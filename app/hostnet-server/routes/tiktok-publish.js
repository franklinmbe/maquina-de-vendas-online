const { loadUsers, saveUsers, findUser, verifyPassword } = require('../lib/users');
const { encryptToken, decryptToken } = require('../lib/token-crypto');
const { refreshAccessToken, publishVideo } = require('../lib/tiktok');

// Publica de fato no TikTok do cliente usando o token de /api/tiktok/oauth-callback.
// TikTok só aceita vídeo (sem foto) e, enquanto o app não passar pela aprovação
// do Content Posting API, só publica como privado (SELF_ONLY) — ver lib/tiktok.js.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, mediaUrl, caption } = req.body || {};

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

  const tiktokConnection = user.connections && user.connections.tiktok;
  if (!tiktokConnection) {
    res.status(400).json({ error: 'Nenhuma conta do TikTok conectada' });
    return;
  }

  try {
    let accessToken = decryptToken(tiktokConnection.accessToken);

    if (Date.now() >= tiktokConnection.expiresAt - 60000) {
      const refreshToken = decryptToken(tiktokConnection.refreshToken);
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      tiktokConnection.accessToken = encryptToken(refreshed.accessToken);
      tiktokConnection.refreshToken = encryptToken(refreshed.refreshToken);
      tiktokConnection.expiresAt = refreshed.expiresAt;
      user.connections.tiktok = tiktokConnection;
      await saveUsers(users);
    }

    const result = await publishVideo({ accessToken, videoUrl: mediaUrl, caption });
    res.status(200).json({ ok: true, channel: 'tiktok', ...result });
  } catch (error) {
    res.status(500).json({ ok: false, channel: 'tiktok', error: error.message });
  }
};
