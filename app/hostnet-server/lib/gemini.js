// Chamadas cruas à API do Gemini (aistudio.google.com), compartilhadas entre
// o servidor MCP de automação (lib/mcp-automation-server.js, usado pela
// antiga rotina de nuvem) e o pipeline de geração síncrona dentro do próprio
// servidor (lib/auto-generate.js, ver essa origem pra contexto completo —
// substitui a rotina de nuvem por causa de um bug real de concorrência
// 2026-09-15, ver memória bug-automation-webhook-duplicate-runs-2026-09-15).
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
const TTS_MODEL = 'gemini-3.1-flash-tts-preview';
const VISION_MODEL = 'gemini-3.8-flash';
const FILES_BASE = 'https://generativelanguage.googleapis.com';

function pcmToWav(pcmBase64, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const pcm = Buffer.from(pcmBase64, 'base64');
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * channels * bitsPerSample) / 8, 28);
  header.writeUInt16LE((channels * bitsPerSample) / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Gera (ou edita, se referenceImages for passado — image-to-image) uma
// imagem via Nano Banana. Retorna Buffer PNG. referenceImages: array de
// {mimeType, base64}.
async function generateImage(prompt, referenceImages = []) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada no servidor');
  const parts = [{ text: prompt }];
  for (const img of referenceImages) {
    parts.push({ inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.base64 } });
  }
  const resp = await fetch(
    `${FILES_BASE}/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) }
  );
  const data = await resp.json();
  const imgPart = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!imgPart) throw new Error(`Gemini não retornou imagem: ${JSON.stringify(data).slice(0, 500)}`);
  return Buffer.from(imgPart.inlineData.data, 'base64');
}

// Narração via Gemini TTS. Retorna Buffer WAV (16-bit/24kHz mono).
async function generateTts(text, voice) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada no servidor');
  const resp = await fetch(
    `${FILES_BASE}/v1beta/models/${TTS_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    }
  );
  const data = await resp.json();
  const audioPart = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!audioPart) throw new Error(`Gemini não retornou áudio: ${JSON.stringify(data).slice(0, 500)}`);
  return pcmToWav(audioPart.inlineData.data);
}

async function uploadVideoToGemini(buffer, mimeType) {
  const start = await fetch(`${FILES_BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': GEMINI_KEY,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(buffer.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: `pedido-${Date.now()}` } }),
  });
  if (!start.ok) throw new Error(`Gemini recusou iniciar upload do vídeo: ${start.status} ${await start.text()}`);
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini não devolveu x-goog-upload-url pro vídeo');

  const uploaded = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(buffer.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: buffer,
  });
  if (!uploaded.ok) throw new Error(`Gemini recusou o upload do vídeo: ${uploaded.status} ${await uploaded.text()}`);
  const body = await uploaded.json();
  return { name: body.file.name, uri: body.file.uri };
}

async function waitForGeminiFileActive(fileName, { timeoutMs = 120000, intervalMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${FILES_BASE}/v1beta/${fileName}`, { headers: { 'x-goog-api-key': GEMINI_KEY } });
    const body = await res.json();
    if (body.state === 'ACTIVE') return;
    if (body.state === 'FAILED') throw new Error('Gemini falhou ao processar o vídeo enviado');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Tempo esgotado esperando o Gemini processar o vídeo');
}

const VIDEO_UNDERSTANDING_PROMPT = `Analise esse vídeo de rede social e responda em português, nessas 4 seções, sempre as 4 mesmo que alguma fique "Nenhum(a)":

DESCRIÇÃO: o que aparece/acontece no vídeo (produto, ambiente, ação).
FALA/NARRAÇÃO: transcrição do que é dito em voz, se houver. Se não houver fala, escreva "Nenhuma".
TEXTOS E OFERTAS NA TELA: qualquer preço, texto, logo ou oferta que apareça escrito na imagem do vídeo. Se não houver, escreva "Nenhum".
LEGENDA SUGERIDA: uma legenda curta e pronta pra postar (2-3 frases, tom comercial, sem hashtag, SEM NENHUM PREÇO/VALOR mesmo que apareça no vídeo), combinando o que foi visto/ouvido com qualquer informação extra fornecida junto do pedido.`;

async function understandVideoUrl(videoUrl, mimeType, extraContext) {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`Não consegui baixar o vídeo de ${videoUrl}: ${videoRes.status}`);
  const buffer = Buffer.from(await videoRes.arrayBuffer());

  const { name, uri } = await uploadVideoToGemini(buffer, mimeType || 'video/mp4');
  try {
    await waitForGeminiFileActive(name);
    const prompt = extraContext
      ? `${VIDEO_UNDERSTANDING_PROMPT}\n\nContexto extra fornecido pelo cliente junto do pedido: "${extraContext}"`
      : VIDEO_UNDERSTANDING_PROMPT;
    const resp = await fetch(`${FILES_BASE}/v1beta/models/${VISION_MODEL}:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ file_data: { mime_type: mimeType || 'video/mp4', file_uri: uri } }, { text: prompt }] }],
      }),
    });
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    if (!text) throw new Error(`Gemini não retornou análise do vídeo: ${JSON.stringify(data)}`);
    return text;
  } finally {
    fetch(`${FILES_BASE}/v1beta/${name}`, { method: 'DELETE', headers: { 'x-goog-api-key': GEMINI_KEY } }).catch(() => {});
  }
}

const READ_TEXT_PROMPT = `Leia esta imagem e transcreva, exatamente como está escrito, TODO texto visível nela: títulos, preços, telefones, nomes de pessoas, logos com texto, letras pequenas, marcas d'água, texto em placas, etiquetas e ao fundo. Uma linha por bloco de texto. NÃO descreva a imagem, só transcreva o texto. Se não houver nenhum texto legível, responda exatamente: NENHUM`;

// Lê todo o texto escrito numa imagem (OCR por visão). Retorna string ('' se
// não há texto). Lança erro se a API falhar mesmo depois de 1 nova tentativa —
// quem chama decide se isso bloqueia (Rjinox) ou só segue sem o texto.
async function readTextFromImage(buffer, mimeType) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada no servidor');
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(`${FILES_BASE}/v1beta/models/${VISION_MODEL}:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: READ_TEXT_PROMPT }, { inlineData: { mimeType: mimeType || 'image/jpeg', data: buffer.toString('base64') } }] }],
        }),
      });
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
      if (typeof text !== 'string') throw new Error(`Gemini não retornou leitura da imagem: ${JSON.stringify(data).slice(0, 300)}`);
      const trimmed = text.trim();
      return /^NENHUM\.?$/i.test(trimmed) ? '' : trimmed;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const PLAN_SCHEMA_DESCRIPTION = `Responda SOMENTE em JSON, exatamente neste formato (sem markdown, sem comentários):
{
  "needsGeneration": boolean,   // false = só publicar a mídia já enviada como está (passthrough)
  "reason": string,             // 1 frase explicando a decisão
  "canDecide": boolean,         // false só se o pedido for genuinamente incompleto/contraditório mesmo vendo tudo (precisa de humano)
  "imagesToUse": [number],      // índices (0-based) das imagens anexadas relevantes pra este pedido específico
  "wantsBanner": boolean,
  "wantsVideo": boolean,
  "useOriginalVideo": boolean,     // true = o vídeo final deve ser o vídeo REAL que o cliente anexou (editado/estabilizado se pedido), não um vídeo novo montado a partir de imagens. Use true sempre que o cliente já anexou um vídeo e quer esse vídeo publicado/consertado (ex: "tira o tremido desse vídeo", "edita esse vídeo"). Use false só quando o cliente claramente quer um vídeo novo criado do zero a partir de imagens/banner (ex: nenhum vídeo foi anexado, ou o pedido pede explicitamente "cria um vídeo novo com essas fotos").
  "banners": [                     // um item POR BANNER que o cliente pediu — se ele pedir "3 banners"/"carrossel de 3 banners", este array tem que ter 3 itens, não 1. Array vazio se wantsBanner for false.
    {
      "prompt": string,            // prompt completo em português pra gerar ESSE banner específico (Nano Banana) — se referenceImageIndex existir, descreva o que MUDAR mantendo o resto igual (ex: "remova o número de telefone, mantenha tudo o resto igual"); senão, descreva o banner do zero
      "referenceImageIndex": number | null  // índice da imagem anexada que serve de base/edição pra ESSE banner específico (cada banner pode usar uma imagem diferente), ou null se for gerado do zero
    }
  ],
  "narrationText": string | null,  // texto da narração do vídeo — usado quando useOriginalVideo for false (vídeo novo montado a partir de imagens) OU quando o cliente escolheu uma voz pro vídeo real dele (a voz é gravada por cima do vídeo dele).
  "legenda": string,               // legenda curta pronta pra postar (a parte que descreve o pedido, ignorando idas-e-vindas de esclarecimento do assistente)
  "legendas": {                    // uma legenda DIFERENTE pra cada rede (texto com outras palavras/ângulo, mesmo assunto), no estilo de cada uma
    "facebook": string,            // 2-4 frases, conversa próxima, chamada pro WhatsApp
    "instagram": string,           // 1-3 frases + 3 a 6 hashtags relevantes no fim
    "tiktok": string,              // 1 frase curta e chamativa + 2 a 4 hashtags
    "youtube": string,             // 2-3 frases descritivas
    "telegram": string             // 1-2 frases diretas
  },
  "burnedCaption": boolean,        // true SOMENTE se o cliente pediu explicitamente legenda queimada na tela do vídeo
  "stabilizeVideo": boolean        // true SOMENTE se o cliente pediu explicitamente pra tirar o tremido/estabilizar um vídeo que ele anexou (ex: "tira o tremido", "vídeo tá tremendo muito", "estabiliza"). Vale tanto com useOriginalVideo:true quanto em passthrough puro.
}`;

// Julgamento central: decide passthrough vs geração, escreve os prompts,
// escolhe quais imagens usar. Substitui o "Passo 3" que antes era feito por
// uma sessão inteira de Claude Code lendo tudo manualmente — agora é uma
// única chamada síncrona ao Gemini com saída em JSON.
async function planPedido({ instructionsText, images, hasVideo, videoAnalysis, narracaoChoice, clientLabel, clientRules }) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada no servidor');

  const contextLines = [
    `Você é o planejador de conteúdo da "Máquina de Vendas Online", uma agência que usa IA pra gerar banners e vídeos publicitários pros clientes dela a partir do pedido que cada um manda pelo app.`,
    `Cliente: ${clientLabel}.`,
    `Texto do pedido (pode incluir uma troca de mensagens com um assistente — ignore perguntas de esclarecimento que ficaram sem resposta, use só a parte que descreve o que o cliente realmente quer):\n"""${instructionsText}"""`,
  ];
  if (narracaoChoice && narracaoChoice.narrationText) {
    contextLines.push(`O cliente já escreveu o texto exato da narração, use-o literalmente em "narrationText": "${narracaoChoice.narrationText}"`);
  }
  if (hasVideo && videoAnalysis) {
    contextLines.push(`Um vídeo foi anexado e já foi analisado — use esta análise como contexto (descrição/fala/textos na tela/legenda sugerida):\n"""${videoAnalysis}"""`);
  }
  if (hasVideo && narracaoChoice && narracaoChoice.voice && !narracaoChoice.narrationText) {
    contextLines.push(`O cliente escolheu uma voz de narração (${narracaoChoice.voice}) pro vídeo que ele anexou — a voz vai ser gravada POR CIMA do vídeo dele. "narrationText" é OBRIGATÓRIO neste caso, mesmo com useOriginalVideo:true ou needsGeneration:false: escreva a narração a partir dos textos e ofertas escritos na tela do vídeo (e do pedido, se houver — se o assistente do chat já sugeriu uma narração e o cliente aceitou, use essa), curta o bastante pra caber na duração do vídeo (cerca de 2,5 palavras por segundo de vídeo, no máximo 75 palavras).`);
  }
  contextLines.push(
    `Regras fixas, sempre seguir:`,
    `- Formato de vídeo/banner: vertical 1080x1920 (9:16), sempre.`,
    `- NUNCA queimar legenda/texto de narração na tela do vídeo, a menos que o cliente peça isso explicitamente no texto do pedido.`,
    `- Se alguma imagem anexada claramente não tem relação com o pedido (ex: assunto totalmente diferente do que foi pedido), não inclua o índice dela em "imagesToUse".`,
    `- Conte com cuidado quantos banners o cliente pediu (ex: "3 banners", "carrossel de 3", "monta mais 1 banner além desses 2" = 3 no total) e coloque exatamente essa quantidade de itens em "banners" — nunca menos. Se o pedido for editar vários banners já anexados (ex: "tira o telefone desses banners", com 2+ banners anexados), cada banner editado vira um item separado em "banners", cada um com seu próprio referenceImageIndex apontando pra imagem original dele.`,
    `- Se o pedido só pede pra publicar a mídia já enviada como está (ex: "posta essa foto", "publica esse vídeo"), needsGeneration deve ser false.`,
    `- "legenda" é o texto que vai aparecer como legenda do post — curto, tom comercial, sem repetir perguntas não respondidas.`,
    `- "legendas": cada rede recebe um texto DIFERENTE dos outros (outras palavras, outra frase de abertura) — NUNCA repita a mesma descrição em duas redes, nem copie a "legenda" principal igualzinha.`,
    `- Regra padrão pra todo cliente: construa a legenda a partir do que aparece de fato nas imagens/vídeo anexados (produto, ambiente, texto visível na tela — nunca o preço —, ação) — os clientes normalmente não escrevem pedidos longos, então o conteúdo visual do próprio criativo é a fonte principal da legenda, o texto do pedido é só um complemento quando existir. Se o texto do pedido não descrever o conteúdo (ex: só "Anexei 1 arquivo", sem nenhuma explicação), escreva a legenda inteira baseada só no que foi visto nas imagens/vídeo — nunca deixe a legenda vaga ou genérica por falta de descrição escrita do cliente.`,
    `- "stabilizeVideo" só deve ser true se o cliente reclamou explicitamente de tremido/câmera balançando e pediu pra corrigir — nunca ativar por conta própria só porque o vídeo parece tremido, tem que ser um pedido explícito do cliente.`,
    `- Se o cliente anexou um vídeo real e quer esse vídeo publicado/melhorado (estabilizado, cortado, com banner de acompanhamento, etc.), "useOriginalVideo" deve ser true e o vídeo final tem que ser o dele — nunca substituir o vídeo real do cliente por um vídeo novo gerado a partir de imagens quando ele já mandou o vídeo pronto. Só gerar vídeo do zero (useOriginalVideo:false) quando não há vídeo anexado, ou o cliente pede explicitamente um vídeo novo feito com as fotos.`,
    `- Se "wantsVideo" for true e "useOriginalVideo" for false (vídeo novo sendo montado do zero), "narrationText" é OBRIGATÓRIO — sempre escreva um texto de narração, mesmo que o pedido não descreva exatamente o que falar (nesse caso, baseie-se na legenda e no que já foi visto/pedido). Nunca deixe "narrationText" vazio/null quando essa combinação acontecer.`,
    // Regras específicas do cliente (ex: Rjinox — sem nome/telefone/imagem de
    // vendedor), ver lib/client-content-rules.js. Vazio pra quem não tem.
    ...(Array.isArray(clientRules) ? clientRules : []),
    PLAN_SCHEMA_DESCRIPTION
  );

  const parts = [{ text: contextLines.join('\n\n') }];
  images.forEach((img, i) => {
    parts.push({ text: `[Imagem ${i}]` });
    parts.push({ inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.base64 } });
  });

  const resp = await fetch(
    `${FILES_BASE}/v1beta/models/${VISION_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
  if (!text) throw new Error(`Gemini não retornou plano: ${JSON.stringify(data).slice(0, 800)}`);
  let plan;
  try {
    plan = JSON.parse(text);
  } catch (error) {
    throw new Error(`Gemini retornou JSON inválido pro plano: ${text.slice(0, 500)}`);
  }
  return plan;
}

// Texto puro -> JSON (sem imagem). Usado pelas dicas do dia (lib/daily-tips.js).
async function generateJson(prompt) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada no servidor');
  const resp = await fetch(`${FILES_BASE}/v1beta/models/${VISION_MODEL}:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
  });
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
  if (!text) throw new Error(`Gemini não retornou texto: ${JSON.stringify(data).slice(0, 300)}`);
  return JSON.parse(text);
}

module.exports = { generateImage, generateTts, understandVideoUrl, readTextFromImage, planPedido, pcmToWav, generateJson };
