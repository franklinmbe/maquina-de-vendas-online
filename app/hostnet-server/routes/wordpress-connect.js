const { resolveClient } = require('../lib/auth');
const { verifyCredentials } = require('../lib/wordpress');
const { encryptToken } = require('../lib/token-crypto');
const { saveUserConnection, loadUsers, findUser } = require('../lib/users');
const { checkPlanAllowsConnection } = require('../lib/plan-limits');

// WordPress não usa OAuth (não tem popup): o cliente gera uma "Senha de
// Aplicativo" no próprio site dele (Usuários → Perfil → Senhas de
// Aplicativo, recurso nativo desde WP 5.6) e informa aqui junto com o site
// e o usuário — a gente confere chamando /wp-json/wp/v2/users/me antes de
// salvar.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, siteUrl, wpUsername, appPassword } = req.body || {};

  const client = await resolveClient({ identifier, password });
  if (!client) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  if (!siteUrl || !wpUsername || !appPassword) {
    res.status(400).json({ error: 'Informe o site, o usuário e a senha de aplicativo do WordPress' });
    return;
  }

  const users = await loadUsers();
  const user = findUser(users, identifier);
  const planCheck = checkPlanAllowsConnection(user, 'wordpress', 1);
  if (!planCheck.ok) {
    res.status(403).json({ error: planCheck.error });
    return;
  }

  try {
    const { name } = await verifyCredentials({ siteUrl, username: wpUsername, appPassword });
    await saveUserConnection(identifier, 'wordpress', {
      connectedAt: new Date().toISOString(),
      siteUrl: String(siteUrl).replace(/\/$/, ''),
      username: wpUsername,
      appPassword: encryptToken(appPassword),
      name,
    });
    res.status(200).json({ ok: true, name });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Falha ao conectar o WordPress' });
  }
};
