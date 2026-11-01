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
const { transcribeWithTimestamps, generateImage, generateTts, generateJson } = require('./gemini');

const VOZES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Sulafat', 'Achird', 'Despina', 'Umbriel', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Algieba', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager'];

const execFileAsync = promisify(execFile);
const MAX_SECONDS = 90; // regra fixa: nenhum vídeo passa de 90 s
const { musicaSegura } = require('./musicas-liberadas');
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

// Edição de imagem com o Nano Banana: manda a foto (em JPG) + instrução e
// grava o resultado em JPG.
async function aiImage(inp, out, prompt) {
  const jpg = out.replace(/\.jpg$/, '-in.jpg');
  await ff(['-i', inp, '-vf', "scale='min(2048,iw)':-2", '-q:v', '3', jpg]);
  const png = await generateImage(prompt, [{ mimeType: 'image/jpeg', base64: (await fs.readFile(jpg)).toString('base64') }]);
  const tmp = out.replace(/\.jpg$/, '.png');
  await fs.writeFile(tmp, png);
  await ff(['-i', tmp, '-q:v', '2', out]);
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
    const name = musicaSegura(o.musica);
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
    await aiImage(inp, out,
      `Remova completamente o fundo desta foto e coloque o produto (ou objeto principal) sobre ${FUNDOS[o.fundo] || FUNDOS.branco}. ` +
      'Mantenha o produto EXATAMENTE igual: mesma forma, mesmas cores, mesmas letras e logos, mesma proporção e o mesmo ângulo. Não acrescente nenhum objeto, texto nem enfeite. Enquadre o produto inteiro, centralizado.');
  } },
  // Recortar produto (Estúdio de Imagem, Franklin 2026-10-30): a IA põe o
  // produto num fundo verde liso e o ffmpeg tira o verde, devolvendo PNG
  // transparente pra o produto ficar solto em cima do banner. 1 imagem da cota.
  recorte: { media: 'image', ai: true, png: true, async run(inp, out) {
    const jpg = out.replace(/\.png$/, '-in.jpg');
    await ff(['-i', inp, '-vf', "scale='min(2048,iw)':-2", '-q:v', '3', jpg]);
    const png = await generateImage(
      'Remova completamente o fundo desta foto e coloque o produto (ou objeto/pessoa principal) sobre um fundo verde chroma key puro (#00FF00), totalmente liso e uniforme, sem sombra, sem degradê e sem chão. ' +
      'Mantenha o produto EXATAMENTE igual: mesma forma, mesmas cores, mesmas letras e logos, mesma proporção e o mesmo ângulo. O produto não pode ter reflexo nem brilho verde. Não acrescente nenhum objeto, texto nem enfeite. Enquadre o produto inteiro, centralizado, com uma margem de fundo verde em volta.',
      [{ mimeType: 'image/jpeg', base64: (await fs.readFile(jpg)).toString('base64') }]);
    const verde = out.replace(/\.png$/, '-verde.png');
    await fs.writeFile(verde, png);
    await ff(['-i', verde, '-vf', 'chromakey=0x00FF00:0.17:0.06,despill=type=green,format=rgba', out]);
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
  // Editar foto com IA (o "Editar foto · Nano Banana" do CapCut): o cliente
  // escreve o que quer mudar. 1 imagem da cota. Regra fixa: nunca preço.
  'editar-ia': { media: 'image', ai: true, async run(inp, out, o) {
    const pedido = String(o.pedido || '').trim().slice(0, 500);
    if (!pedido) throw new Error('Escreva o que você quer mudar na foto.');
    await aiImage(inp, out, `Edite esta foto fazendo SOMENTE isto: ${pedido}. Todo o resto da foto continua igual: o produto, as pessoas, as cores, as letras e os logos que não foram citados. Não escreva preço nem valores em dinheiro.`);
  } },
  // Retoque (como o do CapCut): pele e rosto mais bonitos, sem virar outra pessoa.
  retoque: { media: 'image', ai: true, async run(inp, out, o) {
    const nivel = o.nivel === 'forte' ? 'um retoque caprichado de revista' : 'um retoque leve e natural';
    await aiImage(inp, out, `Faça ${nivel} nas pessoas desta foto: pele mais uniforme, sem manchas e espinhas, olheiras suavizadas, dentes um pouco mais brancos e uma luz bonita no rosto. A pessoa tem que continuar EXATAMENTE a mesma: mesmo rosto, formato, idade, cor da pele, cabelo, roupa e expressão. Não mude o fundo nem nada além das pessoas.`);
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
    const ext = isVideo ? '.mp4' : t.png ? '.png' : '.jpg';
    const out = path.join(workDir, 'resultado' + ext);
    await fs.writeFile(inp, file.buffer);
    if (isVideo && tool !== 'cortar' && (await ffprobeDuration(inp)) > MAX_SECONDS + 1) {
      throw new Error('O vídeo passa de 90 segundos. Use "Cortar vídeo" primeiro.');
    }
    await t.run(inp, out, options, isVideo, extra);
    return { buffer: await fs.readFile(out), mime: isVideo ? 'video/mp4' : t.png ? 'image/png' : 'image/jpeg', name: `${tool}-${Date.now()}${ext}` };
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
  const name = musicaSegura(o.musica || 'musica-Corporate.mp3');
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

// Editor com linha do tempo (o coração do CapCut): cada trecho vem com o
// corte (início/fim), a velocidade e, se for foto, a duração. O servidor
// padroniza cada trecho (1080x1920, 30 fps, fundo desfocado, som AAC; foto
// ganha silêncio), emenda tudo, e por cima põe a música e o texto.
async function runTimeline(files, o = {}) {
  const clips = Array.isArray(o.clips) ? o.clips.slice(0, 12) : [];
  if (!clips.length) throw new Error('Coloque pelo menos um vídeo ou foto na linha do tempo.');
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-timeline-'));
  try {
    const parts = [];
    let total = 0;
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      const f = files[Number(c.file)];
      if (!f) continue;
      const isVideo = /^video\//.test(f.mimetype || '') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(f.originalname || '');
      const inp = path.join(workDir, `in-${i}${path.extname(f.originalname || '') || (isVideo ? '.mp4' : '.jpg')}`);
      await fs.writeFile(inp, f.buffer);
      const part = path.join(workDir, `p-${i}.mp4`);
      const speed = [0.5, 0.75, 1, 1.25, 1.5, 2, 3].includes(Number(c.speed)) ? Number(c.speed) : 1;
      if (isVideo) {
        const d = await ffprobeDuration(inp);
        const start = Math.max(0, Math.min(num(c.start, 0), d - 0.3));
        const end = Math.min(d, Math.max(start + 0.3, num(c.end, d)));
        const len = (end - start) / speed;
        if (total + len > MAX_SECONDS + 0.5) throw new Error('A linha do tempo passa de 90 segundos. Corte alguns trechos.');
        const audio = await hasAudio(inp);
        const vf = `[0:v]setpts=(PTS-STARTPTS)/${speed},split[s1][s2];` +
          COMP.replace('[0:v]scale=270', '[s1]scale=270').replace('[0:v]scale=1080', '[s2]scale=1080') + ',format=yuv420p[v]';
        const af = audio ? `;[0:a]asetpts=PTS-STARTPTS,${atempoChain(speed)},aresample=44100,aformat=channel_layouts=stereo[a]` : '';
        await ff(['-ss', start.toFixed(2), '-t', (end - start).toFixed(2), '-i', inp,
          ...(audio ? [] : ['-f', 'lavfi', '-t', len.toFixed(2), '-i', 'anullsrc=r=44100:cl=stereo']),
          '-filter_complex', vf + af, '-map', '[v]', '-map', audio ? '[a]' : '1:a',
          ...X264, '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', '-t', len.toFixed(2), part]);
        total += len;
      } else {
        const dur = Math.min(10, Math.max(1, num(c.dur, 3)));
        if (total + dur > MAX_SECONDS + 0.5) throw new Error('A linha do tempo passa de 90 segundos. Diminua o tempo das fotos.');
        await ff(['-loop', '1', '-t', String(dur), '-i', inp, '-f', 'lavfi', '-t', String(dur), '-i', 'anullsrc=r=44100:cl=stereo',
          '-filter_complex', COMP + `,zoompan=z='min(zoom+0.0010,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,format=yuv420p[v]`,
          '-map', '[v]', '-map', '1:a', ...X264, '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', '-t', String(dur), part]);
        total += dur;
      }
      parts.push(part);
    }
    if (!parts.length) throw new Error('Não consegui ler os arquivos da linha do tempo.');
    const listFile = path.join(workDir, 'lista.txt');
    await fs.writeFile(listFile, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
    const joined = path.join(workDir, 'junto.mp4');
    await ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', joined]);

    // Música por baixo (o som dos vídeos continua) e texto por cima.
    let current = joined;
    const name = musicaSegura(o.musica);
    if (name) {
      if (!/^musica-[\w-]+\.mp3$/.test(name)) throw new Error('Escolha uma música da lista.');
      const music = path.join(MUSIC_DIR, name);
      await fs.access(music);
      const mixed = path.join(workDir, 'musica.mp4');
      await ff(['-i', current, '-stream_loop', '-1', '-i', music, '-filter_complex',
        `[1:a]volume=0.25,afade=t=out:st=${Math.max(0, total - 1).toFixed(2)}:d=1[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`,
        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', total.toFixed(2), mixed]);
      current = mixed;
    }
    const texto = String(o.texto || '').trim().slice(0, 120);
    if (texto) {
      await fs.writeFile(path.join(workDir, 'legenda.ass'), buildAss([{ inicio: 0, fim: total, texto }], { w: 1080, h: 1920 }, { estilo: o.textoEstilo || 'tarja', posicao: o.textoPos === 'meio' ? 'meio' : 'baixo', maiusculas: true }), 'utf8');
      const withText = path.join(workDir, 'texto.mp4');
      await ff(['-i', current, '-vf', 'subtitles=legenda.ass', ...X264, '-c:a', 'copy', withText], { cwd: workDir });
      current = withText;
    }
    const out = path.join(workDir, 'final.mp4');
    await ff(['-i', current, '-c', 'copy', '-movflags', '+faststart', out]);
    return { buffer: await fs.readFile(out), mime: 'video/mp4', name: `cut-estudio-${Date.now()}.mp4` };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Cortes virais ("1 vídeo longo, vários curtos" do CapCut — Franklin,
// 2026-10-19): o vendedor manda um vídeo dele narrando (ex.: a fabricação da
// mesa) e recebe de 2 a 5 vídeos curtos em pé. A IA escuta a fala, escolhe os
// melhores momentos (cada um começando com uma frase que prende) e o ffmpeg
// corta. Sem fala, corta em partes iguais. Grátis (só a transcrição).
const TAMANHOS = { curto: [10, 15], medio: [15, 30], longo: [30, 60] };
const VIRAL_MAX_INPUT = 10 * 60;

function evenCuts(dur, min, max, count) {
  const len = Math.min(max, Math.max(min, dur / count));
  const step = count > 1 ? (dur - len) / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({ inicio: i * step, fim: i * step + len, titulo: `Parte ${i + 1}` }));
}

async function pickViralMoments(trechos, dur, min, max, count) {
  const fala = trechos.map((t) => `[${t.inicio.toFixed(1)}-${t.fim.toFixed(1)}] ${t.texto}`).join('\n');
  const r = await generateJson(
    `Você é editor de vídeos virais de Reels e TikTok para pequenos negócios. Abaixo está a fala de um vídeo de ${dur.toFixed(0)} segundos, com o tempo de cada trecho (em segundos).\n\n${fala}\n\n` +
    `Escolha os ${count} MELHORES momentos para virar vídeos curtos e virais, cada um com ${min} a ${max} segundos. Regras:\n` +
    `- Cada corte começa numa frase forte que prende quem está rolando a tela (curiosidade, benefício, algo surpreendente) e termina no fim de uma frase, nunca no meio de uma palavra.\n` +
    `- Cada corte precisa fazer sentido sozinho, sem precisar ver o resto.\n` +
    `- Os cortes não podem repetir o mesmo trecho; prefira momentos diferentes do vídeo.\n` +
    `- "titulo": 3 a 6 palavras dizendo do que fala o corte, sem preço.\n` +
    `Responda só JSON: {"cortes":[{"inicio":0.0,"fim":12.0,"titulo":"..."}]}`);
  return (r.cortes || []).map((c) => ({ inicio: Number(c.inicio), fim: Number(c.fim), titulo: String(c.titulo || '').trim().slice(0, 60) }));
}

// Ajusta o corte pra caber no vídeo e no tamanho escolhido, e descarta os que
// repetem mais da metade de um corte já aceito.
function cleanCuts(cuts, dur, min, max) {
  const ok = [];
  for (const c of cuts) {
    if (!Number.isFinite(c.inicio) || !Number.isFinite(c.fim)) continue;
    let a = Math.max(0, Math.min(c.inicio, dur - min));
    let b = Math.min(dur, Math.max(c.fim, a + min), a + max);
    if (b - a < Math.min(min, dur) - 0.5) continue;
    const overlap = ok.some((o) => Math.min(o.fim, b) - Math.max(o.inicio, a) > (b - a) / 2);
    if (!overlap) ok.push({ ...c, inicio: a, fim: b });
  }
  return ok.sort((x, y) => x.inicio - y.inicio);
}

async function runViralCuts(file, o = {}) {
  const isVideo = /^video\//.test(file.mimetype || '') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(file.originalname || '');
  if (!isVideo) throw new Error('Essa ferramenta é pra vídeo. Envie um vídeo.');
  const [min, max] = TAMANHOS[o.tamanho] || TAMANHOS.curto;
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-virais-'));
  try {
    const inp = path.join(workDir, 'in' + (path.extname(file.originalname || '') || '.mp4'));
    await fs.writeFile(inp, file.buffer);
    const dur = await ffprobeDuration(inp);
    if (dur < min * 2) throw new Error(`O vídeo é curto demais pra virar vários cortes desse tamanho. Mande um vídeo com pelo menos ${min * 2} segundos ou escolha cortes menores.`);
    if (dur > VIRAL_MAX_INPUT + 1) throw new Error('O vídeo passa de 10 minutos. Mande um vídeo menor.');
    // Soma dos cortes até ~90 s: o servidor tem 1 processador e a resposta
    // precisa sair antes de 5 minutos.
    const avg = (min + max) / 2;
    const count = Math.max(2, Math.min(5, Math.floor(MAX_SECONDS / avg), Math.floor(dur / (avg * 1.3))));

    let trechos = [];
    if (await hasAudio(inp)) {
      const mp3 = path.join(workDir, 'fala.mp3');
      await ff(['-i', inp, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '48k', mp3]);
      trechos = await transcribeWithTimestamps(await fs.readFile(mp3), 'audio/mp3').catch(() => []);
    }
    let cuts = [];
    if (trechos.length >= 3) cuts = cleanCuts(await pickViralMoments(trechos, dur, min, max, count).catch(() => []), dur, min, max);
    if (cuts.length < 2) cuts = evenCuts(dur, min, max, count);

    const legenda = o.legenda === 'sim' && trechos.length;
    const audio = await hasAudio(inp);
    const clips = [];
    for (let i = 0; i < cuts.length; i++) {
      const c = cuts[i];
      const len = c.fim - c.inicio;
      const out = path.join(workDir, `corte-${i + 1}.mp4`);
      let vf = COMP + ',format=yuv420p';
      if (legenda) {
        const local = trechos.filter((t) => t.fim > c.inicio && t.inicio < c.fim)
          .map((t) => ({ inicio: Math.max(0, t.inicio - c.inicio), fim: Math.min(len, t.fim - c.inicio), texto: t.texto }));
        await fs.writeFile(path.join(workDir, `leg-${i}.ass`), buildAss(local, { w: 1080, h: 1920 }, { estilo: o.estilo || 'amarela' }), 'utf8');
        vf += `,subtitles=leg-${i}.ass`;
      }
      const af = audio ? `;[0:a]afade=t=in:d=0.15,afade=t=out:st=${Math.max(0, len - 0.4).toFixed(2)}:d=0.4[a]` : '';
      await ff(['-ss', c.inicio.toFixed(2), '-t', len.toFixed(2), '-i', inp, '-filter_complex', vf + '[v]' + af, '-map', '[v]',
        ...(audio ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '128k'] : ['-an']),
        ...X264, '-maxrate', '3500k', '-bufsize', '7000k', '-t', len.toFixed(2), out], { cwd: workDir });
      clips.push({ titulo: c.titulo || `Corte ${i + 1}`, inicio: c.inicio, fim: c.fim, name: `corte-viral-${i + 1}-${Date.now()}.mp4`, base64: (await fs.readFile(out)).toString('base64') });
    }
    return { clips, comFala: trechos.length >= 3 };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function usesAi(tool) { return !!(TOOLS[tool] && TOOLS[tool].ai); }

module.exports = { runEdit, runAutoCut, runTimeline, runViralCuts, usesAi, EDIT_TOOLS: Object.keys(TOOLS) };
