const { loadUsers, saveUsers, findUser, verifyPassword } = require('../lib/users');
const { encryptToken, decryptToken } = require('../lib/token-crypto');
const { checkPostQuota, recordPostsPublished } = require('../lib/post-quota');
const { refreshAccessToken, publishVideo } = require('../lib/tiktok');

// Publica de fato no TikTok do cliente usando o token de /api/tiktok/oauth-callback.
// TikTok só aceita vídeo (sem foto) e, enquanto o app não passar pela aprovação
// do Content Posting API, só publica como privado (SELF_ONLY) — ver lib/tiktok.js.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, mediaUrl, caption, targets } = req.body || {};

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

  const raw = user.connections && user.connections.tiktok;
  // Contas conectadas antes do suporte a múltiplas contas ainda são um objeto
  // solto, não uma lista — trata os dois formatos igual.
  const accounts = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (accounts.length === 0) {
    res.status(400).json({ error: 'Nenhuma conta do TikTok conectada' });
    return;
  }

  const quota = checkPostQuota(user);
  if (!quota.allowed) {
    res.status(403).json({ error: quota.error });
    return;
  }

  // targets (opcional) filtra por openId — sem isso, publica em todas as
  // contas conectadas (comportamento do Franklin hoje: um vídeo vai pras 2).
  const selected = Array.isArray(targets) && targets.length
    ? accounts.filter((a) => targets.includes(a.openId))
    : accounts;

  const results = [];
  let dirty = false;

  for (const account of selected) {
    try {
      let accessToken = decryptToken(account.accessToken);

      if (Date.now() >= account.expiresAt - 60000) {
        const refreshToken = decryptToken(account.refreshToken);
        const refreshed = await refreshAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        account.accessToken = encryptToken(refreshed.accessToken);
        account.refreshToken = encryptToken(refreshed.refreshToken);
        account.expiresAt = refreshed.expiresAt;
        dirty = true;
      }

      const result = await publishVideo({ accessToken, videoUrl: mediaUrl, caption });
      results.push({ openId: account.openId, displayName: account.displayName, status: 'ok', ...result });
    } catch (error) {
      results.push({ openId: account.openId, displayName: account.displayName, status: 'erro', error: error.message });
    }
  }

  if (dirty) {
    user.connections.tiktok = accounts;
  }

  const okCount = results.filter((r) => r.status === 'ok').length;
  if (okCount > 0) {
    recordPostsPublished(user, okCount);
    dirty = true;
  }

  if (dirty) {
    await saveUsers(users);
  }

  const anyFailed = results.some((r) => r.status === 'erro');
  res.status(anyFailed ? 207 : 200).json({ ok: true, channel: 'tiktok', results });
};
