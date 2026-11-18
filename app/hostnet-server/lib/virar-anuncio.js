// "Virar anúncio" (Franklin, 2026-11-18): o cliente escolhe no app uma
// postagem dele (feed do Instagram) e ela entra nos anúncios do Meta dele,
// sem ele escolher campanha ("o cliente não entende de campanha, a regra é
// você que decide"). A regra é a mesma que o Claude usa à mão hoje:
//  - vai pra campanha ATIVA que está "precisando mais" = a que gastou mais
//    por conversa nos últimos 7 dias (gastou e não trouxe conversa conta
//    como a pior de todas);
//  - dentro dela, no conjunto ativo que mais gastou;
//  - copia o CTA do melhor anúncio desse conjunto (menor custo por conversa
//    em 30 dias), troca só a postagem e dá o mesmo nome com a data de hoje;
//  - no máximo 10 anúncios ativos por conjunto: passou disso, pausa o pior
//    (maior custo por conversa em 30 dias, com mais de 3 dias de vida);
//  - NUNCA mexe em orçamento.
// Usa só posts do Instagram: posts do Facebook não aceitam o botão de
// WhatsApp (erro #4469908 "CTA não corresponde", achado na conta da Ale).
// Só funciona pra quem conectou o Facebook no app com permissão de anúncios
// (connections.meta.ads) — enquanto a Revisão do App da Meta não aprovar
// ads_management, isso é só quem tem função no app (ex: testadores).
const fs = require('fs/promises');
const path = require('path');
const { decryptToken } = require('./token-crypto');

const GRAPH = 'https://graph.facebook.com/v21.0';
const MAX_ATIVOS = 10;
const LIMITE_DIA = 5;
const CONVERSA = 'onsite_conversion.messaging_conversation_started_7d';
const LOG_FILE = () => path.join(process.env.DATA_DIR || '/data', 'virar-anuncio-log.json');

async function graph(method, p, params, token) {
  const url = new URL(GRAPH + p);
  const opts = { method, signal: AbortSignal.timeout(45000) };
  const all = { ...(params || {}), access_token: token };
  if (method === 'GET') {
    for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);
  } else {
    opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    opts.body = new URLSearchParams(all).toString();
  }
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = j.error || {};
    const msg = e.error_user_msg || e.message || `HTTP ${r.status}`;
    const err = new Error(`${msg}${e.code ? ` (#${e.code})` : ''}`);
    err.meta = e;
    throw err;
  }
  return j;
}

function hojeBR() {
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  return p.replace(/\//g, '-');
}

function nomeComData(nome) {
  const d = hojeBR();
  return /\d{2}-\d{2}-\d{4}/.test(nome) ? nome.replace(/\d{2}-\d{2}-\d{4}/, d) : `${nome} ${d}`;
}

// gasto e conversas a partir do bloco "insights" do Graph
function numeros(ins) {
  const row = ins && ins.data && ins.data[0];
  if (!row) return { gasto: 0, conversas: 0 };
  const a = (row.actions || []).find((x) => x.action_type === CONVERSA);
  return { gasto: Number(row.spend || 0), conversas: Number(a ? a.value : 0) };
}

// custo por conversa; gastou sem conversa = infinito (o pior)
function custo(n) {
  if (n.conversas > 0) return n.gasto / n.conversas;
  return n.gasto > 0 ? Infinity : 0;
}

function contexto(user) {
  const meta = (user.connections || {}).meta || {};
  const page = (meta.pages || []).find((p) => p.instagramBusinessId) || (meta.pages || [])[0];
  if (!meta.ads || !meta.ads.userAccessToken) {
    return { erro: 'sem-ads', mensagem: 'Sua conta de anúncios ainda não está ligada ao aplicativo. Fale com a equipe para liberar.' };
  }
  if (!page || !page.instagramBusinessId) {
    return { erro: 'sem-ig', mensagem: 'Conecte o Instagram da sua empresa no aplicativo para escolher as postagens.' };
  }
  let adsToken, pageToken;
  try { adsToken = decryptToken(meta.ads.userAccessToken); pageToken = decryptToken(page.pageAccessToken); } catch {
    return { erro: 'token', mensagem: 'A conexão com o Facebook precisa ser refeita. Toque em Redes e conecte de novo.' };
  }
  const contas = (meta.ads.adAccounts || []).map((a) => String(a.id).replace(/^act_/, ''));
  const preferida = user.virarAnuncio && user.virarAnuncio.adAccountId ? String(user.virarAnuncio.adAccountId).replace(/^act_/, '') : null;
  return { adsToken, pageToken, pageId: page.pageId, igId: page.instagramBusinessId, igUser: page.instagramUsername, contas: preferida ? [preferida] : contas };
}

// Postagens do feed do Instagram do cliente + quais já estão em anúncio ativo
async function listarPostagens(user) {
  const ctx = contexto(user);
  if (ctx.erro) return { ok: false, ...ctx };
  const media = await graph('GET', `/${ctx.igId}/media`, {
    fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp',
    limit: '30',
  }, ctx.pageToken);
  const emAnuncio = await midiasEmAnuncio(ctx).catch(() => new Set());
  const postagens = (media.data || [])
    .filter((m) => m.media_product_type !== 'STORY')
    .map((m) => ({
      id: m.id,
      tipo: m.media_type === 'VIDEO' ? 'video' : m.media_type === 'CAROUSEL_ALBUM' ? 'carrossel' : 'foto',
      thumb: m.thumbnail_url || m.media_url || null,
      legenda: (m.caption || '').slice(0, 160),
      link: m.permalink,
      data: m.timestamp,
      jaEhAnuncio: emAnuncio.has(m.id),
    }));
  return { ok: true, instagram: ctx.igUser, postagens };
}

async function midiasEmAnuncio(ctx) {
  const set = new Set();
  for (const conta of ctx.contas) {
    const ads = await graph('GET', `/act_${conta}/ads`, {
      fields: 'effective_status,creative{source_instagram_media_id,effective_instagram_media_id}',
      filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PENDING_REVIEW', 'IN_PROCESS', 'WITH_ISSUES'] }]),
      limit: '200',
    }, ctx.adsToken).catch(() => ({ data: [] }));
    for (const ad of ads.data || []) {
      const c = ad.creative || {};
      if (c.source_instagram_media_id) set.add(String(c.source_instagram_media_id));
      if (c.effective_instagram_media_id) set.add(String(c.effective_instagram_media_id));
    }
  }
  return set;
}

// Escolhe campanha → conjunto → anúncio modelo, pela regra do topo do arquivo
async function escolherDestino(ctx) {
  const candidatas = [];
  for (const conta of ctx.contas) {
    const camps = await graph('GET', `/act_${conta}/campaigns`, {
      fields: 'id,name,effective_status,insights.date_preset(last_7d){spend,actions}',
      filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]),
      limit: '50',
    }, ctx.adsToken).catch(() => ({ data: [] }));
    for (const c of camps.data || []) candidatas.push({ conta, id: c.id, nome: c.name, n: numeros(c.insights) });
  }
  if (!candidatas.length) return null;
  candidatas.sort((a, b) => (custo(b.n) - custo(a.n)) || (b.n.gasto - a.n.gasto));

  for (const camp of candidatas) {
    const sets = await graph('GET', `/${camp.id}/adsets`, {
      fields: 'id,name,effective_status,insights.date_preset(last_7d){spend,actions}',
      limit: '50',
    }, ctx.adsToken).catch(() => ({ data: [] }));
    const ativos = (sets.data || []).filter((s) => s.effective_status === 'ACTIVE')
      .map((s) => ({ id: s.id, nome: s.name, n: numeros(s.insights) }))
      .sort((a, b) => b.n.gasto - a.n.gasto);
    for (const conj of ativos) {
      const ads = await anunciosDoConjunto(conj.id, ctx.adsToken);
      const ativosAds = ads.filter((a) => a.ativo);
      if (!ativosAds.length) continue;
      const comConversa = ativosAds.filter((a) => a.n.conversas > 0).sort((a, b) => custo(a.n) - custo(b.n));
      const modelo = comConversa[0] || ativosAds.sort((a, b) => b.criado - a.criado)[0];
      return { camp, conj, modelo, ads };
    }
  }
  return null;
}

async function anunciosDoConjunto(adsetId, token) {
  const r = await graph('GET', `/${adsetId}/ads`, {
    fields: 'id,name,status,effective_status,created_time,creative{id,call_to_action_type,call_to_action,object_story_spec},insights.date_preset(last_30d){spend,actions}',
    limit: '100',
  }, token);
  return (r.data || []).map((a) => ({
    id: a.id,
    nome: a.name,
    ativo: a.status === 'ACTIVE' && !['DELETED', 'ARCHIVED', 'ADSET_PAUSED', 'CAMPAIGN_PAUSED'].includes(a.effective_status),
    criado: Date.parse(a.created_time) || 0,
    creative: a.creative || {},
    n: numeros(a.insights),
  }));
}

function ctaDoModelo(modelo) {
  // Copia o botão do anúncio modelo como está (o de WhatsApp exige o link
  // "https://api.whatsapp.com/send", senão o Meta recusa com #100 "link").
  const c = modelo.creative || {};
  if (c.call_to_action && c.call_to_action.type) return c.call_to_action;
  const spec = c.object_story_spec || {};
  const cta = (spec.video_data && spec.video_data.call_to_action) || (spec.link_data && spec.link_data.call_to_action);
  if (cta && cta.type && cta.value) return cta;
  const tipo = (cta && cta.type) || c.call_to_action_type || 'WHATSAPP_MESSAGE';
  if (tipo === 'WHATSAPP_MESSAGE') return { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP', link: 'https://api.whatsapp.com/send' } };
  return { type: tipo };
}

async function lerLog() {
  try { return JSON.parse(await fs.readFile(LOG_FILE(), 'utf8')); } catch { return []; }
}
async function gravarLog(item) {
  const log = await lerLog();
  log.push(item);
  await fs.writeFile(LOG_FILE(), JSON.stringify(log.slice(-500), null, 2));
}

// `teste`: cria o anúncio PAUSADO e não pausa ninguém (conferência sem gastar)
async function virarAnuncio(user, mediaId, { teste = false } = {}) {
  const ctx = contexto(user);
  if (ctx.erro) return { ok: false, ...ctx };
  mediaId = String(mediaId || '').replace(/\D/g, '');
  if (!mediaId) return { ok: false, mensagem: 'Escolha uma postagem.' };

  const log = await lerLog();
  const hoje = hojeBR();
  const deHoje = log.filter((l) => l.client === user.client && l.dia === hoje && l.ok && !l.teste).length;
  if (!teste && deHoje >= LIMITE_DIA) {
    return { ok: false, mensagem: `Hoje você já colocou ${LIMITE_DIA} postagens nos anúncios. Amanhã libera de novo.` };
  }

  // a postagem é mesmo desse Instagram?
  const media = await graph('GET', `/${mediaId}`, { fields: 'id,media_type,media_product_type,permalink,owner' }, ctx.pageToken).catch(() => null);
  if (!media || (media.owner && String(media.owner.id) !== String(ctx.igId))) {
    return { ok: false, mensagem: 'Essa postagem não é do seu Instagram.' };
  }
  if (!teste && (await midiasEmAnuncio(ctx).catch(() => new Set())).has(mediaId)) {
    return { ok: false, mensagem: 'Essa postagem já está nos seus anúncios.' };
  }

  const destino = await escolherDestino(ctx);
  if (!destino) {
    return { ok: false, mensagem: 'Você não tem nenhuma campanha ativa agora. Fale com a equipe para ligar seus anúncios.' };
  }
  const { camp, conj, modelo } = destino;
  const nome = nomeComData(modelo.nome);

  const creative = await graph('POST', `/act_${camp.conta}/adcreatives`, {
    name: `${nome} (app)`,
    object_id: ctx.pageId,
    instagram_user_id: ctx.igId,
    source_instagram_media_id: mediaId,
    call_to_action: JSON.stringify(ctaDoModelo(modelo)),
  }, ctx.adsToken);

  const ad = await graph('POST', `/act_${camp.conta}/ads`, {
    name: nome,
    adset_id: conj.id,
    creative: JSON.stringify({ creative_id: creative.id }),
    status: teste ? 'PAUSED' : 'ACTIVE',
  }, ctx.adsToken);

  // abre espaço: no máximo 10 ativos por conjunto
  let pausado = null;
  if (!teste) {
    const ads = await anunciosDoConjunto(conj.id, ctx.adsToken).catch(() => []);
    const ativos = ads.filter((a) => a.ativo);
    if (ativos.length > MAX_ATIVOS) {
      const tresDias = Date.now() - 3 * 864e5;
      const pior = ativos
        .filter((a) => a.id !== ad.id && a.criado < tresDias)
        .sort((a, b) => (custo(b.n) - custo(a.n)) || (b.n.gasto - a.n.gasto))[0];
      if (pior) {
        await graph('POST', `/${pior.id}`, { status: 'PAUSED' }, ctx.adsToken);
        pausado = { id: pior.id, nome: pior.nome, gasto: pior.n.gasto, conversas: pior.n.conversas };
      }
    }
  }

  const item = {
    client: user.client, at: new Date().toISOString(), dia: hoje, ok: true, teste,
    mediaId, link: media.permalink, conta: camp.conta, campanha: camp.nome, conjunto: conj.nome,
    anuncioId: ad.id, anuncioNome: nome, modelo: modelo.nome, pausado,
  };
  await gravarLog(item);
  return { ok: true, ...item };
}

async function historico(client) {
  return (await lerLog()).filter((l) => l.client === client).slice(-30).reverse();
}

module.exports = { listarPostagens, virarAnuncio, historico, _interno: { escolherDestino, contexto, custo, nomeComData } };
