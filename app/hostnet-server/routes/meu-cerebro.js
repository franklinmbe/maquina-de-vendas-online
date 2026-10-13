const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { buildUserBrain } = require('../lib/meu-cerebro');
const { friendlyName } = require('../lib/painel');
const { verifyShare } = require('../lib/share-token');

// "Meu cérebro": o mapa da trajetória do PRÓPRIO cliente logado. Isolamento
// é a regra central: o cliente vê sempre o dele, montado com os dados dele —
// o parâmetro `cliente` só vale pro admin (frank), que pode olhar o cérebro de
// qualquer usuário (é o controle total que ele pediu). Cliente comum que
// mandar `cliente` de outra pessoa recebe 403, e nunca cai no cérebro dela.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, cliente } = req.body || {};
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
      res.status(403).json({ error: 'Você só pode ver o seu próprio cérebro.' });
      return;
    }
    target = users.find((u) => u.client === cliente);
    if (!target) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }
  }

  try {
    const map = await buildUserBrain(target);
    const payload = { ok: true, viewing: { client: target.client, name: friendlyName(target), plan: target.plan || '' }, map };
    if (isAdmin) payload.clientes = users.map((u) => ({ client: u.client, name: friendlyName(u), plan: u.plan || '' }));
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao montar o cérebro' });
  }
};
