const { hashPassword, loadUsers, saveUsers, findUser, normalizeIdentifier } = require('./_lib/users');
const { loadDynamicAllowlist } = require('./_lib/allowlist');

// A allowlist é a própria autorização: Franklin cobra o cliente por fora e só
// depois libera o e-mail/telefone dele — via a env var SIGNUP_ALLOWLIST no
// Vercel (só vale a partir do próximo deploy) ou via /api/admin-release (libera
// na hora, sem precisar mexer no painel, pra quando ele estiver fora do PC) —
// já indicando o plano contratado. Isso é a ÚNICA porta de entrada do cadastro:
// nunca existiu, e nunca deve existir, uma "chave de convite" nem qualquer
// senha do Franklin envolvida — o cliente cria e confirma a própria senha,
// sem nunca ver a dele.
//
// Formato da env var: "identificador:cliente:plano" por entrada (plano é
// opcional). Um 4º campo opcional ("...:identificador_alternativo") registra
// um segundo jeito de logar na mesma conta (ex: e-mail como principal +
// telefone como alternativo).
function getStaticAllowlistMap() {
  const map = new Map();
  for (const entry of String(process.env.SIGNUP_ALLOWLIST || '').split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(':').map((p) => p.trim());
    if (parts.length < 2) continue;
    const identifier = normalizeIdentifier(parts[0]);
    const client = parts[1];
    const plan = parts[2] || '';
    const altIdentifier = parts[3] ? normalizeIdentifier(parts[3]) : '';
    if (identifier && client) map.set(identifier, { client, plan, altIdentifier });
  }
  return map;
}

async function getAllowlistEntry(normalizedIdentifier) {
  const dynamicEntries = await loadDynamicAllowlist();
  const dynamicEntry = dynamicEntries.find((e) => normalizeIdentifier(e.identifier) === normalizedIdentifier);
  if (dynamicEntry) {
    return { client: dynamicEntry.client, plan: dynamicEntry.plan || '', altIdentifier: dynamicEntry.altIdentifier || '' };
  }
  return getStaticAllowlistMap().get(normalizedIdentifier);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { name, identifier, password } = req.body || {};

  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    res.status(400).json({ error: 'Nome é obrigatório' });
    return;
  }

  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) {
    res.status(400).json({ error: 'E-mail ou telefone é obrigatório' });
    return;
  }

  const allowlistEntry = await getAllowlistEntry(normalizedIdentifier);
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

  const { client, plan, altIdentifier } = allowlistEntry;
  const newUser = { name: trimmedName, identifier: normalizedIdentifier, client, plan, passwordHash: hashPassword(password) };
  if (altIdentifier) newUser.altIdentifier = altIdentifier;
  users.push(newUser);
  await saveUsers(users);

  res.status(200).json({ ok: true, identifier: normalizedIdentifier });
};
