const { loadUsers } = require('../lib/users');
const { resolveClient } = require('../lib/auth');

// Devolve o histórico persistido do chat de criação da tela "Nova
// postagem" — inclui mensagens normais e prévias de conteúdo esperando
// aprovação (ver chat-deliver-preview.js e chat-mark-preview.js).
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
  res.status(200).json({ ok: true, client: resolvedClient, messages: (user && user.chatHistory) || [] });
};
