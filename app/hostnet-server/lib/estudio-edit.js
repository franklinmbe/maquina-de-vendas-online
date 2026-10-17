// Ferramentas de edição na hora do Cut Estúdio (Franklin, 2026-10-17:
// copiar as ferramentas do CapCut). Tudo com ffmpeg no próprio servidor, sem
// IA e sem gastar cota: o cliente manda o arquivo, recebe o resultado na
// mesma resposta e decide se baixa, edita de novo ou manda pro Postar.
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { ffprobeDuration, stabilizeVideo, mixMusicUnderVideo, narrateOverVideo, prepareClientNarration } = require('./media-pipeline');
const { transcribeWithTimestamps, generateImage, generateTts } = require('./gemini');

const VOZES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Sulafat', 'Achird', 'Despina', 'Umbriel', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Algieba', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager'];

const execFileAsync = promisify(execFile);
const MAX_SECONDS = 90; // regra fixa: nenhum vídeo passa de 90 s
const MUSIC_DIR = path.join(__dirname, '..', 'public', 'audio', 'musicas');
const X264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

const RATIOS = { '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], '16:9': [1920, 1080] };

async function ff(args, opts = {}) {
  await execFileAsync('ffmpeg', ['-y', ...args, '-loglevel', 'error'], { maxBuffer: 10 * 1024 * 1024, ...opts });
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

async function videoSize(file) {
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation', '-of', 'json', file]);
  const s = (JSON.parse(stdout).streams || [])[0] || {};
  let w = Number(s.width) || 1080;
  let h = Number(s.height) || 1920;
  const rot = Math.abs(Number((s.side_data_list || []).map((d) => d.rotation).find((r) => r !== undefined) || 0));
  if (rot === 90 || rot === 270) [w, h] = [h, w];
  return { w, h };
}

// Legenda em ASS (formato que o ffmpeg queima com libass). Cores em &HAABBGGRR.
const LEGENDA_ESTILOS = {
  classica: { cor: '&H00FFFFFF', borda: '&H00000000', fundo: '&H64000000', estilo: 1, contorno: 4 },
  amarela: { cor: '&H0000D7FF', borda: '&H00000000', fundo: '&H64000000', estilo: 1, contorno: 4 },
  tarja: { cor: '&H00FFFFFF', borda: '&H80000000', fundo: '&H80000000', estilo: 3, contorno: 10 },
};
function assTime(s) {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}
function buildAss(trechos, { w, h }, o) {
  const st = LEGENDA_ESTILOS[o.estilo] || LEGENDA_ESTILOS.classica;
  const size = Math.round(Math.min(w, h) * 0.075);
  const align = o.posicao === 'meio' ? 5 : 2;
  const marginV = o.posicao === 'meio' ? 0 : Math.round(h * 0.16);
  const upper = o.maiusculas !== false;
  const clean = (t) => (upper ? t.toUpperCase() : t).replace(/[{}\\]/g, '').replace(/\n/g, ' ');
  return [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${w}`, `PlayResY: ${h}`, 'WrapStyle: 0', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: L,DejaVu Sans,${size},${st.cor},${st.cor},${st.borda},${st.fundo},1,0,0,0,100,100,0,0,${st.estilo},${Math.round(size * st.contorno / 50)},0,${align},${Math.round(w * 0.08)},${Math.round(w * 0.08)},${marginV},1`,
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...trechos.map((t) => `Dialogue: 0,${assTime(t.inicio)},${assTime(t.fim)},L,,0,0,0,,${clean(t.texto)}`),
  ].join('\n');
}

const FILTROS = {
  vivo: 'eq=contrast=1.08:saturation=1.35:brightness=0.02',
  quente: 'colorbalance=rs=0.08:gs=0.02:bs=-0.08:rm=0.06:bm=-0.06,eq=saturation=1.1',
  frio: 'colorbalance=rs=-0.07:bs=0.09:rm=-0.04:bm=0.06,eq=saturation=1.05',
  pb: 'hue=s=0,eq=contrast=1.15',
  vintage: 'curves=preset=vintage,eq=saturation=0.85',
  cinema: 'eq=contrast=1.15:saturation=0.9:brightness=-0.02,colorbalance=rs=-0.04:bs=0.05:rh=0.05:bh=-0.04,vignette=PI/5',
};

const FUNDOS = {
  branco: 'um fundo branco puro e liso (#FFFFFF), com uma sombra bem suave embaixo do produto',
  estudio: 'um fundo de estúdio fotográfico cinza claro, liso, com luz suave e uma sombra leve embaixo do produto',
  preto: 'um fundo preto elegante e liso, com luz de estúdio destacando o produto',
};

const TOOLS = {
  cortar: { media: 'video', async run(inp, out, o) {
    const dur = await ffprobeDuration(inp);
    const start = Math.max(0, Math.min(num(o.start, 0), dur - 0.5));
    const end = Math.min(dur, Math.max(start + 0.5, num(o.end, dur)), start + MAX_SECONDS);
    await ff(['-ss', String(start), '-i', inp, '-t', String(end - start), ...X264, '-c:a', 'aac', '-b:a', '128k', out]);
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
  // Legendas automáticas: a IA ouve a fala (com o tempo de cada trecho) e o
  // ffmpeg escreve na tela. Custo de IA mínimo (só o áudio), não gasta cota.
  legenda: { media: 'video', async run(inp, out, o) {
    if (!(await hasAudio(inp))) throw new Error('Esse vídeo não tem som, então não tem fala pra virar legenda.');
    const mp3 = out.replace(/\.mp4$/, '-fala.mp3');
    await ff(['-i', inp, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '48k', mp3]);
    const trechos = await transcribeWithTimestamps(await fs.readFile(mp3), 'audio/mp3');
    if (!trechos.length) throw new Error('Não encontrei fala nesse vídeo pra virar legenda.');
    const ass = path.join(path.dirname(out), 'legenda.ass');
    await fs.writeFile(ass, buildAss(trechos, await videoSize(inp), o), 'utf8');
    // Roda dentro da pasta de trabalho: o filtro subtitles não aceita caminho com ":".
    await ff(['-i', inp, '-vf', 'subtitles=legenda.ass', ...X264, '-c:a', 'copy', out], { cwd: path.dirname(out) });
  } },
  // Tirar fundo (IA, Nano Banana): troca o fundo por um fundo limpo, com o
  // produto igualzinho. Gasta 1 imagem da cota (cobrado na rota).
  fundo: { media: 'image', ai: true, async run(inp, out, o) {
    const png = await generateImage(
      `Remova completamente o fundo desta foto e coloque o produto (ou objeto principal) sobre ${FUNDOS[o.fundo] || FUNDOS.branco}. ` +
      'Mantenha o produto EXATAMENTE igual: mesma forma, mesmas cores, mesmas letras e logos, mesma proporção e o mesmo ângulo. Não acrescente nenhum objeto, texto nem enfeite. Enquadre o produto inteiro, centralizado.',
      [{ mimeType: 'image/jpeg', base64: (await fs.readFile(inp)).toString('base64') }]
    );
    const tmp = out.replace(/\.jpg$/, '.png');
    await fs.writeFile(tmp, png);
    await ff(['-i', tmp, '-q:v', '2', out]);
  } },
  // Texto em fala: a voz escolhida narra o texto do cliente por cima do
  // vídeo; o som original fica por baixo, mais baixo.
  narracao: { media: 'video', async run(inp, out, o) {
    const texto = String(o.texto || '').trim().slice(0, 900);
    if (!texto) throw new Error('Escreva o texto que a voz vai falar.');
    const voz = VOZES.includes(o.voz) ? o.voz : 'Kore';
    const wav = out.replace(/\.mp4$/, '-voz.wav');
    await fs.writeFile(wav, await generateTts(texto, voz));
    await narrateOverVideo(inp, wav, out);
  } },
  // Gravar minha voz: a gravação feita no celular entra como narração.
  'minha-voz': { media: 'video', async run(inp, out, o, isVideo, extra) {
    if (!extra) throw new Error('Grave a sua voz antes de aplicar.');
    const { wavBuffer } = await prepareClientNarration(extra.buffer, extra.originalname || 'voz.webm');
    const wav = out.replace(/\.mp4$/, '-voz.wav');
    await fs.writeFile(wav, wavBuffer);
    await narrateOverVideo(inp, wav, out);
  } },
  // Filtros de cor (foto e vídeo), como os do CapCut.
  filtro: { media: 'any', async run(inp, out, o, isVideo) {
    const vf = FILTROS[o.filtro] || FILTROS.vivo;
    if (isVideo) await ff(['-i', inp, '-vf', vf + ',format=yuv420p', ...X264, '-c:a', 'copy', out]);
    else await ff(['-i', inp, '-vf', vf, '-q:v', '2', out]);
  } },
  // Melhorar foto: luz, contraste, cor e nitidez (o "Aprimorar" do CapCut).
  melhorar: { media: 'image', async run(inp, out, o) {
    const lvl = { leve: ['0.02', '1.05', '1.08', '0.5'], medio: ['0.04', '1.1', '1.18', '0.9'], forte: ['0.06', '1.16', '1.3', '1.3'] }[o.nivel] || ['0.04', '1.1', '1.18', '0.9'];
    await ff(['-i', inp, '-vf', `eq=brightness=${lvl[0]}:contrast=${lvl[1]}:saturation=${lvl[2]},unsharp=5:5:${lvl[3]}`, '-q:v', '2', out]);
  } },
};

// file = { buffer, originalname, mimetype }. Retorna { buffer, mime, name }.
async function runEdit(tool, file, options = {}, extra = null) {
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
    await t.run(inp, out, options, isVideo, extra);
    return { buffer: await fs.readFile(out), mime: isVideo ? 'video/mp4' : 'image/jpeg', name: `${tool}-${Date.now()}${isVideo ? '.mp4' : '.jpg'}` };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// AutoCut (igual ao do CapCut): várias fotos/vídeos + música → um vídeo em
// pé com cortes no mesmo ritmo, transição suave e a música por baixo.
// Cada trecho é padronizado (1080x1920, 30 fps, fundo desfocado) e depois os
// trechos são emendados. Sem IA, grátis.
const RITMOS = { rapido: 1.5, normal: 2.5, calmo: 3.5 };
const COMP = '[0:v]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=10:2,scale=1080:1920[bg];' +
  '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=30';

async function runAutoCut(files, o = {}) {
  const list = (files || []).slice(0, 8);
  if (list.length < 2) throw new Error('Escolha pelo menos 2 fotos ou vídeos.');
  const seg = RITMOS[o.ritmo] || RITMOS.normal;
  const name = path.basename(String(o.musica || 'musica-Upbeat-Happy-Corporate.mp3'));
  if (!/^musica-[\w-]+\.mp3$/.test(name)) throw new Error('Escolha uma música da lista.');
  const music = path.join(MUSIC_DIR, name);
  await fs.access(music);

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-autocut-'));
  try {
    const parts = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const isVideo = /^video\//.test(f.mimetype || '') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(f.originalname || '');
      const inp = path.join(workDir, `in-${i}${path.extname(f.originalname || '') || (isVideo ? '.mp4' : '.jpg')}`);
      await fs.writeFile(inp, f.buffer);
      const part = path.join(workDir, `p-${i}.mp4`);
      const fade = `,fade=t=in:st=0:d=0.25,fade=t=out:st=${(seg - 0.25).toFixed(2)}:d=0.25,format=yuv420p[v]`;
      // Vídeos dão até 2 trechos cada (começo e meio), fotos dão 1 com zoom.
      const starts = [];
      if (isVideo) {
        const d = await ffprobeDuration(inp);
        starts.push(Math.max(0, Math.min(d * 0.1, d - seg)));
        if (d >= seg * 3) starts.push(d * 0.55);
      }
      if (!isVideo) {
        await ff(['-loop', '1', '-t', String(seg), '-i', inp, '-filter_complex',
          COMP + `,zoompan=z='min(zoom+0.0012,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30` + fade,
          '-map', '[v]', '-an', '-t', String(seg), ...X264, part]);
        parts.push(part);
      } else {
        for (let k = 0; k < starts.length; k++) {
          const p = part.replace(/\.mp4$/, `-${k}.mp4`);
          await ff(['-ss', starts[k].toFixed(2), '-t', String(seg), '-i', inp, '-filter_complex', COMP + fade, '-map', '[v]', '-an', '-t', String(seg), ...X264, p]);
          parts.push(p);
        }
      }
      if (parts.length * seg >= MAX_SECONDS) break;
    }
    const listFile = path.join(workDir, 'lista.txt');
    await fs.writeFile(listFile, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
    const joined = path.join(workDir, 'junto.mp4');
    await ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', joined]);
    const total = Math.min(parts.length * seg, MAX_SECONDS);
    const out = path.join(workDir, 'autocut.mp4');
    await ff(['-i', joined, '-stream_loop', '-1', '-i', music, '-map', '0:v', '-map', '1:a',
      '-af', `volume=0.8,afade=t=out:st=${Math.max(0, total - 1).toFixed(2)}:d=1`, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', total.toFixed(2), '-movflags', '+faststart', out]);
    return { buffer: await fs.readFile(out), mime: 'video/mp4', name: `autocut-${Date.now()}.mp4` };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function usesAi(tool) { return !!(TOOLS[tool] && TOOLS[tool].ai); }

module.exports = { runEdit, runAutoCut, usesAi, EDIT_TOOLS: Object.keys(TOOLS) };
