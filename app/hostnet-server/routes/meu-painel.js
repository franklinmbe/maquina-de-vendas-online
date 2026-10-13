const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { buildUserPanel, addUserTarefa, toggleUserTarefa, deleteUserTarefa } = require('../lib/painel-usuario');
const { friendlyName } = require('../lib/painel');
const { verifyShare } = require('../lib/share-token');

// Painel de controle do usuário (métricas das redes + uso do app). Mesmas
// regras de isolamento do "Meu cérebro": o cliente é sempre o do login; o
// parâmetro `cliente` só vale pro admin (frank), que vê o painel de qualquer
// um em modo LEITURA — as tarefas (add/toggle/delete) só mexem no próprio
// painel de quem está logado, nunca no de outro.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, cliente, action, title, id } = req.body || {};
  const users = await loadUsers();

  let me = null;
  let isAdmin = false;
  // Link de compartilhamento (lib/share-token.js): abre o do cliente do link,
  // só pra ver — sem admin, sem trocar de cliente, sem mexer em nada.
  const shared = req.body && req.body.share ? verifyShare(req.body.share) : null;
  if (req.body && req.body.share) {
    me = shared && users.find((u) => u.client === shared.client);
    if (!me) {
      res.status(401).json({ error: 'Este link venceu ou não é válido. Peça um novo.' });
      return;
    }
  } else if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    isAdmin = true;
    me = users.find((u) => u.client === 'frank') || { client: 'frank', name: 'Franklin', plan: 'personalizado' };
  } else {
    const user = findUser(users, identifier);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
      return;
    }
    me = user;
    isAdmin = user.client === 'frank';
  }

  let target = me;
  if (cliente && cliente !== me.client && !shared) {
    if (!isAdmin) {
      res.status(403).json({ error: 'Você só pode ver o seu próprio painel.' });
      return;
    }
    target = users.find((u) => u.client === cliente);
    if (!target) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }
  }

  try {
    if (action) {
      if (shared || target.client !== me.client) {
        res.status(403).json({ error: 'Só dá pra mexer nas tarefas do seu próprio painel.' });
        return;
      }
      let result;
      if (action === 'add') result = addUserTarefa(me.client, title);
      else if (action === 'toggle') result = toggleUserTarefa(me.client, id);
      else if (action === 'delete') result = deleteUserTarefa(me.client, id);
      else {
        res.status(400).json({ error: 'Ação inválida' });
        return;
      }
      if (result.error) {
        res.status(result.status || 400).json({ error: result.error });
        return;
      }
    }
    const panel = await buildUserPanel(target);
    const payload = { ok: true, viewing: { client: target.client, name: friendlyName(target), plan: target.plan || '', somenteLeitura: !!shared || target.client !== me.client }, panel };
    if (isAdmin) payload.clientes = users.map((u) => ({ client: u.client, name: friendlyName(u), plan: u.plan || '' }));
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao montar o painel' });
  }
};
