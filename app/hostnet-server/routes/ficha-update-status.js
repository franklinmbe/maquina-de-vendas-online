const { resolveClient } = require('../lib/auth');
const { loadUsers } = require('../lib/users');
const { statusPipelineFor } = require('../lib/saas-tenant');
const { updateFichaStatus } = require('../lib/fichas');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, targetClient, id, status } = req.body || {};

  const resolvedClient = await resolveClient({ identifier, password });
  if (!resolvedClient) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }
  const client = resolvedClient === 'frank' && targetClient ? String(targetClient).trim() : resolvedClient;

  if (!id || !status) {
    res.status(400).json({ error: 'id e status são obrigatórios' });
    return;
  }

  const users = await loadUsers();
  const targetUser = users.find((u) => u.client === client) || {};
  const pipeline = statusPipelineFor(targetUser);
  if (!pipeline.includes(status)) {
    res.status(400).json({ error: `Status inválido — use um destes: ${pipeline.join(', ')}` });
    return;
  }

  try {
    const ficha = updateFichaStatus(client, id, status);
    res.status(200).json({ ok: true, ficha });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Falha ao atualizar a ficha' });
  }
};
