const { hashPassword, loadUsers, saveUsers, findUser, normalizeIdentifier } = require('./_lib/users');

// Exceção explícita ao fluxo normal de /api/register: cria (ou substitui) a
// conta de um cliente já com uma senha escolhida por quem está usando esta
// rota, pulando o autocadastro. O padrão do projeto continua sendo o cliente
// criar e confirmar a própria senha em /api/register — usar isso aqui só
// quando Franklin pedir explicitamente essa exceção pra um cliente específico
// (caso de origem: Kleber Materiais de Construção, 2026-08-25, conta que
// Franklin administra em conjunto com o cliente).
// Continua protegido pela senha mestra (APP_PASSPHRASE) — sem ela, ninguém
// cria conta nenhuma por aqui.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase, name, identifier, client, plan, altIdentifier, password } = req.body || {};

  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  const trimmedName = String(name || '').trim();
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const trimmedClient = String(client || '').trim();

  if (!trimmedName || !normalizedIdentifier || !trimmedClient) {
    res.status(400).json({ error: 'Nome, identificador e cliente são obrigatórios' });
    return;
  }

  if (!password || String(password).length < 6) {
    res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres' });
    return;
  }

  const normalizedAlt = altIdentifier ? normalizeIdentifier(altIdentifier) : '';

  const users = await loadUsers();
  const existing = findUser(users, normalizedIdentifier);
  const record = {
    name: trimmedName,
    identifier: normalizedIdentifier,
    client: trimmedClient,
    plan: String(plan || '').trim(),
    passwordHash: hashPassword(password),
  };
  if (normalizedAlt) record.altIdentifier = normalizedAlt;
  if (existing && existing.connections) record.connections = existing.connections;

  const otherUsers = users.filter((u) => normalizeIdentifier(u.identifier) !== normalizedIdentifier);
  otherUsers.push(record);
  await saveUsers(otherUsers);

  res.status(200).json({ ok: true, identifier: normalizedIdentifier, created: !existing });
};
