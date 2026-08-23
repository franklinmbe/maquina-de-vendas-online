const { hashPassword, loadUsers, saveUsers, findUser, normalizeIdentifier } = require('./_lib/users');

// A allowlist é a própria autorização: Franklin cobra o cliente por fora e só
// depois libera o e-mail/telefone dele aqui (editando a env var SIGNUP_ALLOWLIST
// no Vercel), já indicando o plano contratado — "identificador:cliente:plano"
// por entrada (plano é opcional, "identificador:cliente" também funciona).
// Isso é a ÚNICA porta de entrada do cadastro: nunca existiu, e nunca deve
// existir, uma "chave de convite" nem qualquer senha do Franklin envolvida —
// o cliente cria e confirma a própria senha, sem nunca ver a dele.
function getAllowlistMap() {
  const map = new Map();
  for (const entry of String(process.env.SIGNUP_ALLOWLIST || '').split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(':').map((p) => p.trim());
    if (parts.length < 2) continue;
    const identifier = normalizeIdentifier(parts[0]);
    const client = parts[1];
    const plan = parts[2] || '';
    if (identifier && client) map.set(identifier, { client, plan });
  }
  return map;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};

  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) {
    res.status(400).json({ error: 'E-mail ou telefone é obrigatório' });
    return;
  }

  const allowlistEntry = getAllowlistMap().get(normalizedIdentifier);
  if (!allowlistEntry) {
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

  const { client, plan } = allowlistEntry;
  users.push({ identifier: normalizedIdentifier, client, plan, passwordHash: hashPassword(password) });
  await saveUsers(users);

  res.status(200).json({ ok: true, identifier: normalizedIdentifier });
};
