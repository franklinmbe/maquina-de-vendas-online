const { deleteFileFromGithub, listGithubFolder } = require('../lib/github');
const { deleteWholePedido } = require('./delete-pedido');

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
    // Descartou o último item e não sobrou nada pra aprovar: apaga o pedido
    // inteiro (Franklin, 2026-10-19). Antes ficava a pasta com o vídeo
    // original e os textos, esquecida pra sempre (Jaqueline, 15 e 16/10).
    let pedidoDeleted = false;
    try {
      const revisao = await listGithubFolder({ owner, repo, token, path: `.claude/skills/${client}/${pasta}/revisao` });
      const left = revisao.filter((e) => e.type === 'file' && !PROTECTED_NAMES.includes(e.name.toLowerCase()));
      const approved = revisao.some((e) => e.name.toLowerCase() === 'aprovado.txt');
      if (left.length === 0 && !approved) {
        const { failed } = await deleteWholePedido({ owner, repo, token, client, pasta });
        pedidoDeleted = failed.length === 0;
      }
    } catch {
      // Melhor esforço: o descarte do arquivo já deu certo.
    }
    res.status(200).json({ ok: true, deleted: result.deleted, pedidoDeleted });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao apagar arquivo' });
  }
};
