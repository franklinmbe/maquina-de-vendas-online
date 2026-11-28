const fs = require('fs');
const path = require('path');
const { loadUsers } = require('./users');
const { decryptToken } = require('./token-crypto');

// Saldo da conta de anúncios (Meta Ads) de cada usuário — pedido do Franklin,
// 26/11/2026: "todos os usuários precisam ver quanto tem de crédito", com um
// botão pra atualizar na hora e atualização sozinha depois de cada postagem.
//
// O que a Meta devolve (testado ao vivo em 26/11):
//   conta pré-paga (Pix/boleto): is_prepay_account=true e
//     funding_source_details.display_string = "Saldo disponível (570,62 R$ (BRL))"
//   conta com cartão: is_prepay_account=false, display_string = "VISA *0292",
//     balance = gasto ainda não cobrado (centavos).
// O número vem sempre da Meta; quando não dá pra ler, mostra o motivo, nunca inventa.

const GRAPH = 'https://graph.facebook.com/v21.0/';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'relatorios', 'saldo-anuncios.json');
const MIN_REFRESH_MS = 60 * 1000; // botão "Atualizar agora": no máximo 1 leitura por minuto por conta
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // ao abrir a tela, relê se tiver mais de 6 h
// Depois de postar: a Meta demora pra lançar o gasto, então lê duas vezes.
const AFTER_POST_DELAYS = [5 * 60 * 1000, 60 * 60 * 1000];
const SALDO_BAIXO = 20;

// Contas de anúncio que o usuário não conectou com o próprio Facebook, mas que
// o servidor lê por outra conexão (ex.: RJ Inox, lida pelo token do Franklin).
const EXTRA_POR_CLIENTE = [
  { match: (c) => String(c || '').endsWith('-rjinox'), act: '240820228908164' },
  { match: (c) => c === 'kleber-construcao', act: '1015471806745415' },
];
// Conta do relatório completo (lib/relatorio-completo.js CONTAS) → conta de anúncio.
// Nome que o cliente reconhece (na Meta a conta da RJ Inox se chama "Anderson Pujol").
const NOME_CONTA = { '240820228908164': 'RJ Inox' };
const ACT_POR_CONTA = { rjinox: '240820228908164', kleber: '1015471806745415', frank: '100280640066364', aleslux: '3821358748006576' };

function readCache() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')); } catch { return {}; }
}
function writeCache(cache) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
  } catch { /* sem disco: só não guarda */ }
}

const adsOf = (u) => (u && u.connections && u.connections.meta && u.connections.meta.ads) || null;

// Contas de anúncio que esse usuário vê. Admin vê as dele (ativas).
function contasDoCliente(users, client) {
  const user = users.find((u) => u && u.client === client);
  const own = ((adsOf(user) || {}).adAccounts || []).filter((a) => a.status === 1).map((a) => String(a.id));
  const extra = EXTRA_POR_CLIENTE.filter((e) => e.match(client)).map((e) => e.act);
  return [...new Set([...own, ...extra])];
}

// Token que consegue ler a conta: primeiro o de quem é dono dela, depois qualquer
// conexão de anúncios que tenha a conta na lista.
function tokenFor(users, act, preferClient) {
  const has = (u) => ((adsOf(u) || {}).adAccounts || []).some((a) => String(a.id) === act);
  const ordered = [...users.filter((u) => u && u.client === preferClient), ...users.filter((u) => u && u.client !== preferClient)];
  const u = ordered.find((x) => has(x) && adsOf(x).userAccessToken);
  if (!u) return null;
  try { return decryptToken(adsOf(u).userAccessToken); } catch { return null; }
}

function parseValor(str) {
  const m = String(str || '').match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
  return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null;
}

async function lerConta(users, act, preferClient) {
  const token = tokenFor(users, act, preferClient);
  if (!token) return { act, erro: 'A conta de anúncios não está liberada pro app. Conecte o Facebook de novo marcando a permissão de anúncios.', atualizadoEm: new Date().toISOString() };
  const res = await fetch(`${GRAPH}act_${act}?fields=name,currency,balance,amount_spent,spend_cap,is_prepay_account,account_status,funding_source_details{display_string,type}&access_token=${encodeURIComponent(token)}`);
  const j = await res.json();
  if (j.error) return { act, erro: `A Meta não deixou ler o saldo agora (${j.error.message}).`, atualizadoEm: new Date().toISOString() };
  const fsd = j.funding_source_details || {};
  const out = {
    act,
    nome: NOME_CONTA[act] || j.name,
    moeda: j.currency || 'BRL',
    ativa: j.account_status === 1,
    prePaga: !!j.is_prepay_account,
    gastoTotal: Number(j.amount_spent || 0) / 100,
    atualizadoEm: new Date().toISOString(),
  };
  if (out.prePaga) {
    out.saldo = parseValor(fsd.display_string);
    out.baixo = out.saldo != null && out.saldo < SALDO_BAIXO;
  } else {
    out.pagamento = fsd.display_string || null; // ex.: "VISA *0292"
    out.aCobrar = Number(j.balance || 0) / 100;
    const cap = Number(j.spend_cap || 0) / 100;
    if (cap > 0) out.limiteRestante = Math.max(0, +(cap - out.gastoTotal).toFixed(2));
  }
  return out;
}

// Lê (ou devolve do cache) o saldo de cada conta. force = botão/depois de postar.
async function saldoDoCliente(client, { force = false, contaRelatorio = null } = {}) {
  const users = await loadUsers();
  let acts = contasDoCliente(users, client);
  if (contaRelatorio && ACT_POR_CONTA[contaRelatorio]) acts = [ACT_POR_CONTA[contaRelatorio]];
  const cache = readCache();
  const now = Date.now();
  const contas = [];
  let changed = false;
  for (const act of acts) {
    const hit = cache[act];
    const age = hit ? now - Date.parse(hit.atualizadoEm) : Infinity;
    if (hit && (age < MIN_REFRESH_MS || (!force && age < MAX_AGE_MS))) { contas.push(hit); continue; }
    try {
      const fresh = await lerConta(users, act, client);
      // erro de leitura não apaga o último número bom
      if (fresh.erro && hit && !hit.erro) contas.push({ ...hit, aviso: fresh.erro });
      else { cache[act] = fresh; changed = true; contas.push(fresh); }
    } catch (e) {
      contas.push(hit ? { ...hit, aviso: 'Sem conexão com a Meta agora.' } : { act, erro: 'Sem conexão com a Meta agora.' });
    }
  }
  if (changed) writeCache(cache);
  return { contas, proximaAtualizacao: proximas.get(client) || null };
}

// Depois de uma postagem com sucesso: relê o saldo daqui a 5 min e daqui a 1 h.
const timers = new Map();
const proximas = new Map();
function atualizarDepoisDePostar(client) {
  if (!client) return;
  (timers.get(client) || []).forEach(clearTimeout);
  const list = AFTER_POST_DELAYS.map((ms, i) => {
    const t = setTimeout(() => {
      saldoDoCliente(client, { force: true }).catch(() => {});
      if (i === AFTER_POST_DELAYS.length - 1) { proximas.delete(client); timers.delete(client); }
      else proximas.set(client, new Date(Date.now() + AFTER_POST_DELAYS[i + 1] - ms).toISOString());
    }, ms);
    if (t.unref) t.unref();
    return t;
  });
  timers.set(client, list);
  proximas.set(client, new Date(Date.now() + AFTER_POST_DELAYS[0]).toISOString());
}

// Rodada diária (06:00): relê o saldo de todo mundo que tem conta de anúncio.
async function atualizarTodos() {
  const users = await loadUsers();
  const out = {};
  for (const u of users) {
    if (!u || !u.client || contasDoCliente(users, u.client).length === 0) continue;
    try { out[u.client] = (await saldoDoCliente(u.client, { force: true })).contas.length; } catch (e) { out[u.client] = e.message; }
  }
  return out;
}

module.exports = { saldoDoCliente, atualizarDepoisDePostar, atualizarTodos };
