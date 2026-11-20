// Voz dos chats (Franklin, 2026-11-20): o cliente fala em vez de escrever
// (áudio → texto) e ouve as respostas com voz feminina de IA animada
// (texto → áudio). Os dois passam por aqui.
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { transcribeAudio, generateTts } = require('./gemini');

const execFileAsync = promisify(execFile);

// Voz feminina animada do Gemini ("Laomedeia" = upbeat). O texto vai com uma
// instrução de estilo na frente, e o áudio sai 8% mais rápido.
const VOZ_CHAT = 'Laomedeia';
const ESTILO = 'Leia em português do Brasil, com voz feminina animada, simpática e confiante, ritmo dinâmico e um pouco acelerado, sem arrastar as palavras: ';
const ACELERAR = '1.08';

async function comArquivosTemp(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'voz-'));
  try { return await fn(dir); } finally { fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

// Áudio gravado no celular (webm/ogg/m4a) → texto. Converte pra mp3 antes,
// porque nem todo formato de gravação do navegador é aceito pelo Gemini.
async function audioParaTexto(buffer, nomeOriginal) {
  return comArquivosTemp(async (dir) => {
    const ext = (path.extname(nomeOriginal || '') || '.webm').slice(0, 6);
    const entrada = path.join(dir, `in${ext}`);
    const saida = path.join(dir, 'out.mp3');
    await fs.writeFile(entrada, buffer);
    await execFileAsync('ffmpeg', ['-y', '-i', entrada, '-t', '120', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '48k', saida, '-loglevel', 'error'], { timeout: 60000 });
    const mp3 = await fs.readFile(saida);
    return transcribeAudio(mp3, 'audio/mp3');
  });
}

// Texto → mp3 com a voz do chat. Cache curto em memória (mesma resposta
// tocada de novo não gera de novo).
const cache = new Map();
async function textoParaAudio(texto) {
  const limpo = String(texto || '')
    .replace(/[*_#`>|~]+/g, ' ')
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);
  if (!limpo) throw new Error('Texto vazio');
  const chave = crypto.createHash('sha1').update(limpo).digest('hex');
  if (cache.has(chave)) return cache.get(chave);
  const wav = await generateTts(ESTILO + limpo, VOZ_CHAT);
  const mp3 = await comArquivosTemp(async (dir) => {
    const entrada = path.join(dir, 'in.wav');
    const saida = path.join(dir, 'out.mp3');
    await fs.writeFile(entrada, wav);
    await execFileAsync('ffmpeg', ['-y', '-i', entrada, '-filter:a', `atempo=${ACELERAR}`, '-c:a', 'libmp3lame', '-b:a', '64k', saida, '-loglevel', 'error'], { timeout: 60000 });
    return fs.readFile(saida);
  });
  cache.set(chave, mp3);
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return mp3;
}

module.exports = { audioParaTexto, textoParaAudio, VOZ_CHAT };
