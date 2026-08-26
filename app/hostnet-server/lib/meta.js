const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function getAppCredentials() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error('META_APP_ID/META_APP_SECRET não configurados');
  return { appId, appSecret };
}

function buildAuthorizeUrl({ redirectUri, state }) {
  const { appId } = getAppCredentials();
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');

  // Apps tipo "Negócios" usam o Login do Facebook para Negócios, que exige
  // uma "Configuração" pré-criada no painel (config_id) em vez de uma lista
  // solta de scope=... — a configuração já define as permissões e o tipo de
  // token. Sem isso o diálogo do Facebook recusa com um erro genérico.
  const configId = process.env.META_LOGIN_CONFIG_ID;
  if (configId) {
    url.searchParams.set('config_id', configId);
    return url.toString();
  }

  const scope = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_content_publish',
    // Pra alimentar o "Relatório das redes sociais" (visualizações, alcance,
    // engajamento) — exige aprovação do Meta App Review antes de funcionar
    // pra clientes de verdade (só admins/testers do app conseguem usar sem
    // aprovação, ver CLAUDE.md). Clientes já conectados antes desta mudança
    // precisam reconectar pra essas permissões passarem a valer.
    'read_insights',
    'instagram_manage_insights',
  ].join(',');
  url.searchParams.set('scope', scope);
  return url.toString();
}

async function graphGet(path, params) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString());
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Meta Graph API recusou ${path}: ${body.error?.message || response.status}`);
  }
  return body;
}

// Troca o "code" de curta duração (recebido no callback) por um token de
// usuário, e já converte pro de longa duração (~60 dias) — o token de página
// derivado dele não expira sozinho enquanto o usuário não revogar o acesso.
async function exchangeCodeForLongLivedUserToken({ code, redirectUri }) {
  const { appId, appSecret } = getAppCredentials();

  const shortLived = await graphGet('/oauth/access_token', {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const longLived = await graphGet('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLived.access_token,
  });

  return longLived.access_token;
}

// Lista as Páginas do Facebook que o cliente administra e que autorizou o
// nosso app a gerenciar, junto com o token de página (esse sim é o que a
// gente usa depois pra publicar — não expira junto com o token de usuário)
// e a conta do Instagram profissional vinculada a cada Página, se existir.
async function listManagedPages(userAccessToken) {
  const { data } = await graphGet('/me/accounts', {
    access_token: userAccessToken,
    fields: 'id,name,access_token,instagram_business_account{id,username}',
  });

  return (data || []).map((page) => ({
    pageId: page.id,
    pageName: page.name,
    pageAccessToken: page.access_token,
    instagramBusinessId: page.instagram_business_account?.id || null,
    instagramUsername: page.instagram_business_account?.username || null,
  }));
}

function sumMetricSeries(series) {
  return (series || []).reduce((total, point) => total + (Number(point.value) || 0), 0);
}

function metricByName(data, name) {
  const entry = (data || []).find((m) => m.name === name);
  return entry ? sumMetricSeries(entry.values) : 0;
}

// Série diária (pra gráfico) — [{ date, value }], mais recente por último.
function seriesByName(data, name) {
  const entry = (data || []).find((m) => m.name === name);
  return (entry ? entry.values : []).map((point) => ({ date: point.end_time, value: Number(point.value) || 0 }));
}

// Some (por tipo) um metric de "action values" — o Meta devolve isso como
// lista de {value: {like: N, love: N, ...}} em vez de um número simples
// (ex: reações por tipo). Junta os dias e soma cada tipo separado.
function actionBreakdownByName(data, name) {
  const entry = (data || []).find((m) => m.name === name);
  if (!entry) return {};
  const totals = {};
  for (const point of entry.values || []) {
    for (const [type, count] of Object.entries(point.value || {})) {
      totals[type] = (totals[type] || 0) + Number(count || 0);
    }
  }
  return totals;
}

// Pra métricas "extras" que nem toda conta tem habilitado (cliques de
// contato, reações, etc.) — tenta, mas nunca derruba o resto do relatório se
// o Meta recusar (conta sem esse recurso configurado, métrica descontinuada
// naquela versão da API, etc.).
async function graphGetSafe(path, params) {
  try {
    return await graphGet(path, params);
  } catch (error) {
    return null;
  }
}

// Resumo semanal da Página do Facebook — exige a permissão read_insights
// (ver buildAuthorizeUrl). Lança erro (não usa graphGetSafe) nas métricas
// principais se a permissão não tiver sido concedida (token de conexões
// antigas, feitas antes dessa permissão existir) — isso sinaliza pro
// chamador que a conta precisa reconectar. As métricas extras abaixo são
// only-effort: podem faltar sem impedir o resto do relatório de aparecer.
async function getPageWeeklyInsights(pageAccessToken, pageId) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 7 * 24 * 60 * 60;
  const [{ data }, page, extra] = await Promise.all([
    graphGet(`/${pageId}/insights`, {
      access_token: pageAccessToken,
      metric: 'page_impressions,page_engaged_users,page_post_engagements',
      period: 'day',
      since,
      until,
    }),
    graphGet(`/${pageId}`, { access_token: pageAccessToken, fields: 'fan_count' }),
    graphGetSafe(`/${pageId}/insights`, {
      access_token: pageAccessToken,
      metric: 'page_impressions_unique,page_views_total,page_actions_post_reactions_total',
      period: 'day',
      since,
      until,
    }),
  ]);

  return {
    impressions: metricByName(data, 'page_impressions'),
    engagedUsers: metricByName(data, 'page_engaged_users'),
    postEngagements: metricByName(data, 'page_post_engagements'),
    impressionsSeries: seriesByName(data, 'page_impressions'),
    fans: page.fan_count || 0,
    reachUnique: extra ? metricByName(extra.data, 'page_impressions_unique') : null,
    pageViews: extra ? metricByName(extra.data, 'page_views_total') : null,
    reactions: extra ? actionBreakdownByName(extra.data, 'page_actions_post_reactions_total') : null,
  };
}

// Resumo semanal da conta profissional do Instagram — exige
// instagram_manage_insights (ver buildAuthorizeUrl). Métricas extras (cliques
// de contato) só existem se o perfil tiver botão de contato configurado —
// vem null quando não disponível, nunca inventado.
async function getInstagramWeeklyInsights(pageAccessToken, igUserId) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 7 * 24 * 60 * 60;
  const [{ data }, profile, extra] = await Promise.all([
    graphGet(`/${igUserId}/insights`, {
      access_token: pageAccessToken,
      metric: 'impressions,reach,profile_views',
      period: 'day',
      since,
      until,
    }),
    graphGet(`/${igUserId}`, { access_token: pageAccessToken, fields: 'followers_count' }),
    graphGetSafe(`/${igUserId}/insights`, {
      access_token: pageAccessToken,
      metric: 'website_clicks,get_directions_clicks,phone_call_clicks,email_contacts,text_message_clicks',
      period: 'day',
      since,
      until,
    }),
  ]);

  return {
    impressions: metricByName(data, 'impressions'),
    reach: metricByName(data, 'reach'),
    profileViews: metricByName(data, 'profile_views'),
    reachSeries: seriesByName(data, 'reach'),
    followers: profile.followers_count || 0,
    websiteClicks: extra ? metricByName(extra.data, 'website_clicks') : null,
    directionsClicks: extra ? metricByName(extra.data, 'get_directions_clicks') : null,
    callClicks: extra ? metricByName(extra.data, 'phone_call_clicks') : null,
    emailContacts: extra ? metricByName(extra.data, 'email_contacts') : null,
    textClicks: extra ? metricByName(extra.data, 'text_message_clicks') : null,
  };
}

// As publicações mais recentes do Instagram, ordenadas por engajamento —
// usa as últimas 12 pra achar as top N, sem paginar mais que isso.
// comments_count/like_count vêm do escopo básico (instagram_basic), já
// concedido desde sempre — funcionam mesmo em conexões antigas, sem precisar
// reconectar. Só o "engagement/impressions/reach" por post depende da
// permissão nova (instagram_manage_insights).
async function getInstagramTopPosts(pageAccessToken, igUserId, limit = 5) {
  const { data: media } = await graphGet(`/${igUserId}/media`, {
    access_token: pageAccessToken,
    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count',
    limit: 12,
  });

  const withInsights = [];
  for (const item of media || []) {
    const entry = { ...item, comments: item.comments_count || 0, likes: item.like_count || 0 };
    try {
      const { data: insights } = await graphGet(`/${item.id}/insights`, {
        access_token: pageAccessToken,
        metric: 'engagement,impressions,reach',
      });
      for (const m of insights || []) entry[m.name] = sumMetricSeries(m.values) || m.values?.[0]?.value || 0;
    } catch (error) {
      // Sem permissão de insights ainda (precisa reconectar) — segue só com comentários/curtidas.
    }
    withInsights.push(entry);
  }

  const score = (item) => item.engagement || item.likes + item.comments;
  return withInsights.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

async function graphPost(path, params) {
  const response = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Meta Graph API recusou ${path}: ${body.error?.message || response.status}`);
  }
  return body;
}

async function publishFacebookPhoto({ pageAccessToken, pageId, imageUrl, caption }) {
  const body = await graphPost(`/${pageId}/photos`, {
    url: imageUrl,
    caption: caption || '',
    access_token: pageAccessToken,
  });
  return { postId: body.post_id || body.id };
}

async function publishFacebookVideo({ pageAccessToken, pageId, videoUrl, caption }) {
  const body = await graphPost(`/${pageId}/videos`, {
    file_url: videoUrl,
    description: caption || '',
    access_token: pageAccessToken,
  });
  return { postId: body.id };
}

// Vídeo no Instagram processa de forma assíncrona do lado do Meta — cria o
// container (media) e só publica depois que o status virar FINISHED. Photo
// não precisa disso, publica na hora.
async function waitForIgMediaReady(pageAccessToken, creationId, { timeoutMs = 120000, intervalMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await graphGet(`/${creationId}`, { access_token: pageAccessToken, fields: 'status_code' });
    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR') throw new Error('Instagram recusou o processamento da mídia');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Tempo esgotado esperando o Instagram processar a mídia');
}

async function publishInstagramPhoto({ pageAccessToken, igUserId, imageUrl, caption }) {
  const created = await graphPost(`/${igUserId}/media`, {
    image_url: imageUrl,
    caption: caption || '',
    access_token: pageAccessToken,
  });
  const published = await graphPost(`/${igUserId}/media_publish`, {
    creation_id: created.id,
    access_token: pageAccessToken,
  });
  return { postId: published.id };
}

async function publishInstagramVideo({ pageAccessToken, igUserId, videoUrl, caption }) {
  const created = await graphPost(`/${igUserId}/media`, {
    video_url: videoUrl,
    caption: caption || '',
    media_type: 'REELS',
    access_token: pageAccessToken,
  });
  await waitForIgMediaReady(pageAccessToken, created.id);
  const published = await graphPost(`/${igUserId}/media_publish`, {
    creation_id: created.id,
    access_token: pageAccessToken,
  });
  return { postId: published.id };
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCodeForLongLivedUserToken,
  listManagedPages,
  getPageWeeklyInsights,
  getInstagramWeeklyInsights,
  getInstagramTopPosts,
  publishFacebookPhoto,
  publishFacebookVideo,
  publishInstagramPhoto,
  publishInstagramVideo,
};
