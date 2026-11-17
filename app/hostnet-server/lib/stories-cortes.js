// Cortes do Stories do Instagram (Franklin, 2026-11-17): vídeo com mais de
// 60 s não entra no Stories do Instagram (o Meta devolve só "Fatal"). Na
// geração do pedido, o vídeo já é dividido em partes iguais e as partes vão
// pra revisao/cortes-stories/ — a cliente vê os cortes lado a lado na
// aprovação, apaga o que não quiser, e a publicação usa só o que sobrou.
// cortes.json guarda quais partes cada vídeo tinha: assim, se a cliente
// apagar todos os cortes de um vídeo, ele não sai no Stories (em vez de o
// app dividir de novo sozinho na hora de publicar).
const { listGithubFolder, listGithubFolderOrNull, putFileToGithub } = require('./github');
const { splitVideoForStories } = require('./media-pipeline');

const CORTES_DIR = 'cortes-stories';
const VIDEO_EXT = ['mp4', 'mov', 'm4v', 'webm'];
const extOf = (name) => String(name).split('.').pop().toLowerCase();
const stemOf = (name) => String(name).replace(/\.[^.]+$/, '');

async function fetchJsonOrNull(url) {
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now());
    if (!r.ok) return null;
    return JSON.parse(await r.text());
  } catch {
    return null;
  }
}

// O pedido pediu Stories no Instagram? Mesma regra de lib/auto-publish.js
// (formatAppliesToPlatform + redes.json).
function wantsInstagramStories(formato, redes) {
  const formats = formato && Array.isArray(formato.formats) ? formato.formats : ['post'];
  if (!formats.includes('stories')) return false;
  const fn = formato && formato.formatNetworks;
  if (fn && Object.prototype.hasOwnProperty.call(fn, 'stories')) {
    if (!Array.isArray(fn.stories) || !fn.stories.includes('instagram')) return false;
  }
  if (Array.isArray(redes) && redes.length > 0) {
    return redes.some((n) => n && n.platform === 'instagram' && !n.viaPostiz);
  }
  return true;
}

// Chamado no fim da geração (lib/auto-generate.js). Melhor esforço: se der
// erro, a publicação ainda divide sozinha (storiesVideoParts em auto-publish).
async function makeStoriesCuts({ owner, repo, token, basePath }) {
  const root = await listGithubFolder({ owner, repo, token, path: basePath });
  const file = (n) => root.find((e) => e.type === 'file' && e.name.toLowerCase() === n);
  const formato = file('formato.json') ? await fetchJsonOrNull(file('formato.json').download_url) : null;
  const redes = file('redes.json') ? await fetchJsonOrNull(file('redes.json').download_url) : null;
  if (!wantsInstagramStories(formato, redes)) return null;

  const revisao = await listGithubFolder({ owner, repo, token, path: `${basePath}/revisao` });
  const videos = revisao.filter((e) => e.type === 'file' && VIDEO_EXT.includes(extOf(e.name)));
  const map = {};
  for (const vid of videos) {
    const buf = Buffer.from(await (await fetch(vid.download_url)).arrayBuffer());
    const { duration, parts } = await splitVideoForStories(buf, vid.name);
    if (parts.length <= 1) continue;
    const names = [];
    for (let i = 0; i < parts.length; i++) {
      const name = `${stemOf(vid.name)}-parte${i + 1}.mp4`;
      await putFileToGithub({
        owner, repo, token,
        path: `${basePath}/revisao/${CORTES_DIR}/${name}`,
        message: `cortes pro Stories (vídeo de ${Math.round(duration)} s): ${name}`,
        base64Content: parts[i].toString('base64'),
      });
      names.push(name);
    }
    map[vid.name] = { duracao: Math.round(duration * 10) / 10, partes: names };
  }
  if (Object.keys(map).length === 0) return null;
  await putFileToGithub({
    owner, repo, token,
    path: `${basePath}/revisao/${CORTES_DIR}/cortes.json`,
    message: `cortes pro Stories: ${basePath}`,
    base64Content: Buffer.from(JSON.stringify(map, null, 2), 'utf-8').toString('base64'),
  });
  return map;
}

// Na publicação: { 'video.mp4': { duracao, partes: [{ name, download_url }] } }
// com só os cortes que a cliente deixou. null = pedido sem cortes.
async function loadStoriesCuts({ owner, repo, token, basePath }) {
  const list = await listGithubFolderOrNull({ owner, repo, token, path: `${basePath}/revisao/${CORTES_DIR}` });
  if (!list) return null;
  const idx = list.find((e) => e.type === 'file' && e.name === 'cortes.json');
  const map = idx ? await fetchJsonOrNull(idx.download_url) : null;
  if (!map || typeof map !== 'object') return null;
  const present = new Map(list.filter((e) => e.type === 'file').map((e) => [e.name, e]));
  const out = {};
  for (const [video, info] of Object.entries(map)) {
    const partes = (info && Array.isArray(info.partes) ? info.partes : []).filter((n) => present.has(n)).map((n) => present.get(n));
    out[video] = { duracao: info && info.duracao, total: info && Array.isArray(info.partes) ? info.partes.length : 0, partes };
  }
  return out;
}

module.exports = { CORTES_DIR, makeStoriesCuts, loadStoriesCuts, wantsInstagramStories };
