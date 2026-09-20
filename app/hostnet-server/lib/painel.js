const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { loadUsers } = require('./users');
const { loadLog } = require('./fluxo2-log');
const { loadTips } = require('./fluxo2-tips');
const { loadMap } = require('./mapa-cerebro');
const { pendingForClient } = require('../routes/pending-approvals');

// Painel de controle do admin (Franklin): números do negócio, tarefas e o
// resumo da manhã, tudo montado com dados que o servidor já tem — cadastro de
// usuários, registro do Fluxo 2, dicas do dia, agendamentos, pedidos
// aguardando aprovação e o mapa do cérebro. Nenhum número é inventado: o que
// não existe ainda simplesmente não aparece.

const PLAN_PRICES = { iniciante: 100, profissional: 200, especialista: 300 };
const TRAFEGO_PLANS = ['especialista', 'personalizado'];
const DAY = 24 * 60 * 60 * 1000;

// ---------- tarefas do próprio Franklin ----------
function tarefasFilePath() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado (precisa apontar pra um volume persistente)');
  return path.join(dir, 'painel-tarefas.json');
}

function loadTarefas() {
  const file = tarefasFilePath();
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTarefas(list) {
  const file = tarefasFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpFile = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(list.slice(-300)));
  fs.renameSync(tmpFile, file);
}

function addTarefa(title) {
  const clean = String(title || '').trim().slice(0, 200);
  if (!clean) return { error: 'Escreva a tarefa antes de adicionar', status: 400 };
  const list = loadTarefas();
  const tarefa = { id: crypto.randomBytes(6).toString('hex'), title: clean, done: false, createdAt: new Date().toISOString() };
  list.push(tarefa);
  saveTarefas(list);
  return { tarefa };
}

function toggleTarefa(id) {
  const list = loadTarefas();
  const tarefa = list.find((t) => t.id === id);
  if (!tarefa) return { error: 'Tarefa não encontrada', status: 404 };
  tarefa.done = !tarefa.done;
  tarefa.doneAt = tarefa.done ? new Date().toISOString() : undefined;
  saveTarefas(list);
  return { tarefa };
}

function deleteTarefa(id) {
  const list = loadTarefas();
  const next = list.filter((t) => t.id !== id);
  if (next.length === list.length) return { error: 'Tarefa não encontrada', status: 404 };
  saveTarefas(next);
  return { ok: true };
}

// ---------- apoio ----------
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// "kleber-construcao" -> "Kleber"; "alessandra-rjinox" -> "Alessandra (Rjinox)"
// (o nome cadastrado às vezes vem do e-mail, tipo "Klebernascimentodarocha").
function friendlyName(user) {
  const slug = String(user.client || '');
  if (slug === 'frank') return 'Franklin';
  const parts = slug.split('-');
  if (parts.length > 1 && parts[parts.length - 1] === 'rjinox') return `${cap(parts[0])} (Rjinox)`;
  return cap(parts[0]) || user.name || slug;
}

function brDate(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function brTime(d) {
  return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}

function daysSince(iso, now) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.floor((now - t) / DAY) : null;
}

function countConnections(user) {
  const direct = Object.values(user.connections || {}).reduce((n, v) => n + (Array.isArray(v) ? v.length : v ? 1 : 0), 0);
  const p = user.postizConnections;
  const entries = Array.isArray(p) ? p : p && typeof p === 'object' ? Object.values(p) : [];
  // Canal distinto = integrationId (as 4 vendedoras da Rjinox dividem as mesmas páginas).
  const postizIds = entries.map((e, i) => (e && e.integrationId) || `${user.client}:${(e && e.platform) || i}`);
  return { direct, postizIds };
}

function networkLabels(networks) {
  if (!Array.isArray(networks)) return '';
  return networks
    .map((n) => (typeof n === 'string' ? n : n && (n.platform || n.network || n.name || '')))
    .filter(Boolean)
    .join(', ');
}

// Aprovações pendentes vêm do GitHub (uma ida por pasta de pedido): guarda o
// resultado 5 minutos pra abrir o painel várias vezes não bater na API à toa.
let approvalsCache = { at: 0, value: null };
async function pendingApprovals(users) {
  if (approvalsCache.value && Date.now() - approvalsCache.at < 5 * 60 * 1000) return approvalsCache.value;
  const owner = process.env.GITHUB_OWNER, repo = process.env.GITHUB_REPO, token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) return { items: [], failed: true };
  const withOrders = users.filter((u) => (u.stats && u.stats.totalPedidos) > 0);
  const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), 9000));
  const work = Promise.all(
    withOrders.map(async (u) => {
      try {
        const list = await pendingForClient({ owner, repo, token, client: u.client });
        return list.map((p) => ({ ...p, who: friendlyName(u) }));
      } catch {
        return null;
      }
    })
  );
  const result = await Promise.race([work, timeout]);
  if (result === 'timeout') return { items: [], failed: true };
  const value = { items: result.flat().filter(Boolean), failed: result.some((r) => r === null) };
  approvalsCache = { at: Date.now(), value };
  return value;
}

// ---------- o painel ----------
async function buildPainel() {
  const users = await loadUsers();
  const log = loadLog();
  const tips = loadTips();
  const map = loadMap();
  const now = Date.now();
  const today = brDate();
  const clients = users.filter((u) => u.client !== 'frank');

  // Fluxo 2: última leitura com números de cada cliente + quem já tem registro
  const f2 = {};
  log.forEach((e) => {
    f2[e.client] = f2[e.client] || { events: 0, last: '', metrics: null };
    f2[e.client].events += 1;
    if (e.date > f2[e.client].last) f2[e.client].last = e.date;
    if (e.after && (!f2[e.client].metrics || e.date >= f2[e.client].metricsDate)) {
      f2[e.client].metrics = e.after;
      f2[e.client].metricsDate = e.date;
    }
  });
  let conversas = 0, gasto = 0;
  const conversasPorCliente = [];
  for (const u of users) {
    const m = f2[u.client] && f2[u.client].metrics;
    if (m && Number(m.conversas) > 0) {
      conversas += Number(m.conversas);
      gasto += Number(m.gasto) || 0;
      conversasPorCliente.push({ who: friendlyName(u), conversas: Number(m.conversas), custo: Number(m.custoPorConversa) || null, periodo: m.periodo || '', date: f2[u.client].metricsDate });
    }
  }

  const approvals = await pendingApprovals(users);

  // números grandes
  const ordered = clients.filter((u) => (u.stats && u.stats.totalPedidos) > 0).length;
  const mrr = clients.reduce((n, u) => n + (PLAN_PRICES[u.plan] || 0), 0);
  const planos = {};
  clients.forEach((u) => { planos[u.plan || 'sem plano'] = (planos[u.plan || 'sem plano'] || 0) + 1; });
  const pedidos = clients.reduce((n, u) => n + ((u.stats && u.stats.totalPedidos) || 0), 0);
  const fotos = clients.reduce((n, u) => n + ((u.stats && u.stats.fotos) || 0), 0);
  const videos = clients.reduce((n, u) => n + ((u.stats && u.stats.videos) || 0), 0);
  const postizIds = new Set();
  let direct = 0;
  for (const u of users) {
    const c = countConnections(u);
    direct += c.direct;
    c.postizIds.forEach((id) => postizIds.add(id));
  }
  const conn = { direct, postiz: postizIds.size };

  // tarefas automáticas (derivadas dos dados — somem sozinhas quando resolvidas)
  const auto = [];
  for (const p of approvals.items) {
    const m = String(p.pasta).match(/^app-(\d{4})(\d{2})(\d{2})/);
    const age = m ? daysSince(`${m[1]}-${m[2]}-${m[3]}T12:00:00-03:00`, now) : null;
    auto.push({ id: `ap:${p.client}:${p.pasta}`, origin: 'Aprovação', title: `Pedido de ${p.who} pronto e sem aprovação (${p.mediaCount} mídia${p.mediaCount === 1 ? '' : 's'})`, ageDays: age });
  }
  const nameOf = (slug) => { const u = users.find((x) => x.client === slug); return u ? friendlyName(u) : slug; };
  for (const t of tips.filter((x) => x.status === 'solicitada' || x.status === 'em_andamento')) {
    auto.push({ id: `tip:${t.id}`, origin: t.status === 'em_andamento' ? 'Em andamento' : 'Dica marcada', title: `${nameOf(t.client)}: ${t.title}`, hint: t.agent ? `Quem faz: ${t.agent}` : '', ageDays: daysSince(t.requestedAt || t.createdAt, now) });
  }
  const trafegoClients = clients.filter((u) => TRAFEGO_PLANS.includes(u.plan));
  for (const u of trafegoClients.filter((x) => f2[x.client] && f2[x.client].events > 0)) {
    if (!tips.some((t) => t.client === u.client && t.date === today)) {
      auto.push({ id: `dicas:${u.client}`, origin: 'Rotina do dia', title: `Escrever as dicas de estratégia de hoje pra ${friendlyName(u)}`, hint: 'Quem faz: Claude, com os números da conta' });
    }
  }
  const semRegistro = trafegoClients.filter((u) => !f2[u.client]);
  if (semRegistro.length) {
    auto.push({ id: 'f2-sem-registro', origin: 'Fluxo 2', title: `Sem acesso à conta de anúncios (Fluxo 2 sem registro): ${semRegistro.map(friendlyName).join(', ')}` });
  }
  const nuncaPediu = clients.filter((u) => !((u.stats && u.stats.totalPedidos) > 0) && (daysSince(u.createdAt, now) === null || daysSince(u.createdAt, now) >= 1));
  if (nuncaPediu.length) {
    auto.push({ id: 'nunca-pediu', origin: 'Clientes', title: `${nuncaPediu.length === 1 ? 'Ainda não fez nenhum pedido' : 'Ainda não fizeram nenhum pedido'}: ${nuncaPediu.map(friendlyName).join(', ')}` });
  }
  if (map) {
    for (const a of map.apps.filter((x) => x.status === 'blocked')) auto.push({ id: `map:${a.id}`, origin: 'Projeto', title: `Destravar: ${a.label}`, hint: a.desc });
    for (const r of map.routines.filter((x) => x.status === 'planned')) auto.push({ id: `map:${r.id}`, origin: 'Projeto', title: `Construir: ${r.label}`, hint: r.desc });
  }

  // resumo da manhã
  const agenda = [];
  for (const u of users) {
    for (const p of u.scheduledPosts || []) {
      const d = new Date(p.scheduledFor);
      if (brDate(d) !== today) continue;
      agenda.push({ time: brTime(d), sortKey: d.getTime(), who: friendlyName(u), networks: networkLabels(p.networks), status: p.status || 'pending', what: String(p.instruction || '').slice(0, 90) });
    }
  }
  agenda.sort((a, b) => a.sortKey - b.sortKey);

  const followups = [];
  for (const p of approvals.items) {
    const m = String(p.pasta).match(/^app-(\d{4})(\d{2})(\d{2})/);
    followups.push({ kind: 'Aprovação', who: p.who, what: `${p.mediaCount} mídia${p.mediaCount === 1 ? '' : 's'} pronta${p.mediaCount === 1 ? '' : 's'} esperando o OK`, days: m ? daysSince(`${m[1]}-${m[2]}-${m[3]}T12:00:00-03:00`, now) : null });
  }
  for (const u of clients) {
    const d = daysSince(u.lastLogin, now);
    if (u.lastLogin ? d >= 7 : (daysSince(u.createdAt, now) || 0) >= 7) {
      followups.push({ kind: 'Acompanhar', who: friendlyName(u), what: u.lastLogin ? `não abre o app há ${d} dias` : 'nunca entrou no app', days: u.lastLogin ? d : daysSince(u.createdAt, now) });
    }
  }
  followups.sort((a, b) => (b.days || 0) - (a.days || 0));

  const fluxo2 = trafegoClients.map((u) => ({
    who: friendlyName(u),
    last: f2[u.client] ? f2[u.client].last : null,
    conversas: f2[u.client] && f2[u.client].metrics ? Number(f2[u.client].metrics.conversas) || null : null,
    custo: f2[u.client] && f2[u.client].metrics ? Number(f2[u.client].metrics.custoPorConversa) || null : null,
    dicasHoje: tips.filter((t) => t.client === u.client && t.date === today).length,
  }));

  const manual = loadTarefas();
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    today,
    numbers: {
      clientes: { total: clients.length, fizeramPedido: ordered, planos },
      receita: { mrr, pagantes: clients.filter((u) => PLAN_PRICES[u.plan]).length, personalizados: clients.filter((u) => u.plan === 'personalizado').length },
      pedidos: { total: pedidos, fotos, videos },
      conversas: { total: conversas, custoMedio: conversas ? gasto / conversas : null, porCliente: conversasPorCliente },
      redes: conn,
      tarefas: { automaticas: auto.length, minhas: manual.filter((t) => !t.done).length },
    },
    tarefas: { auto, manual },
    brief: { agenda, followups: followups.slice(0, 12), fluxo2, aprovacoesFalhou: approvals.failed },
  };
}

module.exports = { buildPainel, addTarefa, toggleTarefa, deleteTarefa };
