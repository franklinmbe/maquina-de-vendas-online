const { deleteFileFromGithub } = require('../lib/github');

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '');
}

const PROTECTED_NAMES = ['aprovado.txt', 'publicacao-resultado.json'];

// Descarta UM arquivo específico de dentro de revisao/, sem mexer no resto
// do pedido nem exigir aprovar/rejeitar tudo de uma vez — pedido do
// Franklin, 2026-09-10: poder marcar só os banners que não ficaram bons pra
// apagar e seguir ajustando o pedido até acertar, sem perder os outros.
// Mesmo modelo de confiança do approve-pedido.js: client+pasta é o que
// autoriza (sem exigir login) — quem vê essa tela de revisão já tem o link.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const client = safeSegment(req.body?.client);
  const pasta = safeSegment(req.body?.pasta);
  const filename = safeSegment(req.body?.filename);
  if (!client || !pasta || !filename) {
    res.status(400).json({ error: 'Cliente, pasta e arquivo são obrigatórios' });
    return;
  }
  if (PROTECTED_NAMES.includes(filename.toLowerCase())) {
    res.status(400).json({ error: 'Esse arquivo não pode ser apagado por aqui' });
    return;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    res.status(500).json({ error: 'Configuração do servidor incompleta' });
    return;
  }

  const path = `.claude/skills/${client}/${pasta}/revisao/${filename}`;
  try {
    const result = await deleteFileFromGithub({
      owner,
      repo,
      token,
      path,
      message: `descarte: ${client}/${pasta}/${filename}`,
    });
    res.status(200).json({ ok: true, deleted: result.deleted });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao apagar arquivo' });
  }
};
