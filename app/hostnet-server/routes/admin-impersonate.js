const { resolveClient } = require('../lib/auth');
const { loadUsers, signImpersonation } = require('../lib/users');

// "Entrar como cliente" (Franklin, 2026-09-25): o admin (frank), já logado,
// escolhe um cliente numa lista e passa a postar pela conta dele sem digitar
// e-mail/telefone nem saber a senha. Sem `client` → devolve a lista; com
// `client` → devolve a chave temporária (12 h) pra usar como senha, junto do
// identificador "cliente:<slug>" (ver lib/users.js).
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { identifier, password, client } = req.body || {};
  if (String(identifier || '').startsWith('cliente:') || (await resolveClient({ identifier, password })) !== 'frank') {
    res.status(403).json({ error: 'Só a conta de administrador pode entrar como outro usuário' });
    return;
  }

  const users = await loadUsers();
  if (!client) {
    const list = users
      .filter((u) => u.client && u.client !== 'frank')
      .map((u) => ({ client: u.client, name: u.name || u.client, plan: u.plan || '' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    res.status(200).json({ ok: true, users: list });
    return;
  }

  const target = users.find((u) => u.client === client && u.client !== 'frank');
  if (!target) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }
  res.status(200).json({ ok: true, identifier: `cliente:${target.client}`, password: signImpersonation(target.client), client: target.client, name: target.name || target.client });
};
