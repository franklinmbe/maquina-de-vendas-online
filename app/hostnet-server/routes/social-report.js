const { loadUsers, findUser, verifyPassword } = require('../lib/users');

// Relatório que todo cliente logado vê sobre as próprias redes sociais.
// Pra quem loga como admin (frank), vem também um bloco extra com dados
// administrativos (hoje só quantidade de clientes cadastrados).
// Métricas reais de desempenho (curtidas, alcance, etc.) ainda não existem —
// isso depende de conectar com a API de Insights de cada rede (Meta, TikTok),
// que é um trabalho separado. Por enquanto mostra só quais redes o cliente já
// conectou e o plano dele.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  const users = await loadUsers();

  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    res.status(200).json({
      ok: true,
      client: 'frank',
      plan: '',
      connections: {},
      admin: { totalClientes: users.length },
    });
    return;
  }

  const user = findUser(users, identifier);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  const payload = {
    ok: true,
    client: user.client,
    plan: user.plan || '',
    connections: user.connections || {},
  };
  if (user.client === 'frank') {
    payload.admin = { totalClientes: users.length };
  }
  res.status(200).json(payload);
};
