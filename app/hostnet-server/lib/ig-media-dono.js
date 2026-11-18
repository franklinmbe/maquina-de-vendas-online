// Registro "de quem é cada post do Instagram" publicado pelo app.
// Serve pro painel "Virar anúncio" em Páginas compartilhadas (RJ Inox: vários
// vendedores na mesma @rj.inox) — cada vendedor só pode virar anúncio o que
// ELE mandou pelo app (regra do Franklin: nunca misturar conteúdo de vendedor).
// Arquivo: /data/ig-media-dono.json  { "<client>": ["<igMediaId>", ...] }
const fs = require('fs/promises');
const path = require('path');

const FILE = () => path.join(process.env.DATA_DIR || '/data', 'ig-media-dono.json');

async function lerDonos() {
  try { return JSON.parse(await fs.readFile(FILE(), 'utf8')); } catch { return {}; }
}

let fila = Promise.resolve();
function registrarMidias(client, ids) {
  const novos = (ids || []).map((x) => String(x || '').replace(/\D/g, '')).filter(Boolean);
  if (!client || !novos.length) return Promise.resolve();
  fila = fila.then(async () => {
    const d = await lerDonos();
    const set = new Set(d[client] || []);
    for (const id of novos) set.add(id);
    d[client] = [...set].slice(-2000);
    await fs.writeFile(FILE(), JSON.stringify(d, null, 1));
  }).catch((e) => console.error('[ig-media-dono]', e.message));
  return fila;
}

// pega os posts de feed/reels do Instagram que deram certo num resultado de publicação
function idsDoResultado(results) {
  return (results || [])
    .filter((r) => r && r.channel === 'instagram' && r.status === 'ok' && r.postId)
    .map((r) => r.postId);
}

async function midiasDoCliente(client) {
  return new Set(((await lerDonos())[client] || []).map(String));
}

module.exports = { registrarMidias, idsDoResultado, midiasDoCliente };
