const { understandVideoUrl, readTextFromImage } = require('./gemini');

// Leitura do conteúdo de um anexo do composer (vídeo: descrição + fala +
// textos na tela; foto: texto escrito) pro chat de criação conseguir falar
// sobre ele ANTES do Publicar — pedido do Franklin 2026-09-24: vídeo só com
// música e texto na imagem, e o chat respondia que não conseguia ler o vídeo.
// Começa já no staging (routes/stage-attachment.js) e o chat
// (routes/creative-chat.js) reaproveita a mesma promessa, então cada arquivo
// é lido uma vez só (~R$0,05-0,15 por vídeo, ver understand_video).

const CHAT_VIDEO_EXTRA = `Além das 4 seções, acrescente no fim mais duas:
TÍTULO SUGERIDO: um título curto e chamativo (até 8 palavras) pro post, baseado principalmente nos textos escritos na tela.
NARRAÇÃO SUGERIDA: um texto de 15 a 30 segundos pra ser narrado em voz sobre esse vídeo, baseado nos textos e ofertas que aparecem escritos na tela (útil quando o vídeo só tem música).`;

const cache = new Map();
const MAX_CACHE = 200;

async function analyze(item) {
  if (item.type === 'video') {
    return understandVideoUrl(item.url, item.mimetype || 'video/mp4', CHAT_VIDEO_EXTRA);
  }
  const res = await fetch(item.url);
  if (!res.ok) throw new Error(`Não consegui baixar a imagem: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const text = await readTextFromImage(buffer, item.mimetype || 'image/jpeg');
  return `TEXTOS NA IMAGEM: ${text || 'Nenhum'}`;
}

function analyzeAttachment(item) {
  if (!item || !item.url) return Promise.resolve(null);
  if (cache.has(item.url)) return cache.get(item.url);
  const promise = analyze(item);
  cache.set(item.url, promise);
  // Falhou: não guarda o erro, pra próxima mensagem do chat tentar de novo.
  promise.catch(() => cache.delete(item.url));
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  return promise;
}

module.exports = { analyzeAttachment };
