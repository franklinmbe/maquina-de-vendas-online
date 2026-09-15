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
async function reconcilePostizResults(results, pendingPostizChecks) {
  if (pendingPostizChecks.length === 0) return;
  await new Promise((resolve) => setTimeout(resolve, 8000));
  const startDate = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const endDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const posts = await listPostizPosts({ startDate, endDate });
  if (posts.length === 0) return;
  const stateById = new Map(posts.map((p) => [p.id, p.state]));
  for (const { resultIndex, postId } of pendingPostizChecks) {
    const state = stateById.get(postId);
    if (!state) continue;
    results[resultIndex].postizState = state;
    if (state === 'ERROR') {
      results[resultIndex].status = 'erro';
      results[resultIndex].error = 'Postiz aceitou o post, mas a rede recusou depois (state: ERROR) — conferir direto na Postiz';
    }
  }
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
    .filter(Boolean);
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
async function publishMediaBundle({ user, images, videos, caption, requestedNetworks, formats }) {
  const wants = (platform, viaPostiz) =>
    !requestedNetworks || requestedNetworks.some((n) => n.platform === platform && !!n.viaPostiz === !!viaPostiz);

  const results = [];
  let dirty = false;

  // --- Facebook / Instagram (API direta) ---
  // "post" e "reels" dão exatamente o mesmo resultado hoje (vídeo no
  // Instagram já vira Reels via API de qualquer jeito, com share_to_feed
  // ligado; Facebook não tem Reels API confiável, publica igual ao post
  // normal) — marcar os dois juntos não duplica a publicação, roda só uma
  // vez. Carrossel e Stories, cada um marcado, roda uma vez a mais (ex:
  // Reels + Stories publica a mesma mídia nos dois formatos).
  const runPostOuReels = formats.includes('post') || formats.includes('reels');
  const runCarrossel = formats.includes('carrossel');
  const runStories = formats.includes('stories');
  const igCaption = truncateCaption(caption, CAPTION_LIMITS.instagram);
  const ytDescription = truncateCaption(caption, CAPTION_LIMITS.youtube);
  const telegramCaption = truncateCaption(caption, CAPTION_LIMITS.telegram);
  const postizCaption = truncateCaption(caption, CAPTION_LIMITS.tiktok);

  const metaPages = (user.connections && user.connections.meta && user.connections.meta.pages) || [];
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
      if (runCarrossel) {
        if (images.length >= 2) {
          try {
            const r = await publishFacebookCarousel({
              pageAccessToken,
              pageId: page.pageId,
              imageUrls: images.map((img) => img.download_url),
              caption,
            });
            results.push({ channel: 'facebook', name: page.pageName, file: `carrossel (${images.length} fotos)`, status: 'ok', ...r });
          } catch (error) {
            results.push({ channel: 'facebook', name: page.pageName, file: 'carrossel', status: 'erro', error: error.message });
          }
        } else {
          results.push({ channel: 'facebook', name: page.pageName, file: 'carrossel', status: 'erro', error: 'Carrossel precisa de pelo menos 2 fotos' });
        }
      }
      if (runStories) {
        for (const img of images) {
          try {
            const r = await publishFacebookStoryPhoto({ pageAccessToken, pageId: page.pageId, imageUrl: img.download_url });
            results.push({ channel: 'facebook-stories', name: page.pageName, file: img.name, status: 'ok', ...r });
          } catch (error) {
            results.push({ channel: 'facebook-stories', name: page.pageName, file: img.name, status: 'erro', error: error.message });
          }
        }
        for (const vid of videos) {
          try {
            const r = await publishFacebookStoryVideo({ pageAccessToken, pageId: page.pageId, videoUrl: vid.download_url });
            results.push({ channel: 'facebook-stories', name: page.pageName, file: vid.name, status: 'ok', ...r });
          } catch (error) {
            results.push({ channel: 'facebook-stories', name: page.pageName, file: vid.name, status: 'erro', error: error.message });
          }
        }
      }
      if (runPostOuReels) {
        // Facebook não tem uma API de Reels simples e confiável — vídeo
        // publica igual ao post normal, que já aparece bem no feed.
        for (const img of images) {
          try {
            const r = await publishFacebookPhoto({ pageAccessToken, pageId: page.pageId, imageUrl: img.download_url, caption });
            results.push({ channel: 'facebook', name: page.pageName, file: img.name, status: 'ok', ...r });
          } catch (error) {
            results.push({ channel: 'facebook', name: page.pageName, file: img.name, status: 'erro', error: error.message });
          }
        }
        for (const vid of videos) {
          try {
            const r = await publishFacebookVideo({ pageAccessToken, pageId: page.pageId, videoUrl: vid.download_url, caption });
            results.push({ channel: 'facebook', name: page.pageName, file: vid.name, status: 'ok', ...r });
          } catch (error) {
            results.push({ channel: 'facebook', name: page.pageName, file: vid.name, status: 'erro', error: error.message });
          }
        }
      }
    }

    if (page.instagramBusinessId && wants('instagram', false)) {
      if (runCarrossel) {
        // Só fotos — mesma restrição já aplicada no carrossel do Facebook
        // (publishFacebookCarousel, acima). Vídeo junto no mesmo carrossel
        // não é suportado de forma confiável aqui; quando tem vídeo, ele sai
        // separado via Post/Reels (runPostOuReels), não dentro do carrossel.
        if (images.length >= 2) {
          try {
            const r = await publishInstagramCarousel({
              pageAccessToken,
              igUserId: page.instagramBusinessId,
              mediaItems: images.map((img) => ({ url: img.download_url, type: 'image' })),
              caption: igCaption,
            });
            results.push({ channel: 'instagram', name: page.instagramUsername, file: `carrossel (${images.length} fotos)`, status: 'ok', ...r });
          } catch (error) {
            results.push({ channel: 'instagram', name: page.instagramUsername, file: 'carrossel', status: 'erro', error: error.message });
          }
        } else {
          results.push({ channel: 'instagram', name: page.instagramUsername, file: 'carrossel', status: 'erro', error: 'Carrossel precisa de pelo menos 2 fotos' });
        }
      }
      if (runStories) {
        for (const img of images) {
          try {
            const r = await publishInstagramStory({ pageAccessToken, igUserId: page.instagramBusinessId, mediaUrl: img.download_url, mediaType: 'image' });
            results.push({ channel: 'instagram-stories', name: page.instagramUsername, file: img.name, status: 'ok', ...r });
          } catch (error) {
            results.push({ channel: 'instagram-stories', name: page.instagramUsername, file: img.name, status: 'erro', error: error.message });
          }
        }
        for (const vid of videos) {
          try {
            const r = await publishInstagramStory({ pageAccessToken, igUserId: page.instagramBusinessId, mediaUrl: vid.download_url, mediaType: 'video' });
            results.push({ channel: 'instagram-stories', name: page.instagramUsername, file: vid.name, status: 'ok', ...r });
          } catch (error) {
            results.push({ channel: 'instagram-stories', name: page.instagramUsername, file: vid.name, status: 'erro', error: error.message });
          }
        }
      }
      if (runPostOuReels) {
        // Todo vídeo do Instagram já vira Reels via API, com share_to_feed
        // ligado por padrão — o que já faz ele aparecer no feed normal
        // também, por isso "post" e "reels" são a mesma chamada aqui.
        for (const img of images) {
          try {
            const r = await publishInstagramPhoto({ pageAccessToken, igUserId: page.instagramBusinessId, imageUrl: img.download_url, caption: igCaption });
            results.push({ channel: 'instagram', name: page.instagramUsername, file: img.name, status: 'ok', ...r });
          } catch (error) {
            results.push({ channel: 'instagram', name: page.instagramUsername, file: img.name, status: 'erro', error: error.message });
          }
        }
        for (const vid of videos) {
          try {
            const r = await publishInstagramVideo({ pageAccessToken, igUserId: page.instagramBusinessId, videoUrl: vid.download_url, caption: igCaption });
            results.push({ channel: 'instagram', name: page.instagramUsername, file: vid.name, status: 'ok', ...r });
          } catch (error) {
            results.push({ channel: 'instagram', name: page.instagramUsername, file: vid.name, status: 'erro', error: error.message });
          }
        }
      }
    }
  }

  // --- YouTube (API direta, só vídeo) ---
  if (user.connections && user.connections.youtube && wants('youtube', false) && videos.length > 0) {
    const yt = user.connections.youtube;
    try {
      let accessToken = decryptToken(yt.accessToken);
      if (Date.now() >= yt.expiresAt - 60000) {
        const refreshed = await refreshYouTubeToken(decryptToken(yt.refreshToken));
        accessToken = refreshed.accessToken;
        yt.accessToken = encryptToken(refreshed.accessToken);
        yt.expiresAt = refreshed.expiresAt;
        dirty = true;
      }
      for (const vid of videos) {
        try {
          const title = (caption || 'Novo vídeo').slice(0, 90);
          const r = await uploadVideo({ accessToken, videoUrl: vid.download_url, title, description: ytDescription });
          results.push({ channel: 'youtube', file: vid.name, status: 'ok', ...r });
        } catch (error) {
          results.push({ channel: 'youtube', file: vid.name, status: 'erro', error: error.message });
        }
      }
    } catch (error) {
      results.push({ channel: 'youtube', status: 'erro', error: error.message });
    }
  }

  // --- Telegram (API direta) ---
  if (user.connections && user.connections.telegram && wants('telegram', false)) {
    const chatId = user.connections.telegram.chatId;
    for (const img of images) {
      try {
        const r = await sendPhoto({ chatId, photoUrl: img.download_url, caption: telegramCaption });
        results.push({ channel: 'telegram', file: img.name, status: 'ok', ...r });
      } catch (error) {
        results.push({ channel: 'telegram', file: img.name, status: 'erro', error: error.message });
      }
    }
    for (const vid of videos) {
      try {
        const r = await sendVideo({ chatId, videoUrl: vid.download_url, caption: telegramCaption });
        results.push({ channel: 'telegram', file: vid.name, status: 'ok', ...r });
      } catch (error) {
        results.push({ channel: 'telegram', file: vid.name, status: 'erro', error: error.message });
      }
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
  // Índices em `results` de posts criados na Postiz com sucesso na chamada,
  // pra conferir depois (fora deste loop) se a rede de verdade aceitou —
  // ver reconcilePostizResults logo abaixo do loop.
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

    // TikTok só aceita vídeo; as demais aceitam foto ou vídeo.
    const mediaList = platform === 'tiktok' ? videos : [...images, ...videos];
    for (const media of mediaList) {
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
        results.push({ channel: `${platform}-postiz`, file: media.name, status: 'ok', postizResult: r });
        if (postId) pendingPostizChecks.push({ resultIndex: results.length - 1, postId });
      } catch (error) {
        results.push({ channel: `${platform}-postiz`, file: media.name, status: 'erro', error: error.message });
      }
    }
  }

  await reconcilePostizResults(results, pendingPostizChecks);

  const okCount = results.filter((r) => r.status === 'ok').length;
  if (okCount > 0) {
    recordPostsPublished(user, okCount);
    dirty = true;
  }

  return { results, dirty };
}

// Publica de verdade o conteúdo gerado (revisao/) de um pedido já aprovado
// pelo cliente na página aprovacao.html — chamado por
// routes/approve-pedido.js assim que o marcador de aprovação é gravado.
// Usa a lista de redes marcadas na hora de montar o pedido (redes.json, ver
// lib/publish-pedido.js) quando existir; sem isso, publica em todas as
// contas conectadas do cliente (comportamento padrão pra pedidos antigos ou
// enviados sem nenhuma rede marcada).
async function publishApprovedPedido({ client, pasta }) {
  const { owner, repo, token } = githubEnv();
  const basePath = `.claude/skills/${client}/${pasta}`;

  const [rootEntries, revisaoEntries] = await Promise.all([
    listGithubFolder({ owner, repo, token, path: basePath }),
    listGithubFolder({ owner, repo, token, path: `${basePath}/revisao` }),
  ]);

  const mediaEntries = revisaoEntries.filter(
    (e) => e.type === 'file' && e.name.toUpperCase() !== 'APROVADO.TXT'
  );
  if (mediaEntries.length === 0) {
    return { ok: false, error: 'Nenhum conteúdo gerado encontrado em revisao/', results: [] };
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

  // Formato(s) escolhido(s) no composer pra Facebook/Instagram — post
  // (padrão), reels, carrossel e/ou stories, pode ter mais de um marcado ao
  // mesmo tempo (ex: Reels + Stories publica a mesma mídia nos dois) — ver
  // lib/meta.js e CLAUDE.md. Só afeta o bloco Meta; as outras redes
  // continuam publicando do jeito de sempre, sem esse conceito de formato.
  let formats = ['post'];
  const formatoEntry = rootEntries.find((e) => e.name.toLowerCase() === 'formato.json');
  if (formatoEntry) {
    try {
      const parsed = JSON.parse(await fetchText(formatoEntry.download_url));
      const valid = Array.isArray(parsed && parsed.formats)
        ? parsed.formats.filter((f) => ['post', 'reels', 'carrossel', 'stories'].includes(f))
        : [];
      if (valid.length > 0) formats = valid;
    } catch {
      // JSON inválido — cai no formato padrão (post).
    }
  }

  const users = await loadUsers();
  const user = users.find((u) => u.client === client);
  if (!user) {
    return { ok: false, error: `Cliente "${client}" não encontrado`, results: [] };
  }

  const quota = checkPostQuota(user);
  if (!quota.allowed) {
    return { ok: false, error: quota.error, results: [] };
  }

  const { results, dirty } = await publishMediaBundle({ user, images, videos, caption, requestedNetworks, formats });

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
async function publishScheduledPiece({ users, targetClient, files, caption, networks, formats }) {
  const user = users.find((u) => u.client === targetClient);
  if (!user) {
    return { ok: false, error: `Cliente "${targetClient}" não encontrado`, results: [] };
  }

  const quota = checkPostQuota(user);
  if (!quota.allowed) {
    return { ok: false, error: quota.error, results: [] };
  }

  const usableFiles = (files || []).filter((f) => f.status === 'ok' && f.downloadUrl);
  const images = usableFiles
    .filter((f) => (f.mimetype || '').startsWith('image/'))
    .map((f) => ({ name: f.file, download_url: f.downloadUrl }));
  const videos = usableFiles
    .filter((f) => (f.mimetype || '').startsWith('video/'))
    .map((f) => ({ name: f.file, download_url: f.downloadUrl }));

  if (images.length === 0 && videos.length === 0) {
    return { ok: false, error: 'Nenhuma mídia disponível pra publicar (upload falhou)', results: [] };
  }

  const requestedNetworks = Array.isArray(networks) && networks.length > 0 ? networks : null;
  const validFormats = Array.isArray(formats) ? formats.filter((f) => ['post', 'reels', 'carrossel', 'stories'].includes(f)) : [];
  const effectiveFormats = validFormats.length > 0 ? validFormats : ['post'];

  const { results, dirty } = await publishMediaBundle({
    user,
    images,
    videos,
    caption: caption || '',
    requestedNetworks,
    formats: effectiveFormats,
  });

  return { ok: true, results, dirty };
}

module.exports = { publishApprovedPedido, publishScheduledPiece };
