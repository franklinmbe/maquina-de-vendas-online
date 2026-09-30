const fs = require('fs');
const path = require('path');
const { loadUsers } = require('./users');
const { decryptToken } = require('./token-crypto');

// Relatório completo (orgânico + Meta Ads) por conta de empresa — pedido do
// Franklin, 2026-09-30: "relatórios do app precisam ser diários", "aba de
// relatórios orgânicos: visualizações, comentários, curtidas, Direct e
// Messenger, relatório completo junto com Meta Ads".
//
// O que a Meta libera HOJE (testado ao vivo em 2026-09-30, app em Acesso
// Padrão, sem as permissões avançadas que dependem do certificado digital):
//   Facebook: seguidores, lista de posts, visualizações de cada vídeo/Reel,
//             conversas do Messenger. NÃO libera curtidas/comentários de post
//             (#10 pages_read_user_content) nem insights da Página (vem vazio).
//   Instagram: seguidores, curtidas e comentários de cada post. NÃO libera
//             visualizações/alcance (#10) nem Direct (#230).
// Ligações não existem na API. O relatório mostra só o que vem de verdade e
// diz o que ainda está bloqueado — nunca inventa número.

const GRAPH = 'https://graph.facebook.com/v21.0/';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const REPORT_DIR = path.join(DATA_DIR, 'relatorios');
const BUNDLED_DIR = path.join(__dirname, 'relatorios');
const PERIODS = [7, 15, 30];
const ORGANIC_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const CONVERSATION_ACTION = 'onsite_conversion.messaging_conversation_started_7d';

// Contas de empresa com relatório. `ads.graph` = o próprio servidor consegue
// ler a conta de anúncio com o token da Página (só a do Franklin); as outras
// chegam por arquivo (RJ Inox: Claude lê no Gerenciador; Kleber: rotina diária
// na nuvem pelo conector de Ads) — ver loadAds.
const CONTAS = {
  rjinox: { nome: 'RJ Inox', pageId: '193486100512300' },
  kleber: { nome: 'Kleber Materiais de Construção', pageId: '620885647774784' },
  frank: { nome: 'Franklin Morais', pageId: '426448331104933', adAccount: 'act_100280640066364' },
};

function contasForClient(client) {
  if (client === 'frank') return Object.keys(CONTAS);
  if (String(client || '').endsWith('-rjinox')) return ['rjinox'];
  if (client === 'kleber-construcao') return ['kleber'];
  return [];
}

async function graph(pathAndQuery, token) {
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}${pathAndQuery}${sep}access_token=${encodeURIComponent(token)}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'Erro na Graph API');
  return json;
}

// Lista paginada, do mais novo pro mais velho, parando quando passa de `sinceMs`.
async function listSince(firstPath, token, dateField, sinceMs, maxPages = 10) {
  const items = [];
  let json = await graph(firstPath, token);
  for (let page = 0; page < maxPages; page += 1) {
    const data = json.data || [];
    items.push(...data);
    const last = data[data.length - 1];
    if (!json.paging || !json.paging.next || !last || Date.parse(last[dateField]) < sinceMs) break;
    const res = await fetch(json.paging.next);
    json = await res.json();
    if (json.error) break;
  }
  return items.filter((i) => Date.parse(i[dateField]) >= sinceMs);
}

async function findPageConnection(pageId) {
  const users = await loadUsers();
  let best = null;
  for (const user of users) {
    const page = (user.connections?.meta?.pages || []).find((p) => p.pageId === pageId);
    if (!page) continue;
    const history = (user.growthHistory || []).filter((s) => s.pageId === pageId || s.pageId === page.instagramBusinessId);
    if (!best || history.length > best.history.length) best = { page, history };
  }
  return best;
}

function growthSince(history, id, field, sinceMs, current) {
  if (current == null) return null;
  const snaps = history.filter((s) => s.pageId === id && s[field] != null).sort((a, b) => a.date.localeCompare(b.date));
  const base = snaps.find((s) => Date.parse(`${s.date}T23:59:59Z`) >= sinceMs) || null;
  if (!base) return null;
  return { desde: base.date, valor: current - base[field] };
}

async function buildOrganic(contaId) {
  const conta = CONTAS[contaId];
  const conn = await findPageConnection(conta.pageId);
  if (!conn) return { erro: 'A Página dessa empresa não está conectada ao app.' };
  const token = decryptToken(conn.page.pageAccessToken);
  const igId = conn.page.instagramBusinessId;
  const now = Date.now();
  const since30 = now - 30 * 86400000;
  const blocked = [];

  const pageInfo = await graph(`${conta.pageId}?fields=name,fan_count,followers_count,talking_about_count,unread_message_count`, token);

  let videos = [];
  let posts = [];
  let conversations = [];
  try { videos = await listSince(`${conta.pageId}/videos?fields=created_time,views,description,permalink_url&limit=100`, token, 'created_time', since30); } catch { blocked.push('Visualizações de vídeo do Facebook'); }
  try { posts = await listSince(`${conta.pageId}/posts?fields=created_time,permalink_url&limit=100`, token, 'created_time', since30); } catch { blocked.push('Posts do Facebook'); }
  let messengerOk = true;
  try { conversations = await listSince(`${conta.pageId}/conversations?fields=updated_time,message_count&limit=100`, token, 'updated_time', since30); } catch {
    // Ex. RJ Inox (2026-09-30): quem conectou a Página não tem a função que dá
    // acesso às mensagens nela (#200) — aparece "—", não 0.
    messengerOk = false;
    blocked.push('Conversas do Messenger: a pessoa que conectou a Página no app não tem acesso às mensagens dessa Página (é preciso reconectar com um administrador que responde as mensagens)');
  }
  // Mesmo vídeo às vezes aparece duas vezes (Reel + cópia dos Stories, a cópia com 0 views).
  videos = [...new Map(videos.map((v) => [v.id, v])).values()];

  let igInfo = null;
  let media = [];
  if (igId) {
    try { igInfo = await graph(`${igId}?fields=username,followers_count,follows_count,media_count`, token); } catch { blocked.push('Seguidores do Instagram'); }
    try { media = await listSince(`${igId}/media?fields=timestamp,media_type,media_product_type,like_count,comments_count,permalink,caption&limit=100`, token, 'timestamp', since30); } catch { blocked.push('Posts do Instagram'); }
  }

  const periodos = {};
  for (const days of PERIODS) {
    const sinceMs = now - days * 86400000;
    const inP = (list, field) => list.filter((i) => Date.parse(i[field]) >= sinceMs);
    const v = inP(videos, 'created_time');
    const m = inP(media, 'timestamp');
    const c = inP(conversations, 'updated_time');
    const short = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    periodos[days] = {
      facebook: {
        posts: inP(posts, 'created_time').length,
        videos: v.length,
        visualizacoesVideos: v.reduce((s, x) => s + (x.views || 0), 0),
        conversasMessenger: messengerOk ? c.length : null,
        mensagensMessenger: messengerOk ? c.reduce((s, x) => s + (x.message_count || 0), 0) : null,
        crescimentoSeguidores: growthSince(conn.history, conta.pageId, 'fans', sinceMs, pageInfo.fan_count),
        topVideos: [...v].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5)
          .map((x) => ({ texto: short(x.description) || 'Vídeo', visualizacoes: x.views || 0, data: x.created_time.slice(0, 10), link: x.permalink_url ? `https://www.facebook.com${x.permalink_url}` : null })),
      },
      instagram: igId ? {
        posts: m.length,
        reels: m.filter((x) => x.media_product_type === 'REELS').length,
        fotos: m.filter((x) => x.media_type === 'IMAGE').length,
        carrosseis: m.filter((x) => x.media_type === 'CAROUSEL_ALBUM').length,
        curtidas: m.reduce((s, x) => s + (x.like_count || 0), 0),
        comentarios: m.reduce((s, x) => s + (x.comments_count || 0), 0),
        crescimentoSeguidores: growthSince(conn.history, igId, 'followers', sinceMs, igInfo?.followers_count),
        topPosts: [...m].sort((a, b) => ((b.like_count || 0) + (b.comments_count || 0)) - ((a.like_count || 0) + (a.comments_count || 0))).slice(0, 5)
          .map((x) => ({ texto: short(x.caption) || 'Post', tipo: x.media_product_type === 'REELS' ? 'Reel' : x.media_type === 'CAROUSEL_ALBUM' ? 'Carrossel' : x.media_type === 'VIDEO' ? 'Vídeo' : 'Foto', curtidas: x.like_count || 0, comentarios: x.comments_count || 0, data: x.timestamp.slice(0, 10), link: x.permalink })),
      } : null,
    };
  }

  return {
    geradoEm: new Date().toISOString(),
    pagina: { nome: pageInfo.name, seguidores: pageInfo.followers_count ?? pageInfo.fan_count, curtidasPagina: pageInfo.fan_count, falandoSobre: pageInfo.talking_about_count, mensagensNaoLidas: pageInfo.unread_message_count },
    instagram: igInfo ? { usuario: igInfo.username, seguidores: igInfo.followers_count, seguindo: igInfo.follows_count, totalPosts: igInfo.media_count } : null,
    periodos,
    indisponivel: [
      ...blocked,
      'Curtidas e comentários de posts do Facebook, alcance e visualizações do Instagram e mensagens do Direct: a Meta só libera depois da aprovação avançada do app (depende do certificado digital)',
      'Ligações: a Meta não fornece esse número',
    ],
  };
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}

function writeReport(name, data) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, name), JSON.stringify(data, null, 2));
}

async function getOrganic(contaId, { force = false } = {}) {
  const file = path.join(REPORT_DIR, `organico-${contaId}.json`);
  const cached = readJson(file);
  if (!force && cached && Date.now() - Date.parse(cached.geradoEm) < ORGANIC_MAX_AGE_MS) return cached;
  try {
    const fresh = await buildOrganic(contaId);
    if (!fresh.erro) writeReport(`organico-${contaId}.json`, fresh);
    return fresh;
  } catch (error) {
    return cached || { erro: `Não consegui ler a Meta agora (${error.message}).` };
  }
}

// Anúncios de uma conta: o arquivo mais novo entre (1) o que o servidor gravou
// em DATA_DIR (conta do Franklin, lida pela API todo dia), (2) o que está na
// `main` do GitHub (RJ Inox/Kleber — atualizar é só commitar o JSON, sem
// precisar republicar o app) e (3) o que veio junto na imagem do app.
const githubCache = new Map();
async function fetchGithubReport(name) {
  const hit = githubCache.get(name);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.data;
  const { GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (!GITHUB_OWNER || !GITHUB_REPO) return null;
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/app/hostnet-server/lib/relatorios/${name}?t=${Date.now()}`);
    const data = res.ok ? await res.json() : null;
    githubCache.set(name, { at: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

async function loadAds(contaId) {
  const name = `campanhas-${contaId}.json`;
  const candidates = [readJson(path.join(REPORT_DIR, name)), await fetchGithubReport(name), readJson(path.join(BUNDLED_DIR, name))].filter(Boolean);
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)))[0];
}

const brDate = (d) => d.split('-').reverse().join('/');

// Conta de anúncio do Franklin: o token da Página dele lê a conta (as outras
// dão #200 — ver CONTAS). Períodos terminam ontem, igual ao Gerenciador.
async function buildGraphAds(contaId) {
  const conta = CONTAS[contaId];
  const conn = await findPageConnection(conta.pageId);
  if (!conn || !conta.adAccount) return null;
  const token = decryptToken(conn.page.pageAccessToken);
  const until = new Date(Date.now() - 3 * 3600000 - 86400000).toISOString().slice(0, 10);
  const periodos = {};
  for (const days of PERIODS) {
    const since = new Date(Date.parse(`${until}T12:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
    const json = await graph(`${conta.adAccount}/insights?level=campaign&fields=campaign_name,spend,reach,actions&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&limit=100`, token);
    const campanhas = (json.data || []).map((row) => {
      const conversas = Number((row.actions || []).find((a) => a.action_type === CONVERSATION_ACTION)?.value || 0);
      const gasto = Number(row.spend || 0);
      return { nome: row.campaign_name, curto: row.campaign_name, conversas, gasto, custo: conversas ? +(gasto / conversas).toFixed(2) : 0, alcance: Number(row.reach || 0) };
    });
    const conversas = campanhas.reduce((s, c) => s + c.conversas, 0);
    const gasto = +campanhas.reduce((s, c) => s + c.gasto, 0).toFixed(2);
    periodos[days] = { rotulo: `Últimos ${days} dias (${brDate(since)} a ${brDate(until)})`, campanhas, total: { conversas, gasto, custo: conversas ? +(gasto / conversas).toFixed(2) : 0 } };
  }
  return {
    atualizadoEm: new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10),
    conta: conta.adAccount.replace('act_', ''),
    fonte: 'Lido automaticamente da conta de anúncios pela API da Meta. Resultado = conversa por mensagem iniciada.',
    vendedores: [],
    periodos,
    sugestoes: periodos[30].total.gasto === 0 ? [{ quem: 'Situação', titulo: 'Nenhuma campanha rodando', texto: 'Nos últimos 30 dias não houve investimento nessa conta de anúncios (campanhas pausadas).' }] : [],
  };
}

// Rodada diária (server.js, 06:00 de Brasília): refaz o orgânico de todas as
// contas e os anúncios que o servidor consegue ler sozinho.
async function runDailyReports() {
  const summary = {};
  for (const contaId of Object.keys(CONTAS)) {
    const organic = await getOrganic(contaId, { force: true });
    summary[contaId] = { organico: organic.erro || 'ok' };
    if (CONTAS[contaId].adAccount) {
      try {
        const ads = await buildGraphAds(contaId);
        if (ads) writeReport(`campanhas-${contaId}.json`, ads);
        summary[contaId].anuncios = ads ? 'ok' : 'sem conexão';
      } catch (error) {
        summary[contaId].anuncios = error.message;
      }
    }
  }
  return summary;
}

module.exports = { CONTAS, contasForClient, getOrganic, loadAds, runDailyReports };
