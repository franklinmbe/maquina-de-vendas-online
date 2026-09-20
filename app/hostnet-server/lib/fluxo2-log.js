const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Registro diário do Fluxo 2 (Gestão de Tráfego / Meta Ads): tudo que é lido,
// pausado, criado ou alterado na conta de anúncios de um cliente vira um
// evento aqui, com data — o cliente vê só o dele, o admin (frank) vê de todos.
// Fica num arquivo JSON próprio em DATA_DIR (mesmo volume persistente do
// users.json), separado de propósito pra não engordar o cadastro de usuários.
// Quem grava é o Claude, na sessão que executa o fluxo, via POST
// /api/fluxo2-log (senha mestra) — o servidor não tem, hoje, acesso próprio à
// conta de anúncios dos clientes pra coletar isso sozinho.
function logFilePath() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado (precisa apontar pra um volume persistente)');
  return path.join(dir, 'fluxo2-log.json');
}

function loadLog() {
  const file = logFilePath();
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf-8');
  if (!text.trim()) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLog(events) {
  const file = logFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpFile = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(events, null, 2));
  fs.renameSync(tmpFile, file);
}

const EVENT_TYPES = ['acesso', 'leitura', 'pausa', 'ativacao', 'criacao', 'orcamento', 'resumo', 'nota'];
const ACTORS = ['Claude', 'Franklin', 'Cliente', 'Sistema'];
const METRIC_KEYS = [
  'anunciosAtivos',
  'anunciosPausados',
  'campanhasAtivas',
  'orcamentoDiario',
  'gasto',
  'conversas',
  'custoPorConversa',
  'periodo',
  'observacao',
];

function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function todayInBrazil() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function cleanMetrics(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out = {};
  for (const key of METRIC_KEYS) {
    const value = raw[key];
    if (value == null || value === '') continue;
    out[key] = typeof value === 'number' ? value : text(value, 120);
  }
  return Object.keys(out).length ? out : undefined;
}

function cleanItems(raw) {
  if (!Array.isArray(raw)) return undefined;
  const items = raw.slice(0, 100).map((item) => ({
    id: text(item && item.id, 40),
    name: text(item && item.name, 140),
    before: text(item && item.before, 60),
    after: text(item && item.after, 60),
    spent: text(item && item.spent, 40),
    conversations: text(item && item.conversations, 20),
    cost: text(item && item.cost, 40),
    note: text(item && item.note, 200),
  }));
  return items.length ? items : undefined;
}

function normalizeEvent(client, raw) {
  const type = EVENT_TYPES.includes(raw && raw.type) ? raw.type : 'nota';
  const by = ACTORS.includes(raw && raw.by) ? raw.by : 'Claude';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw && raw.date)) ? raw.date : todayInBrazil();
  const event = {
    id: crypto.randomBytes(6).toString('hex'),
    client,
    date,
    ts: new Date().toISOString(),
    type,
    by,
    title: text(raw && raw.title, 160),
    detail: text(raw && raw.detail, 2000),
    // 'admin' esconde o evento do cliente (nota interna); o padrão é visível.
    visibility: raw && raw.visibility === 'admin' ? 'admin' : 'cliente',
  };
  if (raw && raw.key) event.key = text(raw.key, 80);
  const items = cleanItems(raw && raw.items);
  if (items) event.items = items;
  const before = cleanMetrics(raw && raw.before);
  if (before) event.before = before;
  const after = cleanMetrics(raw && raw.after);
  if (after) event.after = after;
  return event;
}

// Grava eventos novos. Um evento com `key` que já existe pro mesmo cliente é
// ignorado — deixa reenviar o mesmo lote sem duplicar o histórico.
function appendEvents(client, rawEvents) {
  const log = loadLog();
  const added = [];
  let skipped = 0;
  for (const raw of rawEvents) {
    const key = raw && raw.key ? text(raw.key, 80) : '';
    if (key && log.some((e) => e.client === client && e.key === key)) {
      skipped += 1;
      continue;
    }
    if (!text(raw && raw.title, 160)) {
      skipped += 1;
      continue;
    }
    const event = normalizeEvent(client, raw);
    log.push(event);
    added.push(event);
  }
  if (added.length) saveLog(log);
  return { added, skipped };
}

module.exports = { loadLog, appendEvents, EVENT_TYPES };
