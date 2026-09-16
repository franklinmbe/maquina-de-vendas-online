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
    // Login legado (senha mestra): sempre entra como frank, mas antes
    // devolvia `connections: {}` fixo em vez de buscar a conta real dele —
    // "Redes conectadas" no relatório sempre mostrava 0 mesmo com tudo
    // conectado de verdade (achado real 2026-09-16). Mesmo padrão de
    // connected-accounts.js: busca a conta real do Franklin em `users`.
    const frankUser = users.find((u) => u.client === 'frank');
    res.status(200).json({
      ok: true,
      client: 'frank',
      plan: (frankUser && frankUser.plan) || '',
      connections: (frankUser && frankUser.connections) || {},
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
