const { putFileToGithub, listGithubFolder } = require('../lib/github');
const { markProjeto } = require('../lib/projetos');
const { publishApprovedPedido } = require('../lib/auto-publish');
const { isProcessing } = require('../lib/auto-generate');

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

  if (isProcessing({ client, pasta })) {
    res.status(409).json({ error: 'Ainda estou terminando de preparar esse pedido (o vídeo ou banner está subindo). Espere uns segundos e toque em Aprovar de novo.' });
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

  // Criado no Cut Estúdio (projeto.json): aprovar só guarda nos Projetos do
  // cliente; a publicação é feita depois, na tela Postar (Franklin,
  // 2026-10-19: criação separada da postagem).
  const root = await listGithubFolder({ owner, repo, token, path: `.claude/skills/${client}/${pasta}` }).catch(() => []);
  if (root.some((e) => e.name === 'projeto.json')) {
    await markProjeto(client, pasta, { status: 'pronto' }, { tipo: 'aprovado', texto: '✅ Você aprovou. Pronta pra postar.' }).catch(() => {});
    res.status(200).json({ ok: true, projeto: true });
    return;
  }

  // A aprovação já está gravada mesmo se a publicação abaixo der erro — por
  // isso fica num try/catch separado, e sempre devolve 200 com o detalhe de
  // cada rede em "published" (o cliente já vê "aprovado" de qualquer forma).
  // A publicação roda em segundo plano e a resposta sai em no máximo 20 s
  // (achado real 2026-09-23, Dudu): pedido com banner+vídeo+fotos em várias
  // redes/formatos leva minutos; o celular desistia e mostrava "Failed to
  // fetch" mesmo com tudo publicado certo. Se terminar antes de 20 s, devolve
  // o resultado na hora; senão devolve `publishing: true` e a tela acompanha
  // sozinha até aparecer revisao/publicacao-resultado.json.
  const publishPromise = publishApprovedPedido({ client, pasta })
    .then((r) => ({ ok: true, published: r.results, publishError: r.ok ? null : r.error }))
    .catch((error) => ({ ok: true, published: [], publishError: error.message || 'Falha ao publicar' }));
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 20000));
  const early = await Promise.race([publishPromise, timeout]);
  res.status(200).json(early || { ok: true, publishing: true });
};
