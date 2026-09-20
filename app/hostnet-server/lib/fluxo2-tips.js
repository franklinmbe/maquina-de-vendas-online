const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Dicas de estratégia do dia (Fluxo 2). O Claude escreve as dicas de cada
// cliente todo dia (POST /api/fluxo2-log com `tips`); o cliente marca a
// caixinha das que quer — isso vira uma tarefa pro agente/skill responsável.
// Marcar NÃO executa nada sozinho: a tarefa entra na fila, e a execução
// acontece na sessão do Fluxo 2 com o Claude, sempre com o OK do Franklin
// antes de qualquer coisa ir ao ar ou mexer em dinheiro.
function tipsFilePath() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado (precisa apontar pra um volume persistente)');
  return path.join(dir, 'fluxo2-tips.json');
}

function loadTips() {
  const file = tipsFilePath();
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf-8');
  if (!content.trim()) return [];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTips(tips) {
  const file = tipsFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpFile = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(tips, null, 2));
  fs.renameSync(tmpFile, file);
}

const CATEGORIES = ['Vendas', 'Engajamento', 'Criativos', 'Público e orçamento', 'Acompanhamento'];
const STATUSES = ['sugerida', 'solicitada', 'em_andamento', 'feita', 'descartada'];

function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function todayInBrazil() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function normalizeTip(client, raw) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String((raw && raw.date) || '')) ? raw.date : todayInBrazil();
  const tip = {
    id: crypto.randomBytes(6).toString('hex'),
    client,
    date,
    category: CATEGORIES.includes(raw && raw.category) ? raw.category : 'Acompanhamento',
    title: text(raw && raw.title, 160),
    detail: text(raw && raw.detail, 1200),
    // Agente ou skill que executa a tarefa quando o cliente marca a caixinha.
    agent: text(raw && raw.agent, 120),
    // Dica que cria anúncio, muda público ou mexe em verba só vai ao ar com o
    // "pode" do Franklin — o cartão avisa isso pro cliente.
    needsApproval: !(raw && raw.needsApproval === false),
    status: 'sugerida',
    createdAt: new Date().toISOString(),
  };
  if (raw && raw.key) tip.key = text(raw.key, 80);
  return tip;
}

// Grava dicas novas. Uma dica com `key` que já existe pro mesmo cliente é
// ignorada — deixa reenviar o mesmo lote sem duplicar.
function addTips(client, rawTips) {
  const tips = loadTips();
  const added = [];
  let skipped = 0;
  for (const raw of rawTips) {
    const key = raw && raw.key ? text(raw.key, 80) : '';
    if ((key && tips.some((t) => t.client === client && t.key === key)) || !text(raw && raw.title, 160)) {
      skipped += 1;
      continue;
    }
    const tip = normalizeTip(client, raw);
    tips.push(tip);
    added.push(tip);
  }
  if (added.length) saveTips(tips);
  return { added, skipped };
}

// O Claude atualiza o andamento de uma tarefa (em andamento, feita, descartada)
// e, quando termina, deixa o resultado escrito.
function updateTips(client, updates) {
  const tips = loadTips();
  let changed = 0;
  for (const update of updates) {
    const tip = tips.find((t) => t.client === client && t.id === (update && update.id));
    if (!tip || !STATUSES.includes(update.status)) continue;
    tip.status = update.status;
    if (update.result != null) tip.result = text(update.result, 800);
    if (update.status === 'feita') tip.doneAt = new Date().toISOString();
    changed += 1;
  }
  if (changed) saveTips(tips);
  return changed;
}

// Cliente (ou admin) marca/desmarca a caixinha. Só dá pra mexer enquanto a
// tarefa ainda não começou: sugerida <-> solicitada.
function setSelected(tipId, selected, actor) {
  const tips = loadTips();
  const tip = tips.find((t) => t.id === tipId);
  if (!tip) return { error: 'Dica não encontrada', status: 404 };

  if (selected) {
    if (tip.status !== 'sugerida') {
      return { error: 'Essa tarefa já foi marcada ou já está em andamento', status: 409 };
    }
    tip.status = 'solicitada';
    tip.requestedAt = new Date().toISOString();
    tip.requestedBy = actor;
  } else {
    if (tip.status !== 'solicitada') {
      return { error: 'Essa tarefa já começou e não dá mais pra desmarcar', status: 409 };
    }
    tip.status = 'sugerida';
    delete tip.requestedAt;
    delete tip.requestedBy;
  }
  saveTips(tips);
  return { tip };
}

module.exports = { loadTips, addTips, updateTips, setSelected, CATEGORIES, STATUSES };
