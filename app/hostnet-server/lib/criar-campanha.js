// Painel "Criar campanha" (Franklin, 2026-11-21): o cliente monta sozinho
// uma campanha básica no Meta Ads ou no Google Ads — objetivo, região no
// mapa (ponto + raio), público, orçamento e o anúncio. A campanha é criada
// de verdade na rede, mas SEMPRE PAUSADA: envolve dinheiro, então só roda
// depois que o admin aprova (action 'ativar' no painel). Cada criação fica
// em user.campanhasCriadas e avisa o admin.
const { decryptToken, encryptToken } = require('./token-crypto');
const google = require('./google');
const { _interno: va } = require('./virar-anuncio');

const GRAPH = 'https://graph.facebook.com/v21.0';

async function graph(method, p, params, token) {
  const url = new URL(GRAPH + p);
  const opts = { method, signal: AbortSignal.timeout(45000) };
  const all = { ...(params || {}), access_token: token };
  if (method === 'GET') {
    for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);
  } else {
    opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    opts.body = new URLSearchParams(Object.fromEntries(Object.entries(all).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]))).toString();
  }
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = j.error || {};
    throw new Error(`${e.error_user_msg || e.message || `HTTP ${r.status}`}${e.code ? ` (#${e.code})` : ''}`);
  }
  return j;
}

const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const hoje = () => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()).replace(/\//g, '-');

// ---------- validação comum ----------
function limparRegiao(r) {
  r = r || {};
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    raio: Math.min(80, Math.max(1, Math.round(Number(r.raio) || 5))),
    endereco: txt(r.endereco, 200),
  };
}

function limparSite(u) {
  let s = txt(u, 300);
  if (s && !/^https?:\/\//i.test(s)) s = `https://${s}`;
  try { const x = new URL(s); return /^https?:$/.test(x.protocol) && x.hostname.includes('.') ? x.toString() : ''; } catch { return ''; }
}

// ---------- META ----------
const META_OBJ = {
  whatsapp: { objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', destination_type: 'WHATSAPP', nome: 'Mensagens no WhatsApp' },
  site: { objective: 'OUTCOME_TRAFFIC', optimization_goal: 'LINK_CLICKS', destination_type: 'WEBSITE', nome: 'Visitas ao site' },
  engajamento: { objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'POST_ENGAGEMENT', destination_type: 'ON_POST', nome: 'Engajamento' },
  alcance: { objective: 'OUTCOME_AWARENESS', optimization_goal: 'REACH', destination_type: null, nome: 'Alcance na região' },
};

function limparMeta(c) {
  c = c || {};
  const objetivo = META_OBJ[c.objetivo] ? c.objetivo : 'whatsapp';
  const generos = c.genero === 'homens' ? [1] : c.genero === 'mulheres' ? [2] : null;
  let idadeMin = Math.min(65, Math.max(18, Math.round(Number(c.idadeMin) || 18)));
  let idadeMax = Math.min(65, Math.max(18, Math.round(Number(c.idadeMax) || 65)));
  if (idadeMax < idadeMin) [idadeMin, idadeMax] = [idadeMax, idadeMin];
  return {
    objetivo,
    regiao: limparRegiao(c.regiao),
    idadeMin, idadeMax, generos,
    orcamentoDia: Math.min(2000, Math.max(6, Math.round(Number(c.orcamentoDia) || 20))),
    dias: Math.min(90, Math.max(0, Math.round(Number(c.dias) || 0))), // 0 = sem data pra acabar
    mediaId: txt(c.mediaId, 40),
    site: limparSite(c.site),
    nome: txt(c.nome, 60),
  };
}

async function criarMeta(user, users, cfgBruto, { teste = false } = {}) {
  const c = limparMeta(cfgBruto);
  if (!c.regiao) return { ok: false, mensagem: 'Marque no mapa o ponto central da sua região.' };
  if (!c.mediaId) return { ok: false, mensagem: 'Escolha a postagem que vai virar o anúncio.' };
  if (c.objetivo === 'site' && !c.site) return { ok: false, mensagem: 'Coloque o endereço do seu site.' };
  const ctx = va.contexto(user, users);
  if (ctx.erro) return { ok: false, mensagem: ctx.mensagem };
  const conta = ctx.contas[0];
  if (!conta) return { ok: false, mensagem: 'Nenhuma conta de anúncios ligada ao app. Fale com a equipe.' };
  const o = META_OBJ[c.objetivo];
  const nomeBase = `${c.nome || `App ${o.nome}`} ${hoje()}`;
  const criados = [];
  try {
    const camp = await graph('POST', `/act_${conta}/campaigns`, {
      name: nomeBase,
      objective: o.objective,
      status: 'PAUSED',
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    }, ctx.adsToken);
    criados.push(camp.id);

    const targeting = {
      geo_locations: { custom_locations: [{ latitude: c.regiao.lat, longitude: c.regiao.lng, radius: c.regiao.raio, distance_unit: 'kilometer' }], location_types: ['home', 'recent'] },
      age_min: c.idadeMin,
      age_max: c.idadeMax,
      targeting_automation: { advantage_audience: 0 },
    };
    if (c.generos) targeting.genders = c.generos;
    const conj = {
      name: `${nomeBase} - ${c.regiao.raio} km`,
      campaign_id: camp.id,
      daily_budget: c.orcamentoDia * 100,
      billing_event: 'IMPRESSIONS',
      optimization_goal: o.optimization_goal,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting,
      status: 'PAUSED',
    };
    if (o.destination_type) conj.destination_type = o.destination_type;
    if (c.objetivo === 'whatsapp' || c.objetivo === 'engajamento') conj.promoted_object = { page_id: ctx.pageId };
    if (c.dias) conj.end_time = Math.floor(Date.now() / 1000) + c.dias * 86400;
    const adset = await graph('POST', `/act_${conta}/adsets`, conj, ctx.adsToken);
    criados.push(adset.id);

    const criativo = { name: `${nomeBase} (app)`, object_id: ctx.pageId, instagram_user_id: ctx.igId, source_instagram_media_id: c.mediaId };
    if (c.objetivo === 'whatsapp') criativo.call_to_action = { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP', link: 'https://api.whatsapp.com/send' } };
    if (c.objetivo === 'site') criativo.call_to_action = { type: 'LEARN_MORE', value: { link: c.site } };
    const creative = await graph('POST', `/act_${conta}/adcreatives`, criativo, ctx.adsToken);
    criados.push(creative.id);
    const ad = await graph('POST', `/act_${conta}/ads`, { name: nomeBase, adset_id: adset.id, creative: { creative_id: creative.id }, status: 'PAUSED' }, ctx.adsToken);
    criados.push(ad.id);

    if (teste) {
      // teste do admin: cria tudo pausado e apaga em seguida
      await graph('DELETE', `/${camp.id}`, {}, ctx.adsToken).catch(() => {});
      return { ok: true, teste: true, conta, ids: { campanha: camp.id, conjunto: adset.id, anuncio: ad.id }, apagado: true };
    }
    return {
      ok: true,
      registro: {
        id: `meta-${camp.id}`, rede: 'meta', criadaEm: new Date().toISOString(), status: 'pausada',
        nome: nomeBase, objetivo: o.nome, conta, campanhaId: camp.id, conjuntoId: adset.id, anuncioId: ad.id,
        regiao: c.regiao, orcamentoDia: c.orcamentoDia, dias: c.dias, idade: `${c.idadeMin}-${c.idadeMax}`,
        genero: c.generos ? (c.generos[0] === 1 ? 'homens' : 'mulheres') : 'todos', mediaId: c.mediaId, site: c.site || null,
      },
    };
  } catch (e) {
    // não deixa campanha pela metade
    if (criados[0]) await graph('DELETE', `/${criados[0]}`, {}, ctx.adsToken).catch(() => {});
    return { ok: false, mensagem: `O Meta recusou: ${e.message}` };
  }
}

async function ativarMeta(user, users, reg) {
  const ctx = va.contexto(user, users);
  if (ctx.erro) throw new Error(ctx.mensagem);
  for (const id of [reg.anuncioId, reg.conjuntoId, reg.campanhaId]) {
    await graph('POST', `/${id}`, { status: 'ACTIVE' }, ctx.adsToken);
  }
}

// ---------- GOOGLE ----------
// Token: o Google do próprio cliente (com escopo adwords); senão o do admin
// com a conta configurada em user.googleAds.customerId.
async function contextoGoogle(user, users, save) {
  const g = user.connections && user.connections.google;
  const admin = (users || []).find((u) => u.client === 'frank');
  const ga = admin && admin.connections && admin.connections.google;
  const cfg = user.googleAds || {};
  let conn = null;
  if (g && String(g.scope || '').includes(google.ADS_SCOPE)) conn = g;
  else if (cfg.customerId && ga && String(ga.scope || '').includes(google.ADS_SCOPE)) conn = ga;
  if (!conn) {
    return { erro: g ? 'Conecte de novo o Google Ads (tela inicial → redes → Google Ads) para liberar os anúncios.' : 'Conecte o Google Ads (tela inicial → redes → Google Ads) para criar campanhas no Google.' };
  }
  let token = decryptToken(conn.accessToken);
  if (Date.now() >= (conn.expiresAt || 0) - 60000) {
    const r = await google.refreshAccessToken(decryptToken(conn.refreshToken));
    token = r.accessToken;
    conn.accessToken = encryptToken(r.accessToken);
    conn.expiresAt = r.expiresAt;
    save();
  }
  const ids = await google.listAdsCustomers(token);
  const info = [];
  for (const id of ids) {
    const [row] = await google.adsSearch(token, id, 'SELECT customer.id, customer.manager, customer.descriptive_name FROM customer LIMIT 1').catch(() => []);
    if (row) info.push({ id, manager: row.customer.manager, nome: row.customer.descriptiveName });
  }
  const managers = info.filter((x) => x.manager).map((x) => x.id);
  const alvo = cfg.customerId ? String(cfg.customerId).replace(/\D/g, '') : (info.find((x) => !x.manager) || {}).id;
  if (!alvo) return { erro: 'Não achei nenhuma conta de anúncios no seu Google. Fale com a equipe.' };
  const direto = ids.includes(alvo);
  return { token, customerId: alvo, loginCustomerId: direto ? null : managers[0] || null };
}

async function adsMutate(ctx, operations, validateOnly) {
  const headers = { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' };
  if (ctx.loginCustomerId) headers['login-customer-id'] = ctx.loginCustomerId;
  const r = await fetch(`https://googleads.googleapis.com/v26/customers/${ctx.customerId}/googleAds:mutate`, {
    method: 'POST', headers, body: JSON.stringify({ mutateOperations: operations, validateOnly: Boolean(validateOnly) }), signal: AbortSignal.timeout(60000),
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = b.error || {};
    const det = (e.details || []).flatMap((d) => d.errors || []);
    const msg = det.map((x) => `${x.message}${x.trigger && x.trigger.stringValue ? ` ("${x.trigger.stringValue}")` : ''}`).filter(Boolean).slice(0, 3).join(' | ');
    throw new Error(msg || e.message || `Google Ads ${r.status}`);
  }
  return b;
}

function limparGoogle(c) {
  c = c || {};
  const lista = (v, max, n) => [...new Set((Array.isArray(v) ? v : String(v || '').split(/[\n,;]/)).map((x) => txt(x, max)).filter(Boolean))].slice(0, n);
  return {
    regiao: limparRegiao(c.regiao),
    site: limparSite(c.site),
    palavras: lista(c.palavras, 80, 20),
    titulos: lista(c.titulos, 30, 15),
    descricoes: lista(c.descricoes, 90, 4),
    orcamentoDia: Math.min(2000, Math.max(5, Math.round(Number(c.orcamentoDia) || 20))),
    nome: txt(c.nome, 60),
  };
}

async function criarGoogle(user, users, cfgBruto, { teste = false, save = () => {} } = {}) {
  const c = limparGoogle(cfgBruto);
  if (!c.regiao) return { ok: false, mensagem: 'Marque no mapa o ponto central da sua região.' };
  if (!c.site) return { ok: false, mensagem: 'No Google o anúncio leva para um site. Coloque o endereço do seu site ou da sua loja.' };
  if (c.palavras.length < 1) return { ok: false, mensagem: 'Coloque pelo menos uma palavra-chave (o que a pessoa digita no Google).' };
  if (c.titulos.length < 3) return { ok: false, mensagem: 'Coloque pelo menos 3 títulos (até 30 letras cada).' };
  if (c.descricoes.length < 2) return { ok: false, mensagem: 'Coloque pelo menos 2 descrições (até 90 letras cada).' };
  let ctx;
  try { ctx = await contextoGoogle(user, users, save); } catch (e) { return { ok: false, mensagem: `Google: ${e.message}` }; }
  if (ctx.erro) return { ok: false, mensagem: ctx.erro };
  const cid = ctx.customerId;
  const nome = `${c.nome || 'App Pesquisa'} ${hoje()} ${Date.now().toString().slice(-4)}`;
  const B = `customers/${cid}/campaignBudgets/-1`;
  const C = `customers/${cid}/campaigns/-2`;
  const G = `customers/${cid}/adGroups/-3`;
  const ops = [
    { campaignBudgetOperation: { create: { resourceName: B, name: `${nome} orçamento`, amountMicros: String(c.orcamentoDia * 1e6), deliveryMethod: 'STANDARD', explicitlyShared: false } } },
    { campaignOperation: { create: {
      resourceName: C, name: nome, status: 'PAUSED', advertisingChannelType: 'SEARCH', campaignBudget: B,
      targetSpend: {},
      networkSettings: { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false, targetPartnerSearchNetwork: false },
      geoTargetTypeSetting: { positiveGeoTargetType: 'PRESENCE_OR_INTEREST' },
      containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
    } } },
    { campaignCriterionOperation: { create: { campaign: C, proximity: { geoPoint: { latitudeInMicroDegrees: Math.round(c.regiao.lat * 1e6), longitudeInMicroDegrees: Math.round(c.regiao.lng * 1e6) }, radius: c.regiao.raio, radiusUnits: 'KILOMETERS' } } } },
    { campaignCriterionOperation: { create: { campaign: C, language: { languageConstant: 'languageConstants/1014' } } } },
    { adGroupOperation: { create: { resourceName: G, campaign: C, name: `${nome} grupo`, status: 'ENABLED', type: 'SEARCH_STANDARD' } } },
    ...c.palavras.map((p) => ({ adGroupCriterionOperation: { create: { adGroup: G, status: 'ENABLED', keyword: { text: p, matchType: 'PHRASE' } } } })),
    { adGroupAdOperation: { create: { adGroup: G, status: 'ENABLED', ad: { finalUrls: [c.site], responsiveSearchAd: { headlines: c.titulos.map((t) => ({ text: t })), descriptions: c.descricoes.map((d) => ({ text: d })) } } } } },
  ];
  try {
    const r = await adsMutate(ctx, ops, teste);
    if (teste) return { ok: true, teste: true, conta: cid, validado: true };
    const res = r.mutateOperationResponses || [];
    const campanha = (res.find((x) => x.campaignResult) || {}).campaignResult;
    return {
      ok: true,
      registro: {
        id: `google-${campanha ? campanha.resourceName.split('/').pop() : Date.now()}`, rede: 'google', criadaEm: new Date().toISOString(), status: 'pausada',
        nome, objetivo: 'Pesquisa no Google', conta: cid, loginCustomerId: ctx.loginCustomerId, campanhaResource: campanha && campanha.resourceName,
        regiao: c.regiao, orcamentoDia: c.orcamentoDia, site: c.site, palavras: c.palavras, titulos: c.titulos, descricoes: c.descricoes,
      },
    };
  } catch (e) {
    return { ok: false, mensagem: `O Google recusou: ${e.message}` };
  }
}

async function ativarGoogle(user, users, reg, save) {
  const ctx = await contextoGoogle(user, users, save);
  if (ctx.erro) throw new Error(ctx.erro);
  ctx.customerId = reg.conta;
  if (reg.loginCustomerId) ctx.loginCustomerId = reg.loginCustomerId;
  await adsMutate(ctx, [{ campaignOperation: { update: { resourceName: reg.campanhaResource, status: 'ENABLED' }, updateMask: 'status' } }]);
}

module.exports = { criarMeta, criarGoogle, ativarMeta, ativarGoogle, META_OBJ, _interno: { limparMeta, limparGoogle } };
