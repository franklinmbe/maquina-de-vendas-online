// Uso de mídia por cliente, contado direto nas pastas de pedido do GitHub
// (.claude/skills/<cliente>/app-*/) — uma única chamada à árvore do repo.
//
// - "prontas": fotos/vídeos que o cliente mandou (arquivos soltos na pasta do
//   pedido) — conteúdo que já chegou pronto.
// - "feitas por nós": fotos/vídeos que estão em revisao/ e NÃO são cópia de
//   um original do cliente (banner, vídeo montado, vídeo em movimento etc.).
// - "aprovados": pedidos com revisao/APROVADO.txt.
const IMG = /\.(jpe?g|png|webp|heic|gif)$/i;
const VID = /\.(mp4|mov|webm|m4v|avi)$/i;
const CACHE_MS = 5 * 60 * 1000;
let cache = { at: 0, data: null };

async function fetchTree() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`GitHub recusou a árvore do repo: ${response.status}`);
  const json = await response.json();
  return json.tree || [];
}

function emptyStats() {
  return {
    pedidos: 0,
    aprovados: 0,
    prontas: { fotos: 0, videos: 0 },
    feitas: { fotos: 0, videos: 0 },
    ultimoPedido: null,
    // Um item por pedido (t = data/hora em UTC, do nome da pasta), para o
    // painel filtrar por período (hoje / 7 / 15 / 30 dias) no navegador.
    lista: [],
  };
}

async function getMediaStatsByClient() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;

  const tree = await fetchTree();
  // pedidos[client][pasta] = { originais: Set, revisao: [], aprovado }
  const pedidos = {};
  const re = /^\.claude\/skills\/([^/]+)\/(app-\d{8}-\d{6})\/(.+)$/;
  for (const item of tree) {
    if (item.type !== 'blob') continue;
    const m = re.exec(item.path);
    if (!m) continue;
    const [, client, pasta, rest] = m;
    const byClient = (pedidos[client] = pedidos[client] || {});
    const p = (byClient[pasta] = byClient[pasta] || { originais: new Set(), revisao: [], aprovado: false });
    if (!rest.includes('/')) {
      if (IMG.test(rest) || VID.test(rest)) p.originais.add(rest);
    } else if (rest.startsWith('revisao/') && !rest.slice(8).includes('/')) {
      const name = rest.slice(8);
      if (name === 'APROVADO.txt') p.aprovado = true;
      else if (IMG.test(name) || VID.test(name)) p.revisao.push(name);
    }
  }

  const result = {};
  for (const [client, pastas] of Object.entries(pedidos)) {
    const s = emptyStats();
    for (const [pasta, p] of Object.entries(pastas)) {
      const item = { t: null, aprovado: p.aprovado, pf: 0, pv: 0, ff: 0, fv: 0 };
      for (const f of p.originais) {
        if (VID.test(f)) item.pv += 1;
        else item.pf += 1;
      }
      for (const f of p.revisao) {
        if (p.originais.has(f)) continue; // cópia do que o cliente mandou
        if (VID.test(f)) item.fv += 1;
        else item.ff += 1;
      }
      // O nome da pasta (app-AAAAMMDD-HHMMSS) é gravado em UTC.
      const m = /app-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(pasta);
      item.t = m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
      s.pedidos += 1;
      if (item.aprovado) s.aprovados += 1;
      s.prontas.fotos += item.pf;
      s.prontas.videos += item.pv;
      s.feitas.fotos += item.ff;
      s.feitas.videos += item.fv;
      if (item.t && (!s.ultimoPedido || item.t > s.ultimoPedido)) s.ultimoPedido = item.t;
      s.lista.push(item);
    }
    result[client] = s;
  }

  cache = { at: Date.now(), data: result };
  return result;
}

module.exports = { getMediaStatsByClient, emptyStats };
