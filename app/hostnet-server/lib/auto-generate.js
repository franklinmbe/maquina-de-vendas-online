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
const { generateImage, generateTts, understandVideoUrl, planPedido, transcribeAudio } = require('./gemini');
const { promptRulesFor, applyClientContentRules, isAttachmentLabel } = require('./client-content-rules');
const { publishApprovedPedido } = require('./auto-publish');
const { detectMediaText, checkGeneratedImage, describeBlock } = require('./media-text-detection');
const { prepareClientNarration, standardizeToCanvas, buildNarratedSlideshow, buildTransitionSlideshow, stabilizeVideo, mixMusicUnderVideo, narrateOverVideo, ensureReelsFormat } = require('./media-pipeline');

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const VIDEO_EXT = ['mp4', 'mov', 'm4v'];
const DEFAULT_VOICE = 'Kore';
// Sorteio de voz/música do modo automático combinado (vídeo + imagem sem
// texto) — mesmo catálogo da caixa "Voz e música" do composer.
const AUTO_VOICES = ['Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Aoede', 'Autonoe', 'Callirrhoe', 'Charon', 'Despina', 'Enceladus', 'Erinome', 'Fenrir', 'Gacrux', 'Iapetus', 'Kore', 'Laomedeia', 'Leda', 'Orus', 'Puck', 'Pulcherrima', 'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 'Umbriel', 'Vindemiatrix', 'Zephyr', 'Zubenelgenubi'];
// Regra pra todo usuário (Franklin, 2026-09-25): a narração criada tem o
// mesmo tipo de voz de quem fala nos vídeos do usuário — homem → voz
// masculina, mulher → voz feminina. Só muda se ele escolher uma voz na caixa.
// Gêneros das vozes do Gemini TTS conforme a documentação do Google.
const MALE_VOICES = ['Puck', 'Charon', 'Fenrir', 'Orus', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Algenib', 'Rasalgethi', 'Alnilam', 'Schedar', 'Achird', 'Zubenelgenubi', 'Sadachbia', 'Sadaltager'];
const FEMALE_VOICES = ['Zephyr', 'Kore', 'Leda', 'Aoede', 'Callirrhoe', 'Autonoe', 'Despina', 'Erinome', 'Laomedeia', 'Achernar', 'Gacrux', 'Pulcherrima', 'Vindemiatrix', 'Sulafat'];

function voiceGenderFromAnalysis(analysis) {
  const m = /VOZ:\s*\**\s*(masculina|feminina)/i.exec(String(analysis || ''));
  return m ? (m[1].toLowerCase() === 'masculina' ? 'masculina' : 'feminina') : null;
}

function randomVoiceFor(gender) {
  const list = gender === 'masculina' ? MALE_VOICES : gender === 'feminina' ? FEMALE_VOICES : AUTO_VOICES;
  return list[Math.floor(Math.random() * list.length)];
}

function randomMusic() {
  return AUTO_MUSICS[Math.floor(Math.random() * AUTO_MUSICS.length)];
}
const AUTO_MUSICS = [
  'musica-Advertising-1.mp3', 'musica-Advertising-2.mp3', 'musica-Advertising-Music-1.mp3', 'musica-Background-Music-1.mp3',
  'musica-Business-Corporate-Music.mp3', 'musica-Corporate.mp3', 'musica-Corporate-Business-Background.mp3',
  'musica-Fun-Life-Commercial-HipHop.mp3', 'musica-Instagram-Reels-Marketing-1.mp3', 'musica-Marketing-Instagram-Reels-2.mp3',
  'musica-Real-Estate-Construction-1.mp3', 'musica-Real-Estate-Construction-2.mp3', 'musica-Summer-Pop.mp3',
  'musica-The-Future-Beat.mp3', 'musica-Upbeat-Happy-Corporate.mp3',
];

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
// Voz escolhida na caixa "Voz e música" sobre o vídeo REAL do cliente — antes
// era ignorada nesse caso (só a música valia). Só roda quando o cliente
// escolheu uma voz de propósito; sem escolha, o vídeo segue com o áudio
// original (regra 3 das simplificações do composer, CLAUDE.md). Falhar aqui
// nunca trava o pedido: devolve o vídeo sem a narração.
async function narrateIfVoiceChosen({ narracaoChoice, plan, videoPath, workDir, label }) {
  if (!narracaoChoice || !narracaoChoice.voice) return videoPath;
  const text = narracaoChoice.narrationText || plan.narrationText || plan.legenda;
  if (!text) return videoPath;
  try {
    const wavPath = path.join(workDir, 'narracao-cliente.wav');
    await fs.writeFile(wavPath, await generateTts(text, narracaoChoice.voice));
    const outPath = path.join(workDir, 'video-narrado.mp4');
    await narrateOverVideo(videoPath, wavPath, outPath);
    return outPath;
  } catch (error) {
    console.error(`[auto-generate] narração sobre o vídeo falhou pra ${label}:`, error.message);
    return videoPath;
  }
}

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

  // Postagem automática (Franklin, 2026-09-25): cliente só escolheu as
  // fotos/vídeos e tocou em Publicar, sem escrever nada → publica a mídia como
  // está, com descrição escrita pela IA (diferente por rede), sem precisar
  // aprovar. Só conta texto do CLIENTE; o rótulo "Anexei N arquivos:" e as
  // falas do assistente não contam.
  const clientTyped = instructionsText
    .split(/\n(?=Cliente:|Assistente:)/)
    .filter((block) => block.startsWith('Cliente:'))
    .map((block) => block.replace(/^Cliente:\s*/, '').trim())
    .filter((line) => line && !isAttachmentLabel(line));
  const autoMode = clientTyped.length === 0;

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

  // Tipo de voz do usuário: o do vídeo deste pedido (e fica guardado no
  // cadastro dele); pedido sem vídeo/sem fala usa o último guardado.
  let voiceGender = voiceGenderFromAnalysis(videoAnalysis);
  try {
    const usersForVoice = await loadUsers();
    const voiceUser = usersForVoice.find((u) => u.client === client);
    if (voiceUser) {
      if (voiceGender && voiceUser.voiceGender !== voiceGender) {
        voiceUser.voiceGender = voiceGender;
        await saveUsers(usersForVoice);
      } else if (!voiceGender) {
        voiceGender = voiceUser.voiceGender || null;
      }
    }
  } catch (error) {
    console.error(`[auto-generate] não consegui ler/gravar o tipo de voz de ${client}:`, error.message);
  }
  // Voz padrão da narração criada (quando o cliente não escolheu nenhuma).
  const autoVoice = randomVoiceFor(voiceGender);

  // Narração gravada pelo próprio cliente no app (narracao-cliente.*,
  // Franklin 2026-09-25): substitui a voz de IA no vídeo montado e o que ele
  // falou vira base da legenda. Falhou a conversão → segue com voz de IA.
  let clientNarration = null;
  const clientNarrationEntry = rootFiles.find((f) => /^narracao-cliente\./i.test(f.name));
  if (clientNarrationEntry) {
    try {
      const prepared = await prepareClientNarration(await downloadBuffer(clientNarrationEntry.download_url), clientNarrationEntry.name);
      let transcript = '';
      try {
        transcript = await transcribeAudio(prepared.mp3Buffer, 'audio/mp3');
      } catch (error) {
        console.error(`[auto-generate] não consegui transcrever a narração de ${basePath}:`, error.message);
      }
      clientNarration = { ...prepared, transcript };
    } catch (error) {
      console.error(`[auto-generate] narração gravada ilegível em ${basePath}, usando voz de IA:`, error.message);
    }
  }
  const planInstructions = clientNarration && clientNarration.transcript
    ? `${instructionsText}\nCliente (narração que ele gravou com a própria voz — use como base da legenda): "${clientNarration.transcript}"`
    : instructionsText;
  const saveClientNarration = async () => {
    if (!clientNarration) return;
    try {
      await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename: 'narracao.mp3', buffer: clientNarration.mp3Buffer });
    } catch (error) {
      console.error(`[auto-generate] não consegui salvar a narração pra revisão em ${basePath}:`, error.message);
    }
  };
  const narrateOverWithClient = async (videoPath, workDir) => {
    const wavPath = path.join(workDir, 'narracao-cliente.wav');
    await fs.writeFile(wavPath, clientNarration.wavBuffer);
    const outPath = path.join(workDir, 'video-voz-cliente.mp4');
    await narrateOverVideo(videoPath, wavPath, outPath);
    return outPath;
  };

  const imagesForPlan = imageBuffers.map((img) => ({ mimeType: img.mimeType, base64: img.buffer.toString('base64') }));

  // Lê TUDO que está escrito/falado nas mídias do pedido (imagens por OCR,
  // vídeo pela análise acima). O texto fica salvo pra todos os clientes; só a
  // Rjinox bloqueia (nome/telefone de vendedor) — ver lib/media-text-detection.js.
  const detection = await detectMediaText({ client, imageBuffers, videoEntries, videoAnalysis });
  try {
    await uploadTextFile({ owner, repo, token, basePath, filename: 'texto-detectado.json', content: JSON.stringify(detection.record, null, 2) });
  } catch (error) {
    console.error(`[auto-generate] não consegui salvar texto-detectado.json em ${basePath}:`, error.message);
  }
  const blocks = [...detection.blocks];
  const blockedFiles = detection.blockedFiles;
  const vendorBlocksInfo = () => blocks.map((b) => ({ ...b, message: describeBlock(b) }));
  const blockedStatus = async () => {
    await writeStatus({ owner, repo, token, basePath }, {
      status: 'blocked_vendor_identifier',
      lastError: blocks.map(describeBlock).join(' '),
      vendorBlocks: vendorBlocksInfo(),
    });
    return { result: 'blocked_vendor_identifier', blocks: blocks.length };
  };

  let plan;
  try {
    plan = await planPedido({
      instructionsText: planInstructions,
      images: imagesForPlan,
      hasVideo: videoEntries.length > 0,
      videoAnalysis,
      narracaoChoice,
      clientLabel: client,
      clientRules: promptRulesFor(client),
    });
  } catch (error) {
    await writeStatus({ owner, repo, token, basePath }, {
      status: 'failed_permanent',
      lastError: `Falha ao planejar o pedido via Gemini: ${error.message}`,
    });
    return { result: 'failed_permanent', reason: 'plan_error', error: error.message };
  }

  // Modo automático combinado (Franklin, 2026-09-25, 3ª dica): vídeo + imagem
  // sem texto → além de publicar os originais, cria 1 banner a partir da
  // imagem e 1 vídeo feito do banner com voz e música sorteadas; imagem
  // original + banner viram carrossel. Só foto ou só vídeo: publica como está.
  const autoCombo = autoMode && imageBuffers.length > 0 && videoEntries.length > 0;
  let videoBannerIndex = null; // índice do banner que só serve de slide do vídeo (4ª dica)
  // 5ª dica (Franklin, 2026-09-25): 2 a 5 imagens, sem vídeo e sem texto →
  // um banner diferente por imagem (cada um lendo a própria imagem), carrossel
  // com originais + banners, e um vídeo com transições alternando original e
  // banner, narração e música sorteadas, que vira Reels.
  const autoCarousel = autoMode && videoEntries.length === 0 && imageBuffers.length >= 2 && imageBuffers.length <= 5;
  if (autoMode) {
    plan.canDecide = true;
    plan.needsGeneration = autoCombo || autoCarousel;
  }
  if (autoCarousel) {
    const assunto = plan.legenda || 'o produto/serviço mostrado nas imagens';
    const estilos = [
      'estilo moderno e limpo, título grande no topo',
      'estilo promocional vibrante, com faixa de destaque diagonal',
      'estilo elegante e premium, fundo escuro com detalhes dourados',
      'estilo dinâmico de Reels, texto em blocos coloridos',
      'estilo minimalista, muito espaço em branco e produto em destaque',
    ];
    plan.wantsBanner = true;
    plan.banners = imageBuffers.map((_, i) => ({
      prompt: `Crie um banner publicitário vertical 1080x1920 a partir da imagem de referência: leia o que aparece nela (produto, textos, ambiente) e use isso como ideia principal. ${estilos[i % estilos.length]} — visual diferente dos outros banners da mesma série. Contexto geral: ${assunto}. Título curto e forte, chamada pra ação pro WhatsApp.`,
      referenceImageIndex: i,
    }));
    plan.wantsVideo = true;
    plan.useOriginalVideo = false;
    plan.imagesToUse = imageBuffers.map((_, i) => i);
    if (!plan.narrationText) plan.narrationText = plan.legenda || null;
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    narracaoChoice = {
      ...(narracaoChoice || {}),
      voice: (narracaoChoice && narracaoChoice.voice) || autoVoice,
      music: (narracaoChoice && narracaoChoice.music) || pick(AUTO_MUSICS),
    };
  }
  if (autoCombo) {
    // Marcador lido na publicação (publishAll em lib/auto-publish.js).
    try {
      await uploadTextFile({ owner, repo, token, basePath, filename: 'modo-automatico-combo.txt', content: 'Pedido automático vídeo + imagem (3ª dica): publica tudo + carrossel.' });
    } catch (error) {
      console.error(`[auto-generate] não consegui gravar o marcador do modo combinado em ${basePath}:`, error.message);
    }
    const assunto = plan.legenda || 'o produto/serviço mostrado na imagem e no vídeo';
    plan.wantsBanner = true;
    plan.banners = [{
      prompt: `Crie um banner publicitário vertical 1080x1920, chamativo e profissional, usando a imagem de referência como base (mesmo produto, cores e estilo). Tema: ${assunto}. Título curto e forte, chamada pra ação pro WhatsApp.`,
      referenceImageIndex: 0,
    }];
    // 4ª dica (vídeo + 2 imagens): um 2º banner, com visual DIFERENTE do
    // primeiro, feito da 2ª imagem — só ele vira o vídeo (não sai como foto),
    // pra o banner do vídeo não ficar igual ao banner da imagem.
    if (imageBuffers.length >= 2) {
      videoBannerIndex = 1;
      plan.banners.push({
        prompt: `Crie um banner publicitário vertical 1080x1920 usando a imagem de referência como base, com layout e composição DIFERENTES de um banner comum: outra disposição dos elementos, outra tipografia e outra cor de destaque, estilo dinâmico de vídeo/Reels. Tema: ${assunto}. Frase de impacto curta e chamada pra ação pro WhatsApp.`,
        referenceImageIndex: 1,
      });
    }
    plan.wantsVideo = true;
    plan.useOriginalVideo = false;
    plan.imagesToUse = [];
    if (!plan.narrationText) plan.narrationText = plan.legenda || null;
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    narracaoChoice = {
      ...(narracaoChoice || {}),
      voice: (narracaoChoice && narracaoChoice.voice) || autoVoice,
      music: (narracaoChoice && narracaoChoice.music) || pick(AUTO_MUSICS),
    };
  }

  // Cliente gravou a narração e mandou fotos, mas o plano não previa vídeo
  // montado: monta o vídeo com as fotos e a voz dele (é pra isso que ele gravou).
  if (clientNarration && imageBuffers.length > 0 && !plan.wantsVideo) {
    plan.canDecide = true;
    plan.needsGeneration = true;
    plan.wantsVideo = true;
    plan.useOriginalVideo = false;
    if (autoMode && !autoCombo && !autoCarousel) {
      plan.wantsBanner = false;
      plan.banners = [];
    }
    if (!Array.isArray(plan.imagesToUse) || plan.imagesToUse.length === 0) plan.imagesToUse = imageBuffers.map((_, i) => i);
  }

  if (!plan.canDecide) {
    await writeStatus({ owner, repo, token, basePath }, {
      status: 'failed_permanent',
      lastError: `Pedido incompleto/ambíguo mesmo após análise: ${plan.reason || '(sem motivo informado)'}`,
    });
    return { result: 'failed_permanent', reason: 'cannot_decide' };
  }

  // Regras de conteúdo por cliente (hoje só Rjinox: sem nome/telefone/imagem
  // de vendedor) — limpa legenda/narração e reforça os prompts de banner ANTES
  // de gerar qualquer coisa. Ver lib/client-content-rules.js.
  const cleanedFields = applyClientContentRules({ client, plan, narracaoChoice });
  if (cleanedFields.length > 0) {
    console.warn(`[auto-generate] ${basePath}: regras do cliente limparam ${cleanedFields.join(', ')}`);
  }

  // ---- Passthrough: só publicar a mídia já enviada, sem gerar nada ----
  if (!plan.needsGeneration) {
    let passthroughUploaded = 0;
    for (const img of imageBuffers) {
      if (blockedFiles.has(img.name)) continue; // nome/telefone de vendedor (Rjinox) — não publica
      await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename: img.name, buffer: img.buffer });
      passthroughUploaded += 1;
    }
    for (const vid of videoEntries) {
      if (blockedFiles.has(vid.name)) continue;
      passthroughUploaded += 1;
      let buf = await downloadBuffer(vid.download_url);
      // Estabilização só quando o cliente pede explicitamente (ver
      // lib/gemini.js, plan.stabilizeVideo) — nunca aplicada sozinha.
      if (plan.stabilizeVideo) {
        const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-stab-'));
        try {
          const rawPath = path.join(workDir, `raw-${vid.name}`);
          const stabPath = path.join(workDir, `stab-${vid.name}`);
          await fs.writeFile(rawPath, buf);
          await stabilizeVideo(rawPath, stabPath);
          buf = await fs.readFile(stabPath);
        } catch (error) {
          // Estabilização é melhoria, não crítica — se falhar, publica o
          // vídeo original em vez de travar o pedido inteiro.
          console.error(`[auto-generate] estabilização falhou pra ${basePath}/${vid.name}:`, error.message);
        } finally {
          await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
        }
      }
      // Música escolhida na caixa "Voz e música" vale aqui também — bug real
      // 2026-09-23 (Alessandra): pedido "coloca uma música no vídeo, deixa a
      // narração que está no vídeo" caiu neste caminho (só publicar, sem
      // gerar) e a música escolhida era ignorada; só o caminho de geração
      // (useOriginalVideo) mixava. Mixa por baixo do áudio original, sem
      // trocar a fala.
      if (narracaoChoice && narracaoChoice.music) {
        const candidate = path.join(__dirname, '..', 'public', 'audio', 'musicas', path.basename(narracaoChoice.music));
        const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-mix-'));
        try {
          await fs.access(candidate);
          const rawPath = path.join(workDir, `raw-${vid.name}`);
          const mixedPath = path.join(workDir, 'video-com-musica.mp4');
          await fs.writeFile(rawPath, buf);
          await mixMusicUnderVideo(rawPath, candidate, mixedPath);
          buf = await fs.readFile(mixedPath);
        } catch (error) {
          console.error(`[auto-generate] mixagem de música falhou pra ${basePath}/${vid.name}:`, error.message);
        } finally {
          await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
        }
      }
      if (clientNarration || (narracaoChoice && narracaoChoice.voice)) {
        const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mvo-voz-'));
        try {
          const rawPath = path.join(workDir, `raw-${vid.name}`);
          await fs.writeFile(rawPath, buf);
          // Voz gravada pelo cliente tem prioridade sobre a voz de IA escolhida.
          const outPath = clientNarration
            ? await narrateOverWithClient(rawPath, workDir).catch((error) => {
              console.error(`[auto-generate] voz do cliente sobre ${basePath}/${vid.name} falhou:`, error.message);
              return rawPath;
            })
            : await narrateIfVoiceChosen({ narracaoChoice, plan, videoPath: rawPath, workDir, label: `${basePath}/${vid.name}` });
          buf = await fs.readFile(outPath);
        } finally {
          await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
        }
      }
      buf = (await ensureReelsFormat(buf, vid.name)).buffer;
      await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename: vid.name, buffer: buf });
    }
    if (passthroughUploaded === 0 && blocks.length > 0) return blockedStatus();
    if (plan.legenda) {
      await uploadTextFile({ owner, repo, token, basePath, filename: 'legenda.txt', content: plan.legenda });
    }
    await saveLegendas({ owner, repo, token, basePath, plan });
    await saveClientNarration();
    await writeStatus({ owner, repo, token, basePath }, {
      status: 'done_passthrough',
      note: plan.stabilizeVideo ? 'Vídeo estabilizado a pedido do cliente (filtro deshake).' : undefined,
      ...(blocks.length > 0 ? { vendorBlocks: vendorBlocksInfo() } : {}),
    });
    if (autoMode) {
      const published = await autoApproveAndPublish({ owner, repo, token, basePath, client, pasta });
      return { result: 'done_passthrough', stabilized: !!plan.stabilizeVideo, autoPublished: published };
    }
    return { result: 'done_passthrough', stabilized: !!plan.stabilizeVideo };
  }

  // ---- Precisa gerar: checar cota (chamada + mídia) ----
  const users = await loadUsers();
  const user = users.find((u) => u.client === client);

  // Modo automático nunca trava por cota: sem cota, publica só os originais.
  let callBlocked = false;
  if (user) {
    const callResult = checkAndConsumeCall(user);
    if (!callResult.allowed) {
      if (!autoMode) {
        await saveUsers(users);
        await writeStatus({ owner, repo, token, basePath }, { status: 'quota_blocked_call_limit', lastError: callResult.error });
        return { result: 'quota_blocked_call_limit' };
      }
      callBlocked = true;
    }
  }

  // Um item por banner pedido (ex: "3 banners" → 3 itens) — achado real
  // 2026-09-16: a versão anterior só sabia gerar 1 banner, sempre, mesmo
  // quando o cliente pedia vários ("total 3 banners" virava 1 banner
  // silenciosamente, 4 tentativas seguidas com o mesmo resultado errado).
  const bannerSpecs = plan.wantsBanner && Array.isArray(plan.banners) ? plan.banners.filter((b) => b && b.prompt) : [];
  let allowBanner = bannerSpecs.length > 0 && !callBlocked;
  let allowVideo = !!plan.wantsVideo && !callBlocked;
  const mediaLimitInfo = {};

  if (user && !callBlocked) {
    if (allowBanner) {
      const r = checkAndConsumeMedia(user, 'images', bannerSpecs.length);
      mediaLimitInfo.images = { requested: bannerSpecs.length, allowed: r.allowed, error: r.error };
      allowBanner = r.allowed;
    }
    if (allowVideo) {
      const r = checkAndConsumeMedia(user, 'videos', 1);
      mediaLimitInfo.videos = { requested: 1, allowed: r.allowed, error: r.error };
      allowVideo = r.allowed;
    }
    await saveUsers(users);
  }

  if (callBlocked) await saveUsers(users);
  if (!allowBanner && !allowVideo && !autoMode) {
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
    // Gera cada banner pedido — um a um, pra uma falha isolada (ex: Gemini
    // recusou um prompt específico) não derrubar os outros que já deram
    // certo. bannerBuffers[i] pode ficar null se aquele item falhou.
    const bannerBuffers = [];
    if (allowBanner) {
      for (const spec of bannerSpecs) {
        const referenceImages = [];
        if (typeof spec.referenceImageIndex === 'number' && imagesForPlan[spec.referenceImageIndex]) {
          referenceImages.push(imagesForPlan[spec.referenceImageIndex]);
        }
        try {
          let generated = await generateImage(spec.prompt, referenceImages);
          if (detection.enforce) {
            // Rjinox: a IA pode inventar nome/telefone/site mesmo sem ser
            // pedido — lê o banner pronto; se tiver, refaz UMA vez com
            // instrução reforçada; se ainda tiver (ou não der pra ler),
            // descarta.
            let check = await checkGeneratedImage(generated);
            if (!check.ok) {
              const retryPrompt = `${spec.prompt}\n\nATENÇÃO: a versão anterior saiu com nome de pessoa, número de telefone ou site/URL escrito na imagem. Gere de novo SEM nenhum nome de pessoa, SEM nenhum número de telefone e SEM nenhum site/URL em lugar nenhum da imagem.`;
              generated = await generateImage(retryPrompt, referenceImages);
              check = await checkGeneratedImage(generated);
              if (!check.ok) {
                blocks.push({
                  file: `banner ${bannerBuffers.length + 1}`,
                  kind: 'banner',
                  reason: check.error ? 'unverified' : 'vendor_identifier',
                  phones: check.found ? check.found.phones : [],
                  names: check.found ? check.found.names : [],
                  urls: check.found ? check.found.urls : [],
                  detail: check.error || undefined,
                });
                generated = null;
              }
            }
          }
          bannerBuffers.push(generated);
        } catch (error) {
          console.error(`[auto-generate] falha ao gerar 1 dos ${bannerSpecs.length} banners de ${basePath}:`, error.message);
          bannerBuffers.push(null);
        }
      }
    }
    // Banner usado como slide do vídeo: o banner próprio do vídeo (4ª dica)
    // se existir; senão, o primeiro banner válido.
    const bannerBuffer = (videoBannerIndex !== null && bannerBuffers[videoBannerIndex]) || bannerBuffers.find(Boolean) || null;

    let videoBuffer = null;
    // O cliente mandou o vídeo dele pra ser publicado, mas ele tem nome/telefone
    // de vendedor (Rjinox) — não publica, e também não troca por um vídeo
    // gerado do zero (ele pediu ESSE vídeo).
    const originalVideoBlocked = plan.useOriginalVideo && videoEntries.length > 0 && blockedFiles.has(videoEntries[0].name);
    if (allowVideo && originalVideoBlocked) {
      // sem vídeo neste pedido — o bloqueio já está em `blocks`
    } else if (allowVideo && plan.useOriginalVideo && videoEntries.length > 0) {
      // O cliente já mandou o vídeo real e quer ESSE vídeo publicado
      // (editado/consertado), não um vídeo novo gerado a partir de imagens
      // — achado real 2026-09-16: substituir o vídeo do cliente por um
      // slideshow genérico quando ele só pediu pra tirar o tremido do
      // vídeo dele é exatamente o tipo de resultado que não serve (ver
      // memória do dia). Narração falada não se aplica aqui (o vídeo já
      // tem áudio próprio) — só estabilização e/ou música de fundo, os
      // dois opcionais e só quando pedidos.
      const workBuffer = await downloadBuffer(videoEntries[0].download_url);
      let workPath = path.join(workDir, `original-${videoEntries[0].name}`);
      await fs.writeFile(workPath, workBuffer);

      if (plan.stabilizeVideo) {
        try {
          const stabPath = path.join(workDir, 'stabilized.mp4');
          await stabilizeVideo(workPath, stabPath);
          workPath = stabPath;
        } catch (error) {
          // Estabilização é melhoria, não crítica — se o ffmpeg falhar por
          // qualquer motivo, publica o vídeo original em vez de derrubar o
          // pedido inteiro (banner incluído).
          console.error(`[auto-generate] estabilização falhou pra ${basePath}:`, error.message);
        }
      }

      if (narracaoChoice && narracaoChoice.music) {
        const candidate = path.join(__dirname, '..', 'public', 'audio', 'musicas', path.basename(narracaoChoice.music));
        try {
          await fs.access(candidate);
          const mixedPath = path.join(workDir, 'video-com-musica.mp4');
          await mixMusicUnderVideo(workPath, candidate, mixedPath);
          workPath = mixedPath;
        } catch (error) {
          // Música não encontrada ou mixagem falhou — segue sem ela, não
          // trava o pedido inteiro por isso.
          console.error(`[auto-generate] mixagem de música falhou pra ${basePath}:`, error.message);
        }
      }

      workPath = clientNarration
        ? await narrateOverWithClient(workPath, workDir).catch((error) => {
          console.error(`[auto-generate] voz do cliente sobre o vídeo falhou em ${basePath}:`, error.message);
          return workPath;
        })
        : await narrateIfVoiceChosen({ narracaoChoice, plan, videoPath: workPath, workDir, label: basePath });

      videoBuffer = (await ensureReelsFormat(await fs.readFile(workPath), videoEntries[0].name)).buffer;
    } else if (allowVideo) {
      // Achado real 2026-09-16: quando o plano não produzia texto de
      // narração (ex: cliente pediu pra manter a voz original, mas o vídeo
      // anexado ficou de fora por algum motivo e caiu aqui em vez do
      // caminho useOriginalVideo acima), o pedido inteiro falhava
      // (failed_permanent) mesmo já tendo tudo que precisava pra pelo
      // menos publicar alguma coisa. Nunca mais travar o pedido inteiro só
      // por falta de texto de narração — cai pro texto da legenda (sempre
      // presente) como narração de segurança.
      let narrationWavBuffer;
      if (clientNarration) {
        // Voz do próprio cliente, gravada no app — no lugar da voz de IA.
        narrationWavBuffer = clientNarration.wavBuffer;
      } else {
        const narrationText = (narracaoChoice && narracaoChoice.narrationText) || plan.narrationText || plan.legenda;
        if (!narrationText) {
          throw new Error('Plano pediu vídeo mas não produziu nem narração nem legenda pra usar como texto');
        }
        const voice = (narracaoChoice && narracaoChoice.voice) || autoVoice;
        narrationWavBuffer = await generateTts(narrationText, voice);
      }
      const narrationWavPath = path.join(workDir, 'narracao.wav');
      await fs.writeFile(narrationWavPath, narrationWavBuffer);

      // Slides: primeiro banner gerado (se houver) + fotos escolhidas pelo
      // plano (imagesToUse), padronizadas pro canvas 1080x1920.
      const usedAsReference = new Set(bannerSpecs.map((b) => b.referenceImageIndex).filter((i) => typeof i === 'number'));
      const slideSources = [];
      // 5ª dica: original e banner alternados (original 1, banner 1,
      // original 2, banner 2...).
      if (autoCarousel) {
        imageBuffers.forEach((img, i) => {
          if (!blockedFiles.has(img.name)) slideSources.push({ name: img.name, buffer: img.buffer });
          if (bannerBuffers[i]) slideSources.push({ name: `banner${i + 1}.png`, buffer: bannerBuffers[i] });
        });
      } else if (bannerBuffer) slideSources.push({ name: 'banner1.png', buffer: bannerBuffer });
      const useIndexes = !autoCarousel && Array.isArray(plan.imagesToUse) ? plan.imagesToUse : [];
      for (const idx of useIndexes) {
        const img = imageBuffers[idx];
        if (img && !blockedFiles.has(img.name) && !(bannerBuffer && usedAsReference.has(idx))) {
          slideSources.push({ name: img.name, buffer: img.buffer });
        }
      }
      if (slideSources.length === 0) {
        // Nada selecionado pelo plano — usa todas as imagens anexadas como
        // fallback (menos as barradas por nome/telefone de vendedor), nunca
        // monta vídeo sem nenhum slide.
        imageBuffers.filter((img) => !blockedFiles.has(img.name)).forEach((img) => slideSources.push({ name: img.name, buffer: img.buffer }));
      }
      if (slideSources.length === 0) {
        // Todas as fotos foram barradas e nenhum banner saiu — sem slide não
        // há vídeo; o bloqueio explica o motivo.
        throw Object.assign(new Error('sem slide disponível pro vídeo'), { noSlides: true });
      }

      const slidePaths = [];
      for (let i = 0; i < slideSources.length; i++) {
        const rawPath = path.join(workDir, `raw-${i}-${slideSources[i].name}`);
        await fs.writeFile(rawPath, slideSources[i].buffer);
        if (autoCarousel) {
          // O vídeo com transições já encaixa cada imagem com fundo desfocado.
          slidePaths.push(rawPath);
          continue;
        }
        const stdPath = path.join(workDir, `slide-${i}.png`);
        await standardizeToCanvas(rawPath, stdPath);
        slidePaths.push(stdPath);
      }

      // Vídeo criado sempre com música: a escolhida pelo cliente, senão uma
      // sorteada (Franklin, 2026-09-25).
      let musicPath = null;
      const musicName = (narracaoChoice && narracaoChoice.music) || randomMusic();
      const musicCandidate = path.join(__dirname, '..', 'public', 'audio', 'musicas', path.basename(musicName));
      try {
        await fs.access(musicCandidate);
        musicPath = musicCandidate;
      } catch {
        musicPath = null;
      }

      const videoOutPath = path.join(workDir, 'video-final.mp4');
      if (autoCarousel) {
        try {
          await buildTransitionSlideshow({ slidePaths, narrationWavPath, musicPath, outputPath: videoOutPath });
        } catch (error) {
          // Transições são o extra; se o ffmpeg falhar, faz o vídeo simples.
          console.error(`[auto-generate] vídeo com transições falhou em ${basePath}, usando o simples:`, error.message);
          const stdPaths = [];
          for (let i = 0; i < slidePaths.length; i++) {
            const stdPath = path.join(workDir, `slide-std-${i}.png`);
            await standardizeToCanvas(slidePaths[i], stdPath);
            stdPaths.push(stdPath);
          }
          await buildNarratedSlideshow({ slidePaths: stdPaths, narrationWavPath, musicPath, outputPath: videoOutPath });
        }
      } else {
        await buildNarratedSlideshow({ slidePaths, narrationWavPath, musicPath, outputPath: videoOutPath });
      }
      videoBuffer = await fs.readFile(videoOutPath);
    }

    let bannersUploaded = 0;
    for (let i = 0; i < bannerBuffers.length; i++) {
      if (!bannerBuffers[i]) continue;
      // Banner só do vídeo não sai como foto (a não ser que o do post tenha falhado).
      if (i === videoBannerIndex && bannerBuffers.some((b, j) => b && j !== videoBannerIndex)) continue;
      bannersUploaded += 1;
      const filename = bannerBuffers.length > 1 ? `banner${i + 1}.png` : 'banner1.png';
      await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename, buffer: bannerBuffers[i] });
    }
    if (videoBuffer) {
      await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename: 'video-final.mp4', buffer: videoBuffer });
    }

    // Além do que a IA gerou, sobe também as mídias ORIGINAIS que o cliente
    // anexou como exemplo/referência pro pedido (2026-09-22, pedido do
    // Franklin: "não quero que delete a imagem e vídeo que o usuário
    // escolheu como modelo" — ele quer poder escolher, na revisão, se
    // mantém o original junto do banner/vídeo gerado, pra virar carrossel
    // com mais itens). O vídeo original só NÃO sobe de novo aqui quando ele
    // já foi enviado como video-final.mp4 acima (plan.useOriginalVideo) —
    // aí já é a mesma mídia, subir duplicado não ajuda em nada.
    const skipVideoNames = new Set(
      plan.useOriginalVideo && videoEntries.length > 0 ? [videoEntries[0].name] : []
    );
    let originalsPreserved = 0;
    for (const img of imageBuffers) {
      if (blockedFiles.has(img.name)) continue; // nome/telefone de vendedor (Rjinox) — não sobe
      await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename: img.name, buffer: img.buffer });
      originalsPreserved += 1;
    }
    for (const vid of videoEntries) {
      if (blockedFiles.has(vid.name) || skipVideoNames.has(vid.name)) continue;
      try {
        const { buffer: buf } = await ensureReelsFormat(await downloadBuffer(vid.download_url), vid.name);
        await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename: vid.name, buffer: buf });
        originalsPreserved += 1;
      } catch (error) {
        // Preservar o original é um extra, não o resultado principal do
        // pedido — se o download falhar por qualquer motivo, segue sem
        // travar o pedido inteiro por causa disso.
        console.error(`[auto-generate] não consegui preservar o vídeo original ${vid.name} em ${basePath}:`, error.message);
      }
    }

    // Nada sobrou pra publicar porque tudo tinha nome/telefone de vendedor
    // (Rjinox): explica em vez de terminar sem resposta.
    if (bannersUploaded === 0 && !videoBuffer && originalsPreserved === 0 && blocks.length > 0) return blockedStatus();

    if (plan.legenda) {
      await uploadTextFile({ owner, repo, token, basePath, filename: 'legenda.txt', content: plan.legenda });
    }
    await saveLegendas({ owner, repo, token, basePath, plan });
    await saveClientNarration();

    await writeStatus({ owner, repo, token, basePath }, {
      status: 'done',
      mediaLimit: mediaLimitInfo,
      note: `Gerado automaticamente (pipeline síncrono no servidor). ${plan.reason || ''} (${bannersUploaded}/${bannerSpecs.length} banners pedidos, ${originalsPreserved} mídia(s) original(is) preservada(s) pra revisão)`.trim(),
      ...(blocks.length > 0 ? { vendorBlocks: vendorBlocksInfo() } : {}),
    });

    if (autoMode) {
      const published = await autoApproveAndPublish({ owner, repo, token, basePath, client, pasta });
      return { result: 'done', banners: bannersUploaded, bannersRequested: bannerSpecs.length, video: !!videoBuffer, originalsPreserved, autoPublished: published };
    }
    return { result: 'done', banners: bannersUploaded, bannersRequested: bannerSpecs.length, video: !!videoBuffer, originalsPreserved };
  } catch (error) {
    if (error && error.noSlides && blocks.length > 0) return blockedStatus();
    if (autoMode) {
      // Pedido automático não fica sem nada: a criação falhou, então publica
      // pelo menos a foto e o vídeo originais.
      console.error(`[auto-generate] criação automática falhou em ${basePath}, publicando só os originais:`, error.message);
      try {
        for (const img of imageBuffers) {
          if (blockedFiles.has(img.name)) continue;
          await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename: img.name, buffer: img.buffer });
        }
        for (const vid of videoEntries) {
          if (blockedFiles.has(vid.name)) continue;
          const { buffer: buf } = await ensureReelsFormat(await downloadBuffer(vid.download_url), vid.name);
          await uploadBinaryFile({ owner, repo, token, basePath, subfolder: 'revisao', filename: vid.name, buffer: buf });
        }
        if (plan.legenda) await uploadTextFile({ owner, repo, token, basePath, filename: 'legenda.txt', content: plan.legenda });
        await saveLegendas({ owner, repo, token, basePath, plan });
        await saveClientNarration();
        await writeStatus({ owner, repo, token, basePath }, { status: 'done_passthrough', note: `Criação automática falhou (${error.message}); publicados só os originais.` });
        const published = await autoApproveAndPublish({ owner, repo, token, basePath, client, pasta });
        return { result: 'done_passthrough', fallbackFromError: error.message, autoPublished: published };
      } catch (fallbackError) {
        console.error(`[auto-generate] publicação dos originais também falhou em ${basePath}:`, fallbackError.message);
      }
    }
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

async function saveLegendas({ owner, repo, token, basePath, plan }) {
  if (!plan.legendas || typeof plan.legendas !== 'object') return;
  const clean = {};
  for (const [net, text] of Object.entries(plan.legendas)) {
    if (typeof text === 'string' && text.trim()) clean[net] = text.trim();
  }
  if (Object.keys(clean).length === 0) return;
  try {
    await uploadTextFile({ owner, repo, token, basePath, filename: 'legendas.json', content: JSON.stringify(clean, null, 2) });
  } catch (error) {
    // Sem as variações, todas as redes usam legenda.txt — não trava o pedido.
    console.error(`[auto-generate] não consegui salvar legendas.json em ${basePath}:`, error.message);
  }
}

// Aprova sozinho e publica (modo automático, ver autoMode). Falha aqui não
// perde nada: o pedido fica pronto na tela de aprovação como sempre.
async function autoApproveAndPublish({ owner, repo, token, basePath, client, pasta }) {
  try {
    await putFileToGithub({
      owner, repo, token,
      path: `${basePath}/revisao/APROVADO.txt`,
      message: `aprovação automática: ${client}/${pasta}`,
      base64Content: Buffer.from(`Aprovado automaticamente (pedido sem texto) em ${new Date().toISOString()}`, 'utf-8').toString('base64'),
    });
  } catch (error) {
    console.error(`[auto-generate] aprovação automática falhou em ${basePath}:`, error.message);
    return 0;
  }
  try {
    const r = await publishApprovedPedido({ client, pasta });
    return (r.results || []).filter((x) => x.status === 'ok').length;
  } catch (error) {
    console.error(`[auto-generate] publicação automática falhou em ${basePath}:`, error.message);
    return 0;
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

// Geração ainda rodando pra esse pedido? revisao/ já existe no meio do
// caminho (fotos sobem antes do vídeo), então aprovar nessa hora publica só
// parte do conteúdo — caso real do Kleber em 2026-09-25 (aprovou 25 s antes
// do vídeo subir, só as fotos saíram). Ver approve-pedido/pending-approvals.
function isProcessing({ client, pasta }) {
  return processing.has(`${client}/${pasta}`);
}

module.exports = { processPedido, triggerAutoGenerate, isProcessing };
