const crypto = require('crypto');
const { listGithubFolder } = require('./github');
const { loadUsers } = require('./users');
const { decryptToken } = require('./token-crypto');

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

// A postagem anterior ainda está no ar? (Franklin, 2026-09-25: o Kleber
// apagou nas redes um vídeo que saiu com preço e a trava não deixou postar de
// novo — "repetido somente depois que ver a postagem nas redes sociais".)
// Confere no Facebook/Instagram cada postId ok de publicacao-resultado.json.
// Stories não contam (somem em 24h); TikTok/YouTube/Telegram não dá pra
// conferir daqui. Nada confirmado no ar → não é repetido.
async function graphExists(id, token) {
  const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(id)}?fields=id&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) });
  const data = await res.json().catch(() => ({}));
  if (!data.error) return true;
  if (data.error.code === 100 || data.error.code === 33) return false; // não existe mais
  return null; // sem permissão pra ler esse tipo de objeto — indefinido
}

async function inPublishedPosts(pageId, id, token) {
  const res = await fetch(`${GRAPH_BASE}/${pageId}/published_posts?fields=id&limit=100&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) });
  const data = await res.json().catch(() => ({}));
  if (!Array.isArray(data.data)) return null;
  const want = new Set([id, `${pageId}_${id}`]);
  return data.data.some((p) => want.has(p.id) || want.has(String(p.id).split('_').pop()));
}

async function isStillLive({ owner, repo, token, pedido, revisaoEntries }) {
  const resultEntry = revisaoEntries.find((e) => e.name.toLowerCase() === 'publicacao-resultado.json');
  if (!resultEntry) return false;
  let results;
  try {
    results = await (await fetch(resultEntry.download_url, { signal: AbortSignal.timeout(15000) })).json();
  } catch {
    return false;
  }
  const checkable = (Array.isArray(results) ? results : []).filter(
    (r) => r && r.status === 'ok' && (r.channel === 'facebook' || r.channel === 'instagram') && (r.postId || r.id)
  );
  if (checkable.length === 0) return false;

  const users = await loadUsers();
  const user = users.find((u) => u.client === pedido.client);
  const pages = (user && user.connections && user.connections.meta && user.connections.meta.pages) || [];
  for (const r of checkable) {
    const id = String(r.postId || r.id);
    for (const page of pages) {
      let pageToken;
      try {
        pageToken = decryptToken(page.pageAccessToken);
      } catch {
        continue;
      }
      try {
        const exists = await graphExists(id, pageToken);
        if (exists === true) return true;
        if (exists === null && r.channel === 'facebook' && (await inPublishedPosts(page.pageId, id, pageToken))) return true;
      } catch {
        // Falha de rede numa conferência não conta como "no ar".
      }
    }
  }
  return false;
}

// Trava de pedido repetido — pedido do Franklin, 2026-09-23: a Alessandra
// (RJ Inox) mandou o MESMO pedido duas vezes (mesmas 2 fotos + mesmo vídeo,
// arquivos idênticos, às 16h e às 19h36 de 22/09) e tudo saiu duplicado na
// página, deu trabalho apagar na mão depois. Aqui, antes de criar a pasta de
// um pedido novo, compara cada foto/vídeo anexado com os arquivos dos pedidos
// recentes (mesmo conteúdo = mesmo "blob sha" do git, não importa o nome do
// arquivo). Achou igual → recusa o pedido com uma mensagem clara.
//
// Os 4 vendedores da RJ Inox publicam na MESMA página, então pra eles a
// comparação vale entre as 4 pastas (um vendedor repetindo a foto de outro
// também duplicaria na página).

const WINDOW_DAYS = 7;

function gitBlobSha(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

// app-YYYYMMDD-HHMMSS (UTC) → Date
function pedidoDate(folderName) {
  const m = /^app-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(folderName);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

function formatPedidoDate(date) {
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function clientsToCompare({ owner, repo, token, client }) {
  if (!client.endsWith('-rjinox')) return [client];
  const skills = await listGithubFolder({ owner, repo, token, path: '.claude/skills' });
  const group = skills.filter((e) => e.type === 'dir' && e.name.endsWith('-rjinox')).map((e) => e.name);
  return group.includes(client) ? group : [client, ...group];
}

// Devolve null se não achou repetição, ou { client, pasta, date, file } do
// pedido anterior com arquivo idêntico. Nunca bloqueia por erro próprio —
// se o GitHub falhar aqui, deixa o pedido passar (melhor um repetido raro do
// que travar todo envio por instabilidade).
async function findDuplicatePedido({ client, files, stagedFiles }) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token || !client) return null;

  try {
    const newShas = new Map(); // sha → nome do arquivo novo
    for (const f of files || []) {
      if (!f || !f.buffer || !/^(image|video)\//.test(f.mimetype || '')) continue;
      newShas.set(gitBlobSha(f.buffer), f.originalname);
    }
    const staged = (stagedFiles || []).filter((f) => f && typeof f.stagedPath === 'string' && /^(image|video)\//.test(f.mimetype || ''));
    if (staged.length > 0) {
      const stagingList = await listGithubFolder({ owner, repo, token, path: `.claude/skills/${client}/_staging` });
      const byPath = new Map(stagingList.map((e) => [e.path, e.sha]));
      for (const f of staged) {
        const sha = byPath.get(f.stagedPath);
        if (sha) newShas.set(sha, f.filename);
      }
    }
    if (newShas.size === 0) return null;

    const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const clients = await clientsToCompare({ owner, repo, token, client });

    const recentPedidos = [];
    await Promise.all(
      clients.map(async (c) => {
        const entries = await listGithubFolder({ owner, repo, token, path: `.claude/skills/${c}` });
        for (const e of entries) {
          const date = e.type === 'dir' ? pedidoDate(e.name) : null;
          if (date && date.getTime() >= cutoff) recentPedidos.push({ client: c, pasta: e.name, date });
        }
      })
    );
    recentPedidos.sort((a, b) => b.date - a.date);

    const matches = [];
    await Promise.all(
      recentPedidos.map(async (p) => {
        const entries = await listGithubFolder({ owner, repo, token, path: `.claude/skills/${p.client}/${p.pasta}` });
        const hit = entries.find((e) => e.type === 'file' && newShas.has(e.sha));
        if (!hit) return;
        // Só conta como repetido se o pedido anterior FOI PUBLICADO (cliente
        // aprovou — revisao/APROVADO.txt). Ajuste 2026-09-23 (Franklin):
        // pedido recusado/cancelado, ainda em revisão ou que falhou não saiu
        // nas redes, então mandar de novo a mesma foto/vídeo é legítimo (ex:
        // "não ficou como eu queria, vou pedir de novo").
        if (!entries.some((e) => e.type === 'dir' && e.name === 'revisao')) return;
        const revisao = await listGithubFolder({ owner, repo, token, path: `.claude/skills/${p.client}/${p.pasta}/revisao` });
        if (!revisao.some((e) => e.name.toUpperCase() === 'APROVADO.TXT')) return;
        if (!(await isStillLive({ owner, repo, token, pedido: p, revisaoEntries: revisao }))) return;
        matches.push({ ...p, file: newShas.get(hit.sha) });
      })
    );
    if (matches.length === 0) return null;
    matches.sort((a, b) => b.date - a.date);
    return matches[0];
  } catch (error) {
    console.error('[duplicate-pedido] falha ao conferir repetição, deixando passar:', error.message);
    return null;
  }
}

function duplicateMessage(dup) {
  return (
    `Pedido repetido: o arquivo "${dup.file}" já foi publicado num pedido de ${formatPedidoDate(dup.date)} e essa postagem ainda está no ar nas redes. ` +
    'Pra não publicar a mesma coisa duas vezes nas redes, este pedido não foi enviado. ' +
    'Se quiser postar algo novo, anexe outra foto ou vídeo.'
  );
}

module.exports = { findDuplicatePedido, duplicateMessage, gitBlobSha };
