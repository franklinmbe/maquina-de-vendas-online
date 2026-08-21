const { hashPassword, loadUsers, saveUsers, findUser, normalizeIdentifier } = require('./_lib/users');

// Clientes que podem se auto-cadastrar. "frank" fica de fora de propósito:
// o Franklin continua usando o login legado (senha mestra), não passa por aqui.
const ALLOWED_SIGNUP_CLIENTS = ['kleber-construcao'];

function getAllowlist() {
  return String(process.env.SIGNUP_ALLOWLIST || '')
    .split(',')
    .map((e) => normalizeIdentifier(e))
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { inviteKey, client, identifier, password } = req.body || {};

  if (!process.env.APP_PASSPHRASE || inviteKey !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Chave de convite incorreta' });
    return;
  }

  if (!ALLOWED_SIGNUP_CLIENTS.includes(client)) {
    res.status(400).json({ error: `Empresa inválida: ${client}` });
    return;
  }

  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) {
    res.status(400).json({ error: 'E-mail ou telefone é obrigatório' });
    return;
  }

  const allowlist = getAllowlist();
  if (!allowlist.includes(normalizedIdentifier)) {
    res.status(403).json({ error: 'Este e-mail/telefone ainda não foi liberado para cadastro. Peça ao Franklin para liberar.' });
    return;
  }

  if (!password || String(password).length < 6) {
    res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres' });
    return;
  }

  const users = await loadUsers();
  if (findUser(users, normalizedIdentifier)) {
    res.status(409).json({ error: 'Este e-mail/telefone já está cadastrado' });
    return;
  }

  users.push({ identifier: normalizedIdentifier, client, passwordHash: hashPassword(password) });
  await saveUsers(users);

  res.status(200).json({ ok: true, identifier: normalizedIdentifier, client });
};
