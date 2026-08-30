const { putFileToGithub } = require('../lib/github');

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '');
}

// Marca um pedido como aprovado pelo cliente na página aprovacao.html —
// grava um arquivo-marcador dentro da própria pasta do pedido no GitHub
// (mesmo repositório onde o pedido e o conteúdo gerado já vivem), pra quem
// estiver processando aquele pedido conferir antes de publicar de verdade.
// Não exige login: o link da página de aprovação (client+pasta) já funciona
// como a "senha" de acesso, e o conteúdo ali já está no mesmo repositório
// público onde o pedido original foi salvo.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const client = safeSegment(req.body?.client);
  const pasta = safeSegment(req.body?.pasta);
  if (!client || !pasta) {
    res.status(400).json({ error: 'Cliente e pasta são obrigatórios' });
    return;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    res.status(500).json({ error: 'Configuração do servidor incompleta' });
    return;
  }

  const path = `.claude/skills/${client}/${pasta}/revisao/APROVADO.txt`;
  const content = `Aprovado pelo cliente em ${new Date().toISOString()}`;

  try {
    await putFileToGithub({
      owner,
      repo,
      token,
      path,
      message: `aprovação: ${client}/${pasta}`,
      base64Content: Buffer.from(content, 'utf-8').toString('base64'),
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao registrar aprovação' });
  }
};
