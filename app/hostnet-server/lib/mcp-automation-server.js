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

  return server;
}

module.exports = { buildServer };
