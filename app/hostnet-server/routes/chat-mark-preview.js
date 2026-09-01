const { loadUsers, saveUsers } = require('../lib/users');
const { resolveClient } = require('../lib/auth');
const { putFileToGithub } = require('../lib/github');
const { publishApprovedPedido } = require('../lib/auto-publish');

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '');
}

// Aprovar/reprovar uma prévia de conteúdo direto no chat de criação —
// mesma lógica de fundo do approve-pedido.js (marcador APROVADO.txt +
// publishApprovedPedido), só que disparada de dentro da conversa em vez da
// página aprovacao.html separada, e também atualiza o histórico persistido
// do chat pra não voltar a mostrar os botões de aprovar/reprovar depois.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, messageIndex, approved } = req.body || {};
  const resolvedClient = await resolveClient({ identifier, password });
  if (!resolvedClient) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  const users = await loadUsers();
  const user = users.find((u) => u.client === resolvedClient);
  const msg = user && Array.isArray(user.chatHistory) ? user.chatHistory[messageIndex] : null;
  if (!msg || msg.type !== 'preview') {
    res.status(404).json({ error: 'Prévia não encontrada' });
    return;
  }

  msg.approved = !!approved;
  await saveUsers(users);

  if (!approved || !msg.pedidoFolder) {
    res.status(200).json({ ok: true, published: null });
    return;
  }

  const client = safeSegment(resolvedClient);
  const pasta = safeSegment(msg.pedidoFolder);
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (owner && repo && token) {
    try {
      await putFileToGithub({
        owner,
        repo,
        token,
        path: `.claude/skills/${client}/${pasta}/revisao/APROVADO.txt`,
        message: `aprovação via chat: ${client}/${pasta}`,
        base64Content: Buffer.from(`Aprovado pelo cliente (chat) em ${new Date().toISOString()}`, 'utf-8').toString('base64'),
      });
    } catch (error) {
      res.status(200).json({ ok: true, published: null, error: error.message || 'Falha ao registrar aprovação' });
      return;
    }
  }

  try {
    const publishResult = await publishApprovedPedido({ client, pasta });
    res.status(200).json({ ok: true, published: publishResult.results, publishError: publishResult.ok ? null : publishResult.error });
  } catch (error) {
    res.status(200).json({ ok: true, published: [], publishError: error.message || 'Falha ao publicar' });
  }
};
