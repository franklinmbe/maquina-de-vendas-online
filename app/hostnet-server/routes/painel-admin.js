const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { buildPainel, addTarefa, toggleTarefa, deleteTarefa } = require('../lib/painel');

// Painel de controle: só admin (senha mestra ou conta frank). Um endpoint só:
// sem `action` devolve o painel inteiro; com `action` mexe nas tarefas do
// próprio Franklin (add | toggle | delete) e devolve o painel atualizado.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, action, title, id } = req.body || {};
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

  try {
    if (action) {
      let result;
      if (action === 'add') result = addTarefa(title);
      else if (action === 'toggle') result = toggleTarefa(id);
      else if (action === 'delete') result = deleteTarefa(id);
      else {
        res.status(400).json({ error: 'Ação inválida' });
        return;
      }
      if (result.error) {
        res.status(result.status || 400).json({ error: result.error });
        return;
      }
    }
    res.status(200).json(await buildPainel());
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao montar o painel' });
  }
};
