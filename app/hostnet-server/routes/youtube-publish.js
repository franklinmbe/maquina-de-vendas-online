const { loadUsers, saveUsers, findUser, verifyPassword } = require('../lib/users');
const { encryptToken, decryptToken } = require('../lib/token-crypto');
const { checkPostQuota, recordPostsPublished } = require('../lib/post-quota');
const { refreshAccessToken, uploadVideo } = require('../lib/youtube');

// Publica de fato no YouTube do cliente usando o token de
// /api/youtube/oauth-callback. Diferente do Meta/TikTok, a API do YouTube não
// puxa o vídeo de uma URL — lib/youtube.js baixa o vídeo e envia os bytes
// direto no upload, então mediaUrl aqui só precisa ser uma URL pública
// acessível pelo servidor.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, mediaUrl, title, description, privacyStatus } = req.body || {};

  const users = await loadUsers();
  const user = findUser(users, identifier);
  // Senha mestra também autoriza publicar em nome de qualquer cliente — ver
  // meta-publish.js pro mesmo comentário.
  const isAdmin = Boolean(process.env.APP_PASSPHRASE) && password === process.env.APP_PASSPHRASE;
  if (!user || (!isAdmin && !verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  if (!mediaUrl || !String(mediaUrl).trim()) {
    res.status(400).json({ error: 'mediaUrl é obrigatório' });
    return;
  }

  const youtubeConnection = user.connections && user.connections.youtube;
  if (!youtubeConnection) {
    res.status(400).json({ error: 'Nenhuma conta do YouTube conectada' });
    return;
  }

  const quota = checkPostQuota(user);
  if (!quota.allowed) {
    res.status(403).json({ error: quota.error });
    return;
  }

  try {
    let accessToken = decryptToken(youtubeConnection.accessToken);

    if (Date.now() >= youtubeConnection.expiresAt - 60000) {
      const refreshToken = decryptToken(youtubeConnection.refreshToken);
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      youtubeConnection.accessToken = encryptToken(refreshed.accessToken);
      youtubeConnection.expiresAt = refreshed.expiresAt;
      user.connections.youtube = youtubeConnection;
    }

    const result = await uploadVideo({ accessToken, videoUrl: mediaUrl, title, description, privacyStatus });
    recordPostsPublished(user, 1);
    await saveUsers(users);
    res.status(200).json({ ok: true, channel: 'youtube', ...result });
  } catch (error) {
    res.status(500).json({ ok: false, channel: 'youtube', error: error.message });
  }
};
