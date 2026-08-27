const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { sendPhoto, sendVideo } = require('../lib/telegram');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, mediaUrl, mediaType, caption } = req.body || {};

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

  const telegramConnection = user.connections && user.connections.telegram;
  if (!telegramConnection) {
    res.status(400).json({ error: 'Nenhum canal do Telegram conectado' });
    return;
  }

  try {
    const result =
      mediaType === 'video'
        ? await sendVideo({ chatId: telegramConnection.chatId, videoUrl: mediaUrl, caption })
        : await sendPhoto({ chatId: telegramConnection.chatId, photoUrl: mediaUrl, caption });
    res.status(200).json({ ok: true, channel: 'telegram', ...result });
  } catch (error) {
    res.status(500).json({ ok: false, channel: 'telegram', error: error.message });
  }
};
