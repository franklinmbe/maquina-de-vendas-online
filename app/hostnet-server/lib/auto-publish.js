const { loadUsers, saveUsers } = require('./users');
const { listGithubFolder, putFileToGithub } = require('./github');
const { decryptToken, encryptToken } = require('./token-crypto');
const { publishFacebookPhoto, publishFacebookVideo, publishInstagramPhoto, publishInstagramVideo } = require('./meta');
const { refreshAccessToken: refreshYouTubeToken, uploadVideo } = require('./youtube');
const { refreshAccessToken: refreshTikTokToken, publishVideo: publishTikTokVideo } = require('./tiktok');
const { sendPhoto, sendVideo } = require('./telegram');
const { uploadToPostiz, createPostizPost } = require('./postiz');
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

// Publica de verdade o conteúdo gerado (revisao/) de um pedido já aprovado
// pelo cliente na página aprovacao.html — chamado por
// routes/approve-pedido.js assim que o marcador de aprovação é gravado.
// Usa a lista de redes marcadas na hora de montar o pedido (redes.json, ver
// lib/publish-pedido.js) quando existir; sem isso, publica em todas as
// contas conectadas do cliente (comportamento padrão pra pedidos antigos ou
// enviados sem nenhuma rede marcada).
//
// WordPress fica de fora de propósito — precisa de título/conteúdo de
// artigo estruturado, não combina com "banner/vídeo pra postar", então
// continua sendo um fluxo manual separado.
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

  let caption = '';
  const instructionEntry = rootEntries.find((e) => e.name.toLowerCase() === 'instrucoes.txt');
  if (instructionEntry) {
    try {
      caption = (await fetchText(instructionEntry.download_url)).replace(/^Enviado por:.*\n+/, '').trim();
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

  const wants = (platform, viaPostiz) =>
    !requestedNetworks || requestedNetworks.some((n) => n.platform === platform && !!n.viaPostiz === !!viaPostiz);

  const users = await loadUsers();
  const user = users.find((u) => u.client === client);
  if (!user) {
    return { ok: false, error: `Cliente "${client}" não encontrado`, results: [] };
  }

  const quota = checkPostQuota(user);
  if (!quota.allowed) {
    return { ok: false, error: quota.error, results: [] };
  }

  const results = [];
  let dirty = false;

  // --- Facebook / Instagram (API direta) ---
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

    if (page.instagramBusinessId && wants('instagram', false)) {
      for (const img of images) {
        try {
          const r = await publishInstagramPhoto({ pageAccessToken, igUserId: page.instagramBusinessId, imageUrl: img.download_url, caption });
          results.push({ channel: 'instagram', name: page.instagramUsername, file: img.name, status: 'ok', ...r });
        } catch (error) {
          results.push({ channel: 'instagram', name: page.instagramUsername, file: img.name, status: 'erro', error: error.message });
        }
      }
      for (const vid of videos) {
        try {
          const r = await publishInstagramVideo({ pageAccessToken, igUserId: page.instagramBusinessId, videoUrl: vid.download_url, caption });
          results.push({ channel: 'instagram', name: page.instagramUsername, file: vid.name, status: 'ok', ...r });
        } catch (error) {
          results.push({ channel: 'instagram', name: page.instagramUsername, file: vid.name, status: 'erro', error: error.message });
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
          const r = await uploadVideo({ accessToken, videoUrl: vid.download_url, title, description: caption });
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
        const r = await sendPhoto({ chatId, photoUrl: img.download_url, caption });
        results.push({ channel: 'telegram', file: img.name, status: 'ok', ...r });
      } catch (error) {
        results.push({ channel: 'telegram', file: img.name, status: 'erro', error: error.message });
      }
    }
    for (const vid of videos) {
      try {
        const r = await sendVideo({ chatId, videoUrl: vid.download_url, caption });
        results.push({ channel: 'telegram', file: vid.name, status: 'ok', ...r });
      } catch (error) {
        results.push({ channel: 'telegram', file: vid.name, status: 'erro', error: error.message });
      }
    }
  }

  // --- TikTok (API direta — hoje nenhum cliente usa esse caminho, TikTok
  // vive na Postiz por causa do modo sandbox, mas o código já suporta pra
  // quando isso mudar) ---
  const rawTiktok = user.connections && user.connections.tiktok;
  const tiktokAccounts = Array.isArray(rawTiktok) ? rawTiktok : rawTiktok ? [rawTiktok] : [];
  if (tiktokAccounts.length > 0 && wants('tiktok', false) && videos.length > 0) {
    for (const account of tiktokAccounts) {
      try {
        let accessToken = decryptToken(account.accessToken);
        if (Date.now() >= account.expiresAt - 60000) {
          const refreshed = await refreshTikTokToken(decryptToken(account.refreshToken));
          accessToken = refreshed.accessToken;
          account.accessToken = encryptToken(refreshed.accessToken);
          account.refreshToken = encryptToken(refreshed.refreshToken);
          account.expiresAt = refreshed.expiresAt;
          dirty = true;
        }
        for (const vid of videos) {
          try {
            const r = await publishTikTokVideo({ accessToken, videoUrl: vid.download_url, caption });
            results.push({ channel: 'tiktok', name: account.displayName, file: vid.name, status: 'ok', ...r });
          } catch (error) {
            results.push({ channel: 'tiktok', name: account.displayName, file: vid.name, status: 'erro', error: error.message });
          }
        }
      } catch (error) {
        results.push({ channel: 'tiktok', name: account.displayName, status: 'erro', error: error.message });
      }
    }
  }

  // --- Contas "via Postiz" (Facebook/Instagram/TikTok de clientes que ainda
  // não conectaram direto, ou o TikTok do Franklin) ---
  const postizEntries = Array.isArray(user.postizConnections) ? user.postizConnections : [];
  for (const entry of postizEntries) {
    const platform = typeof entry === 'string' ? entry : entry.platform;
    const integrationId = typeof entry === 'string' ? null : entry.integrationId;
    if (!integrationId || !wants(platform, true)) continue;

    // TikTok só aceita vídeo; as demais aceitam foto ou vídeo.
    const mediaList = platform === 'tiktok' ? videos : [...images, ...videos];
    for (const media of mediaList) {
      try {
        const buffer = await fetchBuffer(media.download_url);
        const uploaded = await uploadToPostiz({ buffer, filename: media.name, mimetype: MIME_BY_EXT[extOf(media.name)] || 'application/octet-stream' });
        const r = await createPostizPost({ integrationId, content: caption, mediaObj: uploaded });
        results.push({ channel: `${platform}-postiz`, file: media.name, status: 'ok', postizResult: r });
      } catch (error) {
        results.push({ channel: `${platform}-postiz`, file: media.name, status: 'erro', error: error.message });
      }
    }
  }

  const okCount = results.filter((r) => r.status === 'ok').length;
  if (okCount > 0) {
    recordPostsPublished(user, okCount);
    dirty = true;
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

module.exports = { publishApprovedPedido };
