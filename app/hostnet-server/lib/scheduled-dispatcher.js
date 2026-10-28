const fs = require('fs');
const path = require('path');
const { loadUsers, saveUsers } = require('./users');
const { publishPedido } = require('./publish-pedido');
const { publishScheduledPiece, publishMediaBundle } = require('./auto-publish');
const { listGithubFolder } = require('./github');
const { projetoItens, pushHistorico } = require('./projetos');
const { checkPostQuota } = require('./post-quota');
const { sanitizeClientText } = require('./client-content-rules');

function scheduledDir() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado');
  return path.join(dir, 'scheduled');
}

// "Só postar" agendado (Franklin, 2026-10-28): a criação já foi preparada na
// hora de agendar (routes/schedule-post.js) — aqui só publica o que está em
// revisao/, com as descrições de cada rede. Devolve null enquanto a criação
// ainda está sendo preparada (tenta de novo no minuto seguinte).
const WAIT_LIMIT_MS = 6 * 60 * 60 * 1000;

async function publishCriacao({ users, entry }) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const base = `.claude/skills/${entry.client}/${entry.pasta}`;
  const root = await listGithubFolder({ owner, repo, token, path: base });
  const statusEntry = root.find((e) => e.name === 'geracao-status.json');
  let genStatus = '';
  let genError = '';
  if (statusEntry) {
    try {
      const st = await (await fetch(statusEntry.download_url)).json();
      genStatus = String(st.status || '');
      genError = String(st.lastError || '');
    } catch {}
  }
  if (/failed|blocked/.test(genStatus)) throw new Error(`A preparação da postagem falhou: ${genError || genStatus}`);
  if (!/^done/.test(genStatus)) {
    if (Date.now() - new Date(entry.scheduledFor).getTime() > WAIT_LIMIT_MS) throw new Error('A postagem não ficou pronta a tempo.');
    return null;
  }

  const user = users.find((u) => u.client === entry.client);
  if (!user) throw new Error(`Cliente "${entry.client}" não encontrado`);
  const quota = checkPostQuota(user);
  if (!quota.allowed) return { ok: false, error: quota.error, results: [] };

  const { itens, legendas, legenda } = await projetoItens(entry.client, entry.pasta);
  if (itens.length === 0) throw new Error('Nenhuma foto ou vídeo pronto pra publicar.');
  const captions = {};
  Object.entries(legendas || {}).forEach(([net, t]) => { if (typeof t === 'string' && t.trim()) captions[net] = sanitizeClientText(entry.client, t.trim()); });
  const caption = sanitizeClientText(entry.client, String(legenda || Object.values(captions)[0] || ''));
  const { results, dirty } = await publishMediaBundle({
    user,
    images: itens.filter((i) => !i.video).map((i) => ({ name: i.name, download_url: i.url })),
    videos: itens.filter((i) => i.video).map((i) => ({ name: i.name, download_url: i.url })),
    caption,
    captions,
    requestedNetworks: Array.isArray(entry.networks) && entry.networks.length > 0 ? entry.networks : null,
    formats: Array.isArray(entry.format) && entry.format.length > 0 ? entry.format : ['post'],
    formatNetworks: entry.formatNetworks || null,
  });
  const ok = results.some((r) => r.status === 'ok');
  // Marca a criação como postada no mesmo cadastro em memória (gravado no fim
  // do disparo) — markProjeto gravaria por fora e seria sobrescrito.
  const p = (user.projetos || []).find((x) => x.pasta === entry.pasta);
  if (p) {
    Object.assign(p, { status: 'postado', postadoEm: Date.now(), resultado: results.map((r) => ({ channel: r.channel, status: r.status, error: r.error })) });
    pushHistorico(p, { tipo: 'postagem', formatos: entry.format, itens: itens.length, resultado: results.map((r) => ({ channel: r.channel, status: r.status, error: r.error ? String(r.error).slice(0, 160) : undefined })) });
  }
  return { ok, dirty: true, results, error: ok ? null : (results.find((r) => r.error) || {}).error || 'Nenhuma rede publicou' };
}

// Roda a cada minuto (ver server.js) — procura posts agendados cuja hora já
// chegou e publica de verdade (mesmo caminho do envio imediato). Continua
// pendente automaticamente se ainda não chegou a hora; nunca reprocessa um
// que já esteja "sent"/"failed".
async function dispatchDuePosts() {
  const users = await loadUsers();
  const now = Date.now();
  let changed = false;
  const dispatched = [];

  for (const user of users) {
    const pending = (user.scheduledPosts || []).filter(
      (p) => p.status === 'pending' && new Date(p.scheduledFor).getTime() <= now
    );

    for (const entry of pending) {
      if (entry.pasta) {
        try {
          const r = await publishCriacao({ users, entry });
          if (!r) continue; // ainda preparando
          changed = true;
          entry.status = r.ok ? 'sent' : 'failed';
          if (r.ok) entry.sentAt = new Date().toISOString();
          else entry.error = r.error;
          entry.publishResults = r.results;
          dispatched.push({ id: entry.id, identifier: user.identifier, status: entry.status, published: r.results });
        } catch (error) {
          changed = true;
          entry.status = 'failed';
          entry.error = error.message || String(error);
          dispatched.push({ id: entry.id, identifier: user.identifier, status: 'failed', error: entry.error });
        }
        continue;
      }
      changed = true;
      try {
        const dir = path.join(scheduledDir(), entry.id);
        const files = entry.files.map((f) => ({
          originalname: f.filename,
          mimetype: f.mimetype,
          buffer: fs.readFileSync(path.join(dir, f.filename)),
        }));
        const archived = await publishPedido({
          identifier: user.identifier,
          client: entry.client,
          instruction: entry.instruction,
          files,
          networks: entry.networks,
          voice: entry.voice,
          music: entry.music,
          narrationText: entry.narrationText,
          motionVideo: entry.motionVideo,
          motionExtend: entry.motionExtend,
          motionVideoVoice: entry.motionVideoVoice,
          format: entry.format,
          formatNetworks: entry.formatNetworks,
        });

        // Arquivar no GitHub (acima) só guarda o registro do pedido — quem
        // publica de verdade nas redes é publishScheduledPiece, usando os
        // download_url que acabaram de sair do upload. Sem isso, "agendar"
        // só arquivava e nunca publicava sozinho de verdade.
        const publishResult = await publishScheduledPiece({
          users,
          targetClient: entry.client,
          files: archived.files,
          caption: entry.instruction,
          networks: entry.networks,
          formats: entry.format,
          formatNetworks: entry.formatNetworks,
        });
        if (publishResult.dirty) changed = true;

        if (publishResult.ok) {
          entry.status = 'sent';
          entry.sentAt = new Date().toISOString();
          entry.publishResults = publishResult.results;
        } else {
          // O pedido já ficou arquivado no GitHub (acima) mesmo se a
          // publicação de verdade falhar aqui (ex: cota do plano estourada)
          // — não adianta tentar de novo depois, então marca failed em vez
          // de deixar pending pra sempre.
          entry.status = 'failed';
          entry.error = publishResult.error;
        }
        fs.rmSync(dir, { recursive: true, force: true });
        dispatched.push({ id: entry.id, identifier: user.identifier, status: entry.status, published: publishResult.results });
      } catch (error) {
        entry.status = 'failed';
        entry.error = error.message || String(error);
        dispatched.push({ id: entry.id, identifier: user.identifier, status: 'failed', error: entry.error });
      }
    }
  }

  if (changed) await saveUsers(users);
  return dispatched;
}

module.exports = { dispatchDuePosts };
