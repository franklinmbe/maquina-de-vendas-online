// Ferramentas de edição na hora do Cut Estúdio (Franklin, 2026-10-17:
// copiar as ferramentas do CapCut). Tudo com ffmpeg no próprio servidor, sem
// IA e sem gastar cota: o cliente manda o arquivo, recebe o resultado na
// mesma resposta e decide se baixa, edita de novo ou manda pro Postar.
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { ffprobeDuration, stabilizeVideo, mixMusicUnderVideo } = require('./media-pipeline');

const execFileAsync = promisify(execFile);
const MAX_SECONDS = 90; // regra fixa: nenhum vídeo passa de 90 s
const MUSIC_DIR = path.join(__dirname, '..', 'public', 'audio', 'musicas');
const X264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

const RATIOS = { '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], '16:9': [1920, 1080] };

async function ff(args) {
  await execFileAsync('ffmpeg', ['-y', ...args, '-loglevel', 'error'], { maxBuffer: 10 * 1024 * 1024 });
}

async function hasAudio(file) {
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file]);
  return !!stdout.trim();
}

// atempo só aceita 0,5–2 por etapa: encadeia pra fatores maiores/menores.
function atempoChain(speed) {
  const parts = [];
  let s = speed;
  while (s > 2) { parts.push('atempo=2'); s /= 2; }
  while (s < 0.5) { parts.push('atempo=0.5'); s /= 0.5; }
  parts.push(`atempo=${s.toFixed(4)}`);
  return parts.join(',');
}

function num(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

const TOOLS = {
  cortar: { media: 'video', async run(inp, out, o) {
    const dur = await ffprobeDuration(inp);
    const start = Math.max(0, Math.min(num(o.start, 0), dur - 0.5));
    const end = Math.min(dur, Math.max(start + 0.5, num(o.end, dur)), start + MAX_SECONDS);
    await ff(['-ss', String(start), '-to', String(end), '-i', inp, ...X264, '-c:a', 'aac', '-b:a', '128k', out]);
  } },
  velocidade: { media: 'video', async run(inp, out, o) {
    const speed = [0.5, 0.75, 1.25, 1.5, 2, 3].includes(num(o.fator)) ? num(o.fator) : 1.5;
    const dur = await ffprobeDuration(inp);
    if (dur / speed > MAX_SECONDS) throw new Error('Com essa velocidade o vídeo passaria de 90 segundos. Corte o vídeo antes.');
    const audio = await hasAudio(inp);
    await ff(['-i', inp, '-filter_complex', `[0:v]setpts=PTS/${speed}[v]` + (audio ? `;[0:a]${atempoChain(speed)}[a]` : ''),
      '-map', '[v]', ...(audio ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '128k'] : []), ...X264, out]);
  } },
  // Câmera super lenta: estica o vídeo e cria quadros intermediários
  // (mistura) pra não ficar travando. Sem som (som lento fica estranho).
  'camera-lenta': { media: 'video', async run(inp, out, o) {
    const factor = num(o.fator) === 4 ? 4 : 2;
    const dur = await ffprobeDuration(inp);
    if (dur * factor > MAX_SECONDS) throw new Error(`Câmera lenta ${factor}x deixaria o vídeo com mais de 90 segundos. Corte um trecho de até ${Math.floor(MAX_SECONDS / factor)} segundos antes.`);
    await ff(['-i', inp, '-vf', `setpts=${factor}*PTS,minterpolate=fps=30:mi_mode=blend`, '-an', ...X264, out]);
  } },
  estabilizar: { media: 'video', async run(inp, out) {
    const tmp = out.replace(/\.mp4$/, '-st.mp4');
    await stabilizeVideo(inp, tmp);
    await ff(['-i', tmp, ...X264, '-c:a', 'aac', '-b:a', '128k', out]);
  } },
  // Redimensionar: o vídeo/foto inteiro no centro e o fundo com ele mesmo
  // ampliado e desfocado (igual ensureReelsFormat), sem cortar nada.
  formato: { media: 'any', async run(inp, out, o, isVideo) {
    const [w, h] = RATIOS[o.ratio] || RATIOS['9:16'];
    const sw = Math.round(w / 8) * 2;
    const sh = Math.round(h / 8) * 2;
    const filter = `[0:v]scale=${sw}:${sh}:force_original_aspect_ratio=increase,crop=${sw}:${sh},boxblur=10:2,scale=${w}:${h}[bg];` +
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1` + (isVideo ? ',fps=30,format=yuv420p' : '') + '[v]';
    if (isVideo) await ff(['-i', inp, '-filter_complex', filter, '-map', '[v]', '-map', '0:a?', ...X264, '-c:a', 'aac', '-b:a', '128k', out]);
    else await ff(['-i', inp, '-filter_complex', filter, '-map', '[v]', '-q:v', '2', out]);
  } },
  musica: { media: 'video', async run(inp, out, o) {
    const name = path.basename(String(o.musica || ''));
    const music = path.join(MUSIC_DIR, name);
    if (!/^musica-[\w-]+\.mp3$/.test(name)) throw new Error('Escolha uma música da lista.');
    await fs.access(music);
    await mixMusicUnderVideo(inp, music, out);
  } },
  // Melhorar foto: luz, contraste, cor e nitidez (o "Aprimorar" do CapCut).
  melhorar: { media: 'image', async run(inp, out, o) {
    const lvl = { leve: ['0.02', '1.05', '1.08', '0.5'], medio: ['0.04', '1.1', '1.18', '0.9'], forte: ['0.06', '1.16', '1.3', '1.3'] }[o.nivel] || ['0.04', '1.1', '1.18', '0.9'];
    await ff(['-i', inp, '-vf', `eq=brightness=${lvl[0]}:contrast=${lvl[1]}:saturation=${lvl[2]},unsharp=5:5:${lvl[3]}`, '-q:v', '2', out]);
  } },
};

// file = { buffer, originalname, mimetype }. Retorna { buffer, mime, name }.
async function runEdit(tool, file, options = {}) {
  const t = TOOLS[tool];
  if (!t) throw new Error('Ferramenta desconhecida.');
  const isVideo = /^video\//.test(file.mimetype || '') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(file.originalname || '');
  if (t.media === 'video' && !isVideo) throw new Error('Essa ferramenta é pra vídeo. Envie um vídeo.');
  if (t.media === 'image' && isVideo) throw new Error('Essa ferramenta é pra foto. Envie uma foto.');

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-estudio-'));
  try {
    const inp = path.join(workDir, 'in' + (path.extname(file.originalname || '') || (isVideo ? '.mp4' : '.jpg')));
    const out = path.join(workDir, isVideo ? 'resultado.mp4' : 'resultado.jpg');
    await fs.writeFile(inp, file.buffer);
    if (isVideo && tool !== 'cortar' && (await ffprobeDuration(inp)) > MAX_SECONDS + 1) {
      throw new Error('O vídeo passa de 90 segundos. Use "Cortar vídeo" primeiro.');
    }
    await t.run(inp, out, options, isVideo);
    return { buffer: await fs.readFile(out), mime: isVideo ? 'video/mp4' : 'image/jpeg', name: `${tool}-${Date.now()}${isVideo ? '.mp4' : '.jpg'}` };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { runEdit, EDIT_TOOLS: Object.keys(TOOLS) };
