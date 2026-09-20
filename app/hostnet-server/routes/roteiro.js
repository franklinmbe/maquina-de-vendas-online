const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { loadRoteiro, buildVivo, buildParametros } = require('../lib/roteiro');

// Dados da seção "Tarefas pendentes e roteiro" da página Fluxos operacionais:
// só admin (senha mestra ou conta frank). É informação de gestão do negócio,
// por isso não vai no HTML público.
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

  const roteiro = loadRoteiro();
  if (!roteiro) {
    res.status(404).json({ error: 'O roteiro ainda não foi enviado. Peça ao Claude pra atualizar.' });
    return;
  }
  try {
    res.status(200).json({ ok: true, roteiro, vivo: await buildVivo(), parametros: buildParametros() });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao montar o roteiro' });
  }
};
