const { loadUsers, saveUsers } = require('../lib/users');
const { checkAndConsumeMedia } = require('../lib/media-quota');

// Chamada manualmente por quem está processando um pedido (Claude, numa
// sessão com o Franklin) bem antes de gerar cada imagem/vídeo por IA — nunca
// pra postar o que o cliente já mandou pronto (isso é ilimitado, ver
// comentário em commit.js). Protegida pela senha mestra, mesmo padrão de
// check-call-limit.js.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase, client, type, count } = req.body || {};
  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  if (!client || !String(client).trim()) {
    res.status(400).json({ error: 'client é obrigatório' });
    return;
  }
  if (type !== 'images' && type !== 'videos') {
    res.status(400).json({ error: 'type deve ser "images" ou "videos"' });
    return;
  }

  const users = await loadUsers();
  const user = users.find((u) => u.client === String(client).trim());
  if (!user) {
    res.status(404).json({ error: `Cliente "${client}" não encontrado` });
    return;
  }

  const result = checkAndConsumeMedia(user, type, Number(count) > 0 ? Number(count) : 1);
  if (result.allowed) {
    await saveUsers(users);
  }

  res.status(result.allowed ? 200 : 429).json(result);
};
