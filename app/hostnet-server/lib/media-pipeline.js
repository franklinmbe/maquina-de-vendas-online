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

module.exports = { standardizeToCanvas, buildNarratedSlideshow, ffprobeDuration };
