const { loadUsers, saveUsers } = require('./users');
const { listGithubFolder, putFileToGithub } = require('./github');
const { decryptToken, encryptToken } = require('./token-crypto');
const {
  publishFacebookPhoto,
  publishFacebookVideo,
  publishInstagramPhoto,
  publishInstagramVideo,
  publishInstagramStory,
  publishInstagramCarousel,
  publishFacebookCarousel,
  publishFacebookStoryPhoto,
  publishFacebookStoryVideo,
} = require('./meta');
const { refreshAccessToken: refreshYouTubeToken, uploadVideo } = require('./youtube');
const { sendPhoto, sendVideo } = require('./telegram');
const { uploadToPostiz, createPostizPost, listPostizPosts } = require('./postiz');
const { checkPostQuota, recordPostsPublished } = require('./post-quota');
const { sanitizeClientText, isRjinoxClient, isAttachmentLabel } = require('./client-content-rules');
const { scanUrlsForVendorIdentifiers, describeBlock } = require('./media-text-detection');
const { toJpeg, splitVideoForStories } = require('./media-pipeline');
const { loadStoriesCuts } = require('./stories-cortes');
const { generateJson } = require('./gemini');
const { registrarMidias, idsDoResultado } = require('./ig-media-dono');

// Regra pra todo cliente (Franklin, 2026-09-25): nunca a mesma descrição em
// duas redes. Se faltar legenda de alguma rede ou duas vierem iguais
// (legendas.json ausente, agendamento, pedido antigo), reescreve variações a
// partir da legenda principal. Falhou a IA → segue com o que tinha.
const CAPTION_NETWORKS = ['facebook', 'instagram', 'tiktok', 'youtube', 'telegram'];

async function ensureDistinctCaptions(client, caption, captions) {
  const base = String(caption || '').trim();
  const current = { ...(captions || {}) };
  const seen = new Set();
  let needsRewrite = false;
  for (const net of CAPTION_NETWORKS) {
    const text = (current[net] || '').trim();
    if (!text || seen.has(text.toLowerCase())) needsRewrite = true;
    seen.add(text.toLowerCase());
  }
  if (!needsRewrite || !base) return captions;
  try {
    const out = await generateJson(
      `Reescreva a legenda abaixo em 5 versões DIFERENTES, uma pra cada rede social, mesmo assunto mas com outras palavras e outra frase de abertura — nenhuma igual à outra. ` +
        `Nunca coloque preço/valor. Português do Brasil. Responda só em JSON: {"facebook": string (2-4 frases, conversa próxima, chamada pro WhatsApp), "instagram": string (1-3 frases + 3 a 6 hashtags), "tiktok": string (1 frase curta + 2 a 4 hashtags), "youtube": string (2-3 frases descritivas), "telegram": string (1-2 frases diretas)}.\n\nLegenda:\n"""${base}"""`
    );
    const merged = { ...current };
    const used = new Set();
    for (const net of CAPTION_NETWORKS) {
      const mine = (merged[net] || '').trim();
      if (mine && !used.has(mine.toLowerCase())) {
        used.add(mine.toLowerCase());
        continue;
      }
      if (out && typeof out[net] === 'string' && out[net].trim()) {
        merged[net] = sanitizeClientText(client, out[net].trim());
        used.add(merged[net].toLowerCase());
      }
    }
    return merged;
  } catch (error) {
    console.error('[auto-publish] não consegui variar as legendas por rede:', error.message);
    return captions;
  }
}

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'm4v'];
const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  m4v: 'video/x-m4v',
};

function extOf(name) {
  return (name.split('.').pop() || '').toLowerCase();
}

// createPostizPost (chamado no loop "Contas via Postiz" abaixo) só confirma
// que a Postiz aceitou a fila — o processamento real na rede (TikTok, etc)
// é assíncrono e pode terminar em erro depois. Achado real 2026-09-15: um
// vídeo do Kleber ficou marcado "ok" aqui, mas a Postiz já mostrava
// state:"ERROR" (TikTok recusou por frame rate inválido) — ninguém percebeu
// porque nosso registro nunca conferia o estado final. Uma única espera +
// uma única chamada de listagem (não por item, senão um pedido com vários
// posts via Postiz somaria dezenas de segundos no tempo de resposta do
// "Aprovar" do cliente, que aguarda esta função terminar — ver
// routes/approve-pedido.js) — best-effort: se a rede ainda não processou
// dentro desse tempo, ou a chamada falhar, o status "ok" da criação é
// mantido sem mudança (nunca piora o que já tínhamos antes desta correção).
// `pendingPostizChecks` guarda a referência do OBJETO de resultado (não mais
// um índice em `results`) — 2026-09-22, publishMediaBundle passou a rodar as
// publicações em paralelo (ver runWithConcurrency), então a posição de cada
// item em `results` não é mais previsível/estável; mutar o objeto direto
// (referência) funciona não importa a ordem em que as tarefas terminaram.
async function reconcilePostizResults(pendingPostizChecks) {
  if (pendingPostizChecks.length === 0) return;
  await new Promise((resolve) => setTimeout(resolve, 8000));
  const startDate = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const endDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const posts = await listPostizPosts({ startDate, endDate });
  if (posts.length === 0) return;
  const stateById = new Map(posts.map((p) => [p.id, p.state]));
  for (const { result, postId } of pendingPostizChecks) {
    const state = stateById.get(postId);
    if (!state) continue;
    result.postizState = state;
    if (state === 'ERROR') {
      result.status = 'erro';
      result.error = 'Postiz aceitou o post, mas a rede recusou depois (state: ERROR) — conferir direto na Postiz';
    }
  }
}

// Executa uma lista de tarefas assíncronas em paralelo, no máximo
// `concurrency` por vez — pedido do Franklin, 2026-09-22: antes, cada
// publicação (post, story, carrossel, em cada rede) esperava a anterior
// terminar antes de começar a próxima, então um pedido com bastante mídia em
// vários formatos/redes (ex: 5 arquivos × 2 redes × 3 formatos = 20+
// publicações reais) podia levar minutos — tempo suficiente pro celular do
// cliente desistir da conexão e mostrar "Failed to fetch" mesmo o servidor
// tendo terminado tudo certo por trás (achado real, mais de uma vez no mesmo
// dia: Eduardo, Alessandra, Kleber). Roda em lotes (não tudo de uma vez só)
// pra não estourar limite de taxa da API do Meta.
async function runWithConcurrency(tasks, concurrency) {
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const current = index++;
      await tasks[current]();
    }
  }
  const workerCount = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
}

// instrucoes.txt pode ser a transcrição inteira de uma conversa com o
// assistente do composer ("Cliente: ...\nAssistente: ...\n..."), não uma
// legenda pronta pra publicar — bug real 2026-09-15: um pedido do Kleber
// (frete grátis em Madureira) saiu ao vivo no Facebook/Instagram com a
// pergunta de esclarecimento do assistente ("quer incluir preço/telefone?
// qual tom de voz?") publicada como legenda, porque esse pedido não gerou
// legenda.txt curada (só acontece hoje quando understand_video roda, ver
// gestor-de-geracao-automatica/SKILL.md) e caiu neste fallback cru. Rede de
// segurança: quando o texto bate no formato de conversa, ficamos só com as
// falas do "Cliente:" (o pedido de verdade), descartando as perguntas e
// respostas do assistente. Pedido enviado direto (sem passar pelo chat do
// composer) não bate nesse formato e sai sem nenhuma mudança.
function extractCleanCaption(rawText) {
  const text = (rawText || '').trim();
  if (!/^Cliente:/m.test(text)) return text;
  const clientLines = text
    .split(/\n(?=Cliente:|Assistente:)/)
    .filter((block) => block.startsWith('Cliente:'))
    .map((block) => block.replace(/^Cliente:\s*/, '').trim())
    .filter((line) => line && !isAttachmentLabel(line));
  return clientLines.join(' ').trim() || text;
}

// A legenda vem crua da conversa do composer (ver publish-pedido.js) — pode
// vir bem mais longa que o limite de cada rede (teste real 2026-09-10: 5448
// caracteres, estourou o teto de Instagram/YouTube em 5/5 e 1/1 tentativas).
// Cada rede recusa a chamada inteira quando isso acontece, então cortamos
// ANTES de publicar em vez de deixar a API rejeitar. Corta em '…' pra deixar
// claro que a legenda foi resumida.
function truncateCaption(text, maxLen) {
  const value = text || '';
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1).trimEnd()}…`;
}

// Instagram: 2200 chars (caption de foto/vídeo/carrossel). YouTube:
// description tem 5000 chars de teto. Telegram: caption de foto/vídeo é
// limitada a 1024 chars. TikTok (via Postiz): mesmo teto do Instagram, prática
// comum da própria plataforma. Facebook fica de fora — teto real é ~63.000
// chars, nunca chega perto disso aqui.
const CAPTION_LIMITS = { instagram: 2200, youtube: 5000, telegram: 1024, tiktok: 2200 };

// Postiz exige esse objeto "settings" completo pra publicar no TikTok (teste
// real 2026-09-10 falhou 2/2 vezes por faltar todos esses campos — Postiz
// recusa a chamada inteira, listando cada um). Valores escolhidos: posta
// público de verdade (não fica preso em rascunho), sem restringir
// duet/stitch/comentário, sem música automática (os vídeos já saem com
// narração/trilha próprias, ver CLAUDE.md) e sem marcar como conteúdo de
// marca (posts orgânicos, não patrocinados).
const TIKTOK_POSTIZ_SETTINGS = {
  privacy_level: 'PUBLIC_TO_EVERYONE',
  content_posting_method: 'DIRECT_POST',
  duet: true,
  stitch: true,
  comment: true,
  autoAddMusic: 'no',
  brand_content_toggle: false,
  brand_organic_toggle: false,
};

// Descoberto no teste real da Rjinox (2026-09-14): Instagram via Postiz
// também exige "settings", só que bem mais simples que o TikTok — só o tipo
// de post. "post" = feed normal (o único formato que esse caminho publica
// hoje; Stories/Reels via Postiz não são usados, ver auto-publish abaixo).
const INSTAGRAM_POSTIZ_SETTINGS = { post_type: 'post' };

// Resolve, pra um formato (post/reels/carrossel/stories) e uma rede
// (facebook/instagram/youtube), se esse formato deve publicar NESSA rede
// específica — pedido do Franklin, 2026-09-22: antes, marcar um formato
// aplicava em toda rede marcada ao mesmo tempo (não dava pra escolher
// "Reels só no Facebook"). Se `formatNetworks` tem uma entrada pra esse
// formato, usa ela (lista explícita de redes); sem entrada nenhuma (pedido
// de antes dessa mudança, ou formato sem restrição extra), cai no
// comportamento de sempre: o formato vale pra qualquer rede marcada.
function formatAppliesToPlatform(formatNetworks, formats, format, platform) {
  if (!formats.includes(format)) return false;
  if (formatNetworks && Object.prototype.hasOwnProperty.call(formatNetworks, format)) {
    return Array.isArray(formatNetworks[format]) && formatNetworks[format].includes(platform);
  }
  return true;
}

// Vídeo do Stories do Instagram com mais de 60 s: divide em partes, guarda
// cada parte no GitHub (precisa de URL pública pro Meta buscar) e devolve a
// lista na ordem. Até 60 s devolve o próprio vídeo. Franklin, 2026-11-17:
// "já parte o vídeo, avisa ele e posta".
async function storiesVideoParts(vid) {
  const buf = await fetchBuffer(vid.download_url);
  const { duration, parts } = await splitVideoForStories(buf, vid.name);
  if (parts.length <= 1) return { duration, parts: [{ url: vid.download_url, label: vid.name }] };
  const { owner, repo, token } = githubEnv();
  const m = /\/(\.claude\/skills\/[^/]+\/[^/]+)\/revisao\//.exec(decodeURIComponent(vid.download_url));
  const dir = m ? `${m[1]}/stories-partes` : `.claude/skills/_stories-partes/${Date.now()}`;
  const stem = vid.name.replace(/\.[^.]+$/, '');
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const up = await putFileToGithub({
      owner, repo, token,
      path: `${dir}/${stem}-parte${i + 1}.mp4`,
      message: `stories em partes (vídeo de ${Math.round(duration)} s): ${stem} parte ${i + 1}`,
      base64Content: parts[i].toString('base64'),
    });
    out.push({ url: up.content.download_url, label: `${vid.name} (parte ${i + 1} de ${parts.length})` });
  }
  return { duration, parts: out };
}

function githubEnv() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) throw new Error('Configuração do servidor incompleta (GitHub)');
  return { owner, repo, token };
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar mídia: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo: ${res.status}`);
  return res.text();
}

// Núcleo compartilhado de publicação — recebe mídia já com URL pública
// (download_url, de qualquer origem: GitHub via revisao/ aprovado, ou GitHub
// via upload de um post agendado) e publica de verdade em todas as contas
// conectadas do usuário, respeitando redes marcadas (requestedNetworks) e
// formato(s) escolhidos pro Facebook/Instagram (formats). Não mexe em
// cota/persistência — quem chama decide isso (ver publishApprovedPedido e
// publishScheduledPiece abaixo, os dois usam essa mesma função por baixo).
//
// WordPress fica de fora de propósito — precisa de título/conteúdo de
// artigo estruturado, não combina com "banner/vídeo pra postar", então
// continua sendo um fluxo manual separado.
async function publishMediaBundle({ user, images, videos, caption, captions, requestedNetworks, formats, formatNetworks, publishAll = false, onlyMetaPage, storiesCuts }) {
  // Legenda diferente por rede (Franklin, 2026-09-25) — legendas.json gerado
  // junto com o plano; rede sem variação própria usa a legenda principal.
  const captionFor = (net) => (captions && typeof captions[net] === 'string' && captions[net].trim()) || caption;
  const fbCaption = captionFor('facebook');
  const wants = (platform, viaPostiz) =>
    !requestedNetworks || requestedNetworks.some((n) => n.platform === platform && !!n.viaPostiz === !!viaPostiz);

  const results = [];
  let dirty = false;

  // Cada publicação individual (1 foto, 1 vídeo, 1 carrossel) vira uma
  // TAREFA nesta lista, em vez de rodar na hora — 2026-09-22, pedido do
  // Franklin: antes cada `await` bloqueava a próxima publicação, então um
  // pedido com bastante mídia em vários formatos/redes podia levar minutos
  // seguidos (achado real, mesmo dia: Eduardo, Alessandra, Kleber — o
  // celular desistia da conexão e mostrava "Failed to fetch" mesmo o
  // servidor terminando tudo certo por trás). Todas as tarefas rodam juntas
  // no fim, em lotes (runWithConcurrency), sem depender de ordem entre si —
  // por isso cada uma já entra pronta pra empurrar seu próprio resultado em
  // `results` (array comum: .push() é seguro mesmo com várias tarefas
  // "paralelas", porque só uma de fato executa por vez — JS é single-thread,
  // as tarefas só ficam concorrentes enquanto ESPERAM a rede responder).
  const tasks = [];

  // --- Facebook / Instagram (API direta) ---
  // "post" e "reels" dão exatamente o mesmo resultado hoje (vídeo no
  // Instagram já vira Reels via API de qualquer jeito, com share_to_feed
  // ligado; Facebook não tem Reels API confiável, publica igual ao post
  // normal) — marcar os dois juntos não duplica a publicação, roda só uma
  // vez. Carrossel e Stories, cada um marcado, roda uma vez a mais (ex:
  // Reels + Stories publica a mesma mídia nos dois formatos). Calculado por
  // REDE (não mais um único booleano pra Facebook+Instagram juntos) — ver
  // formatAppliesToPlatform, pedido do Franklin 2026-09-22 (ex: Reels só no
  // Facebook, sem publicar Reels no Instagram mesmo com os dois marcados).
  const igCaption = truncateCaption(captionFor('instagram'), CAPTION_LIMITS.instagram);
  const ytDescription = truncateCaption(captionFor('youtube'), CAPTION_LIMITS.youtube);
  const telegramCaption = truncateCaption(captionFor('telegram'), CAPTION_LIMITS.telegram);
  const postizCaption = truncateCaption(captionFor('tiktok'), CAPTION_LIMITS.tiktok);

  // onlyMetaPage (repostar onde falhou): publica só na página/perfil daquela
  // falha; null = nenhuma página do Meta (a falha era em outra rede).
  const allMetaPages = (user.connections && user.connections.meta && user.connections.meta.pages) || [];
  const metaPages = onlyMetaPage === undefined
    ? allMetaPages
    : allMetaPages.filter((p) => onlyMetaPage !== null && (p.pageName === onlyMetaPage || p.instagramUsername === onlyMetaPage));
  for (const page of metaPages) {
    let pageAccessToken;
    try {
      pageAccessToken = decryptToken(page.pageAccessToken);
    } catch {
      results.push({ channel: 'facebook', name: page.pageName, status: 'erro', error: 'Token ilegível — reconectar a conta' });
      continue;
    }

    if (wants('facebook', false)) {
      // Formatos marcados são independentes entre si — marcar mais de um
      // (ex: Post + Stories) publica a mesma mídia nos dois, sem se
      // misturar. Carrossel do Facebook é só fotos (limitação da API deles);
      // se tiver vídeo junto, ele só sai se "Post"/"Reels" também estiver
      // marcado — carrossel sozinho não publica vídeo nenhum.
      const fbCarrossel = formatAppliesToPlatform(formatNetworks, formats, 'carrossel', 'facebook');
      const fbStories = formatAppliesToPlatform(formatNetworks, formats, 'stories', 'facebook');
      const fbPostOuReels =
        formatAppliesToPlatform(formatNetworks, formats, 'post', 'facebook') ||
        formatAppliesToPlatform(formatNetworks, formats, 'reels', 'facebook');
      if (fbCarrossel) {
        if (images.length >= 2) {
          tasks.push(async () => {
            try {
              const r = await publishFacebookCarousel({
                pageAccessToken,
                pageId: page.pageId,
                imageUrls: images.map((img) => img.download_url),
                caption: fbCaption,
              });
              results.push({ channel: 'facebook', name: page.pageName, file: `carrossel (${images.length} fotos)`, status: 'ok', ...r });
            } catch (error) {
              results.push({ channel: 'facebook', name: page.pageName, file: 'carrossel', status: 'erro', error: error.message });
            }
          });
        } else if (!fbPostOuReels && !fbStories) {
          // Só avisa quando carrossel era o único formato; com Post/Stories
          // marcados junto (padrão), pular o carrossel não é erro nenhum —
          // o "❌ carrossel" assustava o cliente num post de 1 foto/vídeo.
          results.push({ channel: 'facebook', name: page.pageName, file: 'carrossel', status: 'erro', error: 'Carrossel precisa de pelo menos 2 fotos' });
        }
      }
      if (fbStories) {
        for (const img of images) {
          tasks.push(async () => {
            try {
              const r = await publishFacebookStoryPhoto({ pageAccessToken, pageId: page.pageId, imageUrl: img.download_url });
              results.push({ channel: 'facebook-stories', name: page.pageName, file: img.name, status: 'ok', ...r });
            } catch (error) {
              results.push({ channel: 'facebook-stories', name: page.pageName, file: img.name, status: 'erro', error: error.message });
            }
          });
        }
        for (const vid of videos) {
          tasks.push(async () => {
            try {
              const r = await publishFacebookStoryVideo({ pageAccessToken, pageId: page.pageId, videoUrl: vid.download_url });
              results.push({ channel: 'facebook-stories', name: page.pageName, file: vid.name, status: 'ok', ...r });
            } catch (error) {
              results.push({ channel: 'facebook-stories', name: page.pageName, file: vid.name, status: 'erro', error: error.message });
            }
          });
        }
      }
      if (fbPostOuReels) {
        // Facebook não tem uma API de Reels simples e confiável — vídeo
        // publica igual ao post normal, que já aparece bem no feed.
        // Se o carrossel já levou as fotos pro feed, não publica as mesmas
        // fotos de novo como posts soltos (achado real 2026-09-23, RJ Inox:
        // Carrossel + Post marcados = cada foto aparecia 2x no feed).
        for (const img of fbCarrossel && images.length >= 2 && !publishAll ? [] : images) {
          tasks.push(async () => {
            try {
              const r = await publishFacebookPhoto({ pageAccessToken, pageId: page.pageId, imageUrl: img.download_url, caption: fbCaption });
              results.push({ channel: 'facebook', name: page.pageName, file: img.name, status: 'ok', ...r });
            } catch (error) {
              results.push({ channel: 'facebook', name: page.pageName, file: img.name, status: 'erro', error: error.message });
            }
          });
        }
        for (const vid of videos) {
          tasks.push(async () => {
            try {
              const r = await publishFacebookVideo({ pageAccessToken, pageId: page.pageId, videoUrl: vid.download_url, caption: fbCaption });
              results.push({ channel: 'facebook', name: page.pageName, file: vid.name, status: 'ok', ...r });
            } catch (error) {
              results.push({ channel: 'facebook', name: page.pageName, file: vid.name, status: 'erro', error: error.message });
            }
          });
        }
      }
    }

    if (page.instagramBusinessId && wants('instagram', false)) {
      const igCarrossel = formatAppliesToPlatform(formatNetworks, formats, 'carrossel', 'instagram');
      const igStories = formatAppliesToPlatform(formatNetworks, formats, 'stories', 'instagram');
      const igPostOuReels =
        formatAppliesToPlatform(formatNetworks, formats, 'post', 'instagram') ||
        formatAppliesToPlatform(formatNetworks, formats, 'reels', 'instagram');
      if (igCarrossel) {
        // Só fotos — mesma restrição já aplicada no carrossel do Facebook
        // (publishFacebookCarousel, acima). Vídeo junto no mesmo carrossel
        // não é suportado de forma confiável aqui; quando tem vídeo, ele sai
        // separado via Post/Reels (igPostOuReels), não dentro do carrossel.
        // Franklin, 2026-09-25: carrossel do Instagram é só de imagens, a
        // partir de 2 (máx. 10) — vídeo não entra no carrossel.
        const photoItems = images.slice(0, 10).map((img) => ({ url: img.download_url, type: 'image' }));
        if (photoItems.length >= 2) {
          tasks.push(async () => {
            try {
              const r = await publishInstagramCarousel({ pageAccessToken, igUserId: page.instagramBusinessId, mediaItems: photoItems, caption: igCaption });
              results.push({ channel: 'instagram', name: page.instagramUsername, file: `carrossel (${photoItems.length} fotos)`, status: 'ok', ...r });
            } catch (error) {
              results.push({ channel: 'instagram', name: page.instagramUsername, file: 'carrossel', status: 'erro', error: error.message });
            }
          });
        } else if (!igPostOuReels && !igStories) {
          // Mesmo critério do Facebook acima.
          results.push({ channel: 'instagram', name: page.instagramUsername, file: 'carrossel', status: 'erro', error: 'Carrossel precisa de pelo menos 2 fotos' });
        }
      }
      if (igStories) {
        for (const img of images) {
          tasks.push(async () => {
            try {
              const r = await publishInstagramStory({ pageAccessToken, igUserId: page.instagramBusinessId, mediaUrl: img.download_url, mediaType: 'image' });
              results.push({ channel: 'instagram-stories', name: page.instagramUsername, file: img.name, status: 'ok', ...r });
            } catch (error) {
              results.push({ channel: 'instagram-stories', name: page.instagramUsername, file: img.name, status: 'erro', error: error.message });
            }
          });
        }
        for (const vid of videos) {
          tasks.push(async () => {
            // Mais de 60 s: sai em partes, uma depois da outra. Se a cliente
            // aprovou cortes (revisao/cortes-stories/), usa só os que ela
            // deixou; nenhum corte sobrando = esse vídeo não vai pro Stories.
            let split;
            let aviso;
            const cuts = storiesCuts && storiesCuts[vid.name];
            if (cuts) {
              if (cuts.partes.length === 0) return;
              split = { duration: cuts.duracao, parts: cuts.partes.map((c) => ({ url: c.download_url, label: `${vid.name} (${c.name})` })) };
              aviso = `O vídeo ${vid.name} tem ${Math.round(cuts.duracao || 0)} segundos e o Stories do Instagram aceita até 60. Saiu em ${cuts.partes.length} ${cuts.partes.length === 1 ? 'corte' : 'cortes'} (os que você aprovou), em sequência.`;
            } else {
              try {
                split = await storiesVideoParts(vid);
              } catch (error) {
                console.error(`[auto-publish] não deu pra dividir ${vid.name} pro Stories:`, error.message);
                split = { parts: [{ url: vid.download_url, label: vid.name }] };
              }
              if (split.parts.length > 1) aviso = `O vídeo ${vid.name} tem ${Math.round(split.duration)} segundos e o Stories do Instagram aceita até 60. Dividi em ${split.parts.length} partes e postei em sequência.`;
            }
            for (const part of split.parts) {
              try {
                const r = await publishInstagramStory({ pageAccessToken, igUserId: page.instagramBusinessId, mediaUrl: part.url, mediaType: 'video' });
                results.push({ channel: 'instagram-stories', name: page.instagramUsername, file: part.label, status: 'ok', ...r, ...(aviso ? { aviso } : {}) });
              } catch (error) {
                results.push({ channel: 'instagram-stories', name: page.instagramUsername, file: part.label, status: 'erro', error: error.message, ...(aviso ? { aviso } : {}) });
              }
            }
          });
        }
      }
      if (igPostOuReels) {
        // Todo vídeo do Instagram já vira Reels via API, com share_to_feed
        // ligado por padrão — o que já faz ele aparecer no feed normal
        // também, por isso "post" e "reels" são a mesma chamada aqui.
        // Fotos que já foram no carrossel não saem de novo soltas (mesmo
        // motivo do Facebook, acima).
        for (const img of igCarrossel && images.length >= 2 && !publishAll ? [] : images) {
          tasks.push(async () => {
            try {
              const r = await publishInstagramPhoto({ pageAccessToken, igUserId: page.instagramBusinessId, imageUrl: img.download_url, caption: igCaption });
              results.push({ channel: 'instagram', name: page.instagramUsername, file: img.name, status: 'ok', ...r });
            } catch (error) {
              results.push({ channel: 'instagram', name: page.instagramUsername, file: img.name, status: 'erro', error: error.message });
            }
          });
        }
        for (const vid of videos) {
          tasks.push(async () => {
            try {
              const r = await publishInstagramVideo({ pageAccessToken, igUserId: page.instagramBusinessId, videoUrl: vid.download_url, caption: igCaption });
              results.push({ channel: 'instagram', name: page.instagramUsername, file: vid.name, status: 'ok', ...r });
            } catch (error) {
              results.push({ channel: 'instagram', name: page.instagramUsername, file: vid.name, status: 'erro', error: error.message });
            }
          });
        }
      }
    }
  }

  // --- YouTube (API direta, só vídeo) ---
  // Gatilho de formato (pedido do Franklin, 2026-09-22): antes, YouTube
  // publicava sempre que a rede estivesse marcada, sem ligar pro formato.
  // Agora só publica se "Post" ou "Reels" (Shorts) incluir YouTube — no
  // composer, YouTube só aparece como opção dentro da caixinha do Reels (ver
  // FORMAT_ELIGIBLE_PLATFORMS em public/index.html). Sem `formatNetworks`
  // (pedido de antes dessa mudança), cai no comportamento de sempre: publica
  // enquanto Post OU Reels estiver marcado (os dois vêm marcados por padrão,
  // então nada muda pra quem não mexeu nisso).
  const ytEnabled =
    formatAppliesToPlatform(formatNetworks, formats, 'post', 'youtube') ||
    formatAppliesToPlatform(formatNetworks, formats, 'reels', 'youtube');
  if (user.connections && user.connections.youtube && wants('youtube', false) && ytEnabled && videos.length > 0) {
    const yt = user.connections.youtube;
    // O refresh de token precisa acontecer só UMA vez, antes de qualquer
    // upload — por isso fica fora das tarefas paralelas (não faz sentido
    // paralelizar isso, e duas tarefas tentando refrescar ao mesmo tempo
    // criaria uma corrida de verdade).
    tasks.push(async () => {
      try {
        let accessToken = decryptToken(yt.accessToken);
        if (Date.now() >= yt.expiresAt - 60000) {
          const refreshed = await refreshYouTubeToken(decryptToken(yt.refreshToken));
          accessToken = refreshed.accessToken;
          yt.accessToken = encryptToken(refreshed.accessToken);
          yt.expiresAt = refreshed.expiresAt;
          dirty = true;
        }
        // Os vídeos em si sobem em paralelo entre si também (mesmo token já
        // pronto) — normalmente só tem 1 vídeo por pedido, mas não custa nada
        // já deixar certo pra quando tiver mais.
        await Promise.all(
          videos.map(async (vid) => {
            try {
              const title = (ytDescription || 'Novo vídeo').slice(0, 90);
              const r = await uploadVideo({ accessToken, videoUrl: vid.download_url, title, description: ytDescription });
              results.push({ channel: 'youtube', file: vid.name, status: 'ok', ...r });
            } catch (error) {
              results.push({ channel: 'youtube', file: vid.name, status: 'erro', error: error.message });
            }
          })
        );
      } catch (error) {
        results.push({ channel: 'youtube', status: 'erro', error: error.message });
      }
    });
  }

  // --- Telegram (API direta) ---
  if (user.connections && user.connections.telegram && wants('telegram', false)) {
    const chatId = user.connections.telegram.chatId;
    for (const img of images) {
      tasks.push(async () => {
        try {
          const r = await sendPhoto({ chatId, photoUrl: img.download_url, caption: telegramCaption });
          results.push({ channel: 'telegram', file: img.name, status: 'ok', ...r });
        } catch (error) {
          results.push({ channel: 'telegram', file: img.name, status: 'erro', error: error.message });
        }
      });
    }
    for (const vid of videos) {
      tasks.push(async () => {
        try {
          const r = await sendVideo({ chatId, videoUrl: vid.download_url, caption: telegramCaption });
          results.push({ channel: 'telegram', file: vid.name, status: 'ok', ...r });
        } catch (error) {
          results.push({ channel: 'telegram', file: vid.name, status: 'erro', error: error.message });
        }
      });
    }
  }

  // --- TikTok via API direta: DESATIVADO de propósito (regra fixa do
  // CLAUDE.md) — o app do TikTok ainda não passou pela revisão oficial deles
  // (pull-from-URL recusa com erro de verificação de domínio pra qualquer
  // cliente, confirmado 2026-09-08 até pra conta conectada direto no app).
  // TikTok de todo cliente publica só via Postiz (bloco abaixo), mesmo
  // quando existe uma conexão direta salva em user.connections.tiktok — essa
  // conexão direta fica só disponível pra reativar quando a revisão do
  // TikTok sair, não é usada pra publicar enquanto isso não acontece.

  // --- Contas "via Postiz" (Facebook/Instagram/TikTok de clientes que ainda
  // não conectaram direto, ou o TikTok de qualquer cliente, incluindo o
  // Franklin — ver nota acima) ---
  // Guarda a referência do resultado (não mais um índice) de cada post
  // criado na Postiz com sucesso, pra conferir depois (fora das tarefas) se
  // a rede de verdade aceitou — ver reconcilePostizResults mais abaixo.
  const pendingPostizChecks = [];

  const postizEntries = Array.isArray(user.postizConnections) ? user.postizConnections : [];
  for (const entry of postizEntries) {
    const platform = typeof entry === 'string' ? entry : entry.platform;
    const integrationId = typeof entry === 'string' ? null : entry.integrationId;
    // TikTok ignora o "viaPostiz" marcado no redes.json (que reflete como a
    // conta foi CONECTADA no app, não como ela deve PUBLICAR) — sempre
    // publica por Postiz enquanto a API direta estiver desativada acima.
    // Ainda respeita o cliente não ter marcado TikTok nenhum no pedido.
    const platformWanted = platform === 'tiktok'
      ? !requestedNetworks || requestedNetworks.some((n) => n.platform === 'tiktok')
      : wants(platform, true);
    if (!integrationId || !platformWanted) continue;

    // TikTok (Franklin, 2026-09-25): foto também vai — todas as fotos do
    // pedido num único post de fotos, em JPG (TikTok recusa PNG), com a
    // música automática do TikTok (autoAddMusic só vale pra post de foto).
    if (platform === 'tiktok' && images.length > 0) {
      const photos = images.slice(0, 35);
      tasks.push(async () => {
        const label = photos.length === 1 ? photos[0].name : `${photos.length} fotos`;
        try {
          const uploadedList = [];
          for (const img of photos) {
            const { buffer } = await toJpeg(await fetchBuffer(img.download_url), img.name);
            uploadedList.push(await uploadToPostiz({ buffer, filename: img.name.replace(/\.[^.]+$/, '') + '.jpg', mimetype: 'image/jpeg' }));
          }
          const title = (postizCaption || '').split(/\s#/)[0].slice(0, 90);
          const r = await createPostizPost({
            integrationId,
            content: postizCaption,
            mediaObjs: uploadedList,
            settings: { ...TIKTOK_POSTIZ_SETTINGS, autoAddMusic: 'yes', ...(title ? { title } : {}) },
          });
          const postId = Array.isArray(r) && r[0] && r[0].postId;
          const result = { channel: 'tiktok-postiz', file: label, status: 'ok', postizResult: r };
          results.push(result);
          if (postId) pendingPostizChecks.push({ result, postId });
        } catch (error) {
          results.push({ channel: 'tiktok-postiz', file: label, status: 'erro', error: error.message });
        }
      });
    }

    // Vídeo: um post por vídeo em todas as redes; foto: nas demais (TikTok já acima).
    const mediaList = platform === 'tiktok' ? videos : [...images, ...videos];
    for (const media of mediaList) {
      tasks.push(async () => {
        try {
          const buffer = await fetchBuffer(media.download_url);
          const uploaded = await uploadToPostiz({ buffer, filename: media.name, mimetype: MIME_BY_EXT[extOf(media.name)] || 'application/octet-stream' });
          const r = await createPostizPost({
            integrationId,
            content: postizCaption,
            mediaObj: uploaded,
            settings:
              platform === 'tiktok'
                ? TIKTOK_POSTIZ_SETTINGS
                : platform === 'instagram'
                ? INSTAGRAM_POSTIZ_SETTINGS
                : undefined,
          });
          const postId = Array.isArray(r) && r[0] && r[0].postId;
          const result = { channel: `${platform}-postiz`, file: media.name, status: 'ok', postizResult: r };
          results.push(result);
          if (postId) pendingPostizChecks.push({ result, postId });
        } catch (error) {
          results.push({ channel: `${platform}-postiz`, file: media.name, status: 'erro', error: error.message });
        }
      });
    }
  }

  // Roda tudo agora, em paralelo (no máximo 4 por vez — ver runWithConcurrency).
  await runWithConcurrency(tasks, 4);

  await reconcilePostizResults(pendingPostizChecks);

  const okCount = results.filter((r) => r.status === 'ok').length;
  if (okCount > 0) {
    recordPostsPublished(user, okCount);
    dirty = true;
  }
  // dono de cada post do Instagram (vale pra todo caminho de publicação)
  registrarMidias(user.client, idsDoResultado(results));

  return { results, dirty };
}

// Lê de um pedido tudo o que a publicação precisa (mídia de revisao/,
// legendas, redes e formatos marcados) — usado na publicação normal e no
// "Repostar onde falhou" (retryFailedPublication), pra os dois publicarem
// exatamente do mesmo jeito.
async function preparePedidoBundle({ client, pasta, rootEntries, revisaoEntries }) {
  const mediaEntries = revisaoEntries.filter(
    (e) => e.type === 'file' && e.name.toUpperCase() !== 'APROVADO.TXT' && e.name.toLowerCase() !== 'publicacao-resultado.json'
  );
  if (mediaEntries.length === 0) {
    return { error: 'Nenhum conteúdo gerado encontrado em revisao/' };
  }

  const images = mediaEntries.filter((e) => IMAGE_EXT.includes(extOf(e.name)));
  const videos = mediaEntries.filter((e) => VIDEO_EXT.includes(extOf(e.name)));

  // legenda.txt (opcional) é uma legenda já curada, escrita pela geração
  // (automática ou manual) quando ela entendeu o conteúdo de verdade — ex:
  // via understand_video, ver gestor-de-geracao-automatica/SKILL.md. Quando
  // existe, substitui o instrucoes.txt cru (que é a conversa inteira do
  // composer, não uma legenda pronta — sem isso, pedido com vídeo cujo texto
  // só faz sentido junto com o que está gravado sai com legenda maior/pior).
  let caption = '';
  const legendaEntry = rootEntries.find((e) => e.name.toLowerCase() === 'legenda.txt');
  const instructionEntry = rootEntries.find((e) => e.name.toLowerCase() === 'instrucoes.txt');
  if (legendaEntry) {
    try {
      caption = (await fetchText(legendaEntry.download_url)).trim();
    } catch {
      // Cai pro instrucoes.txt abaixo se a legenda curada não puder ser lida.
    }
  }
  if (!caption && instructionEntry) {
    try {
      const raw = (await fetchText(instructionEntry.download_url)).replace(/^Enviado por:.*\n+/, '').trim();
      caption = extractCleanCaption(raw);
    } catch {
      // Sem legenda não impede a publicação — só sai sem texto.
    }
  }
  // Última rede de proteção das regras por cliente (Rjinox: sem nome/telefone
  // de vendedor) — vale mesmo se a legenda veio crua do instrucoes.txt.
  caption = sanitizeClientText(client, caption);

  // Pedido automático vídeo + imagem (3ª dica): publica tudo solto E no
  // carrossel (Instagram com vídeos também); TikTok só os vídeos.
  const publishAll = rootEntries.some((e) => e.name.toLowerCase() === 'modo-automatico-combo.txt');

  // Variações por rede (legendas.json, escrito pela geração) — mesma limpeza.
  let captions = null;
  const legendasEntry = rootEntries.find((e) => e.name.toLowerCase() === 'legendas.json');
  if (legendasEntry) {
    try {
      const parsed = JSON.parse(await fetchText(legendasEntry.download_url));
      if (parsed && typeof parsed === 'object') {
        captions = {};
        for (const [net, text] of Object.entries(parsed)) {
          if (typeof text === 'string' && text.trim()) captions[net] = sanitizeClientText(client, text.trim());
        }
      }
    } catch {
      captions = null; // JSON inválido — ensureDistinctCaptions abaixo reescreve.
    }
  }
  captions = await ensureDistinctCaptions(client, caption, captions);

  let requestedNetworks = null;
  const redesEntry = rootEntries.find((e) => e.name.toLowerCase() === 'redes.json');
  if (redesEntry) {
    try {
      const parsed = JSON.parse(await fetchText(redesEntry.download_url));
      if (Array.isArray(parsed) && parsed.length > 0) requestedNetworks = parsed;
    } catch {
      // JSON inválido — cai no padrão (todas as contas conectadas).
    }
  }

  // Formato(s) escolhido(s) no composer pra Facebook/Instagram/YouTube —
  // post (padrão), reels, carrossel e/ou stories, pode ter mais de um
  // marcado ao mesmo tempo (ex: Reels + Stories publica a mesma mídia nos
  // dois) — ver lib/meta.js e CLAUDE.md. Só afeta esse bloco; Telegram/TikTok
  // continuam publicando do jeito de sempre, sem conceito de formato.
  // `formatNetworks` (2026-09-22): dentro de cada formato, em quais redes
  // especificamente ele publica (ex: {reels:['facebook']} = Reels só no
  // Facebook, mesmo com Instagram/YouTube também marcados) — ver
  // formatAppliesToPlatform abaixo. Sem essa chave (pedido de antes dessa
  // mudança), cada formato marcado vale pra toda rede marcada, como sempre foi.
  let formats = ['post'];
  let formatNetworks = null;
  let virarAnuncio = false;
  let somenteAnuncio = false;
  let anuncioOutras = [];
  const formatoEntry = rootEntries.find((e) => e.name.toLowerCase() === 'formato.json');
  if (formatoEntry) {
    try {
      const parsed = JSON.parse(await fetchText(formatoEntry.download_url));
      const valid = Array.isArray(parsed && parsed.formats)
        ? parsed.formats.filter((f) => ['post', 'reels', 'carrossel', 'stories'].includes(f))
        : [];
      if (valid.length > 0) formats = valid;
      if (parsed && parsed.formatNetworks && typeof parsed.formatNetworks === 'object') {
        formatNetworks = parsed.formatNetworks;
      }
      if (parsed && parsed.virarAnuncio === true) virarAnuncio = true;
      if (parsed && parsed.somenteAnuncio === true) somenteAnuncio = true;
      if (parsed && Array.isArray(parsed.anuncioOutras)) anuncioOutras = parsed.anuncioOutras;
    } catch {
      // JSON inválido — cai no formato padrão (post).
    }
  }

  // Dica 1.1 (imagem + banner feito dela): as duas saem como posts separados,
  // nunca juntas num carrossel.
  // Dica 1.2 (foto + banner + vídeo): fotos também como posts separados.
  if (rootEntries.some((e) => ['modo-automatico-banner.txt', 'modo-automatico-video.txt'].includes(e.name.toLowerCase()))) {
    formats = formats.filter((f) => f !== 'carrossel');
    if (formats.length === 0) formats = ['post'];
  }

  let storiesCuts = null;
  try {
    const { owner, repo, token } = githubEnv();
    storiesCuts = await loadStoriesCuts({ owner, repo, token, basePath: `.claude/skills/${client}/${pasta}` });
  } catch {
    storiesCuts = null; // sem cortes legíveis: a publicação divide sozinha
  }
  return { images, videos, caption, captions, requestedNetworks, formats, formatNetworks, publishAll, storiesCuts, virarAnuncio, somenteAnuncio, anuncioOutras };
}

// Publica de verdade o conteúdo gerado (revisao/) de um pedido já aprovado
// pelo cliente na página aprovacao.html — chamado por
// routes/approve-pedido.js assim que o marcador de aprovação é gravado.
// Usa a lista de redes marcadas na hora de montar o pedido (redes.json, ver
// lib/publish-pedido.js) quando existir; sem isso, publica em todas as
// contas conectadas do cliente (comportamento padrão pra pedidos antigos ou
// enviados sem nenhuma rede marcada).
//
// Trava em memória (mesmo padrão de `processing` em lib/auto-generate.js) —
// além da checagem de `publicacao-resultado.json` já existente (mais abaixo,
// que cobre retentativa depois de um erro/timeout), isso cobre o caso de
// dois cliques bem próximos um do outro, antes da primeira chamada terminar
// de publicar e gravar o resultado — sem isso, os dois passariam pela
// checagem do arquivo (nenhum dos dois o encontraria ainda) e publicariam em
// duplicado do mesmo jeito.
const publishingNow = new Set();

async function publishApprovedPedido({ client, pasta }) {
  const key = `${client}/${pasta}`;
  if (publishingNow.has(key)) {
    return { ok: true, results: [], alreadyPublishing: true };
  }
  publishingNow.add(key);
  try {
    return await doPublishApprovedPedido({ client, pasta });
  } finally {
    publishingNow.delete(key);
  }
}

async function doPublishApprovedPedido({ client, pasta }) {
  const { owner, repo, token } = githubEnv();
  const basePath = `.claude/skills/${client}/${pasta}`;

  const [rootEntries, revisaoEntries] = await Promise.all([
    listGithubFolder({ owner, repo, token, path: basePath }),
    listGithubFolder({ owner, repo, token, path: `${basePath}/revisao` }),
  ]);

  // Idempotência (achado real 2026-09-22, pedido da Alessandra): sem essa
  // trava, cada chamada a esta função publicava tudo de novo do zero — um
  // segundo clique em "Aprovar" (ex: o cliente clicou de novo depois de ver
  // um erro de timeout na tela, sem saber que a primeira tentativa já tinha
  // publicado de verdade por trás, igual ao achado do Eduardo no mesmo dia)
  // duplicava CADA publicação (carrossel, stories, posts, TikTok). Se
  // `publicacao-resultado.json` já existe, essa pasta já foi publicada —
  // devolve o resultado salvo em vez de publicar tudo de novo.
  const existingResultEntry = revisaoEntries.find((e) => e.type === 'file' && e.name.toLowerCase() === 'publicacao-resultado.json');
  if (existingResultEntry) {
    try {
      const cached = JSON.parse(await fetchText(existingResultEntry.download_url));
      return { ok: true, results: cached, alreadyPublished: true };
    } catch {
      // Não deu pra ler o resultado salvo — mais seguro seguir e publicar
      // (mesma decisão "falha fechada" de sempre neste arquivo) do que travar
      // o pedido pra sempre por um JSON corrompido.
    }
  }

  const prep = await preparePedidoBundle({ client, pasta, rootEntries, revisaoEntries });
  if (prep.error) return { ok: false, error: prep.error, results: [] };
  const { images, videos, caption, captions, requestedNetworks, formats, formatNetworks, publishAll, storiesCuts } = prep;

  const users = await loadUsers();
  const user = users.find((u) => u.client === client);
  if (!user) {
    return { ok: false, error: `Cliente "${client}" não encontrado`, results: [] };
  }

  const quota = checkPostQuota(user);
  if (!quota.allowed) {
    return { ok: false, error: quota.error, results: [] };
  }

  let results;
  let dirty = false;
  const NOME_ADS = { google: 'Google Ads', tiktok: 'TikTok Ads', kwai: 'Kwai Ads', linkedin: 'LinkedIn Ads', pinterest: 'Pinterest Ads' };
  if (prep.anuncioOutras && prep.anuncioOutras.length) {
    // Outras redes de anúncio ainda não são automáticas: o admin monta.
    require('./avisar-admin').avisarAdmin(`📢 ${client} quer este conteúdo também em: ${prep.anuncioOutras.map((r) => NOME_ADS[r] || r).join(', ')}${prep.somenteAnuncio ? ' (SÓ anúncio, sem orgânico)' : ''}. Pedido ${pasta}. Montar com o Claude.`).catch(() => {});
  }
  if (prep.somenteAnuncio && !prep.virarAnuncio) {
    results = (prep.anuncioOutras || []).map((r) => ({ channel: 'anuncio-' + r, name: NOME_ADS[r] || r, status: 'ok', aviso: 'Pedido enviado para a administração montar o anúncio.' }));
  } else if (prep.somenteAnuncio) {
    // "Só anúncio" (Franklin, 18/11): nada sai no orgânico; a mídia vira
    // anúncio direto no Meta (lib/virar-anuncio.js anuncioSemPostar).
    const { anuncioSemPostar } = require('./virar-anuncio');
    const texto = (captions && (captions.instagram || captions.facebook)) || caption;
    let r;
    try {
      r = await anuncioSemPostar(user, [...videos.map((v) => ({ ...v, video: true })), ...images], texto, { users, pasta });
    } catch (e) {
      r = { ok: false, mensagem: e.message };
    }
    results = [{ channel: 'meta-ads', name: 'Meta Ads', status: r.ok ? 'ok' : 'erro', ...(r.ok ? { anuncioNome: r.anuncioNome, campanha: r.campanha } : { error: r.mensagem || 'Não deu para criar o anúncio' }) },
      ...(prep.anuncioOutras || []).map((x) => ({ channel: 'anuncio-' + x, name: NOME_ADS[x] || x, status: 'ok', aviso: 'Pedido enviado para a administração montar o anúncio.' }))];
    require('./avisar-admin').avisarAdmin(r.ok
      ? `📢 ${client}: SÓ ANÚNCIO (sem orgânico) criado: "${r.anuncioNome}" na campanha "${r.campanha}".${r.pausado ? ` Pausado: "${r.pausado.nome}".` : ''}`
      : `⚠️ ${client}: pediu SÓ ANÚNCIO e não deu certo: ${r.mensagem || 'falhou'} (pedido ${pasta}).`).catch(() => {});
  } else {
    ({ results, dirty } = await publishMediaBundle({ user, images, videos, caption, captions, requestedNetworks, formats, formatNetworks, publishAll, storiesCuts }));
    registrarMidias(client, idsDoResultado(results));
    if (prep.virarAnuncio) {
      require('./virar-anuncio').virarDepoisDePublicar(client, results, pasta).catch((e) => console.error('[virar-anuncio pós-post]', e.message));
    }
  }

  if (dirty) {
    await saveUsers(users);
  }

  try {
    await putFileToGithub({
      owner,
      repo,
      token,
      path: `${basePath}/revisao/publicacao-resultado.json`,
      message: `publicação: ${client}/${pasta}`,
      base64Content: Buffer.from(JSON.stringify(results, null, 2), 'utf-8').toString('base64'),
    });
  } catch {
    // Resultado é só um registro auxiliar pra conferência depois — não deve
    // fazer a publicação em si "falhar" se só esse registro não gravar.
  }

  return { ok: true, results };
}

// ---- Repostar onde falhou (Franklin, 2026-11-17) ----
// Caso real: pedido da Ale com 2 vídeos, o Stories do Instagram de um deles
// voltou "Fatal" do Meta e o resto saiu. Antes não tinha como a própria
// cliente tentar de novo (aprovar outra vez devolve o resultado salvo, de
// propósito, pra não duplicar). Aqui só as linhas com erro são publicadas de
// novo, cada uma só na rede/formato/arquivo dela — o que já saiu não repete.

// Erros que repostar não resolve: falta de fotos pro carrossel, conta sem
// permissão ou desconectada, limite do plano. Pra esses o botão não aparece.
function isRetryableFailure(r) {
  if (!r || r.status !== 'erro' || !r.file) return false;
  const e = String(r.error || '');
  return !/carrossel precisa|token|reconect|permiss|\(#(200|10|190)\)|limite|plano/i.test(e);
}

function retrySliceFor(r) {
  const ch = String(r.channel || '');
  const carrossel = /^carrossel/i.test(String(r.file || ''));
  if (ch === 'facebook' || ch === 'instagram') {
    return { platform: ch, viaPostiz: false, format: carrossel ? 'carrossel' : 'post', page: r.name || null };
  }
  if (ch === 'facebook-stories' || ch === 'instagram-stories') {
    return { platform: ch.split('-')[0], viaPostiz: false, format: 'stories', page: r.name || null };
  }
  if (ch === 'youtube') return { platform: 'youtube', viaPostiz: false, format: 'reels', page: null };
  if (ch === 'telegram') return { platform: 'telegram', viaPostiz: false, format: 'post', page: null };
  const m = /^(facebook|instagram|tiktok)-postiz$/.exec(ch);
  if (m) return { platform: m[1], viaPostiz: true, format: 'post', page: null };
  return null;
}

// `only` (opcional): posições, dentro de publicacao-resultado.json, das
// falhas que a cliente marcou na tela; sem isso, tenta todas as falhas.
async function retryFailedPublication({ client, pasta, only }) {
  const key = `${client}/${pasta}`;
  if (publishingNow.has(key)) return { ok: false, error: 'Já estou publicando esse pedido. Espere um pouco e veja o resultado.', results: [] };
  publishingNow.add(key);
  try {
    const { owner, repo, token } = githubEnv();
    const basePath = `.claude/skills/${client}/${pasta}`;
    const [rootEntries, revisaoEntries] = await Promise.all([
      listGithubFolder({ owner, repo, token, path: basePath }),
      listGithubFolder({ owner, repo, token, path: `${basePath}/revisao` }),
    ]);
    const resultEntry = revisaoEntries.find((e) => e.type === 'file' && e.name.toLowerCase() === 'publicacao-resultado.json');
    if (!resultEntry) return { ok: false, error: 'Esse pedido ainda não foi publicado.', results: [] };
    const previous = JSON.parse(await fetchText(resultEntry.download_url + '?t=' + Date.now()));
    if (!Array.isArray(previous)) return { ok: false, error: 'Não consegui ler o resultado da publicação.', results: [] };

    const marked = Array.isArray(only) ? new Set(only.map(Number)) : null;
    const failed = previous.filter((r, i) => isRetryableFailure(r) && (!marked || marked.has(i)));
    if (failed.length === 0) return { ok: false, error: marked ? 'Marque pelo menos um lugar pra repostar.' : 'Não tem nada pra repostar nesse pedido.', results: previous };

    const prep = await preparePedidoBundle({ client, pasta, rootEntries, revisaoEntries });
    if (prep.error) return { ok: false, error: prep.error, results: previous };

    const users = await loadUsers();
    const user = users.find((u) => u.client === client);
    if (!user) return { ok: false, error: `Cliente "${client}" não encontrado`, results: previous };
    const quota = checkPostQuota(user);
    if (!quota.allowed) return { ok: false, error: quota.error, results: previous };

    const replacements = new Map();
    let dirty = false;
    for (const r of failed) {
      const slice = retrySliceFor(r);
      if (!slice) continue;
      let images = [];
      let videos = [];
      if (slice.format === 'carrossel' || /^\d+ fotos$/.test(r.file)) {
        images = prep.images;
      } else {
        // "video.mp4 (parte 2 de 3)" → video.mp4 (o Stories divide de novo).
        const baseName = String(r.file).replace(/ \((parte \d+ de \d+|[^()]*-parte\d+\.mp4)\)$/, '');
        images = prep.images.filter((e) => e.name === baseName);
        videos = prep.videos.filter((e) => e.name === baseName);
      }
      if (images.length === 0 && videos.length === 0) continue; // arquivo descartado/sumiu
      const out = await publishMediaBundle({
        user,
        images,
        videos,
        caption: prep.caption,
        captions: prep.captions,
        requestedNetworks: [{ platform: slice.platform, viaPostiz: slice.viaPostiz }],
        formats: [slice.format],
        formatNetworks: { [slice.format]: [slice.platform] },
        onlyMetaPage: ['facebook', 'instagram'].includes(slice.platform) && !slice.viaPostiz ? slice.page : null,
        storiesCuts: prep.storiesCuts,
      });
      if (out.dirty) dirty = true;
      registrarMidias(client, idsDoResultado(out.results));
      const now = new Date().toISOString();
      replacements.set(r, out.results.map((x) => ({ ...x, repostadoEm: now })));
    }

    if (dirty) await saveUsers(users);

    const merged = previous.flatMap((r) => (replacements.has(r) && replacements.get(r).length > 0 ? replacements.get(r) : [r]));
    try {
      await putFileToGithub({
        owner,
        repo,
        token,
        path: `${basePath}/revisao/publicacao-resultado.json`,
        message: `repostar onde falhou: ${client}/${pasta}`,
        base64Content: Buffer.from(JSON.stringify(merged, null, 2), 'utf-8').toString('base64'),
      });
    } catch (error) {
      console.error(`[retry-publish] ${client}/${pasta}: resultado não gravou:`, error.message);
    }
    return { ok: true, results: merged };
  } finally {
    publishingNow.delete(key);
  }
}

// Publica de verdade um post agendado (Calendário) assim que a hora marcada
// chega — chamado por lib/scheduled-dispatcher.js logo depois de subir os
// arquivos pro GitHub via publishPedido (que já devolve o download_url
// público de cada arquivo, usado aqui pra alimentar as mesmas funções de
// publicação de sempre). Antes, um post agendado só arquivava no GitHub sem
// nunca publicar de verdade em rede social nenhuma — essa função fecha essa
// lacuna, pra "agendar" realmente significar "publicar sozinho na hora
// certa", sem precisar de ninguém clicando em nada quando a hora chegar.
//
// Recebe `users` já carregado (e vai salvar depois) pelo próprio dispatcher,
// em vez de fazer seu próprio loadUsers/saveUsers — importante porque o
// dono do agendamento (quem tem a entrada em scheduledPosts, ex: o admin
// frank agendando pra um cliente) pode ser um usuário diferente do
// `targetClient` de verdade (dono das contas sociais/cota a debitar). Duas
// idas independentes ao arquivo de usuários na mesma rodada do dispatcher
// se pisariam (a segunda sobrescreveria a primeira sem querer).
async function publishScheduledPiece({ users, targetClient, files, caption, networks, formats, formatNetworks }) {
  const user = users.find((u) => u.client === targetClient);
  if (!user) {
    return { ok: false, error: `Cliente "${targetClient}" não encontrado`, results: [] };
  }

  const quota = checkPostQuota(user);
  if (!quota.allowed) {
    return { ok: false, error: quota.error, results: [] };
  }

  const usableFiles = (files || []).filter((f) => f.status === 'ok' && f.downloadUrl);
  let images = usableFiles
    .filter((f) => (f.mimetype || '').startsWith('image/'))
    .map((f) => ({ name: f.file, download_url: f.downloadUrl }));
  let videos = usableFiles
    .filter((f) => (f.mimetype || '').startsWith('video/'))
    .map((f) => ({ name: f.file, download_url: f.downloadUrl }));

  if (images.length === 0 && videos.length === 0) {
    return { ok: false, error: 'Nenhuma mídia disponível pra publicar (upload falhou)', results: [] };
  }

  // Rjinox: o agendamento publica a mídia do vendedor direto, sem passar pela
  // geração — então lê o texto de cada imagem/vídeo aqui e barra o que tiver
  // nome/telefone de vendedor (ou o que não der pra conferir). Outros clientes:
  // nenhum custo, tudo liberado. Ver lib/media-text-detection.js.
  if (isRjinoxClient(targetClient)) {
    const scan = await scanUrlsForVendorIdentifiers({
      client: targetClient,
      items: [
        ...images.map((m) => ({ name: m.name, url: m.download_url, type: 'image', mimeType: usableFiles.find((f) => f.file === m.name)?.mimetype })),
        ...videos.map((m) => ({ name: m.name, url: m.download_url, type: 'video', mimeType: usableFiles.find((f) => f.file === m.name)?.mimetype })),
      ],
    });
    if (scan.blocks.length > 0) {
      const okNames = new Set(scan.allowed.map((m) => m.name));
      images = images.filter((m) => okNames.has(m.name));
      videos = videos.filter((m) => okNames.has(m.name));
      if (images.length === 0 && videos.length === 0) {
        return { ok: false, error: scan.blocks.map(describeBlock).join(' '), results: [] };
      }
    }
  }

  const requestedNetworks = Array.isArray(networks) && networks.length > 0 ? networks : null;
  const validFormats = Array.isArray(formats) ? formats.filter((f) => ['post', 'reels', 'carrossel', 'stories'].includes(f)) : [];
  const effectiveFormats = validFormats.length > 0 ? validFormats : ['post'];
  const effectiveFormatNetworks = formatNetworks && typeof formatNetworks === 'object' ? formatNetworks : null;

  const cleanCaption = sanitizeClientText(targetClient, caption || '');
  const { results, dirty } = await publishMediaBundle({
    user,
    images,
    videos,
    caption: cleanCaption,
    captions: await ensureDistinctCaptions(targetClient, cleanCaption, null),
    requestedNetworks,
    formats: effectiveFormats,
    formatNetworks: effectiveFormatNetworks,
  });
  registrarMidias(targetClient, idsDoResultado(results));

  return { ok: true, results, dirty };
}

module.exports = { publishApprovedPedido, publishScheduledPiece, publishMediaBundle, retryFailedPublication, isRetryableFailure };
