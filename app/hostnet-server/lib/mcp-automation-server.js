// Servidor MCP interno pra automação de geração (rotina de nuvem
// gestor-de-geracao-automatica, ver .claude/skills/gestor-de-geracao-automatica/
// SKILL.md). Existe porque rotinas de nuvem do Claude Code não têm acesso a
// arquivos locais nem variáveis de ambiente (GEMINI_API_KEY, APP_PASSPHRASE
// ficam só em .claude/settings.local.json, nunca no repositório) — a única
// forma sancionada de dar acesso a um segredo pra uma rotina é um conector
// MCP, então esse servidor expõe só o mínimo necessário (checagem de cota +
// geração via Gemini) por trás de um token próprio (ver routes/mcp-automation.js).
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');
const { loadUsers, saveUsers } = require('./users');
const { checkAndConsumeCall } = require('./call-limit');
const { checkAndConsumeMedia } = require('./media-quota');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
const TTS_MODEL = 'gemini-3.1-flash-tts-preview';
const VIDEO_MODEL = 'gemini-3.8-flash';
const FILES_BASE = 'https://generativelanguage.googleapis.com';

// Sobe um vídeo (bytes já baixados de uma URL pública, ex: download_url do
// GitHub) pro Files API do Gemini via protocolo resumível — necessário pra
// entender vídeo (Franklin, 2026-09-14: "o pessoal da Inox grava muito
// vídeo... precisamos tirar tudo disso"), já que generateContent sozinho só
// aceita bytes inline até 20MB de request inteira, e vídeo cru de celular
// passa disso fácil. Devolve {name, uri} — `name` (ex: "files/abc123") é o
// que usamos pra apagar depois, `uri` é o que referenciamos no
// generateContent.
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

// Vídeo processa de forma assíncrona do lado do Gemini (igual Meta) — espera
// virar ACTIVE antes de mandar pro generateContent.
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

const VIDEO_UNDERSTANDING_PROMPT = `Analise esse vídeo de rede social (empresa RJ INOX, cozinhas industriais, ou outro cliente da Máquina de Vendas Online) e responda em português, nessas 4 seções, sempre as 4 mesmo que alguma fique "Nenhum(a)":

DESCRIÇÃO: o que aparece/acontece no vídeo (produto, ambiente, ação).
FALA/NARRAÇÃO: transcrição do que é dito em voz, se houver. Se não houver fala, escreva "Nenhuma".
TEXTOS E OFERTAS NA TELA: qualquer preço, texto, logo ou oferta que apareça escrito na imagem do vídeo. Se não houver, escreva "Nenhum".
LEGENDA SUGERIDA: uma legenda curta e pronta pra postar (2-3 frases, tom comercial, sem hashtag), combinando o que foi visto/ouvido com qualquer informação extra fornecida junto do pedido.`;

// Entendimento de vídeo via Gemini — usado pela rotina de geração automática
// (Passo 3 do gestor-de-geracao-automatica/SKILL.md) pra decidir com
// segurança o que fazer com um vídeo anexado (publicar como está, usar como
// base de legenda, etc.) em vez de travar em "failed_permanent" toda vez que
// o texto do pedido não é auto-suficiente. Também chamável de uma sessão
// manual pelo mesmo motivo — ver gestor-de-geracao-ia-google/SKILL.md.
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
    const resp = await fetch(`${FILES_BASE}/v1beta/models/${VIDEO_MODEL}:generateContent?key=${GEMINI_KEY}`, {
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
    // Limpeza best-effort — o Files API expira sozinho em 48h de qualquer
    // jeito, isso é só pra não acumular lixo à toa. Nunca deve derrubar o
    // resultado já obtido acima.
    fetch(`${FILES_BASE}/v1beta/${name}`, { method: 'DELETE', headers: { 'x-goog-api-key': GEMINI_KEY } }).catch(() => {});
  }
}

// Monta o cabeçalho WAV (44 bytes) em cima do PCM 16-bit/24kHz mono que o
// Gemini TTS devolve cru — mesma lógica já documentada e testada em
// gestor-de-geracao-ia-google/SKILL.md.
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
  return Buffer.concat([header, pcm]).toString('base64');
}

function jsonResult(obj, isError) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }], ...(isError ? { isError: true } : {}) };
}

function buildServer() {
  const server = new McpServer({ name: 'mvo-automacao', version: '1.0.0' });

  server.registerTool(
    'check_call_limit',
    {
      description:
        'Confere e consome uma chamada da janela atual (manhã/tarde/noite) do limite diário do plano do cliente. Chamar exatamente UMA vez por pedido, antes de gerar conteúdo por IA ou responder dúvida de suporte — nunca pra só publicar mídia já enviada (isso é ilimitado, não chamar essa ferramenta nesse caso).',
      inputSchema: { client: z.string().describe('nome exato da pasta do cliente, ex: frank') },
    },
    async ({ client }) => {
      const users = await loadUsers();
      const user = users.find((u) => u.client === client);
      if (!user) return jsonResult({ allowed: false, error: `Cliente "${client}" não encontrado` }, true);
      const result = checkAndConsumeCall(user);
      if (result.allowed) await saveUsers(users);
      return jsonResult(result);
    }
  );

  server.registerTool(
    'check_media_limit',
    {
      description:
        'Confere e consome cota mensal de imagens/vídeos por IA do plano do cliente. Chamar UMA vez por (pedido, tipo), com o count certo (ex: 3 banners = count:3) — nunca uma vez por unidade.',
      inputSchema: {
        client: z.string(),
        type: z.enum(['images', 'videos']),
        count: z.number().int().min(1).default(1),
      },
    },
    async ({ client, type, count }) => {
      const users = await loadUsers();
      const user = users.find((u) => u.client === client);
      if (!user) return jsonResult({ allowed: false, error: `Cliente "${client}" não encontrado` }, true);
      const result = checkAndConsumeMedia(user, type, count);
      if (result.allowed) await saveUsers(users);
      return jsonResult(result);
    }
  );

  server.registerTool(
    'generate_image',
    {
      description:
        'Gera (ou edita, se referenceImageBase64 for passado — image-to-image) uma imagem via Nano Banana (Gemini). Retorna PNG em base64.',
      inputSchema: {
        prompt: z.string(),
        referenceImageBase64: z.string().optional().describe('PNG existente em base64, pra edição image-to-image'),
      },
    },
    async ({ prompt, referenceImageBase64 }) => {
      if (!GEMINI_KEY) return jsonResult({ error: 'GEMINI_API_KEY não configurada no servidor' }, true);
      const parts = [{ text: prompt }];
      if (referenceImageBase64) parts.push({ inlineData: { mimeType: 'image/png', data: referenceImageBase64 } });

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) }
      );
      const data = await resp.json();
      const imgPart = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!imgPart) return jsonResult({ error: 'Gemini não retornou imagem', raw: data }, true);
      return jsonResult({ base64Png: imgPart.inlineData.data });
    }
  );

  server.registerTool(
    'generate_tts',
    {
      description: 'Gera narração via Gemini TTS. Retorna WAV (16-bit/24kHz mono) em base64, já com cabeçalho WAV montado.',
      inputSchema: {
        text: z.string(),
        voice: z.string().describe('nome exato da voz, ex: Kore, Sulafat — ver catálogo em gestor-de-geracao-ia-google/SKILL.md'),
      },
    },
    async ({ text, voice }) => {
      if (!GEMINI_KEY) return jsonResult({ error: 'GEMINI_API_KEY não configurada no servidor' }, true);
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${GEMINI_KEY}`,
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
      if (!audioPart) return jsonResult({ error: 'Gemini não retornou áudio', raw: data }, true);
      return jsonResult({ base64Wav: pcmToWav(audioPart.inlineData.data) });
    }
  );

  server.registerTool(
    'understand_video',
    {
      description:
        'Analisa um vídeo (por URL pública, ex: download_url do GitHub) via Gemini e devolve, em texto, descrição do que aparece, transcrição da fala, textos/ofertas visíveis na tela, e uma sugestão de legenda pronta. Use antes de decidir passthrough/geração/failed_permanent pra um pedido cujo texto se refere a algo que só existe dentro do vídeo (ex: "usa os textos da imagem/vídeo") — não adivinhar o conteúdo do vídeo pelo nome do arquivo.',
      inputSchema: {
        videoUrl: z.string().describe('URL pública do vídeo, ex: download_url do GitHub'),
        mimeType: z.string().optional().describe('ex: video/mp4 — default video/mp4 se omitido'),
        extraContext: z.string().optional().describe('texto do pedido (instrucoes.txt) pra dar contexto extra à análise'),
      },
    },
    async ({ videoUrl, mimeType, extraContext }) => {
      if (!GEMINI_KEY) return jsonResult({ error: 'GEMINI_API_KEY não configurada no servidor' }, true);
      try {
        const analysis = await understandVideoUrl(videoUrl, mimeType, extraContext);
        return jsonResult({ analysis });
      } catch (error) {
        return jsonResult({ error: error.message }, true);
      }
    }
  );

  return server;
}

module.exports = { buildServer };
