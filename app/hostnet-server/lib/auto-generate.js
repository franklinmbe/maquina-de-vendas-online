// Geração automática de conteúdo (banner/vídeo), rodando SÍNCRONA dentro do
// próprio processo do servidor — substitui a antiga rotina de nuvem
// (.claude/skills/gestor-de-geracao-automatica/SKILL.md, desligada em
// 2026-09-15 por causar execuções concorrentes/rate limit em vários
// clientes ao mesmo tempo, ver memória
// bug-automation-webhook-duplicate-runs-2026-09-15 — Franklin pediu
// explicitamente pra tirar a dependência de sessão de nuvem: "o pedido
// precisa sair do usuário e depois que o usuário aprovar é 100% sozinho,
// sem eu e você").
//
// Disparado uma vez, fire-and-forget, logo depois que um pedido novo é
// salvo (ver lib/publish-pedido.js) — nunca por push no GitHub, nunca por
// múltiplas sessões concorrentes. Um `Set` em memória neste mesmo processo
// evita reprocessar o mesmo pedido duas vezes (ex: dispatcher de agendamento
// e um retry manual coincidindo) — muito mais simples e confiável que a
// coordenação via git/commit que a rotina antiga precisava fazer, porque
// agora só existe UM processo tocando isso, não N sessões de nuvem
// concorrentes.
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const { listGithubFolder, listGithubFolderOrNull, putFileToGithub } = require('./github');
const { loadUsers, saveUsers } = require('./users');
const { checkAndConsumeCall } = require('./call-limit');
const { checkAndConsumeMedia } = require('./media-quota');
const { generateImage, generateTts, understandVideoUrl, planPedido } = require('./gemini');
const { standardizeToCanvas, buildNarratedSlideshow } = require('./media-pipeline');

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const VIDEO_EXT = ['mp4', 'mov', 'm4v'];
const DEFAULT_VOICE = 'Kore';

const processing = new Set();

function extOf(name) {
  return (name.split('.').pop() || '').toLowerCase();
}

function mimeFromExt(name) {
  const ext = extOf(name);
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'm4v') return 'video/x-m4v';
  return 'application/octet-stream';
}

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadTextFile({ owner, repo, token, basePath, filename, content, subfolder }) {
  const filePath = subfolder ? `${basePath}/${subfolder}/${filename}` : `${basePath}/${filename}`;
  const base64Content = Buffer.from(content, 'utf-8').toString('base64');
  return putFileToGithub({ owner, repo, token, path: filePath, message: `geração automática: ${filePath}`, base64Content });
}

async function uploadBinaryFile({ owner, repo, token, basePath, filename, buffer, subfolder }) {
  const filePath = subfolder ? `${basePath}/${subfolder}/${filename}` : `${basePath}/${filename}`;
  return putFileToGithub({ owner, repo, token, path: filePath, message: `geração automática: ${filePath}`, base64Content: buffer.toString('base64') });
}

// Ponto de entrada. client = nome exato da pasta (ex: "kleber-construcao"),
// pasta = nome da subpasta do pedido (ex: "app-20260915-195319").
async function processPedido({ client, pasta }) {
  const key = `${client}/${pasta}`;
  if (processing.has(key)) {
    return { skipped: 'already_processing' };
  }
  processing.add(key);
  try {
    return await doProcessPedido({ client, pasta });
  } finally {
    processing.delete(key);
  }
}

async function doProcessPedido({ client, pasta }) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) throw new Error('Configuração do servidor incompleta (GitHub)');

  const basePath = `.claude/skills/${client}/${pasta}`;

  const existingRevisao = await listGithubFolderOrNull({ owner, repo, token, path: `${basePath}/revisao` });
  if (existingRevisao !== null) {
    return { skipped: 'already_has_revisao' };
  }

  const root = await listGithubFolder({ owner, repo, token, path: basePath });
  const rootFiles = root.filter((e) => e.type === 'file');

  const statusEntry = rootFiles.find((f) => f.name === 'geracao-status.json');
  let previousStatus = null;
  if (statusEntry) {
    try {
      const raw = await downloadBuffer(statusEntry.download_url);
      previousStatus = JSON.parse(raw.toString('utf-8'));
    } catch {
      previousStatus = null;
    }
  }
  if (previousStatus && ['done', 'done_passthrough', 'failed_permanent'].includes(previousStatus.status)) {
    return { skipped: `already_${previousStatus.status}` };
  }

  const instrucoesEntry = rootFiles.find((f) => f.name === 'instrucoes.txt');
  if (!instrucoesEntry) {
    return { skipped: 'no_instrucoes' };
  }
  const instrucoesRaw = (await downloadBuffer(instrucoesEntry.download_url)).toString('utf-8');
  const instructionsText = instrucoesRaw.replace(/^Enviado por:.*\n\n/, '');

  const narracaoEntry = rootFiles.find((f) => f.name === 'narracao.json');
  let narracaoChoice = null;
  if (narracaoEntry) {
    try {
      narracaoChoice = JSON.parse((await downloadBuffer(narracaoEntry.download_url)).toString('utf-8'));
    } catch {
      narracaoChoice = null;
    }
  }

  const mediaEntries = rootFiles.filter((f) => {
    const ext = extOf(f.name);
    return IMAGE_EXT.includes(ext) || VIDEO_EXT.includes(ext);
  });

  if (mediaEntries.length === 0) {
    await writeStatus({ owner, repo, token, basePath }, {
      status: 'failed_permanent',
      lastError: 'Pedido sem nenhuma mídia anexada (nem imagem nem vídeo) — precisa de revisão manual do Franklin.',
    });
    return { result: 'failed_permanent', reason: 'no_media' };
  }

  const imageEntries = mediaEntries.filter((f) => IMAGE_EXT.includes(extOf(f.name)));
  const videoEntries = mediaEntries.filter((f) => VIDEO_EXT.includes(extOf(f.name)));

  const imageBuffers = await Promise.all(
    imageEntries.map(async (f) => ({ name: f.name, mimeType: mimeFromExt(f.name), buffer: await downloadBuffer(f.download_url) }))
  );

  let videoAnalysis = null;
  if (videoEntries.length > 0) {
    try {
      videoAnalysis = await understandVideoUrl(videoEntries[0].download_url, mimeFromExt(videoEntries[0].name), instructionsText);
    } catch (error) {
      videoAnalysis = null; // Segue sem análise — plano decide com o que tem, ou marca canDecide:false.
    }
  }

  const imagesForPlan = imageBuffers.map((img) => ({ mimeType: img.mimeType, base64: img.buffer.toString('base64') }));

  let plan;
  try {
    plan = await planPedido({
      instructionsText,
      images: imagesForPlan,
      hasVideo: videoEntries.length > 0,
      videoAnalysis,
      narracaoChoice,
      clientLabel: client,
    });
  } catch (error) {
    await writeStatus({ owner, repo, token, basePath }, {
      status: 'failed_permanent',
      lastError: `Falha ao planejar o pedido via Gemini: ${error.message}`,
    });
    return { result: 'failed_permanent', reason: 'plan_error', error: error.message };
  }

  if (!plan.canDecide) {
    await writeStatus({ owner, repo, token, basePath }, {
      status: 'failed_permanent',
      lastError: `Pedido incompleto/ambíguo mesmo após análise: ${plan.reason || '(sem motivo informado)'}`,
    });
    return { result: 'failed_permanent', reason: 'cannot_decide' };
  }

  // ---- Passthrough: só publicar a mídia já enviada, sem gerar nada ----
  if (!plan.needsGeneration) {
    for (const img of imageBuffers) {
      await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename: img.name, buffer: img.buffer });
    }
    for (const vid of videoEntries) {
      const buf = await downloadBuffer(vid.download_url);
      await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename: vid.name, buffer: buf });
    }
    if (plan.legenda) {
      await uploadTextFile({ owner, repo, token, basePath, filename: 'legenda.txt', content: plan.legenda });
    }
    await writeStatus({ owner, repo, token, basePath }, { status: 'done_passthrough' });
    return { result: 'done_passthrough' };
  }

  // ---- Precisa gerar: checar cota (chamada + mídia) ----
  const users = await loadUsers();
  const user = users.find((u) => u.client === client);

  if (user) {
    const callResult = checkAndConsumeCall(user);
    if (!callResult.allowed) {
      await saveUsers(users);
      await writeStatus({ owner, repo, token, basePath }, { status: 'quota_blocked_call_limit', lastError: callResult.error });
      return { result: 'quota_blocked_call_limit' };
    }
  }

  let allowBanner = !!plan.wantsBanner;
  let allowVideo = !!plan.wantsVideo;
  const mediaLimitInfo = {};

  if (user) {
    if (allowBanner) {
      const r = checkAndConsumeMedia(user, 'images', 1);
      mediaLimitInfo.images = { requested: 1, allowed: r.allowed, error: r.error };
      allowBanner = r.allowed;
    }
    if (allowVideo) {
      const r = checkAndConsumeMedia(user, 'videos', 1);
      mediaLimitInfo.videos = { requested: 1, allowed: r.allowed, error: r.error };
      allowVideo = r.allowed;
    }
    await saveUsers(users);
  }

  if (!allowBanner && !allowVideo) {
    await writeStatus({ owner, repo, token, basePath }, {
      status: 'quota_blocked_media_limit',
      lastError: 'Cota mensal de imagens/vídeos por IA esgotada pro plano deste cliente.',
      mediaLimit: mediaLimitInfo,
    });
    return { result: 'quota_blocked_media_limit' };
  }

  // ---- Gerar de verdade ----
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-gen-'));
  try {
    let bannerBuffer = null;
    if (allowBanner && plan.bannerPrompt) {
      const referenceImages = [];
      if (typeof plan.referenceImageIndex === 'number' && imagesForPlan[plan.referenceImageIndex]) {
        referenceImages.push(imagesForPlan[plan.referenceImageIndex]);
      }
      bannerBuffer = await generateImage(plan.bannerPrompt, referenceImages);
    }

    let videoBuffer = null;
    if (allowVideo) {
      const narrationText = (narracaoChoice && narracaoChoice.narrationText) || plan.narrationText;
      if (!narrationText) {
        throw new Error('Plano pediu vídeo mas não produziu texto de narração');
      }
      const voice = (narracaoChoice && narracaoChoice.voice) || DEFAULT_VOICE;
      const narrationWavBuffer = await generateTts(narrationText, voice);
      const narrationWavPath = path.join(workDir, 'narracao.wav');
      await fs.writeFile(narrationWavPath, narrationWavBuffer);

      // Slides: banner gerado (se houver) + fotos escolhidas pelo plano
      // (imagesToUse), padronizadas pro canvas 1080x1920.
      const slideSources = [];
      if (bannerBuffer) slideSources.push({ name: 'banner1.png', buffer: bannerBuffer });
      const useIndexes = Array.isArray(plan.imagesToUse) ? plan.imagesToUse : [];
      for (const idx of useIndexes) {
        const img = imageBuffers[idx];
        if (img && !(bannerBuffer && idx === plan.referenceImageIndex)) {
          slideSources.push({ name: img.name, buffer: img.buffer });
        }
      }
      if (slideSources.length === 0) {
        // Nada selecionado pelo plano — usa todas as imagens anexadas como
        // fallback, nunca monta vídeo sem nenhum slide.
        imageBuffers.forEach((img) => slideSources.push({ name: img.name, buffer: img.buffer }));
      }

      const slidePaths = [];
      for (let i = 0; i < slideSources.length; i++) {
        const rawPath = path.join(workDir, `raw-${i}-${slideSources[i].name}`);
        await fs.writeFile(rawPath, slideSources[i].buffer);
        const stdPath = path.join(workDir, `slide-${i}.png`);
        await standardizeToCanvas(rawPath, stdPath);
        slidePaths.push(stdPath);
      }

      let musicPath = null;
      if (narracaoChoice && narracaoChoice.music) {
        const candidate = path.join(__dirname, '..', 'public', 'audio', 'musicas', path.basename(narracaoChoice.music));
        try {
          await fs.access(candidate);
          musicPath = candidate;
        } catch {
          musicPath = null;
        }
      }

      const videoOutPath = path.join(workDir, 'video-final.mp4');
      await buildNarratedSlideshow({ slidePaths, narrationWavPath, musicPath, outputPath: videoOutPath });
      videoBuffer = await fs.readFile(videoOutPath);
    }

    if (bannerBuffer) {
      await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename: 'banner1.png', buffer: bannerBuffer });
    }
    if (videoBuffer) {
      await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename: 'video-final.mp4', buffer: videoBuffer });
    }
    if (plan.legenda) {
      await uploadTextFile({ owner, repo, token, basePath, filename: 'legenda.txt', content: plan.legenda });
    }

    await writeStatus({ owner, repo, token, basePath }, {
      status: 'done',
      mediaLimit: mediaLimitInfo,
      note: `Gerado automaticamente (pipeline síncrono no servidor). ${plan.reason || ''}`.trim(),
    });

    return { result: 'done', banner: !!bannerBuffer, video: !!videoBuffer };
  } catch (error) {
    await writeStatus({ owner, repo, token, basePath }, {
      status: 'failed_permanent',
      lastError: `Falha na geração: ${error.message}`,
      mediaLimit: mediaLimitInfo,
    });
    return { result: 'failed_permanent', reason: 'generation_error', error: error.message };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function writeStatus({ owner, repo, token, basePath }, fields) {
  const content = JSON.stringify({ ...fields, completedAt: new Date().toISOString() }, null, 2);
  await putFileToGithub({
    owner, repo, token,
    path: `${basePath}/geracao-status.json`,
    message: `geração automática: status ${fields.status} — ${basePath}`,
    base64Content: Buffer.from(content, 'utf-8').toString('base64'),
  });
}

// Dispara em segundo plano, sem bloquear quem chamou (ver publish-pedido.js)
// — erros são só logados, nunca propagados pro request HTTP do cliente.
function triggerAutoGenerate({ client, pasta }) {
  processPedido({ client, pasta })
    .then((result) => {
      console.log(`[auto-generate] ${client}/${pasta}:`, JSON.stringify(result));
    })
    .catch((error) => {
      console.error(`[auto-generate] ${client}/${pasta} erro não tratado:`, error);
    });
}

module.exports = { processPedido, triggerAutoGenerate };
