const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { loadMap } = require('../lib/mapa-cerebro');

// Leitura do mapa do cérebro: só admin (senha mestra ou conta frank). O
// conteúdo é estrutura interna do negócio, por isso não fica no HTML público.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  let isAdmin = false;
  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    isAdmin = true;
  } else {
    const users = await loadUsers();
    const user = findUser(users, identifier);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
      return;
    }
    isAdmin = user.client === 'frank';
  }
  if (!isAdmin) {
    res.status(403).json({ error: 'Essa página é só pra administração.' });
    return;
  }

  const map = loadMap();
  if (!map) {
    res.status(404).json({ error: 'O mapa ainda não foi gerado. Peça ao Claude pra rodar o gerador do mapa.' });
    return;
  }
  res.status(200).json({ ok: true, map });
};
