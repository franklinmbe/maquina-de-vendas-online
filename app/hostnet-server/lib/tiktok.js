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

// O access_token dura ~24h — chamar isso antes de publicar quando estiver
// perto (ou já) expirado, usando o refresh_token guardado na conexão.
async function refreshAccessToken(refreshToken) {
  const { clientKey, clientSecret } = getAppCredentials();
  const body = await postForm(TOKEN_URL, {
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
}

const USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url';

// Nome + foto de perfil da conta — usado tanto pra diferenciar as 2 contas
// de TikTok do Franklin quanto pra tela "Contas Conectadas". Não afeta
// publicação.
async function getUserInfo(accessToken) {
  const response = await fetch(USER_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json();
  if (!response.ok || (body.error && body.error.code !== 'ok')) {
    return { displayName: null, avatarUrl: null };
  }
  return {
    displayName: body.data?.user?.display_name || null,
    avatarUrl: body.data?.user?.avatar_url || null,
  };
}

const PUBLISH_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/video/init/';

async function bearerPost(url, accessToken, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok || (body.error && body.error.code !== 'ok')) {
    throw new Error(`TikTok API recusou: ${body.error?.message || response.status}`);
  }
  return body.data;
}

// Publica direto no perfil do cliente, puxando o vídeo de uma URL pública
// (Direct Post, source PULL_FROM_URL — não vira rascunho no app do TikTok).
// privacy_level SELF_ONLY é obrigatório enquanto o app não tiver passado pela
// aprovação do TikTok pro Content Posting API com escopo de publicação
// pública — sem essa aprovação, a API recusa qualquer outro nível de
// privacidade (ver CLAUDE.md, pendência de aprovação do app).
async function publishVideo({ accessToken, videoUrl, caption }) {
  const data = await bearerPost(PUBLISH_INIT_URL, accessToken, {
    post_info: {
      title: caption || '',
      privacy_level: 'SELF_ONLY',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: videoUrl,
    },
  });
  return { publishId: data.publish_id };
}

// --- Postagem direta pela tela própria do TikTok (tiktok-postar.html) ---
// Segue as regras de UX do Content Posting API (Content Sharing Guidelines):
// a tela mostra o criador, o cliente escolhe a privacidade (sem padrão),
// comentários/dueto/costura e a divulgação de conteúdo comercial. O vídeo
// sobe por FILE_UPLOAD (não precisa de domínio verificado, ao contrário do
// PULL_FROM_URL). Liberado só pra contas de teste (tiktokBeta) enquanto o
// app não é aprovado — 19/11/2026.
const CREATOR_INFO_URL = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';
const PUBLISH_STATUS_URL = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';

async function queryCreatorInfo(accessToken) {
  return bearerPost(CREATOR_INFO_URL, accessToken, {});
}

// Regras de pedaços do TikTok: até 64 MB vai num pedaço só; acima disso,
// pedaços de 10 MB e o último leva o resto.
function chunkPlan(size) {
  const MB = 1024 * 1024;
  if (size <= 64 * MB) return { chunkSize: size, total: 1 };
  const chunkSize = 10 * MB;
  return { chunkSize, total: Math.floor(size / chunkSize) };
}

async function publishVideoFile({ accessToken, buffer, mimetype, caption, privacyLevel, disableComment, disableDuet, disableStitch, brandContent, brandOrganic }) {
  const size = buffer.length;
  const { chunkSize, total } = chunkPlan(size);
  const data = await bearerPost(PUBLISH_INIT_URL, accessToken, {
    post_info: {
      title: caption || '',
      privacy_level: privacyLevel,
      disable_comment: !!disableComment,
      disable_duet: !!disableDuet,
      disable_stitch: !!disableStitch,
      video_cover_timestamp_ms: 1000,
      brand_content_toggle: !!brandContent,
      brand_organic_toggle: !!brandOrganic,
    },
    source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunkSize, total_chunk_count: total },
  });
  for (let i = 0; i < total; i++) {
    const start = i * chunkSize;
    const end = i === total - 1 ? size - 1 : start + chunkSize - 1;
    const response = await fetch(data.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': mimetype || 'video/mp4',
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${size}`,
      },
      body: buffer.subarray(start, end + 1),
    });
    if (!response.ok) throw new Error(`TikTok recusou o envio do vídeo (parte ${i + 1}/${total}): ${response.status}`);
  }
  return { publishId: data.publish_id };
}

async function fetchPublishStatus(accessToken, publishId) {
  return bearerPost(PUBLISH_STATUS_URL, accessToken, { publish_id: publishId });
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  publishVideo,
  getUserInfo,
  queryCreatorInfo,
  publishVideoFile,
  fetchPublishStatus,
};
