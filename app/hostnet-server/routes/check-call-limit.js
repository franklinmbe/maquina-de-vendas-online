const { loadUsers, saveUsers } = require('../lib/users');
const { checkAndConsumeCall } = require('../lib/call-limit');

// Chamada manualmente por quem está processando um pedido (Claude, numa
// sessão com o Franklin) bem antes de gerar banner/vídeo por IA ou responder
// uma pergunta de suporte — nunca pra postar o que o cliente já mandou (isso
// é ilimitado, ver comentário em commit.js). Protegida pela senha mestra
// porque só faz sentido ser chamada de dentro de uma sessão de processamento,
// nunca pelo navegador do cliente.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase, client } = req.body || {};
  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  if (!client || !String(client).trim()) {
    res.status(400).json({ error: 'client é obrigatório' });
    return;
  }

  const users = await loadUsers();
  const user = users.find((u) => u.client === String(client).trim());
  if (!user) {
    res.status(404).json({ error: `Cliente "${client}" não encontrado` });
    return;
  }

  const result = checkAndConsumeCall(user);
  if (result.allowed) {
    await saveUsers(users);
  }

  res.status(result.allowed ? 200 : 429).json(result);
};
