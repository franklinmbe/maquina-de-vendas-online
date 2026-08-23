const { hashPassword, loadUsers, saveUsers, findUser, normalizeIdentifier } = require('./_lib/users');

// A allowlist já diz qual empresa e qual plano cada e-mail/telefone aprovado
// contratou ("identificador:cliente:plano" por entrada, plano é opcional pra
// compatibilidade com entradas antigas "identificador:cliente") — assim
// ninguém escolhe/enxerga nome de empresa ou plano na tela de cadastro, e não
// dá pra ver quem mais já é cliente. O plano fica registrado no cadastro do
// usuário pra entrar na conta de cota do Postiz Ultimate (ver
// .claude/skills/postiz-cota/SKILL.md).
function getAllowlistMap() {
  const map = new Map();
  for (const entry of String(process.env.SIGNUP_ALLOWLIST || '').split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(':');
    if (parts.length < 2) continue;
    const identifier = normalizeIdentifier(parts[0]);
    const client = parts[1].trim();
    const plan = (parts[2] || '').trim();
    if (identifier && client) map.set(identifier, { client, plan });
  }
  return map;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { inviteKey, identifier, password, confirmPassword } = req.body || {};

  if (!process.env.APP_PASSPHRASE || inviteKey !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Chave de convite incorreta' });
    return;
  }

  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) {
    res.status(400).json({ error: 'E-mail ou telefone é obrigatório' });
    return;
  }

  const authorized = getAllowlistMap().get(normalizedIdentifier);
  if (!authorized) {
    res.status(403).json({ error: 'Este e-mail/telefone ainda não foi liberado para cadastro. Peça ao Franklin para liberar.' });
    return;
  }

  if (!password || String(password).length < 6) {
    res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres' });
    return;
  }

  // O próprio cliente cria e confirma a senha aqui — o Franklin nunca vê nem
  // participa dessa senha, só autoriza o e-mail/telefone antes (allowlist).
  if (password !== confirmPassword) {
    res.status(400).json({ error: 'As senhas não coincidem' });
    return;
  }

  const users = await loadUsers();
  if (findUser(users, normalizedIdentifier)) {
    res.status(409).json({ error: 'Este e-mail/telefone já está cadastrado' });
    return;
  }

  users.push({
    identifier: normalizedIdentifier,
    client: authorized.client,
    plan: authorized.plan,
    passwordHash: hashPassword(password),
  });
  await saveUsers(users);

  res.status(200).json({ ok: true, identifier: normalizedIdentifier });
};
