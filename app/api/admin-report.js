const { loadUsers } = require('./_lib/users');

// Relatório administrativo — só quantidade e lista de contas por enquanto,
// mais campos entram conforme o Franklin for pedindo (ver app/public/relatorio.html).
// Nunca devolve passwordHash.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase } = req.body || {};

  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  const users = await loadUsers();
  const accounts = users.map((u) => ({
    name: u.name,
    identifier: u.identifier,
    altIdentifier: u.altIdentifier || '',
    client: u.client,
    plan: u.plan || '',
    lastLogin: u.lastLogin || null,
  }));

  res.status(200).json({
    ok: true,
    total: accounts.length,
    loggedAtLeastOnce: accounts.filter((a) => a.lastLogin).length,
    accounts,
  });
};
