const AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status';

function getAppCredentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET não configurados');
  return { clientId, clientSecret };
}

function buildAuthorizeUrl({ redirectUri, state }) {
  const { clientId } = getAppCredentials();
  const scope = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
  ].join(' ');

  const url = new URL(AUTH_BASE);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  // access_type=offline + prompt=consent garantem que o refresh_token vem
  // sempre, mesmo se o cliente já tiver autorizado o app antes.
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}

async function postForm(url, params) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Google recusou: ${body.error_description || body.error || response.status}`);
  }
  return body;
}

async function exchangeCodeForToken({ code, redirectUri }) {
  const { clientId, clientSecret } = getAppCredentials();
  const body = await postForm(TOKEN_URL, {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
}

// O access_token do Google dura ~1h — o refresh_token normalmente não expira
// (a menos que o cliente revogue o acesso) e o Google não devolve um
// refresh_token novo a cada renovação, então mantemos o original salvo.
async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = getAppCredentials();
  const body = await postForm(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
}

// Diferente do Meta/TikTok, a API do YouTube não "puxa" o vídeo de uma URL —
// precisa receber os bytes do vídeo direto no corpo da requisição. Baixamos
// o vídeo da URL pública e montamos um upload multipart (metadata + binário)
// numa só chamada — os vídeos deste projeto são curtos (máx. 90s, ver
// CLAUDE.md), então cabem tranquilo em memória sem precisar de upload
// resumível em pedaços.
async function uploadVideo({ accessToken, videoUrl, title, description, privacyStatus }) {
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Não consegui baixar o vídeo de ${videoUrl}: ${videoResponse.status}`);
  }
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

  const metadata = {
    snippet: {
      title: title || 'Vídeo',
      description: description || '',
    },
    // "private" por padrão enquanto o app não passar pela verificação do
    // Google (necessária pros escopos sensíveis de YouTube antes de
    // publicar em nome de clientes de verdade, fora dos usuários de teste).
    status: { privacyStatus: privacyStatus || 'private' },
  };

  const boundary = `mvo_boundary_${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`, 'utf-8'),
    Buffer.from(`--${boundary}\r\nContent-Type: video/*\r\n\r\n`, 'utf-8'),
    videoBuffer,
    Buffer.from(`\r\n--${boundary}--`, 'utf-8'),
  ]);

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`YouTube recusou o upload: ${result.error?.message || response.status}`);
  }
  return { videoId: result.id };
}

// Nome + miniatura do canal — usado na tela "Contas Conectadas" (o servidor
// nunca salvou isso no momento da conexão, então busca ao vivo).
async function getChannelInfo(accessToken) {
  const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json();
  if (!response.ok) return { title: null, avatarUrl: null };
  const channel = body.items?.[0];
  return {
    title: channel?.snippet?.title || null,
    avatarUrl: channel?.snippet?.thumbnails?.default?.url || null,
  };
}

module.exports = { buildAuthorizeUrl, exchangeCodeForToken, refreshAccessToken, uploadVideo, getChannelInfo };
