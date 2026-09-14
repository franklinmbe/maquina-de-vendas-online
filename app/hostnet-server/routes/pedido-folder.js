const { listGithubFolderOrNull } = require('../lib/github');

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '');
}

// Lista a pasta raiz e a revisao/ de um pedido, autenticado com o token do
// servidor — usado pelo tracker do composer (index.html) e pela tela de
// aprovação (aprovacao.html) EM VEZ de chamar api.github.com direto do
// navegador. Achado real 2026-09-14: api.github.com sem autenticação tem
// limite de 60 consultas/hora POR IP — o tracker sozinho, consultando a
// cada 20s, já bate nisso em ~20 minutos de uma aba aberta esperando a
// geração terminar (e mais rápido ainda se mais de um cliente estiver atrás
// do mesmo IP/rede, ou testando bastante como nesta sessão). Quando isso
// acontece, a tela trava mostrando o progresso antigo pra sempre, sem
// nenhum aviso — parece "travado" de novo, mas é rate limit, não bug de
// lógica. O token do servidor tem 5000 consultas/hora, folga enorme pro
// mesmo uso. Mesmo modelo de confiança do approve-pedido.js: client+pasta
// já é o que autoriza, sem exigir login (a aprovacao.html não pede senha).
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

  const basePath = `.claude/skills/${client}/${pasta}`;
  try {
    const [root, revisao] = await Promise.all([
      listGithubFolderOrNull({ owner, repo, token, path: basePath }),
      listGithubFolderOrNull({ owner, repo, token, path: `${basePath}/revisao` }),
    ]);
    res.status(200).json({ ok: true, root, revisao });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao consultar o pedido' });
  }
};
