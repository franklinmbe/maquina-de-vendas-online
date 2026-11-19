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
const { midiasDoCliente, postsFbDoCliente } = require('./ig-media-dono');
const MOSTRAR = 10; // últimas postagens que ainda não viraram anúncio (Franklin, 18/11)

const GRAPH = 'https://graph.facebook.com/v21.0';
const MAX_ATIVOS = 10;
// Limite de anúncios por dia = limite de postagens por dia do plano
// (Franklin, 18/11: "a quantidade de postagem que ele puder fazer vai ser a
// quantidade de anúncio"). Plano sem teto de postagem = sem teto aqui.
const { PLAN_POST_LIMITS } = require('./post-quota');
function limiteDia(user) {
  if (user && user.client === 'frank') return Infinity;
  const l = PLAN_POST_LIMITS[user && user.plan];
  return l && l.perDay ? l.perDay : Infinity;
}
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

// Regra do app (Franklin, 18/11): TODOS os clientes usam o painel. Quem
// conectou o próprio Facebook com permissão de anúncios usa o token dele;
// quem não, usa o acesso do gestor de tráfego (o admin, client 'frank',
// connections.meta.ads) na conta de anúncios configurada pro cliente em
// user.virarAnuncio = { adAccountId, campanhaContem?, soPostsDoApp? }.
//  - campanhaContem: só campanhas com esse texto no nome (RJ Inox: "DUDU",
//    "JACK"...) — cada vendedor só entra nas campanhas dele;
//  - soPostsDoApp: só posts que o cliente mandou pelo app (Página
//    compartilhada; lib/ig-media-dono.js) — nunca o post de outro vendedor.
function contexto(user, users) {
  const meta = (user.connections || {}).meta || {};
  const cfg = user.virarAnuncio || {};
  const page = (meta.pages || []).find((p) => p.instagramBusinessId) || (meta.pages || [])[0];
  const admin = (users || []).find((u) => u.client === 'frank');
  const adminAds = admin && admin.connections && admin.connections.meta && admin.connections.meta.ads;
  const proprio = meta.ads && meta.ads.userAccessToken ? meta.ads : null;
  const preferida = cfg.adAccountId ? String(cfg.adAccountId).replace(/^act_/, '') : null;
  const fonte = proprio || (preferida && adminAds && adminAds.userAccessToken ? adminAds : null);
  if (!fonte) {
    const mensagem = preferida
      ? 'O acesso do gestor de tráfego aos seus anúncios precisa ser renovado. Fale com a equipe.'
      : 'Sua conta de anúncios ainda não está ligada ao aplicativo. Fale com a equipe para liberar.';
    return { erro: 'sem-ads', mensagem };
  }
  if (!page || !page.instagramBusinessId) {
    return { erro: 'sem-ig', mensagem: 'Conecte o Instagram da sua empresa no aplicativo para escolher as postagens.' };
  }
  let adsToken, pageToken;
  try { adsToken = decryptToken(fonte.userAccessToken); pageToken = decryptToken(page.pageAccessToken); } catch {
    return { erro: 'token', mensagem: 'A conexão com o Facebook precisa ser refeita. Toque em Redes e conecte de novo.' };
  }
  const contas = (fonte.adAccounts || []).map((a) => String(a.id).replace(/^act_/, ''));
  return {
    adsToken, pageToken, pageId: page.pageId, igId: page.instagramBusinessId, igUser: page.instagramUsername,
    contas: preferida ? [preferida] : contas,
    campanhaContem: cfg.campanhaContem ? String(cfg.campanhaContem).toUpperCase() : null,
    soPostsDoApp: Boolean(cfg.soPostsDoApp),
    client: user.client,
  };
}

function campanhaDoCliente(ctx, nome) {
  if (!ctx.campanhaContem) return true;
  return String(nome || '').toUpperCase().includes(ctx.campanhaContem);
}

// Postagens do feed do Instagram do cliente + quais já estão em anúncio ativo
async function listarPostagens(user, users) {
  const ctx = contexto(user, users);
  if (ctx.erro) return { ok: false, ...ctx };
  const meus = ctx.soPostsDoApp ? await midiasDoCliente(ctx.client) : null;
  const media = await graph('GET', `/${ctx.igId}/media`, {
    fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp',
    limit: ctx.soPostsDoApp ? '100' : '30',
  }, ctx.pageToken);
  const emAnuncio = await midiasEmAnuncio(ctx).catch(() => new Set());
  const postagens = (media.data || [])
    .filter((m) => m.media_product_type !== 'STORY')
    .filter((m) => !meus || meus.has(String(m.id)))
    .filter((m) => !emAnuncio.has(m.id))
    .slice(0, MOSTRAR)
    .map((m) => ({
      id: m.id,
      tipo: m.media_type === 'VIDEO' ? 'video' : m.media_type === 'CAROUSEL_ALBUM' ? 'carrossel' : 'foto',
      thumb: m.thumbnail_url || m.media_url || null,
      legenda: (m.caption || '').slice(0, 160),
      link: m.permalink,
      data: m.timestamp,
      jaEhAnuncio: false,
    }));
  return { ok: true, rede: 'instagram', instagram: ctx.igUser, postagens };
}

// Janela do Facebook: posts da Página. Post do Facebook não aceita o botão
// de WhatsApp como anúncio (#4469908), então a foto/vídeo do post vira um
// anúncio novo (anuncioSemPostar), com o mesmo texto.
function midiaDoPostFb(p) {
  const a = p.attachments && p.attachments.data && p.attachments.data[0];
  if (!a) return null;
  const sub = a.subattachments && a.subattachments.data && a.subattachments.data[0];
  const alvo = /video/i.test(a.media_type || '') ? a : (sub && /video/i.test(sub.media_type || '') ? sub : (sub || a));
  const video = /video/i.test(alvo.media_type || '');
  return { video, videoId: video && alvo.target ? alvo.target.id : null, imagem: (alvo.media && alvo.media.image && alvo.media.image.src) || p.full_picture || null };
}

// O publicador às vezes guarda o id da foto/vídeo em vez do id do post
// ("pagina_post"): confere todos.
function fbEhDoCliente(set, p) {
  const ids = [String(p.id), String(p.id).split('_').pop()];
  const a = p.attachments && p.attachments.data && p.attachments.data[0];
  if (a && a.target && a.target.id) ids.push(String(a.target.id));
  const sub = a && a.subattachments && a.subattachments.data;
  (sub || []).forEach((s) => { if (s.target && s.target.id) ids.push(String(s.target.id)); });
  return ids.some((i) => set.has(i) || [...set].some((x) => x.split('_').pop() === i));
}

async function listarPostagensFacebook(user, users) {
  const ctx = contexto(user, users);
  if (ctx.erro) return { ok: false, ...ctx };
  const meus = ctx.soPostsDoApp ? await postsFbDoCliente(ctx.client) : null;
  const r = await graph('GET', `/${ctx.pageId}/posts`, {
    fields: 'id,message,created_time,full_picture,permalink_url,attachments{media_type,media,target,subattachments.limit(1){media_type,media,target}}',
    limit: ctx.soPostsDoApp ? '100' : '30',
  }, ctx.pageToken);
  const feitos = new Set((await lerLog()).filter((l) => l.client === user.client && l.ok && !l.teste && l.fbPostId).map((l) => String(l.fbPostId)));
  const postagens = (r.data || [])
    .filter((p) => !meus || fbEhDoCliente(meus, p))
    .filter((p) => !feitos.has(String(p.id)))
    .map((p) => ({ p, m: midiaDoPostFb(p) }))
    .filter((x) => x.m && (x.m.imagem || x.m.videoId))
    .slice(0, MOSTRAR)
    .map(({ p, m }) => ({ id: p.id, tipo: m.video ? 'video' : 'foto', thumb: m.imagem, legenda: (p.message || '').slice(0, 160), link: p.permalink_url, data: p.created_time, jaEhAnuncio: false }));
  return { ok: true, rede: 'facebook', postagens };
}

async function virarAnuncioFacebook(user, postId, { teste = false, users } = {}) {
  const ctx = contexto(user, users);
  if (ctx.erro) return { ok: false, ...ctx };
  postId = String(postId || '').replace(/[^\d_]/g, '');
  if (!postId) return { ok: false, mensagem: 'Escolha uma postagem.' };
  const p = await graph('GET', `/${postId}`, { fields: 'id,message,full_picture,permalink_url,from,attachments{media_type,media,target,subattachments.limit(1){media_type,media,target}}' }, ctx.pageToken).catch(() => null);
  if (!p || (p.from && String(p.from.id) !== String(ctx.pageId))) return { ok: false, mensagem: 'Essa postagem não é da sua Página.' };
  if (ctx.soPostsDoApp && !fbEhDoCliente(await postsFbDoCliente(ctx.client), p)) {
    return { ok: false, mensagem: 'Só dá pra virar anúncio as postagens que você mandou pelo aplicativo.' };
  }
  if (!teste && (await lerLog()).some((l) => l.client === user.client && l.ok && !l.teste && String(l.fbPostId) === postId)) {
    return { ok: false, mensagem: 'Essa postagem já está nos seus anúncios.' };
  }
  const m = midiaDoPostFb(p);
  if (!m) return { ok: false, mensagem: 'Essa postagem não tem foto nem vídeo.' };
  let url = m.imagem;
  if (m.video && m.videoId) {
    const v = await graph('GET', `/${m.videoId}`, { fields: 'source' }, ctx.pageToken).catch(() => null);
    if (v && v.source) url = v.source;
    else m.video = false;
  }
  if (!url) return { ok: false, mensagem: 'Não consegui pegar a foto ou o vídeo dessa postagem.' };
  const r = await anuncioSemPostar(user, [{ name: 'facebook-' + postId, download_url: url, video: m.video }], p.message || '', { teste, users, fbPostId: postId, link: p.permalink_url });
  return r;
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
    for (const c of camps.data || []) {
      if (campanhaDoCliente(ctx, c.name)) candidatas.push({ conta, id: c.id, nome: c.name, n: numeros(c.insights) });
    }
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
async function virarAnuncio(user, mediaId, { teste = false, users } = {}) {
  const ctx = contexto(user, users);
  if (ctx.erro) return { ok: false, ...ctx };
  mediaId = String(mediaId || '').replace(/\D/g, '');
  if (!mediaId) return { ok: false, mensagem: 'Escolha uma postagem.' };

  const log = await lerLog();
  const hoje = hojeBR();
  const deHoje = log.filter((l) => l.client === user.client && l.dia === hoje && l.ok && !l.teste).length;
  const LIMITE_DIA = limiteDia(user);
  if (!teste && deHoje >= LIMITE_DIA) {
    return { ok: false, mensagem: `Hoje você já colocou ${LIMITE_DIA} postagens nos anúncios, o limite do seu plano. Amanhã libera de novo.` };
  }

  // a postagem é mesmo desse Instagram?
  const media = await graph('GET', `/${mediaId}`, { fields: 'id,media_type,media_product_type,permalink,owner' }, ctx.pageToken).catch(() => null);
  if (!media || (media.owner && String(media.owner.id) !== String(ctx.igId))) {
    return { ok: false, mensagem: 'Essa postagem não é do seu Instagram.' };
  }
  if (ctx.soPostsDoApp && !(await midiasDoCliente(ctx.client)).has(mediaId)) {
    return { ok: false, mensagem: 'Só dá pra virar anúncio as postagens que você mandou pelo aplicativo.' };
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

  const { ad, pausado } = await criarAnuncio(ctx, destino, nome, {
    object_id: ctx.pageId,
    instagram_user_id: ctx.igId,
    source_instagram_media_id: mediaId,
    call_to_action: JSON.stringify(ctaDoModelo(modelo)),
  }, teste);

  const item = {
    client: user.client, at: new Date().toISOString(), dia: hoje, ok: true, teste,
    mediaId, link: media.permalink, conta: camp.conta, campanha: camp.nome, conjunto: conj.nome,
    anuncioId: ad.id, anuncioNome: nome, modelo: modelo.nome, pausado,
  };
  await gravarLog(item);
  return { ok: true, ...item };
}

// Cria o criativo + o anúncio no conjunto escolhido e, se passar de 10
// ativos, pausa o pior com mais de 3 dias (mesma regra do topo do arquivo).
async function criarAnuncio(ctx, destino, nome, creativeFields, teste) {
  const { camp, conj } = destino;
  const creative = await graph('POST', `/act_${camp.conta}/adcreatives`, { name: `${nome} (app)`, ...creativeFields }, ctx.adsToken);
  const ad = await graph('POST', `/act_${camp.conta}/ads`, {
    name: nome,
    adset_id: conj.id,
    creative: JSON.stringify({ creative_id: creative.id }),
    status: teste ? 'PAUSED' : 'ACTIVE',
  }, ctx.adsToken);
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
  return { ad, creative, pausado };
}

// "Só anúncio" (Franklin, 18/11): o cliente desmarca as redes do orgânico e
// deixa só a caixinha do Meta Ads — nada sai no feed; a foto/vídeo enviado
// vira anúncio direto (criativo novo, não post existente), na campanha que a
// regra escolher, com o mesmo botão (WhatsApp etc.) do melhor anúncio dali.
// Usa o 1º vídeo, senão a 1ª foto. `media`: [{ name, download_url, video }].
async function anuncioSemPostar(user, media, texto, { teste = false, users, pasta, fbPostId, link } = {}) {
  const ctx = contexto(user, users);
  if (ctx.erro) return { ok: false, ...ctx };
  const item0 = (media || []).find((m) => m.video) || (media || [])[0];
  if (!item0) return { ok: false, mensagem: 'Anexe a foto ou o vídeo do anúncio.' };

  const log = await lerLog();
  const hoje = hojeBR();
  const deHoje = log.filter((l) => l.client === user.client && l.dia === hoje && l.ok && !l.teste).length;
  const LIMITE_DIA = limiteDia(user);
  if (!teste && deHoje >= LIMITE_DIA) {
    return { ok: false, mensagem: `Hoje você já colocou ${LIMITE_DIA} anúncios, o limite do seu plano. Amanhã libera de novo.` };
  }

  const destino = await escolherDestino(ctx);
  if (!destino) return { ok: false, mensagem: 'Você não tem nenhuma campanha ativa agora. Fale com a equipe para ligar seus anúncios.' };
  const { camp, conj, modelo } = destino;
  const nome = nomeComData(modelo.nome);
  const cta = ctaDoModelo(modelo);
  const linkCta = (cta.value && cta.value.link) || 'https://api.whatsapp.com/send';
  const message = String(texto || '').slice(0, 2000);

  let spec;
  if (item0.video) {
    const up = await graph('POST', `/act_${camp.conta}/advideos`, { file_url: item0.download_url, name: nome }, ctx.adsToken);
    let thumb = null;
    for (let i = 0; i < 24 && !thumb; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const v = await graph('GET', `/${up.id}`, { fields: 'status,picture,thumbnails{uri,is_preferred}' }, ctx.adsToken).catch(() => null);
      const pronto = v && v.status && v.status.video_status === 'ready';
      const t = v && v.thumbnails && v.thumbnails.data && (v.thumbnails.data.find((x) => x.is_preferred) || v.thumbnails.data[0]);
      if (pronto) thumb = (t && t.uri) || v.picture || null;
    }
    if (!thumb) return { ok: false, mensagem: 'O Meta ainda está processando o vídeo. Tente de novo em alguns minutos.' };
    spec = { page_id: ctx.pageId, instagram_user_id: ctx.igId, video_data: { video_id: up.id, image_url: thumb, message, call_to_action: { ...cta, value: { ...(cta.value || {}), link: linkCta } } } };
  } else {
    const buf = Buffer.from(await (await fetch(item0.download_url, { signal: AbortSignal.timeout(60000) })).arrayBuffer());
    const img = await graph('POST', `/act_${camp.conta}/adimages`, { bytes: buf.toString('base64') }, ctx.adsToken);
    const hash = img.images && Object.values(img.images)[0] && Object.values(img.images)[0].hash;
    if (!hash) return { ok: false, mensagem: 'O Meta não aceitou a imagem agora.' };
    spec = { page_id: ctx.pageId, instagram_user_id: ctx.igId, link_data: { image_hash: hash, link: linkCta, message, call_to_action: { ...cta, value: { ...(cta.value || {}), link: linkCta } } } };
  }

  const { ad, pausado } = await criarAnuncio(ctx, destino, nome, { object_story_spec: JSON.stringify(spec) }, teste);
  const item = {
    client: user.client, at: new Date().toISOString(), dia: hoje, ok: true, teste, somenteAnuncio: !fbPostId, pasta, fbPostId, link,
    arquivo: item0.name, conta: camp.conta, campanha: camp.nome, conjunto: conj.nome,
    anuncioId: ad.id, anuncioNome: nome, modelo: modelo.nome, pausado,
  };
  await gravarLog(item);
  return { ok: true, ...item };
}

async function historico(client) {
  return (await lerLog()).filter((l) => l.client === client && l.ok !== false).slice(-30).reverse();
}

// Caixinha "Virar anúncio no Meta Ads" da postagem (Franklin, 18/11): depois
// que o pedido publica, pega o 1º post de feed/Reels do Instagram que deu
// certo e coloca nos anúncios pela mesma regra do painel. Espera um pouco
// (o Meta às vezes ainda está processando o vídeo) e tenta de novo 1 vez.
// Nunca derruba a publicação; o resultado vai pro admin e pro histórico.
async function virarDepoisDePublicar(client, results, pasta) {
  const { loadUsers } = require('./users');
  const { avisarAdmin } = require('./avisar-admin');
  const ig = (results || []).find((r) => r && r.channel === 'instagram' && r.status === 'ok' && r.postId);
  // sem post de feed/Reels no Instagram (ex.: só Stories): nada a fazer
  if (!ig) return { ok: false };
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  let r = null;
  for (const ms of [30000, 120000]) {
    await espera(ms);
    const users = await loadUsers();
    const user = users.find((u) => u.client === client);
    if (!user) return { ok: false };
    try { r = await virarAnuncio(user, ig.postId, { users }); } catch (e) { r = { ok: false, mensagem: e.message }; }
    if (r.ok || r.erro || /já está|já colocou|não tem nenhuma campanha|só dá pra/i.test(r.mensagem || '')) break;
  }
  // Caixinha vem marcada por padrão: cliente sem anúncios ligados ou sem
  // campanha ativa não gera aviso a cada post (só fica no registro).
  const semAnuncios = r && (r.erro === 'sem-ads' || /não tem nenhuma campanha/i.test(r.mensagem || ''));
  if (r && r.ok) {
    avisarAdmin(`📢 ${client}: postagem virou anúncio pela caixinha da postagem: "${r.anuncioNome}" na campanha "${r.campanha}".${r.pausado ? ` Pausado: "${r.pausado.nome}".` : ''} ${r.link || ''}`).catch(() => {});
  } else {
    await gravarLog({ client, at: new Date().toISOString(), dia: hojeBR(), ok: false, mediaId: ig.postId, pasta, erro: (r && r.mensagem) || 'falhou' }).catch(() => {});
    if (!semAnuncios) avisarAdmin(`⚠️ ${client}: a postagem saiu, mas NÃO virou anúncio: ${(r && r.mensagem) || 'falhou'} (pedido ${pasta || '-'}, post IG ${ig.postId}).`).catch(() => {});
  }
  return r;
}

module.exports = { listarPostagens, listarPostagensFacebook, virarAnuncio, virarAnuncioFacebook, virarDepoisDePublicar, anuncioSemPostar, historico, _interno: { escolherDestino, contexto, custo, nomeComData } };
