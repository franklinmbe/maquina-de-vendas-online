const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { decryptToken } = require('../lib/token-crypto');
const {
  publishFacebookPhoto,
  publishFacebookVideo,
  publishInstagramPhoto,
  publishInstagramVideo,
} = require('../lib/meta');

// Publica de fato no Facebook/Instagram do cliente usando o token que ele
// autorizou em /api/meta/oauth-callback — puxa a mídia por URL pública.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, mediaUrl, mediaType, caption, targets } = req.body || {};

  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  if (!mediaUrl || !String(mediaUrl).trim()) {
    res.status(400).json({ error: 'mediaUrl é obrigatório' });
    return;
  }
  if (!['image', 'video'].includes(mediaType)) {
    res.status(400).json({ error: 'mediaType precisa ser "image" ou "video"' });
    return;
  }

  const metaConnection = user.connections && user.connections.meta;
  if (!metaConnection || !Array.isArray(metaConnection.pages) || metaConnection.pages.length === 0) {
    res.status(400).json({ error: 'Nenhuma conta do Facebook/Instagram conectada' });
    return;
  }

  const wantFacebook = !Array.isArray(targets) || targets.includes('facebook');
  const wantInstagram = !Array.isArray(targets) || targets.includes('instagram');

  const results = [];
  for (const page of metaConnection.pages) {
    const pageAccessToken = decryptToken(page.pageAccessToken);

    if (wantFacebook) {
      try {
        const result =
          mediaType === 'video'
            ? await publishFacebookVideo({ pageAccessToken, pageId: page.pageId, videoUrl: mediaUrl, caption })
            : await publishFacebookPhoto({ pageAccessToken, pageId: page.pageId, imageUrl: mediaUrl, caption });
        results.push({ channel: 'facebook', pageName: page.pageName, status: 'ok', ...result });
      } catch (error) {
        results.push({ channel: 'facebook', pageName: page.pageName, status: 'erro', error: error.message });
      }
    }

    if (wantInstagram && page.instagramBusinessId) {
      try {
        const result =
          mediaType === 'video'
            ? await publishInstagramVideo({ pageAccessToken, igUserId: page.instagramBusinessId, videoUrl: mediaUrl, caption })
            : await publishInstagramPhoto({ pageAccessToken, igUserId: page.instagramBusinessId, imageUrl: mediaUrl, caption });
        results.push({ channel: 'instagram', pageName: page.instagramUsername, status: 'ok', ...result });
      } catch (error) {
        results.push({ channel: 'instagram', pageName: page.instagramUsername, status: 'erro', error: error.message });
      }
    }
  }

  const anyFailed = results.some((r) => r.status === 'erro');
  res.status(anyFailed ? 207 : 200).json({ ok: true, results });
};
