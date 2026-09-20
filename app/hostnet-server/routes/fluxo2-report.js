const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { loadLog } = require('../lib/fluxo2-log');
const { loadTips } = require('../lib/fluxo2-tips');

// Planos em que o Fluxo 2 (Gestão de Tráfego) faz parte do pacote — só pra
// admin enxergar quem ainda está sem nenhum registro.
const PLANS_WITH_TRAFEGO = ['especialista', 'personalizado'];

// Registro diário do Fluxo 2. Cliente logado vê só os eventos do próprio
// registro (sem as notas internas, `visibility: 'admin'`); o admin (senha
// mestra ou conta frank) vê o de todos os clientes, mais a lista de quem tem
// o plano com Gestor de Tráfego mesmo que ainda sem nenhum evento.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  const users = await loadUsers();
  const log = loadLog();

  let isAdmin = false;
  let ownClient = null;
  let ownPlan = '';

  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    isAdmin = true;
    ownClient = 'frank';
  } else {
    const user = findUser(users, identifier);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
      return;
    }
    ownClient = user.client;
    ownPlan = user.plan || '';
    isAdmin = user.client === 'frank';
  }

  if (!isAdmin) {
    const events = log
      .filter((e) => e.client === ownClient && e.visibility !== 'admin')
      .map(({ visibility, ...rest }) => rest);
    const tips = loadTips().filter((t) => t.client === ownClient);
    res.status(200).json({ ok: true, admin: false, client: ownClient, plan: ownPlan, events, tips });
    return;
  }

  const allTips = loadTips();

  const byClient = new Map();
  for (const user of users) {
    if (!user.client || byClient.has(user.client)) continue;
    byClient.set(user.client, {
      client: user.client,
      name: user.name || user.client,
      plan: user.plan || '',
      trafego: PLANS_WITH_TRAFEGO.includes(user.plan),
      eventCount: 0,
      lastEventDate: '',
    });
  }
  for (const event of log) {
    let entry = byClient.get(event.client);
    if (!entry) {
      entry = { client: event.client, name: event.client, plan: '', trafego: false, eventCount: 0, lastEventDate: '' };
      byClient.set(event.client, entry);
    }
    entry.eventCount += 1;
    if (event.date > entry.lastEventDate) entry.lastEventDate = event.date;
  }

  // Só entra na lista quem tem o plano com Gestor de Tráfego ou já tem algum registro.
  const clients = [...byClient.values()]
    .filter((c) => c.trafego || c.eventCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  res.status(200).json({ ok: true, admin: true, client: ownClient, clients, events: log, tips: allTips });
};
