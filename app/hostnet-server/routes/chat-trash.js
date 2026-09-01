const { loadUsers } = require('../lib/users');
const { resolveClient } = require('../lib/auth');

// Devolve as conversas apagadas (segurar o botão de lixeira na tela "Nova
// postagem") — pra recuperar imagens/vídeos de prévias de um chat limpo.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  const resolvedClient = await resolveClient({ identifier, password });
  if (!resolvedClient) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  const users = await loadUsers();
  const user = users.find((u) => u.client === resolvedClient);
  res.status(200).json({ ok: true, trash: (user && user.chatTrash) || [] });
};
