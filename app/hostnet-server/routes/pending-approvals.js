const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { listGithubFolder } = require('../lib/github');
const { isProcessing } = require('../lib/auto-generate');
const { isRetryableFailure } = require('../lib/auto-publish');

// Só olha os pedidos mais recentes (pasta nomeada app-YYYYMMDD-HHMMSS, ordem
// alfabética = cronológica) — cliente antigo com muitos pedidos já aprovados
// no passado não precisa reconferir a história inteira toda vez que loga.
const MAX_RECENT_PEDIDOS = 15;

// Acha, pra um cliente, quais pedidos já têm revisao/ pronta (conteúdo
// gerado) mas ainda não foram aprovados (sem revisao/APROVADO.txt) nem
// ficaram vazios (tudo descartado pelo cliente) — mesmo critério que
// index.html usa no próprio tracker (checkOnce), só que aqui roda no
// servidor, sem depender do navegador ter acompanhado o pedido desde o
// envio. Ver CLAUDE.md / memória "video-understanding" pro caso real que
// motivou isso: pedido pronto, cliente logado, nada indicava que existia.
async function scanClient({ owner, repo, token, client }) {
  const basePath = `.claude/skills/${client}`;
  const rootEntries = await listGithubFolder({ owner, repo, token, path: basePath });
  // Postagem agendada (e criação já vista no Estúdio) não pede aprovação.
  const users = await loadUsers();
  const owner_ = users.find((u) => u.client === client);
  const semAprovacao = new Set(((owner_ && owner_.projetos) || []).filter((p) => p.semAprovacao).map((p) => p.pasta));
  const pedidoFolders = rootEntries
    .filter((e) => e.type === 'dir' && /^app-\d{8}-\d{6}$/.test(e.name) && !semAprovacao.has(e.name))
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(0, MAX_RECENT_PEDIDOS);

  const checked = await Promise.all(
    pedidoFolders.map(async (folder) => {
      // Geração ainda rodando: revisao/ pode estar pela metade (ver isProcessing).
      if (isProcessing({ client, pasta: folder.name })) return null;
      const revisaoEntries = await listGithubFolder({ owner, repo, token, path: `${basePath}/${folder.name}/revisao` });
      if (revisaoEntries.length === 0) return null;
      const approved = revisaoEntries.some((e) => e.name.toUpperCase() === 'APROVADO.TXT');
      if (approved) {
        // Já publicado, mas com rede/formato que deu erro nos últimos 7 dias:
        // avisa pra cliente poder tocar em "Repostar onde falhou" (2026-11-17).
        const m = /^app-(\d{4})(\d{2})(\d{2})/.exec(folder.name);
        const age = m ? Date.now() - Date.UTC(+m[1], +m[2] - 1, +m[3]) : Infinity;
        const resultEntry = revisaoEntries.find((e) => e.name.toLowerCase() === 'publicacao-resultado.json');
        if (!resultEntry || age > 7 * 86400000) return null;
        try {
          const r = await fetch(resultEntry.download_url + '?t=' + Date.now());
          const published = JSON.parse(await r.text());
          const failures = Array.isArray(published) ? published.filter(isRetryableFailure).length : 0;
          return failures > 0 ? { client, pasta: folder.name, failures } : null;
        } catch {
          return null;
        }
      }
      const mediaCount = revisaoEntries.filter(
        (e) => e.type === 'file' && e.name.toUpperCase() !== 'APROVADO.TXT' && e.name.toLowerCase() !== 'publicacao-resultado.json'
      ).length;
      if (mediaCount === 0) return null; // tudo descartado, nada pra aprovar
      return { client, pasta: folder.name, mediaCount };
    })
  );

  return checked.filter(Boolean);
}

async function pendingForClient(args) {
  return (await scanClient(args)).filter((c) => !c.failures).sort((a, b) => a.pasta.localeCompare(b.pasta));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  const users = await loadUsers();

  let client;
  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    client = 'frank';
  } else {
    const user = findUser(users, identifier);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
      return;
    }
    client = user.client;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    res.status(500).json({ error: 'Configuração do servidor incompleta' });
    return;
  }

  try {
    const all = await scanClient({ owner, repo, token, client });
    const pending = all.filter((c) => !c.failures).sort((a, b) => a.pasta.localeCompare(b.pasta));
    const failures = all.filter((c) => c.failures).sort((a, b) => b.pasta.localeCompare(a.pasta));
    res.status(200).json({ ok: true, pending, failures });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao checar pedidos pendentes' });
  }
};

// O painel de controle do admin (lib/painel.js) reaproveita a mesma checagem.
module.exports.pendingForClient = pendingForClient;
