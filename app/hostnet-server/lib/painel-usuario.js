const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { loadLog } = require('./fluxo2-log');
const { loadTips } = require('./fluxo2-tips');
const { decryptToken } = require('./token-crypto');
const { getPageWeeklyInsights, getInstagramWeeklyInsights, getInstagramTopPosts, getFollowerCounts } = require('./meta');
const { PLAN_MEDIA_LIMITS, TRIAL_MEDIA_LIMITS } = require('./media-quota');
const { PLAN_POST_LIMITS } = require('./post-quota');
const { PLAN_CALL_LIMITS } = require('./call-limit');
const { platformAllowedForPlan } = require('./plan-limits');
const { pendingForClient } = require('../routes/pending-approvals');

// Painel de controle do USUÁRIO: as métricas mais importantes das redes
// sociais + as métricas de uso do aplicativo, montado só com os dados dele.
// Não mostra nada financeiro da empresa (faturamento, receita) — isso fica só
// no painel do admin (lib/painel.js).
//
// Métricas do Meta: já está tudo ligado. Enquanto o Meta não libera o acesso
// avançado (depende do certificado digital), a API responde sem erro mas sem
// dados; o painel percebe isso (`hasData` em lib/meta.js) e mostra "aguardando
// o Meta". No dia em que liberar, os números aparecem sozinhos — sem deploy.

const DAY = 24 * 60 * 60 * 1000;
const TRAFEGO_PLANS = ['especialista', 'personalizado'];
const PLAN_NAMES = { teste7dias: 'Teste Grátis 7 Dias', iniciante: 'Iniciante', profissional: 'Profissional', especialista: 'Especialista', personalizado: 'Personalizado', 'aplicativo-saas': 'Aplicativos ou SaaS' };

// ---------- tarefas do próprio usuário (isoladas por cliente) ----------
function tarefasFilePath() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado (precisa apontar pra um volume persistente)');
  return path.join(dir, 'painel-tarefas-usuarios.json');
}

function loadAllTarefas() {
  const file = tarefasFilePath();
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllTarefas(list) {
  const file = tarefasFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpFile = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(list.slice(-3000)));
  fs.renameSync(tmpFile, file);
}

const tarefasDe = (client) => loadAllTarefas().filter((t) => t.client === client);

function addUserTarefa(client, title) {
  const clean = String(title || '').trim().slice(0, 200);
  if (!clean) return { error: 'Escreva a tarefa antes de adicionar', status: 400 };
  const all = loadAllTarefas();
  if (all.filter((t) => t.client === client && !t.done).length >= 40) return { error: 'Você já tem 40 tarefas abertas. Conclua ou apague algumas.', status: 400 };
  all.push({ id: crypto.randomBytes(6).toString('hex'), client, title: clean, done: false, createdAt: new Date().toISOString() });
  saveAllTarefas(all);
  return { ok: true };
}

// Toda mudança confere que a tarefa é DESTE cliente — id de outra pessoa não acha nada.
function toggleUserTarefa(client, id) {
  const all = loadAllTarefas();
  const t = all.find((x) => x.id === id && x.client === client);
  if (!t) return { error: 'Tarefa não encontrada', status: 404 };
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : undefined;
  saveAllTarefas(all);
  return { ok: true };
}

function deleteUserTarefa(client, id) {
  const all = loadAllTarefas();
  const next = all.filter((x) => !(x.id === id && x.client === client));
  if (next.length === all.length) return { error: 'Tarefa não encontrada', status: 404 };
  saveAllTarefas(next);
  return { ok: true };
}

// ---------- tempo (Brasília) ----------
function brParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  return Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
}
const brDate = (d) => { const p = brParts(d); return `${p.year}-${p.month}-${p.day}`; };
const brTime = (d) => d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const daysSince = (iso, now) => { const t = iso ? new Date(iso).getTime() : NaN; return Number.isFinite(t) ? Math.floor((now - t) / DAY) : null; };

// ---------- uso do app: cotas do plano ----------
function mediaView(user) {
  if (user.plan === 'teste7dias') {
    const used = user.trialMediaUsed || {};
    const ends = user.createdAt ? new Date(new Date(user.createdAt).getTime() + 7 * DAY) : null;
    return { periodo: 'teste de 7 dias', ate: ends ? ends.toISOString().slice(0, 10) : null, images: { used: used.images || 0, limit: TRIAL_MEDIA_LIMITS.images }, videos: { used: used.videos || 0, limit: TRIAL_MEDIA_LIMITS.videos } };
  }
  const limits = PLAN_MEDIA_LIMITS[user.plan];
  if (!limits) return null;
  const p = brParts();
  const key = `${p.year}-${p.month}`;
  const bucket = user.mediaWindow && user.mediaWindow.key === key ? user.mediaWindow : {};
  return { periodo: 'mês', images: { used: bucket.images || 0, limit: limits.images }, videos: { used: bucket.videos || 0, limit: limits.videos } };
}

function postsView(user) {
  const limits = PLAN_POST_LIMITS[user.plan];
  if (!limits) return null;
  const p = brParts();
  const day = user.postDayWindow && user.postDayWindow.key === `${p.year}-${p.month}-${p.day}` ? user.postDayWindow.count : 0;
  const month = user.postWindow && user.postWindow.key === `${p.year}-${p.month}` ? user.postWindow.count : 0;
  return { dia: { used: day, limit: limits.perDay }, mes: { used: month, limit: limits.perMonth } };
}

function chamadasView(user) {
  const limit = PLAN_CALL_LIMITS[user.plan];
  if (!limit) return null;
  const p = brParts();
  const hour = Number(p.hour);
  const period = hour < 12 ? 'manha' : hour < 18 ? 'tarde' : 'noite';
  const key = `${p.year}-${p.month}-${p.day}-${period}`;
  const used = user.callWindow && user.callWindow.key === key ? user.callWindow.count : 0;
  return { janela: { manha: 'manhã', tarde: 'tarde', noite: 'noite' }[period], used, limit };
}

// ---------- métricas do Meta (Facebook + Instagram) ----------
const metaCache = new Map();
const range7 = () => { const until = Math.floor(Date.now() / 1000); return { since: until - 7 * 24 * 60 * 60, until }; };
const isPermission = (e) => /permission|scope|OAuthException/i.test(String((e && e.message) || ''));

async function fetchMeta(user) {
  const pages = (user.connections && user.connections.meta && Array.isArray(user.connections.meta.pages)) ? user.connections.meta.pages : [];
  if (!pages.length) return { estado: 'sem-conexao', paginas: [] };
  const range = range7();
  const paginas = [];
  let anyPermission = false;
  let anyData = false;
  for (const page of pages) {
    const entry = { pageId: page.pageId, pageName: page.pageName, instagramUsername: page.instagramUsername || null, temInstagram: !!page.instagramBusinessId };
    let token;
    try {
      token = decryptToken(page.pageAccessToken);
    } catch {
      anyPermission = true; // token antigo: precisa reconectar
      paginas.push(entry);
      continue;
    }
    // seguidores vêm do acesso básico: aparecem mesmo com as métricas avançadas bloqueadas
    entry.basico = await getFollowerCounts(token, page.pageId, page.instagramBusinessId).catch(() => null);
    try {
      entry.facebook = await getPageWeeklyInsights(token, page.pageId, range);
      if (entry.facebook.hasData) anyData = true;
    } catch (e) {
      if (isPermission(e)) anyPermission = true;
    }
    if (page.instagramBusinessId) {
      try {
        entry.instagram = await getInstagramWeeklyInsights(token, page.instagramBusinessId, range);
        if (entry.instagram.hasData) anyData = true;
      } catch (e) {
        if (isPermission(e)) anyPermission = true;
      }
      try {
        // curtidas e comentários vêm do acesso básico: aparecem mesmo antes da liberação avançada
        entry.topPosts = (await getInstagramTopPosts(token, page.instagramBusinessId, 3)).map((p) => ({
          link: p.permalink, tipo: p.media_type, data: String(p.timestamp || '').slice(0, 10), legenda: String(p.caption || '').slice(0, 90), curtidas: p.likes || 0, comentarios: p.comments || 0,
        }));
      } catch {
        // sem posts ou sem acesso: segue sem essa lista
      }
    }
    paginas.push(entry);
  }
  const algumaCarregou = paginas.some((p) => p.facebook || p.instagram);
  const estado = anyData ? 'ok' : algumaCarregou ? 'aguardando-meta' : anyPermission ? 'permissao' : 'aguardando-meta';
  return { estado, paginas };
}

async function metaForUser(user) {
  const hit = metaCache.get(user.client);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.value;
  const timeout = new Promise((resolve) => setTimeout(() => resolve({ estado: 'demorou', paginas: [] }), 14000));
  let value;
  try {
    value = await Promise.race([fetchMeta(user), timeout]);
  } catch {
    value = { estado: 'demorou', paginas: [] };
  }
  if (value.estado !== 'demorou') metaCache.set(user.client, { at: Date.now(), value });
  return value;
}

function growthSummary(user) {
  const byPage = {};
  (user.growthHistory || []).forEach((s) => { (byPage[s.pageId] = byPage[s.pageId] || []).push(s); });
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString().slice(0, 10);
  let total = 0, delta = 0, hasDelta = false, any = false;
  for (const list of Object.values(byPage)) {
    list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const last = list[list.length - 1];
    const val = last.fans != null ? last.fans : last.followers;
    if (val == null) continue;
    total += val; any = true;
    const base = [...list].reverse().find((s) => s.date <= weekAgo);
    const b = base ? (base.fans != null ? base.fans : base.followers) : null;
    if (b != null) { delta += val - b; hasDelta = true; }
  }
  return any ? { total, delta: hasDelta ? delta : null } : null;
}

// ---------- aprovações pendentes do próprio cliente (GitHub, cache de 5 min) ----------
const approvalsCache = new Map();
async function pendingOwn(client) {
  const hit = approvalsCache.get(client);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;
  const owner = process.env.GITHUB_OWNER, repo = process.env.GITHUB_REPO, token = process.env.GITHUB_TOKEN;
  let value = { items: [], failed: true };
  if (owner && repo && token) {
    try {
      const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), 8000));
      const r = await Promise.race([pendingForClient({ owner, repo, token, client }), timeout]);
      value = r === 'timeout' ? { items: [], failed: true } : { items: r, failed: false };
    } catch {
      value = { items: [], failed: true };
    }
  }
  if (!value.failed) approvalsCache.set(client, { at: Date.now(), value });
  return value;
}

// ---------- o painel ----------
const OTHER_NETS = [
  { id: 'tiktok', label: 'TikTok', platform: 'tiktok' },
  { id: 'youtube', label: 'YouTube', platform: 'youtube' },
  { id: 'telegram', label: 'Telegram', platform: 'telegram' },
  { id: 'wordpress', label: 'WordPress', platform: 'wordpress' },
];

async function buildUserPanel(user) {
  const client = user.client;
  const plan = user.plan || '';
  const isAdminUser = client === 'frank';
  const hasTrafego = isAdminUser || TRAFEGO_PLANS.includes(plan);
  const now = Date.now();
  const today = brDate(new Date());
  const stats = user.stats || {};
  const conn = user.connections || {};
  const postiz = new Set((Array.isArray(user.postizConnections) ? user.postizConnections : []).map((p) => p && p.platform));
  const events = loadLog().filter((e) => e.client === client && e.visibility !== 'admin');
  const tips = loadTips().filter((t) => t.client === client);

  const [meta, approvals] = await Promise.all([metaForUser(user), pendingOwn(client)]);
  const growth = growthSummary(user);

  // ---- redes ----
  const redes = [];
  if (meta.paginas.length) {
    for (const p of meta.paginas) {
      const fb = p.facebook, ig = p.instagram;
      redes.push({
        id: `facebook:${p.pageId}`, nome: 'Facebook', detalhe: p.pageName || '', conexao: 'direta',
        seguidores: fb ? fb.fans : p.basico ? p.basico.fans : null,
        estado: fb ? (fb.hasData ? 'ok' : 'aguardando-meta') : meta.estado === 'permissao' ? 'permissao' : 'aguardando-meta',
        metricas: fb && fb.hasData ? { visualizacoes: fb.impressions, interacoes: fb.postEngagements, visitas: fb.pageViews } : null,
        serie: fb && fb.hasData ? fb.impressionsSeries : null,
      });
      if (p.temInstagram) {
        const cliques = ig ? [ig.websiteClicks, ig.directionsClicks, ig.callClicks, ig.emailContacts, ig.textClicks].reduce((s, v) => s + (Number(v) || 0), 0) : null;
        redes.push({
          id: `instagram:${p.pageId}`, nome: 'Instagram', detalhe: p.instagramUsername ? `@${p.instagramUsername}` : '', conexao: 'direta',
          seguidores: ig ? ig.followers : p.basico ? p.basico.followers : null,
          estado: ig ? (ig.hasData ? 'ok' : 'aguardando-meta') : meta.estado === 'permissao' ? 'permissao' : 'aguardando-meta',
          metricas: ig && ig.hasData ? { alcance: ig.reach, visualizacoes: ig.impressions, visitas: ig.profileViews, cliques } : null,
          serie: ig && ig.hasData ? ig.reachSeries : null,
          topPosts: p.topPosts || [],
        });
      }
    }
  } else {
    for (const n of [{ id: 'facebook', label: 'Facebook' }, { id: 'instagram', label: 'Instagram' }]) {
      const viaEquipe = postiz.has(n.id);
      redes.push({ id: n.id, nome: n.label, detalhe: '', conexao: viaEquipe ? 'equipe' : 'nenhuma', seguidores: null, estado: viaEquipe ? 'sem-conexao' : 'nao-conectada', metricas: null });
    }
  }
  for (const n of OTHER_NETS) {
    const direta = n.id === 'tiktok' ? Array.isArray(conn.tiktok) && conn.tiktok.length > 0 : !!conn[n.id];
    const viaEquipe = postiz.has(n.id);
    const foraDoPlano = !isAdminUser && !platformAllowedForPlan(plan, n.platform);
    redes.push({ id: n.id, nome: n.label, detalhe: '', conexao: direta ? 'direta' : viaEquipe ? 'equipe' : foraDoPlano ? 'fora-do-plano' : 'nenhuma', seguidores: null, estado: direta || viaEquipe ? 'em-breve' : foraDoPlano ? 'fora-do-plano' : 'nao-conectada', metricas: null });
  }

  // ---- números grandes das redes ----
  // seguidores: das métricas quando vieram, senão do acesso básico (que já funciona hoje)
  const liveFans = (p) => (p.facebook ? p.facebook.fans : p.basico ? p.basico.fans : null);
  const liveFollowers = (p) => (p.instagram ? p.instagram.followers : p.basico ? p.basico.followers : null);
  const haveLive = meta.paginas.some((p) => liveFans(p) != null || liveFollowers(p) != null);
  const live = meta.paginas.reduce((s, p) => s + (liveFans(p) || 0) + (liveFollowers(p) || 0), 0);
  const seguidoresTotal = haveLive ? live : growth ? growth.total : null;
  const sum = (fn) => meta.paginas.reduce((s, p) => s + (fn(p) || 0), 0);
  const okData = meta.estado === 'ok';
  const numbers = {
    seguidores: seguidoresTotal == null ? null : { valor: seguidoresTotal, delta7d: growth ? growth.delta : null },
    visualizacoes: okData ? { valor: sum((p) => (p.facebook && p.facebook.hasData ? p.facebook.impressions : 0)) + sum((p) => (p.instagram && p.instagram.hasData ? p.instagram.impressions : 0)) } : null,
    alcance: okData && meta.paginas.some((p) => p.instagram && p.instagram.hasData) ? { valor: sum((p) => (p.instagram && p.instagram.hasData ? p.instagram.reach : 0)) } : null,
    interacoes: okData && meta.paginas.some((p) => p.facebook && p.facebook.hasData) ? { valor: sum((p) => (p.facebook && p.facebook.hasData ? p.facebook.postEngagements : 0)) } : null,
  };

  // ---- uso do app ----
  const midia = mediaView(user);
  const posts = postsView(user);
  const chamadas = chamadasView(user);
  const agendadosPendentes = (user.scheduledPosts || []).filter((p) => p.status === 'pending');
  const pct = (q) => (q && q.limit ? Math.round((q.used / q.limit) * 100) : 0);
  const cotas = [];
  if (midia) cotas.push({ nome: 'Imagens por IA', ...midia.images, pct: pct(midia.images), periodo: midia.periodo }, { nome: 'Vídeos por IA', ...midia.videos, pct: pct(midia.videos), periodo: midia.periodo });
  if (posts) cotas.push({ nome: 'Posts hoje', ...posts.dia, pct: pct(posts.dia), periodo: 'dia' }, { nome: 'Posts no mês', ...posts.mes, pct: pct(posts.mes), periodo: 'mês' });
  if (chamadas) cotas.push({ nome: `Chamadas com a IA (${chamadas.janela})`, used: chamadas.used, limit: chamadas.limit, pct: pct(chamadas), periodo: 'janela' });
  const uso = {
    pedidos: { enviados: stats.totalPedidos || 0, fotos: stats.fotos || 0, videos: stats.videos || 0, ultimo: stats.lastRequestAt || null },
    acessos: { total: user.loginCount || 0, ultimo: user.lastLogin || null },
    cotas,
    semLimite: cotas.length === 0,
    agendados: agendadosPendentes.length,
  };
  const maisApertada = cotas.slice().sort((a, b) => b.pct - a.pct)[0] || null;
  numbers.plano = maisApertada ? { pct: maisApertada.pct, nome: maisApertada.nome, used: maisApertada.used, limit: maisApertada.limit } : null;
  numbers.pedidos = { total: uso.pedidos.enviados, fotos: uso.pedidos.fotos, videos: uso.pedidos.videos };

  // ---- tarefas do sistema (só as deste cliente) ----
  const auto = [];
  for (const p of approvals.items) {
    const m = String(p.pasta).match(/^app-(\d{4})(\d{2})(\d{2})/);
    auto.push({ id: `ap:${p.pasta}`, origem: 'Aprovação', titulo: `Seu pedido está pronto e espera o seu OK (${p.mediaCount} mídia${p.mediaCount === 1 ? '' : 's'})`, dias: m ? daysSince(`${m[1]}-${m[2]}-${m[3]}T12:00:00-03:00`, now) : null });
  }
  const totalRedes = redes.filter((r) => r.conexao === 'direta' || r.conexao === 'equipe').length;
  if (!totalRedes) auto.push({ id: 'conectar', origem: 'Redes', titulo: 'Conecte a sua primeira rede social na aba Redes pra começar a publicar' });
  else if (!meta.paginas.length && redes.some((r) => r.conexao === 'equipe' && (r.id === 'facebook' || r.id === 'instagram'))) {
    auto.push({ id: 'conectar-meta', origem: 'Métricas', titulo: 'Conecte o Facebook e o Instagram direto pelo app pra ver aqui as métricas das suas páginas', dica: 'Hoje a nossa equipe publica por você; conectando direto, o painel puxa os números sozinho.' });
  }
  if (meta.estado === 'permissao') auto.push({ id: 'reconectar', origem: 'Métricas', titulo: 'Reconecte o Facebook/Instagram na aba Redes pra liberar as métricas' });
  const dicasAbertas = tips.filter((t) => t.date === today && t.status === 'sugerida').length;
  if (dicasAbertas) auto.push({ id: 'dicas', origem: 'Estratégia', titulo: `Você tem ${dicasAbertas} dica${dicasAbertas === 1 ? '' : 's'} de estratégia do dia esperando`, dica: 'Marque as que você quer em Ajustes → Meu fluxo de tráfego.' });
  for (const t of tips.filter((x) => x.status === 'solicitada' || x.status === 'em_andamento')) {
    auto.push({ id: `tip:${t.id}`, origem: t.status === 'em_andamento' ? 'Em andamento' : 'Dica marcada', titulo: t.title, dica: t.agent ? `Quem faz: ${t.agent}` : '', dias: daysSince(t.requestedAt || t.createdAt, now) });
  }
  const dEnv = daysSince(stats.lastRequestAt, now);
  if ((stats.totalPedidos || 0) > 0 && dEnv != null && dEnv >= 7) auto.push({ id: 'sem-pedido', origem: 'Conteúdo', titulo: `Faz ${dEnv} dias que você não envia um pedido. Que tal postar algo novo?`, dias: dEnv });
  for (const c of cotas.filter((x) => x.pct >= 80 && x.limit)) auto.push({ id: `cota:${c.nome}`, origem: 'Plano', titulo: `${c.nome}: você já usou ${c.used} de ${c.limit}`, dica: 'Peça upgrade pela IA (Suporte) se precisar de mais.' });

  // ---- resumo do dia ----
  const agenda = [];
  for (const p of user.scheduledPosts || []) {
    const d = new Date(p.scheduledFor);
    if (brDate(d) !== today) continue;
    agenda.push({ hora: brTime(d), sortKey: d.getTime(), oQue: String(p.instruction || '').slice(0, 90), status: p.status || 'pending' });
  }
  agenda.sort((a, b) => a.sortKey - b.sortKey);
  let fluxo2 = null;
  if (hasTrafego) {
    const last = events.reduce((m, e) => (e.date > m ? e.date : m), '');
    const withMetrics = events.filter((e) => e.after && e.after.conversas).sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
    fluxo2 = { ultimoRegistro: last || null, conversas: withMetrics ? Number(withMetrics.after.conversas) || null : null, custo: withMetrics ? Number(withMetrics.after.custoPorConversa) || null : null, dicasHoje: tips.filter((t) => t.date === today).length };
  }

  return {
    generatedAt: new Date().toISOString(),
    today,
    plano: { id: plan, nome: PLAN_NAMES[plan] || '' },
    meta: { estado: meta.estado },
    numbers,
    redes,
    uso,
    tarefas: { auto, manual: tarefasDe(client) },
    brief: { agenda, aprovacoes: approvals.items.length, aprovacoesFalhou: approvals.failed, fluxo2 },
  };
}

// Sensor da liberação do Meta, usado pelo painel do admin: olha a página
// conectada do próprio Franklin. 'aguardando-meta' = o Meta ainda não liberou;
// 'ok' = liberou (a tarefa "aguardando o certificado" some sozinha).
// Versão LEVE (só as métricas da primeira página, em paralelo, com teto de 7 s
// e cache de 10 min): pro sensor basta saber se o Meta já responde com dados —
// buscar também os posts do Instagram um por um deixava a primeira abertura
// da página de pendências com quase 10 segundos.
const sensorCache = new Map();
async function metaSensor(user) {
  if (!user) return null;
  const hit = sensorCache.get(user.client);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.value;
  const pages = (user.connections && user.connections.meta && Array.isArray(user.connections.meta.pages)) ? user.connections.meta.pages : [];
  if (!pages.length) return 'sem-conexao';
  const page = pages[0];
  let token;
  try {
    token = decryptToken(page.pageAccessToken);
  } catch {
    return 'permissao';
  }
  const range = range7();
  const work = Promise.allSettled([
    getPageWeeklyInsights(token, page.pageId, range),
    page.instagramBusinessId ? getInstagramWeeklyInsights(token, page.instagramBusinessId, range) : Promise.reject(new Error('sem instagram')),
  ]).then((results) => {
    const ok = results.filter((r) => r.status === 'fulfilled');
    if (ok.some((r) => r.value && r.value.hasData)) return 'ok';
    if (ok.length) return 'aguardando-meta';
    return results.some((r) => r.status === 'rejected' && isPermission(r.reason)) ? 'permissao' : 'aguardando-meta';
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve('demorou'), 7000));
  const value = await Promise.race([work, timeout]);
  if (value !== 'demorou') sensorCache.set(user.client, { at: Date.now(), value });
  return value;
}

// Só pra testes: limpa o cache de 10 minutos das métricas do Meta.
const __resetCache = () => { metaCache.clear(); approvalsCache.clear(); sensorCache.clear(); };

module.exports = { buildUserPanel, addUserTarefa, toggleUserTarefa, deleteUserTarefa, metaSensor, __resetCache };
