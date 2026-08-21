const { hashPassword, loadUsers, saveUsers, findUser, normalizeIdentifier } = require('./_lib/users');

// A allowlist já diz qual empresa cada e-mail/telefone aprovado pertence
// ("identificador:cliente" por entrada) — assim ninguém escolhe/enxerga nome
// de empresa na tela de cadastro, e não dá pra ver quem mais já é cliente.
function getAllowlistMap() {
  const map = new Map();
  for (const entry of String(process.env.SIGNUP_ALLOWLIST || '').split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const sep = trimmed.lastIndexOf(':');
    if (sep === -1) continue;
    const identifier = normalizeIdentifier(trimmed.slice(0, sep));
    const client = trimmed.slice(sep + 1).trim();
    if (identifier && client) map.set(identifier, client);
  }
  return map;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { inviteKey, identifier, password } = req.body || {};

  if (!process.env.APP_PASSPHRASE || inviteKey !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Chave de convite incorreta' });
    return;
  }

  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) {
    res.status(400).json({ error: 'E-mail ou telefone é obrigatório' });
    return;
  }

  const client = getAllowlistMap().get(normalizedIdentifier);
  if (!client) {
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

  res.status(200).json({ ok: true, identifier: normalizedIdentifier });
};
