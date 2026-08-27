function authHeader(username, appPassword) {
  const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
  return `Basic ${auth}`;
}

// Confere as credenciais chamando o próprio usuário logado — é o
// equivalente a "autorizar" nas outras redes, mas aqui é feito com Senha de
// Aplicativo (recurso nativo do WordPress desde a 5.6), sem OAuth.
async function verifyCredentials({ siteUrl, username, appPassword }) {
  const base = siteUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: authHeader(username, appPassword) },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`WordPress recusou: ${body.message || response.status}`);
  }
  return { name: body.name };
}

async function uploadMedia({ siteUrl, username, appPassword, mediaUrl, filename }) {
  const base = siteUrl.replace(/\/$/, '');
  const mediaResponse = await fetch(mediaUrl);
  if (!mediaResponse.ok) {
    throw new Error(`Não consegui baixar a mídia de ${mediaUrl}: ${mediaResponse.status}`);
  }
  const buffer = Buffer.from(await mediaResponse.arrayBuffer());
  const contentType = mediaResponse.headers.get('content-type') || 'application/octet-stream';

  const response = await fetch(`${base}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(username, appPassword),
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename || 'midia.jpg'}"`,
    },
    body: buffer,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`WordPress recusou o upload de mídia: ${body.message || response.status}`);
  }
  return { mediaId: body.id, url: body.source_url };
}

async function createPost({ siteUrl, username, appPassword, title, content, featuredMediaId, status }) {
  const base = siteUrl.replace(/\/$/, '');
  const payload = { title, content: content || '', status: status || 'publish' };
  if (featuredMediaId) payload.featured_media = featuredMediaId;

  const response = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(username, appPassword),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`WordPress recusou o post: ${body.message || response.status}`);
  }
  return { postId: body.id, link: body.link };
}

module.exports = { verifyCredentials, uploadMedia, createPost };
