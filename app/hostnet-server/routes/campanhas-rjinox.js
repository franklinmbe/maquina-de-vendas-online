const fs = require('fs');
const path = require('path');
const { loadUsers, findUser, verifyPassword } = require('../lib/users');

// Relatório das campanhas de Meta Ads da RJ Inox (pedido do Franklin,
// 2026-09-23): admin (senha mestra ou frank) e os vendedores da RJ Inox
// (clientes *-rjinox) podem ver — "todos precisam saber disso". Fica atrás do
// login porque tem investimento e resultado de cada vendedor. Os números vêm
// de lib/relatorios/campanhas-rjinox.json, atualizado pelo Claude a partir
// do Gerenciador de Anúncios (o app não tem acesso de API a essa conta).
const DATA_PATH = path.join(__dirname, '..', 'lib', 'relatorios', 'campanhas-rjinox.json');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  let client = null;
  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    client = 'frank';
  } else {
    const users = await loadUsers();
    const user = findUser(users, identifier);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
      return;
    }
    client = user.client;
  }
  const isAdmin = client === 'frank';
  if (!isAdmin && !String(client || '').endsWith('-rjinox')) {
    res.status(403).json({ error: 'Esse relatório é só da equipe da RJ Inox.' });
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    res.status(200).json({ ok: true, isAdmin, client, data });
  } catch (error) {
    res.status(500).json({ error: 'O relatório ainda não foi montado. Peça ao Claude pra atualizar.' });
  }
};
