const { normalizeIdentifier } = require('./_lib/users');
const { loadDynamicAllowlist, saveDynamicAllowlist } = require('./_lib/allowlist');

// Libera um cliente novo pro cadastro, na hora, sem precisar mexer no painel do
// Vercel (a SIGNUP_ALLOWLIST via env var só passa a valer no próximo deploy —
// isso aqui é pra situação de "estou na rua, preciso liberar agora").
// Só quem sabe a senha mestra (APP_PASSPHRASE, a mesma do login legado do
// Franklin) consegue liberar — continua sendo só uma identidade, nunca a senha
// do cliente: ele cria e confirma a própria senha na tela de cadastro.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase, identifier, client, plan, altIdentifier } = req.body || {};

  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  const normalizedIdentifier = normalizeIdentifier(identifier);
  const trimmedClient = String(client || '').trim();
  if (!normalizedIdentifier || !trimmedClient) {
    res.status(400).json({ error: 'Identificador e cliente são obrigatórios' });
    return;
  }

  const normalizedAlt = altIdentifier ? normalizeIdentifier(altIdentifier) : '';

  const entries = await loadDynamicAllowlist();
  const filtered = entries.filter((e) => normalizeIdentifier(e.identifier) !== normalizedIdentifier);
  filtered.push({
    identifier: normalizedIdentifier,
    client: trimmedClient,
    plan: String(plan || '').trim(),
    altIdentifier: normalizedAlt,
  });
  await saveDynamicAllowlist(filtered);

  res.status(200).json({ ok: true, identifier: normalizedIdentifier });
};
