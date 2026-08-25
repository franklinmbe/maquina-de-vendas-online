const AUTH_BASE = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

function getAppCredentials() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error('TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET não configurados');
  return { clientKey, clientSecret };
}

function buildAuthorizeUrl({ redirectUri, state }) {
  const { clientKey } = getAppCredentials();
  const scope = ['user.info.basic', 'video.publish', 'video.upload'].join(',');

  const url = new URL(AUTH_BASE);
  url.searchParams.set('client_key', clientKey);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', scope);
  url.searchParams.set('response_type', 'code');
  return url.toString();
}

async function postForm(url, params) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams(params).toString(),
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`TikTok API recusou: ${body.error_description || body.error || response.status}`);
  }
  return body;
}

// O access_token do TikTok expira em ~24h — guardamos junto o refresh_token
// (esse dura bem mais) e a data de expiração, pra quem for publicar depois
// saber quando precisa renovar antes de usar.
async function exchangeCodeForToken({ code, redirectUri }) {
  const { clientKey, clientSecret } = getAppCredentials();
  const body = await postForm(TOKEN_URL, {
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    openId: body.open_id,
    scope: body.scope,
  };
}

module.exports = { buildAuthorizeUrl, exchangeCodeForToken };
