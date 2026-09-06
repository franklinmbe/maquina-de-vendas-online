const { resolveClient } = require('../lib/auth');
const { listFichas } = require('../lib/fichas');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, targetClient, contato, status } = req.body || {};

  const resolvedClient = await resolveClient({ identifier, password });
  if (!resolvedClient) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }
  const client = resolvedClient === 'frank' && targetClient ? String(targetClient).trim() : resolvedClient;

  try {
    const fichas = listFichas(client, { contato, status });
    res.status(200).json({ ok: true, fichas });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao listar as fichas' });
  }
};
