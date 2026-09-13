const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { getRecursosDoPlano, getTodosRecursos } = require('../lib/recursos-por-plano');

// "O que você tem disponível" — recursos de IA que o PRÓPRIO plano do
// cliente logado já inclui de verdade hoje. Mesma checagem de login normal
// (identifier+password, ou senha mestra pra admin) — qualquer cliente pode
// ver isso, não é admin-only, já que o objetivo é o cliente descobrir
// recurso que ele nem sabia que tinha.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  const users = await loadUsers();

  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    res.status(200).json({ ok: true, client: 'frank', plan: '', recursos: getTodosRecursos(), admin: true });
    return;
  }

  const user = findUser(users, identifier);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  // "frank" pode logar com a própria senha normal também, não só a mestra —
  // trata do mesmo jeito: vê tudo.
  if (user.client === 'frank') {
    res.status(200).json({ ok: true, client: 'frank', plan: user.plan || '', recursos: getTodosRecursos(), admin: true });
    return;
  }

  res.status(200).json({
    ok: true,
    client: user.client,
    plan: user.plan || '',
    recursos: getRecursosDoPlano(user.plan),
    admin: false,
  });
};
