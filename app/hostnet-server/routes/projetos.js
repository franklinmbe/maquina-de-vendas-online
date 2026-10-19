const { resolveClient } = require('../lib/auth');
const { loadUsers, saveUsers } = require('../lib/users');
const { refreshProjetos, projetoItens, markProjeto } = require('../lib/projetos');
const { publishMediaBundle } = require('../lib/auto-publish');
const { checkPostQuota } = require('../lib/post-quota');
const { sanitizeClientText } = require('../lib/client-content-rules');

// Projetos do Cut Estúdio e a tela Postar (Franklin, 2026-10-19: criação
// separada da postagem). action:
//   lista  → projetos do cliente, com o estado atualizado
//   itens  → conteúdo pronto de um projeto (mídias + legendas)
//   redes  → redes conectadas onde dá pra postar
//   postar → publica os itens escolhidos nas redes escolhidas
//   lixeira → esconde/restaura um projeto da lista
const FORMATS = ['post', 'reels', 'carrossel', 'stories'];

function redesDoCliente(user) {
  const redes = [];
  const pages = (user.connections && user.connections.meta && user.connections.meta.pages) || [];
  pages.forEach((p) => {
    redes.push({ platform: 'facebook', viaPostiz: false, name: p.pageName || 'Facebook' });
    if (p.instagramBusinessId) redes.push({ platform: 'instagram', viaPostiz: false, name: p.instagramUsername || p.pageName || 'Instagram' });
  });
  if (user.connections && user.connections.youtube) redes.push({ platform: 'youtube', viaPostiz: false, name: 'YouTube' });
  if (user.connections && user.connections.telegram) redes.push({ platform: 'telegram', viaPostiz: false, name: user.connections.telegram.title || 'Telegram' });
  (Array.isArray(user.postizConnections) ? user.postizConnections : []).forEach((e) => {
    const platform = typeof e === 'string' ? e : e.platform;
    redes.push({ platform, viaPostiz: true, name: platform === 'tiktok' ? 'TikTok' : platform });
  });
  // Uma vez cada (a mesma rede em 2 Páginas publica nas duas de qualquer jeito).
  const seen = new Set();
  return redes.filter((r) => { const k = r.platform + r.viaPostiz; if (seen.has(k)) return false; seen.add(k); return true; });
}

module.exports = async function handler(req, res) {
  const body = req.body || {};
  const client = await resolveClient({ identifier: body.identifier, password: body.password });
  if (!client) { res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' }); return; }
  const action = String(body.action || 'lista');

  try {
    if (action === 'lista') {
      const list = await refreshProjetos(client);
      res.json({ projetos: list });
      return;
    }

    const users = await loadUsers();
    const user = users.find((u) => u.client === client);
    if (!user) { res.status(404).json({ error: 'Conta não encontrada.' }); return; }

    if (action === 'redes') { res.json({ redes: redesDoCliente(user) }); return; }

    const pasta = String(body.pasta || '').replace(/[^a-zA-Z0-9._-]/g, '');
    const projeto = (user.projetos || []).find((p) => p.pasta === pasta);
    if (!projeto) { res.status(404).json({ error: 'Projeto não encontrado.' }); return; }

    if (action === 'lixeira') {
      await markProjeto(client, pasta, { trash: !!body.trash });
      res.json({ ok: true });
      return;
    }

    if (action === 'itens') { res.json(await projetoItens(projeto.client, pasta)); return; }

    if (action === 'postar') {
      if (projeto.status !== 'pronto' && projeto.status !== 'postado') { res.status(400).json({ error: 'Esse projeto ainda não foi aprovado. Aprove em Projetos primeiro.' }); return; }
      const quota = checkPostQuota(user);
      if (!quota.allowed) { res.status(403).json({ error: quota.error }); return; }
      const { itens, legendas, legenda } = await projetoItens(projeto.client, pasta);
      const chosen = Array.isArray(body.itens) && body.itens.length ? itens.filter((i) => body.itens.includes(i.name)) : itens;
      if (!chosen.length) { res.status(400).json({ error: 'Escolha pelo menos uma foto ou vídeo do projeto.' }); return; }
      const disponiveis = redesDoCliente(user);
      const networks = (Array.isArray(body.networks) ? body.networks : [])
        .filter((n) => disponiveis.some((d) => d.platform === n.platform && d.viaPostiz === !!n.viaPostiz))
        .map((n) => ({ platform: n.platform, viaPostiz: !!n.viaPostiz }));
      if (!networks.length) { res.status(400).json({ error: 'Escolha pelo menos uma rede social.' }); return; }
      const formats = (Array.isArray(body.formats) ? body.formats : []).filter((f) => FORMATS.includes(f));

      // O cliente pode ajustar o texto de cada rede antes de postar.
      const captions = {};
      const src = { ...(legendas || {}), ...(body.legendas && typeof body.legendas === 'object' ? body.legendas : {}) };
      Object.entries(src).forEach(([net, t]) => { if (typeof t === 'string' && t.trim()) captions[net] = sanitizeClientText(projeto.client, t.trim()); });
      const caption = sanitizeClientText(projeto.client, String(body.legenda || legenda || Object.values(captions)[0] || ''));

      const job = publishMediaBundle({
        user,
        images: chosen.filter((i) => !i.video).map((i) => ({ name: i.name, download_url: i.url })),
        videos: chosen.filter((i) => i.video).map((i) => ({ name: i.name, download_url: i.url })),
        caption,
        captions,
        requestedNetworks: networks,
        formats: formats.length ? formats : ['post'],
        formatNetworks: null,
      }).then(async ({ results, dirty }) => {
        if (dirty) {
          // Relê antes de gravar: a postagem leva minutos e outras coisas
          // podem ter mudado no cadastro nesse meio tempo.
          const fresh = await loadUsers();
          const fu = fresh.find((u) => u.client === client);
          if (fu) {
            ['connections', 'postWindow', 'postDayWindow'].forEach((k) => { if (user[k] !== undefined) fu[k] = user[k]; });
            await saveUsers(fresh);
          }
        }
        const ok = results.filter((r) => r.status === 'ok').length;
        await markProjeto(client, pasta, { status: 'postado', postadoEm: Date.now(), resultado: results.map((r) => ({ channel: r.channel, status: r.status, error: r.error })), postando: false });
        return { ok: true, results, okCount: ok };
      }).catch(async (error) => {
        await markProjeto(client, pasta, { postando: false, erroPostar: error.message }).catch(() => {});
        return { ok: false, error: error.message };
      });
      await markProjeto(client, pasta, { postando: true });
      // Publicar em várias redes leva minutos: devolve em até 20 s e a tela
      // acompanha pela lista (campo postando/resultado).
      const early = await Promise.race([job, new Promise((r) => setTimeout(() => r(null), 20000))]);
      res.json(early || { ok: true, postando: true });
      return;
    }

    res.status(400).json({ error: 'Ação desconhecida.' });
  } catch (error) {
    console.error('[projetos]', action, error.message);
    res.status(500).json({ error: 'Não deu pra carregar os projetos agora. Tente de novo.' });
  }
};
