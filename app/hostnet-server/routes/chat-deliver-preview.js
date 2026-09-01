const { loadUsers, saveUsers } = require('../lib/users');

// Chamada manualmente por quem está processando um pedido (Claude, numa
// sessão com o Franklin) depois de gerar o conteúdo (banner/vídeo) — entrega
// a prévia direto no chat de criação do cliente (em vez de só mandar o link
// de aprovacao.html por WhatsApp). Protegida pela senha mestra, mesmo padrão
// de check-call-limit.js/admin-set-account.js.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase, client, media, caption, pedidoFolder } = req.body || {};
  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }
  if (!client || !String(client).trim()) {
    res.status(400).json({ error: 'client é obrigatório' });
    return;
  }
  if (!Array.isArray(media) || media.length === 0) {
    res.status(400).json({ error: 'media (lista de {type, url}) é obrigatório' });
    return;
  }

  const users = await loadUsers();
  const user = users.find((u) => u.client === String(client).trim());
  if (!user) {
    res.status(404).json({ error: `Cliente "${client}" não encontrado` });
    return;
  }

  user.chatHistory = user.chatHistory || [];
  user.chatHistory.push({
    role: 'bot',
    type: 'preview',
    text: caption || 'Prontinho! Dá uma olhada no que preparei — toca pra ver maior, e aprova se estiver bom.',
    media,
    pedidoFolder: pedidoFolder || null,
    approved: null,
  });
  await saveUsers(users);

  res.status(200).json({ ok: true });
};
