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

module.exports = { buildAuthorizeUrl, exchangeCodeForLongLivedUserToken, listManagedPages };
