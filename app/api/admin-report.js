const { loadUsers } = require('./_lib/users');

// Relatório administrativo, conta por conta: identidade, plano, login
// (última vez + quantidade) e uso (pedidos, fotos, vídeos). Mais campos
// entram conforme o Franklin for pedindo (ver app/public/relatorio.html).
// Nunca devolve passwordHash nem senha em texto puro — a senha do cliente
// nunca é armazenada em nenhum lugar, só o hash (scrypt, irreversível), então
// não existe "mostrar a senha" possível aqui, nem em uma versão futura disso.
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
    loginCount: u.loginCount || 0,
    totalPedidos: (u.stats && u.stats.totalPedidos) || 0,
    fotos: (u.stats && u.stats.fotos) || 0,
    videos: (u.stats && u.stats.videos) || 0,
    lastRequestAt: (u.stats && u.stats.lastRequestAt) || null,
  }));

  res.status(200).json({
    ok: true,
    total: accounts.length,
    loggedAtLeastOnce: accounts.filter((a) => a.lastLogin).length,
    accounts,
  });
};
