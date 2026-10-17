const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { getMediaUsage } = require('../lib/media-quota');

// Saldo do mês pro topo do Cut Estúdio (imagens, vídeos e vídeos em
// movimento que ainda restam). Só leitura — não gasta nada.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { identifier, password } = req.body || {};
  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    res.status(200).json({ ok: true, ilimitado: true, plan: 'admin', nome: 'Franklin' });
    return;
  }
  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }
  const saldo = getMediaUsage(user);
  res.status(200).json({ ok: true, ilimitado: !saldo, saldo, plan: user.client === 'frank' ? 'admin' : (user.plan || ''), nome: user.name || '' });
};
