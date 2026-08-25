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

  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', scope);
  url.searchParams.set('response_type', 'code');
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

// Resumo semanal da Página do Facebook — exige a permissão read_insights
// (ver buildAuthorizeUrl). Lança erro se a permissão não tiver sido concedida
// (token de conexões antigas, feitas antes dessa permissão existir).
async function getPageWeeklyInsights(pageAccessToken, pageId) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 7 * 24 * 60 * 60;
  const [{ data }, page] = await Promise.all([
    graphGet(`/${pageId}/insights`, {
      access_token: pageAccessToken,
      metric: 'page_impressions,page_engaged_users,page_post_engagements',
      period: 'day',
      since,
      until,
    }),
    graphGet(`/${pageId}`, { access_token: pageAccessToken, fields: 'fan_count' }),
  ]);

  return {
    impressions: metricByName(data, 'page_impressions'),
    engagedUsers: metricByName(data, 'page_engaged_users'),
    postEngagements: metricByName(data, 'page_post_engagements'),
    impressionsSeries: seriesByName(data, 'page_impressions'),
    fans: page.fan_count || 0,
  };
}

// Resumo semanal da conta profissional do Instagram — exige
// instagram_manage_insights (ver buildAuthorizeUrl).
async function getInstagramWeeklyInsights(pageAccessToken, igUserId) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 7 * 24 * 60 * 60;
  const [{ data }, profile] = await Promise.all([
    graphGet(`/${igUserId}/insights`, {
      access_token: pageAccessToken,
      metric: 'impressions,reach,profile_views',
      period: 'day',
      since,
      until,
    }),
    graphGet(`/${igUserId}`, { access_token: pageAccessToken, fields: 'followers_count' }),
  ]);

  return {
    impressions: metricByName(data, 'impressions'),
    reach: metricByName(data, 'reach'),
    profileViews: metricByName(data, 'profile_views'),
    reachSeries: seriesByName(data, 'reach'),
    followers: profile.followers_count || 0,
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

module.exports = {
  buildAuthorizeUrl,
  exchangeCodeForLongLivedUserToken,
  listManagedPages,
  getPageWeeklyInsights,
  getInstagramWeeklyInsights,
  getInstagramTopPosts,
};
