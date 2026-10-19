const { listGithubFolder, deleteFileFromGithub } = require('../lib/github');

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '');
}

// Apaga um pedido inteiro (todos os arquivos da raiz + revisao/), pra sumir
// de vez com pedidos travados (failed_permanent, quota_blocked_*) que não
// têm nada em revisao/ pra usar o delete-revisao-file.js normal — pedido do
// Franklin, 2026-09-16: "tira essa porra da tela" depois de um pedido ficar
// preso mostrando erro pra sempre, sem nenhum jeito de sumir com ele.
// Mesmo modelo de confiança de sempre: client+pasta é o que autoriza.
// Apaga todos os arquivos do pedido, um de cada vez. Devolve { deleted, failed }.
// Também usado pelo delete-revisao-file.js quando o cliente descarta o
// último item da aprovação (pedido vazio não fica mais esquecido na pasta).
async function deleteWholePedido({ owner, repo, token, client, pasta }) {
  const basePath = `.claude/skills/${client}/${pasta}`;
  const [root, revisao] = await Promise.all([
    listGithubFolder({ owner, repo, token, path: basePath }),
    listGithubFolder({ owner, repo, token, path: `${basePath}/revisao` }),
  ]);

  const filePaths = [
    ...root.filter((e) => e.type === 'file').map((e) => `${basePath}/${e.name}`),
    ...revisao.filter((e) => e.type === 'file').map((e) => `${basePath}/revisao/${e.name}`),
  ];

  // Um de cada vez, não Promise.all — commits concorrentes pro mesmo ref
  // do GitHub disputam o mesmo HEAD e o GitHub rejeita todos menos um
  // (409), então em paralelo só 1 arquivo saía de fato mesmo respondendo
  // ok:true pros outros (achado real 2026-09-18: pedido da Jaqueline
  // ficou preso com 3 de 4 arquivos ainda lá depois de "apagado").
  const failed = [];
  for (const p of filePaths) {
    try {
      await deleteFileFromGithub({ owner, repo, token, path: p, message: `apaga pedido: ${p}` });
    } catch (error) {
      failed.push({ path: p, error: error.message });
    }
  }
  return { deleted: filePaths.length - failed.length, failed };
}

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

  try {
    const { deleted, failed } = await deleteWholePedido({ owner, repo, token, client, pasta });
    if (failed.length > 0) {
      res.status(207).json({ ok: false, deleted, failed });
      return;
    }
    res.status(200).json({ ok: true, deleted });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao apagar o pedido' });
  }
};

module.exports.deleteWholePedido = deleteWholePedido;
