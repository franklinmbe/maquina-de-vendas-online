const { resolveClient } = require('../lib/auth');
const { loadUsers } = require('../lib/users');
const { statusPipelineFor } = require('../lib/saas-tenant');
const { createFicha } = require('../lib/fichas');

// Cria uma Ordem de Serviço/ficha do módulo Administrativo (ver CLAUDE.md,
// produto "Aplicativo" — modelo RN Cell). targetClient permite o admin
// (frank) criar em nome de outro cliente, mesmo padrão de commit.js.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, targetClient, cliente, contato, item, defeito } = req.body || {};

  const resolvedClient = await resolveClient({ identifier, password });
  if (!resolvedClient) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }
  const client = resolvedClient === 'frank' && targetClient ? String(targetClient).trim() : resolvedClient;

  if (!cliente || !contato || !item) {
    res.status(400).json({ error: 'Informe o nome do cliente, o contato e o item/aparelho' });
    return;
  }

  const users = await loadUsers();
  const targetUser = users.find((u) => u.client === client) || {};
  const pipeline = statusPipelineFor(targetUser);

  try {
    const ficha = createFicha(client, { cliente, contato, item, defeito, pipeline });
    res.status(200).json({ ok: true, ficha });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao criar a ficha' });
  }
};
