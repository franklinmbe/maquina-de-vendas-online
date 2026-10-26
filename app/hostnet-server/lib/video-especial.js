// Geração do "🎬 Vídeo especial" do Cut Studio Pro (Franklin, 2026-10-26),
// pago com créditos (lib/creditos.js). O vídeo é feito de cenas de 8 s com
// movimento de verdade (uma chamada ao motor por cena) emendadas no FFmpeg.
// Demora alguns minutos, então roda em segundo plano: a tela pergunta o
// andamento. Cada vídeo fica em $DATA_DIR/video-especial/<cliente>/<id>.json
// (+ .mp4 quando pronto). Se der erro, os créditos voltam pro cliente.
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { generateImage, generateMotionVideo, generateJson } = require('./gemini');
const { creditar, SEGUNDOS_POR_CENA } = require('./creditos');

const execFileAsync = promisify(execFile);

function pasta(client) {
  return path.join(process.env.DATA_DIR || '/data', 'video-especial', client.replace(/[^a-z0-9-]/gi, '_'));
}

async function salvar(client, job) {
  await fs.mkdir(pasta(client), { recursive: true });
  await fs.writeFile(path.join(pasta(client), `${job.id}.json`), JSON.stringify(job, null, 2));
}

async function lerJob(client, id) {
  if (!/^[a-z0-9-]+$/i.test(String(id))) return null;
  try { return JSON.parse(await fs.readFile(path.join(pasta(client), `${id}.json`), 'utf8')); } catch (e) { return null; }
}

async function listarJobs(client) {
  let nomes = [];
  try { nomes = await fs.readdir(pasta(client)); } catch (e) { return []; }
  const jobs = await Promise.all(nomes.filter((n) => n.endsWith('.json')).map((n) => lerJob(client, n.slice(0, -5))));
  return jobs.filter(Boolean).sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
}

function caminhoVideo(client, id) {
  return path.join(pasta(client), `${id}.mp4`);
}

// A IA divide a ideia do cliente em cenas: o que aparece em cada uma (pra
// criar a imagem base) e o movimento da câmera/objetos.
async function planejarCenas(descricao, cenas, temFoto) {
  const plano = await generateJson(
    `Você é diretor de vídeos curtos de propaganda, em pé (9:16). Divida a ideia abaixo em exatamente ${cenas} cena(s) de ${SEGUNDOS_POR_CENA} segundos, que contem uma história do começo ao fim.\n` +
    `Ideia do cliente: """${descricao}"""\n` +
    (temFoto ? 'O cliente mandou uma foto do produto: ele tem que aparecer igual em todas as cenas, sem mudar formato, cor nem letras.\n' : '') +
    'Regras: nunca mostre preço; nenhum texto escrito na tela; ninguém fala (só som ambiente e efeitos).\n' +
    'Responda só com JSON: {"cenas":[{"imagem":"descrição detalhada da imagem inicial da cena","movimento":"o que se mexe e como a câmera anda nos 8 segundos"}]}'
  );
  const lista = Array.isArray(plano.cenas) ? plano.cenas.slice(0, cenas) : [];
  while (lista.length < cenas) lista.push({ imagem: descricao, movimento: 'câmera chegando perto devagar, movimento suave' });
  return lista;
}

async function temAudio(arquivo) {
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', arquivo]);
  return stdout.trim().length > 0;
}

// Deixa todos os clipes no mesmo tamanho/ritmo (com faixa de som, mesmo que
// muda) e emenda um atrás do outro.
async function emendar(clipes, saida, workDir) {
  const prontos = [];
  for (let i = 0; i < clipes.length; i++) {
    const out = path.join(workDir, `n${i}.mp4`);
    const vf = 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30';
    const args = (await temAudio(clipes[i]))
      ? ['-y', '-i', clipes[i], '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-ar', '44100', '-ac', '2', out]
      : ['-y', '-i', clipes[i], '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-vf', vf, '-map', '0:v', '-map', '1:a', '-shortest', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', out];
    await execFileAsync('ffmpeg', [...args, '-loglevel', 'error'], { maxBuffer: 1 << 24 });
    prontos.push(out);
  }
  const lista = path.join(workDir, 'lista.txt');
  await fs.writeFile(lista, prontos.map((p) => `file '${p}'`).join('\n'));
  await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-movflags', '+faststart', saida, '-loglevel', 'error']);
}

async function gerar(client, job, foto) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-especial-'));
  try {
    const cenas = await planejarCenas(job.descricao, job.segundos / SEGUNDOS_POR_CENA, !!foto);
    const ref = foto ? [{ mimeType: foto.mimeType, base64: foto.buffer.toString('base64') }] : [];
    const clipes = [];
    for (let i = 0; i < cenas.length; i++) {
      job.etapa = `Criando a cena ${i + 1} de ${cenas.length}`;
      await salvar(client, job);
      // 1ª cena com foto do cliente: usa a própria foto como imagem base.
      const base = i === 0 && foto
        ? ref[0]
        : { mimeType: 'image/png', base64: (await generateImage(`Foto vertical 9:16, realista e bem iluminada, sem nenhum texto escrito: ${cenas[i].imagem}`, ref)).toString('base64') };
      const video = await generateMotionVideo({
        prompt: `${cenas[i].movimento}. Movimento suave e realista, qualidade de comercial. Sem ninguém falando e sem texto na tela.`,
        image: base,
      });
      const arq = path.join(workDir, `c${i}.mp4`);
      await fs.writeFile(arq, video);
      clipes.push(arq);
    }
    job.etapa = 'Juntando as cenas';
    await salvar(client, job);
    await emendar(clipes, caminhoVideo(client, job.id), workDir);
    job.status = 'pronto';
    job.etapa = '';
    job.prontoEm = new Date().toISOString();
    await salvar(client, job);
  } catch (error) {
    console.error(`[video-especial] ${client}/${job.id} falhou:`, error.message);
    job.status = 'erro';
    job.etapa = '';
    job.erro = 'Não deu pra criar este vídeo. Os créditos voltaram pro seu saldo. Tente de novo mudando um pouco a ideia.';
    if (job.creditos && !job.admin) {
      await creditar({ client }, job.creditos, `Devolução: vídeo especial ${job.id} não saiu`).catch(() => {});
      job.devolvido = true;
    }
    await salvar(client, job);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Cria o registro e começa a gerar em segundo plano. Os créditos já foram
// tirados antes (routes/video-especial.js).
async function iniciar(client, { nivel, segundos, descricao, creditos, admin, foto }) {
  const job = {
    id: `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    nivel, segundos, descricao, creditos, admin: !!admin,
    status: 'criando', etapa: 'Planejando as cenas', criadoEm: new Date().toISOString(),
  };
  await salvar(client, job);
  gerar(client, job, foto).catch(() => {});
  return job;
}

// Vídeo que estava "criando" quando o servidor reiniciou nunca termina:
// marca como erro e devolve os créditos.
async function recuperarInterrompidos() {
  const raiz = path.join(process.env.DATA_DIR || '/data', 'video-especial');
  let clientes = [];
  try { clientes = await fs.readdir(raiz); } catch (e) { return; }
  for (const client of clientes) {
    for (const job of await listarJobs(client)) {
      if (job.status !== 'criando') continue;
      job.status = 'erro';
      job.etapa = '';
      job.erro = 'O servidor reiniciou no meio da criação. Os créditos voltaram pro seu saldo. Pode pedir de novo.';
      if (job.creditos && !job.admin) {
        await creditar({ client }, job.creditos, `Devolução: vídeo especial ${job.id} interrompido`).catch(() => {});
        job.devolvido = true;
      }
      await salvar(client, job);
    }
  }
}

module.exports = { iniciar, listarJobs, lerJob, caminhoVideo, recuperarInterrompidos };
