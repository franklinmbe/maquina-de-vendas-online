const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { decryptToken } = require('../lib/token-crypto');
const { uploadMedia, createPost } = require('../lib/wordpress');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, title, content, mediaUrl } = req.body || {};

  const users = await loadUsers();
  const user = findUser(users, identifier);
  // Senha mestra também autoriza publicar em nome de qualquer cliente — ver
  // meta-publish.js pro mesmo comentário.
  const isAdmin = Boolean(process.env.APP_PASSPHRASE) && password === process.env.APP_PASSPHRASE;
  if (!user || (!isAdmin && !verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  const wp = user.connections && user.connections.wordpress;
  if (!wp) {
    res.status(400).json({ error: 'Nenhum site WordPress conectado' });
    return;
  }

  if (!title || !String(title).trim()) {
    res.status(400).json({ error: 'title é obrigatório' });
    return;
  }

  try {
    const appPassword = decryptToken(wp.appPassword);
    let featuredMediaId;
    if (mediaUrl) {
      const media = await uploadMedia({
        siteUrl: wp.siteUrl,
        username: wp.username,
        appPassword,
        mediaUrl,
        filename: 'imagem.jpg',
      });
      featuredMediaId = media.mediaId;
    }
    const result = await createPost({
      siteUrl: wp.siteUrl,
      username: wp.username,
      appPassword,
      title,
      content,
      featuredMediaId,
    });
    res.status(200).json({ ok: true, channel: 'wordpress', ...result });
  } catch (error) {
    res.status(500).json({ ok: false, channel: 'wordpress', error: error.message });
  }
};
