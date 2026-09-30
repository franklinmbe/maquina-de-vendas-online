// Detecção de TUDO que está escrito (ou falado) nas mídias de um pedido —
// pedido do Franklin em 2026-09-21. Vale pra todos os clientes: o texto lido
// fica salvo na pasta do pedido (texto-detectado.json). Só a Rjinox BLOQUEIA
// com base nisso (regra: nenhum nome/telefone de vendedor no conteúdo, ver
// lib/client-content-rules.js e .claude/skills/rjinox-log/PROTOCOLO.md).
//
// Imagens: OCR por visão (gemini.readTextFromImage). Vídeos: a análise que o
// pedido já faz (gemini.understandVideoUrl) traz as seções "FALA/NARRAÇÃO" e
// "TEXTOS E OFERTAS NA TELA" — usamos elas, sem chamada extra.
//
// Limite conhecido: identificar uma PESSOA (vendedor aparecendo na foto) não é
// possível por leitura de texto — só nome/telefone escrito ou falado.
const { readTextFromImage } = require('./gemini');
const { isRjinoxClient, findVendorIdentifiers, findWebsiteUrl, findPriceInMediaText } = require('./client-content-rules');

// Extrai da análise do vídeo só as seções de fala e de texto na tela (a
// "DESCRIÇÃO" e a "LEGENDA SUGERIDA" são da IA, não do que está no vídeo).
function extractVideoSpokenAndOnScreen(videoAnalysis) {
  if (!videoAnalysis) return '';
  const text = String(videoAnalysis);
  const pick = (label, nextLabels) => {
    const start = text.search(new RegExp(`${label}\\s*:`, 'i'));
    if (start < 0) return '';
    const rest = text.slice(start).replace(new RegExp(`^${label}\\s*:`, 'i'), '');
    const end = rest.search(new RegExp(`\\n\\s*(?:${nextLabels.join('|')})\\s*:`, 'i'));
    return (end < 0 ? rest : rest.slice(0, end)).trim();
  };
  const fala = pick('FALA/NARRA[ÇC][ÃA]O', ['TEXTOS E OFERTAS NA TELA', 'LEGENDA SUGERIDA', 'DESCRI[ÇC][ÃA]O']);
  const tela = pick('TEXTOS E OFERTAS NA TELA', ['LEGENDA SUGERIDA', 'FALA/NARRA[ÇC][ÃA]O', 'DESCRI[ÇC][ÃA]O']);
  return [fala && `FALA: ${fala}`, tela && `TELA: ${tela}`].filter(Boolean).join('\n');
}

// Lê o texto de todas as imagens do pedido (em paralelo, poucas por pedido).
async function detectMediaText({ client, imageBuffers, videoEntries, videoAnalysis }) {
  const enforce = isRjinoxClient(client);

  const images = await Promise.all(
    imageBuffers.map(async (img) => {
      try {
        return { file: img.name, text: await readTextFromImage(img.buffer, img.mimeType), error: null };
      } catch (error) {
        return { file: img.name, text: '', error: error.message };
      }
    })
  );

  const videos = videoEntries.map((v, i) => {
    // Só o primeiro vídeo é analisado pelo pipeline (ver auto-generate.js).
    if (i > 0) return { file: v.name, text: '', error: 'vídeo extra não analisado' };
    if (!videoAnalysis) return { file: v.name, text: '', error: 'análise do vídeo indisponível' };
    return { file: v.name, text: extractVideoSpokenAndOnScreen(videoAnalysis), error: null };
  });

  // 2026-09-28 (Franklin): mídia REAL do vendedor (foto/vídeo que ele mesmo
  // mandou) não é mais barrada por telefone. Telefone que aparece na cena
  // (parede, caminhão, uniforme do funcionário) pode ser postado. A regra
  // agora vale só pro que a IA ESCREVE ou GERA: legenda/narração
  // (sanitizeClientText) e banner gerado (checkGeneratedImage). O texto lido
  // continua salvo em texto-detectado.json.
  const blocks = [];

  // Preço na foto/vídeo real (todo cliente, 2026-09-29): o original não é
  // publicado, a geração cria conteúdo novo sem preço (ver auto-generate.js).
  const pricedFiles = new Map();
  for (const item of [...images, ...videos]) {
    const price = findPriceInMediaText(item.text);
    if (price) {
      item.price = price;
      pricedFiles.set(item.file, price);
    }
  }

  return {
    enforce,
    pricedFiles,
    record: { detectedAt: new Date().toISOString(), images, videos },
    blocks,
    blockedFiles: new Set(blocks.map((b) => b.file)),
  };
}

// Confere o texto de um banner recém-gerado pela IA (a IA pode inventar
// nome/telefone/site mesmo sem ter sido pedido). Site/URL só é checado AQUI
// (banner gerado) — não em mídia real do vendedor, ver nota em
// client-content-rules.js. Retorna {ok, found, error}.
async function checkGeneratedImage(buffer, mimeType) {
  try {
    const text = await readTextFromImage(buffer, mimeType || 'image/png');
    const f = findVendorIdentifiers(text);
    const urls = findWebsiteUrl(text);
    const found = f.found || urls.length > 0;
    return { ok: !found, found: found ? { phones: f.phones, names: f.names, urls } : null, text, error: null };
  } catch (error) {
    return { ok: false, found: null, text: '', error: error.message };
  }
}

// Mídias publicadas SEM passar pela geração (agendador — lib/auto-publish.js
// publishScheduledPiece). Desde 2026-09-28 mídia real do vendedor não é mais
// barrada por telefone (ver nota em detectMediaText), então tudo passa.
// Mantida com a mesma assinatura pra não mexer em quem chama.
async function scanUrlsForVendorIdentifiers({ items }) {
  return { allowed: items, blocks: [] };
}

// Frase curta em português pro cliente (vai no acompanhamento do pedido).
function describeBlock(block) {
  const kind = block.kind === 'video' ? 'o vídeo' : block.kind === 'banner' ? 'um banner gerado' : 'a foto';
  if (block.reason === 'unverified') return `Não consegui conferir ${kind} "${block.file}", então deixei de fora por segurança.`;
  const what = [
    block.names && block.names.length ? 'nome de vendedor' : null,
    block.phones && block.phones.length ? 'telefone' : null,
    block.urls && block.urls.length ? 'site/URL' : null,
  ].filter(Boolean).join(', ');
  return `Deixei de fora ${kind} "${block.file}" porque tinha ${what || 'nome/telefone de vendedor'} — o conteúdo da Rjinox não pode trazer isso. Mande outra mídia sem isso.`;
}

module.exports = { detectMediaText, checkGeneratedImage, scanUrlsForVendorIdentifiers, describeBlock, extractVideoSpokenAndOnScreen };
