const { loadUsers, saveUsers } = require('../lib/users');
const { resolveClient } = require('../lib/auth');

// Apaga só as mensagens selecionadas pelo cliente (botão de lixeira em modo
// de seleção, na tela "Nova postagem") — diferente de chat-clear.js, que
// apaga a conversa inteira de uma vez. `indices` são posições dentro de
// user.chatHistory (o próprio front calcula isso a partir do que já foi
// carregado por /api/chat-history). Igual chat-clear.js, arquiva o que foi
// removido em user.chatTrash antes de tirar, pra dar pra recuperar depois
// segurando o botão de lixeira.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, indices } = req.body || {};
  const resolvedClient = await resolveClient({ identifier, password });
  if (!resolvedClient) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }
  if (!Array.isArray(indices) || !indices.length) {
    res.status(400).json({ error: 'indices (lista de posições) é obrigatório' });
    return;
  }

  const users = await loadUsers();
  const user = users.find((u) => u.client === resolvedClient);
  if (!user || !Array.isArray(user.chatHistory)) {
    res.status(200).json({ ok: true, removedCount: 0 });
    return;
  }

  const idxSet = new Set(indices.map(Number).filter((n) => Number.isInteger(n) && n >= 0));
  const removed = user.chatHistory.filter((_, i) => idxSet.has(i));
  const kept = user.chatHistory.filter((_, i) => !idxSet.has(i));

  if (removed.length) {
    user.chatTrash = user.chatTrash || [];
    user.chatTrash.push({ clearedAt: new Date().toISOString(), messages: removed });
  }
  user.chatHistory = kept;
  await saveUsers(users);

  res.status(200).json({ ok: true, removedCount: removed.length });
};
