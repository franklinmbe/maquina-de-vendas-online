const { loadUsers, saveUsers } = require('../lib/users');
const { resolveClient } = require('../lib/auth');

// Apaga o histórico persistido do chat de criação (botão "Nova conversa" na
// tela "Nova postagem") — usado quando o chat fica cheio de texto e
// atrapalha acompanhar os diálogos novos.
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
  if (user) {
    user.chatHistory = [];
    await saveUsers(users);
  }
  res.status(200).json({ ok: true });
};
