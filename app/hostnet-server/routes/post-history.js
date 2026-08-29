const { loadUsers, findUser, verifyPassword } = require('../lib/users');

// Histórico de pedidos pra mostrar no Calendário — mesmo padrão de admin de
// connected-accounts.js: quem loga como frank vê o histórico de todos os
// clientes, cliente comum vê só o próprio.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  const users = await loadUsers();

  let targetUsers;

  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    targetUsers = users;
  } else {
    const user = findUser(users, identifier);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
      return;
    }
    targetUsers = user.client === 'frank' ? users : [user];
  }

  const entries = targetUsers.flatMap((u) =>
    (u.history || []).map((h) => ({ ...h, client: u.client }))
  );

  res.status(200).json({ ok: true, entries });
};
