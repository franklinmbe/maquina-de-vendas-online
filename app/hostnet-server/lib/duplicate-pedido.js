const crypto = require('crypto');
const { listGithubFolder } = require('./github');

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

// Pedido anterior que não chegou a gerar/publicar nada — reenviar é legítimo.
const RESEND_ALLOWED_STATUSES = new Set([
  'failed_permanent',
  'quota_blocked_call_limit',
  'quota_blocked_media_limit',
  'blocked_vendor_identifier',
]);

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
        const statusEntry = entries.find((e) => e.name === 'geracao-status.json');
        if (statusEntry && statusEntry.download_url) {
          try {
            const status = await (await fetch(statusEntry.download_url)).json();
            if (status && RESEND_ALLOWED_STATUSES.has(status.status)) return;
          } catch {
            // Status ilegível — trata como pedido válido (bloqueia).
          }
        }
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
    `Pedido repetido: o arquivo "${dup.file}" já foi enviado num pedido de ${formatPedidoDate(dup.date)}. ` +
    'Pra não publicar a mesma coisa duas vezes nas redes, este pedido não foi enviado. ' +
    'Se quiser postar algo novo, anexe outra foto ou vídeo.'
  );
}

module.exports = { findDuplicatePedido, duplicateMessage, gitBlobSha };
