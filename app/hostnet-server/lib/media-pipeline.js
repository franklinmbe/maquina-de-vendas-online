// Montagem de vídeo "slideshow narrado" via FFmpeg, rodando dentro do
// próprio processo do servidor (ver lib/auto-generate.js) — precisa do
// binário ffmpeg instalado na imagem Docker (ver Dockerfile, `apk add
// ffmpeg`). Mesmo pipeline já documentado em
// .claude/skills/gestor-de-geracao-ia-google/SKILL.md, só que em JS/
// child_process em vez de comandos de shell numa sessão manual.
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const execFileAsync = promisify(execFile);

async function ffprobeDuration(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

async function standardizeToCanvas(inputPath, outputPath) {
  await execFileAsync('ffmpeg', [
    '-y', '-i', inputPath,
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1',
    outputPath,
    '-loglevel', 'error',
  ]);
}

// Monta o vídeo final: slides (imagens já padronizadas) + narração + música
// de fundo em volume reduzido. slidePaths: array de caminhos de imagem
// (ordem de exibição). narrationWavPath: caminho do WAV da narração.
// musicPath: caminho do MP3 de música (opcional). outputPath: onde salvar o
// vídeo final .mp4.
async function buildNarratedSlideshow({ slidePaths, narrationWavPath, musicPath, outputPath, workDir }) {
  const dir = workDir || (await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-video-')));
  const narrationDuration = await ffprobeDuration(narrationWavPath);
  const perSlide = narrationDuration / slidePaths.length;

  const concatPath = path.join(dir, 'concat.txt');
  const lines = [];
  slidePaths.forEach((p) => {
    // ffconcat exige caminho relativo ou absoluto sem aspas problemáticas —
    // usamos caminho absoluto com forward slashes, funciona no Windows e Linux.
    const normalized = p.replace(/\\/g, '/');
    lines.push(`file '${normalized}'`);
    lines.push(`duration ${perSlide.toFixed(4)}`);
  });
  // Entrada final repetida sem duration — exigência do formato concat do
  // ffmpeg pra não cortar o último slide cedo demais.
  lines.push(`file '${slidePaths[slidePaths.length - 1].replace(/\\/g, '/')}'`);
  await fs.writeFile(concatPath, lines.join('\n') + '\n', { encoding: 'utf-8' });

  const muteVideoPath = path.join(dir, 'video-mudo.mp4');
  await execFileAsync('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-vf', 'fps=30,format=yuv420p',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    muteVideoPath,
    '-loglevel', 'error',
  ]);

  let audioMixPath = narrationWavPath;
  if (musicPath) {
    audioMixPath = path.join(dir, 'audio-mix.aac');
    const fadeStart = Math.max(0, narrationDuration - 2);
    await execFileAsync('ffmpeg', [
      '-y', '-i', narrationWavPath, '-i', musicPath,
      '-filter_complex',
      `[0:a]volume=1.0[a1];[1:a]volume=0.18,afade=t=out:st=${fadeStart.toFixed(2)}:d=2[a2];[a1][a2]amix=inputs=2:duration=first`,
      audioMixPath,
      '-loglevel', 'error',
    ]);
  }

  await execFileAsync('ffmpeg', [
    '-y', '-i', muteVideoPath, '-i', audioMixPath,
    '-c:v', 'copy', '-c:a', 'aac', '-shortest',
    outputPath,
    '-loglevel', 'error',
  ]);

  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

// Vídeo de slides COM transições e efeitos (Franklin, 2026-09-25, 5ª dica):
// cada slide ganha um movimento de câmera (zoom in, zoom out ou deslize) e a
// passagem de um slide pro outro usa uma transição diferente (xfade). Mesmo
// áudio do buildNarratedSlideshow (narração + música baixa). A duração total
// acompanha a narração. Se o ffmpeg falhar, quem chama cai no slideshow simples.
const XFADE_TRANSITIONS = ['fade', 'slideleft', 'circleopen', 'wipeleft', 'smoothup', 'dissolve', 'slideup', 'radial', 'smoothleft', 'circlecrop'];
const TRANSITION_SECONDS = 0.6;

async function buildTransitionSlideshow({ slidePaths, narrationWavPath, musicPath, outputPath, workDir }) {
  const dir = workDir || (await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-trans-')));
  const n = slidePaths.length;
  const narrationDuration = await ffprobeDuration(narrationWavPath);
  const total = narrationDuration + 0.8;
  const T = n > 1 ? TRANSITION_SECONDS : 0;
  const per = Math.max(T + 1.2, (total + (n - 1) * T) / n);
  const fps = 30;
  const frames = Math.ceil(per * fps);

  const args = ['-y'];
  slidePaths.forEach((p) => args.push('-framerate', String(fps), '-i', p));

  const moves = [
    `z='min(zoom+0.0009,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
    `z='if(eq(on,0),1.15,max(zoom-0.0009,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
    `z='1.12':x='(iw-iw/zoom)*on/${frames}':y='ih/2-(ih/zoom/2)'`,
    `z='1.12':x='(iw-iw/zoom)*(1-on/${frames})':y='ih/2-(ih/zoom/2)'`,
  ];
  // Imagem que não é vertical 9:16 ganha fundo com ela mesma ampliada e
  // desfocada (sem faixa preta), igual ao ensureReelsFormat dos vídeos.
  const filters = slidePaths.map((_, i) =>
    `[${i}:v]split[a${i}][b${i}];` +
      `[a${i}]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:2[bg${i}];` +
      `[b${i}]scale=1080:1920:force_original_aspect_ratio=decrease[fg${i}];` +
      `[bg${i}][fg${i}]overlay=(W-w)/2:(H-h)/2,` +
      `scale=1350:2400,zoompan=${moves[i % moves.length]}:d=${frames}:s=1080x1920:fps=${fps},setsar=1,format=yuv420p[s${i}]`
  );
  let last = 's0';
  for (let i = 1; i < n; i++) {
    const offset = (i * (per - T)).toFixed(3);
    const out = `x${i}`;
    filters.push(`[${last}][s${i}]xfade=transition=${XFADE_TRANSITIONS[(i - 1) % XFADE_TRANSITIONS.length]}:duration=${T}:offset=${offset}[${out}]`);
    last = out;
  }
  const muteVideoPath = path.join(dir, 'video-transicoes.mp4');
  await execFileAsync('ffmpeg', [
    ...args,
    '-filter_complex', filters.join(';'),
    '-map', `[${last}]`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', String(fps),
    muteVideoPath,
    '-loglevel', 'error',
  ], { maxBuffer: 10 * 1024 * 1024 });

  // O vídeo pode passar da narração (muitos slides, cada um com tempo
  // mínimo): a música cobre o vídeo inteiro e o áudio é completado com
  // silêncio, pra nunca cortar os últimos slides.
  const videoTotal = n * per - (n - 1) * T;
  let audioMixPath = narrationWavPath;
  if (musicPath) {
    audioMixPath = path.join(dir, 'audio-mix.aac');
    const fadeStart = Math.max(0, videoTotal - 2);
    await execFileAsync('ffmpeg', [
      '-y', '-i', narrationWavPath, '-i', musicPath,
      '-filter_complex',
      `[0:a]volume=1.0[a1];[1:a]atrim=0:${videoTotal.toFixed(2)},volume=0.18,afade=t=out:st=${fadeStart.toFixed(2)}:d=2[a2];[a1][a2]amix=inputs=2:duration=longest:normalize=0`,
      audioMixPath,
      '-loglevel', 'error',
    ]);
  }

  await execFileAsync('ffmpeg', [
    '-y', '-i', muteVideoPath, '-i', audioMixPath,
    '-filter_complex', '[1:a]apad[aout]', '-map', '0:v', '-map', '[aout]',
    '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-movflags', '+faststart',
    outputPath,
    '-loglevel', 'error',
  ]);

  if (!workDir) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

// Estabiliza um vídeo tremido (câmera na mão) — filtro `deshake` nativo do
// FFmpeg (não precisa de libvidstab nem nenhuma lib extra, funciona em
// qualquer build padrão). Só aplicado quando o cliente pede explicitamente
// (ver lib/gemini.js, plan.stabilizeVideo) — não é ativado sozinho, e não é
// perfeito pra tremido muito forte, mas reduz bastante tremido leve/médio de
// filmagem com celular na mão.
async function stabilizeVideo(inputPath, outputPath) {
  await execFileAsync('ffmpeg', [
    '-y', '-i', inputPath,
    '-vf', 'deshake',
    '-c:a', 'copy',
    outputPath,
    '-loglevel', 'error',
  ]);
}

// Mixa uma música de fundo em volume baixo sob o áudio ORIGINAL de um vídeo
// já existente (diferente de buildNarratedSlideshow, que monta um vídeo do
// zero) — usado quando o cliente quer o vídeo real dele publicado, só com
// música de fundo, sem trocar a fala/áudio original. A música repete em
// loop se for mais curta que o vídeo.
async function mixMusicUnderVideo(videoPath, musicPath, outputPath) {
  // Vídeo sem nenhuma faixa de áudio (gravação muda): a música vira o áudio
  // do vídeo, num volume normal, em vez do ffmpeg falhar procurando [0:a].
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', videoPath,
  ]);
  if (!stdout.trim()) {
    await execFileAsync('ffmpeg', [
      '-y', '-i', videoPath, '-stream_loop', '-1', '-i', musicPath,
      '-map', '0:v', '-map', '1:a', '-filter:a', 'volume=0.6',
      '-c:v', 'copy', '-c:a', 'aac', '-shortest',
      outputPath,
      '-loglevel', 'error',
    ]);
    return;
  }
  await execFileAsync('ffmpeg', [
    '-y', '-i', videoPath, '-stream_loop', '-1', '-i', musicPath,
    '-filter_complex', '[1:a]volume=0.15[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=0[aout]',
    '-map', '0:v', '-map', '[aout]',
    '-c:v', 'copy', '-c:a', 'aac', '-shortest',
    outputPath,
    '-loglevel', 'error',
  ]);
}

// Grava uma narração (voz escolhida pelo cliente) POR CIMA de um vídeo real
// dele — pedido do Franklin 2026-09-24: vídeo só com música e texto na tela,
// cliente escolhia a voz e ela era ignorada. O áudio original (música) fica
// por baixo, mais baixo. Se a narração passar um pouco da duração do vídeo,
// acelera a fala até 1,3x; o que ainda sobrar é cortado no fim do vídeo.
async function narrateOverVideo(videoPath, narrationWavPath, outputPath) {
  const videoDuration = await ffprobeDuration(videoPath);
  const narrationDuration = await ffprobeDuration(narrationWavPath);
  const tempo = Math.min(1.3, Math.max(1, narrationDuration / Math.max(videoDuration - 0.3, 1)));
  const voice = `[1:a]atempo=${tempo.toFixed(3)},volume=1.0[voice]`;
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', videoPath,
  ]);
  const filter = stdout.trim()
    ? `${voice};[0:a]volume=0.25[bed];[bed][voice]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`
    : `${voice};[voice]apad[aout]`;
  await execFileAsync('ffmpeg', [
    '-y', '-i', videoPath, '-i', narrationWavPath,
    '-filter_complex', filter,
    '-map', '0:v', '-map', '[aout]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', String(videoDuration),
    outputPath,
    '-loglevel', 'error',
  ]);
}

// Garante que o vídeo está no formato que o Facebook/Instagram exigem pra
// Reels (vertical 9:16, mínimo 540x960) — achado real 2026-09-23: o vídeo da
// Jaqueline (RJ Inox) tinha 368x448; a API do Facebook aceitou, respondeu
// "published", mas o Reel nunca apareceu pra ninguém na página. Se o vídeo
// já está no padrão, devolve o mesmo buffer sem mexer. Senão, converte pra
// 1080x1920: o vídeo inteiro no centro (sem cortar nada) e o fundo com o
// próprio vídeo ampliado e desfocado, em vez de faixas pretas. Áudio original
// preservado. Se o ffmpeg falhar, devolve o original (não trava o pedido).
async function ensureReelsFormat(buffer, name = 'video.mp4') {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-reels-'));
  try {
    const inPath = path.join(workDir, `in-${path.basename(name)}`);
    const outPath = path.join(workDir, 'reels.mp4');
    await fs.writeFile(inPath, buffer);

    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:stream_side_data=rotation:stream_tags=rotate',
      '-of', 'json', inPath,
    ]);
    const stream = (JSON.parse(stdout).streams || [])[0] || {};
    let width = Number(stream.width) || 0;
    let height = Number(stream.height) || 0;
    const rotation = Math.abs(Number(
      (stream.side_data_list || []).map((s) => s.rotation).find((r) => r !== undefined) ??
      (stream.tags && stream.tags.rotate) ?? 0
    ));
    if (rotation === 90 || rotation === 270) [width, height] = [height, width];

    const isVertical916 = width > 0 && Math.abs(width / height - 9 / 16) < 0.02;
    if (isVertical916 && height >= 960) return { buffer, converted: false, width, height };

    await execFileAsync('ffmpeg', [
      '-y', '-i', inPath,
      '-filter_complex',
      '[0:v]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=10:2,scale=1080:1920[bg];' +
        '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];' +
        '[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=30,format=yuv420p[v]',
      '-map', '[v]', '-map', '0:a?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
      '-movflags', '+faststart',
      outPath,
      '-loglevel', 'error',
    ], { maxBuffer: 10 * 1024 * 1024 });
    return { buffer: await fs.readFile(outPath), converted: true, width, height };
  } catch (error) {
    console.error(`[media-pipeline] ensureReelsFormat falhou pra ${name}, usando original:`, error.message);
    return { buffer, converted: false };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Post de foto no TikTok só aceita JPG/WEBP (PNG é recusado) — converte
// qualquer imagem pra JPG. Se o ffmpeg falhar, devolve o original.
async function toJpeg(buffer, name = 'imagem.png') {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-jpg-'));
  try {
    const inPath = path.join(workDir, `in-${path.basename(name)}`);
    const outPath = path.join(workDir, 'foto.jpg');
    await fs.writeFile(inPath, buffer);
    await execFileAsync('ffmpeg', ['-y', '-i', inPath, '-q:v', '2', outPath, '-loglevel', 'error']);
    return { buffer: await fs.readFile(outPath), converted: true };
  } catch (error) {
    console.error(`[media-pipeline] toJpeg falhou pra ${name}, usando original:`, error.message);
    return { buffer, converted: false };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { standardizeToCanvas, buildNarratedSlideshow, buildTransitionSlideshow, ffprobeDuration, stabilizeVideo, mixMusicUnderVideo, narrateOverVideo, ensureReelsFormat, toJpeg };
