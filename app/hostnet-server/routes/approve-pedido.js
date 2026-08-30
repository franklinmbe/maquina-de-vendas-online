const { putFileToGithub } = require('../lib/github');
const { publishApprovedPedido } = require('../lib/auto-publish');

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '');
}

// Marca um pedido como aprovado pelo cliente na página aprovacao.html —
// grava um arquivo-marcador dentro da própria pasta do pedido no GitHub
// (mesmo repositório onde o pedido e o conteúdo gerado já vivem) — e, na
// sequência, já publica de verdade nas redes conectadas do cliente (ver
// lib/auto-publish.js). Não exige login: o link da página de aprovação
// (client+pasta) já funciona como a "senha" de acesso, e o conteúdo ali já
// está no mesmo repositório público onde o pedido original foi salvo.
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
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao registrar aprovação' });
    return;
  }

  // A aprovação já está gravada mesmo se a publicação abaixo der erro — por
  // isso fica num try/catch separado, e sempre devolve 200 com o detalhe de
  // cada rede em "published" (o cliente já vê "aprovado" de qualquer forma).
  try {
    const publishResult = await publishApprovedPedido({ client, pasta });
    res.status(200).json({ ok: true, published: publishResult.results, publishError: publishResult.ok ? null : publishResult.error });
  } catch (error) {
    res.status(200).json({ ok: true, published: [], publishError: error.message || 'Falha ao publicar' });
  }
};
