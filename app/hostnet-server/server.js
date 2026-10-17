const path = require('path');
const express = require('express');
const multer = require('multer');
const cron = require('node-cron');

const { collectSnapshots } = require('./lib/collect-snapshots');
const { runDailyTips } = require('./lib/daily-tips');
const { runDailyReports } = require('./lib/relatorio-completo');
const { dispatchDuePosts } = require('./lib/scheduled-dispatcher');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB, mesmo teto do GitHub Contents API
});

app.use(express.json({ limit: '2mb' }));

// Mudança de endereço (Franklin, 2026-10-17): o app saiu de app.franklinmorais.com
// para app.maquinadevendasonline.com.br. No endereço antigo, toda página vira uma
// passagem que leva o login guardado no aparelho (o localStorage é preso ao
// endereço) para public/migrar.html no endereço novo, que guarda e abre o mesmo
// caminho. /api, imagens e scripts continuam respondendo nos dois endereços.
const NEW_APP_HOST = 'app.maquinadevendasonline.com.br';
const OLD_APP_HOSTS = ['app.franklinmorais.com'];
app.use((req, res, next) => {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0].toLowerCase();
  if (!OLD_APP_HOSTS.includes(host) || req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') return next();
  // Política de privacidade e termos seguem abrindo direto: os painéis da Meta/Google apontam pra elas.
  if (req.path === '/privacy.html' || req.path === '/terms.html') return next();
  const next_ = JSON.stringify(req.originalUrl).replace(/</g, '\\u003c');
  res.set('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Máquina de Vendas Online</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0d12;color:#f2f2f0;font-family:system-ui,sans-serif;text-align:center;padding:16px">
<p>O aplicativo mudou de endereço.<br />Abrindo <b>${NEW_APP_HOST}</b>…</p>
<script>
(function () {
  var d = {};
  ['mvo_session', 'mvo_admin_session'].forEach(function (k) { try { var v = localStorage.getItem(k); if (v) d[k] = v; } catch (e) {} });
  var p = new URLSearchParams();
  p.set('next', ${next_});
  if (Object.keys(d).length) p.set('d', btoa(unescape(encodeURIComponent(JSON.stringify(d)))));
  location.replace('https://${NEW_APP_HOST}/migrar.html#' + p.toString());
})();
</script>
<noscript><a href="https://${NEW_APP_HOST}/" style="color:#ff5a36">Abrir o aplicativo</a></noscript>
</body></html>`);
});

app.use(express.static(path.join(__dirname, 'public')));

// Links de planos pra mandar separado: /planos devolve o próprio app, que
// abre a tela de planos inteira sozinho.
const PLAN_PAGES = ['planos'];
app.get(PLAN_PAGES.map((p) => `/${p}`), (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
// Cada plano tem a sua página de apresentação (mais explicativa, pra mandar
// ao cliente), em public/<slug>.html.
for (const p of ['plano-iniciante', 'plano-profissional', 'plano-especialista']) {
  app.get(`/${p}`, (req, res) => res.sendFile(path.join(__dirname, 'public', `${p}.html`)));
}
app.get('/plano-personalizado', (req, res) => res.sendFile(path.join(__dirname, 'public', 'plano-personalizado.html')));
app.get('/treinamento-criacao-de-aplicativos', (req, res) => res.sendFile(path.join(__dirname, 'public', 'treinamento-criacao-de-aplicativos.html')));
// "Saiba mais" de cada item de Ajustes: página explicativa em public/conheca/<slug>.html.
for (const p of ['relatorio-completo', 'meu-painel', 'meu-cerebro', 'meu-fluxo-de-trafego', 'site-ou-loja', 'fluxos-operacionais']) {
  app.get(`/conheca/${p}`, (req, res) => res.sendFile(path.join(__dirname, 'public', 'conheca', `${p}.html`)));
}

function route(name) {
  return require(`./routes/${name}`);
}

app.post('/api/login', route('login'));
app.post('/api/register', route('register'));
app.post('/api/admin-report', route('admin-report'));
app.post('/api/extrato-operacao', route('extrato-operacao'));
app.post('/api/obrigacoes-cnpj', route('obrigacoes-cnpj'));
app.post('/api/share-links', route('share-links'));
app.post('/api/fluxo2-log', route('fluxo2-log'));
app.post('/api/fluxo2-report', route('fluxo2-report'));
app.post('/api/fluxo2-task', route('fluxo2-task'));
app.post('/api/mapa-cerebro', route('mapa-cerebro'));
app.post('/api/mapa-cerebro-update', route('mapa-cerebro-update'));
app.post('/api/painel-admin', route('painel-admin'));
app.post('/api/meu-cerebro', route('meu-cerebro'));
app.post('/api/meu-painel', route('meu-painel'));
app.post('/api/roteiro', route('roteiro'));
app.post('/api/campanhas-rjinox', route('campanhas-rjinox'));
app.post('/api/relatorio-completo', route('relatorio-completo'));
app.post('/api/roteiro-update', route('roteiro-update'));
app.get('/api/agentes-catalogo', route('agentes-catalogo'));
app.post('/api/recursos-do-plano', route('recursos-do-plano'));
app.post('/api/admin-set-account', route('admin-set-account'));
app.post('/api/admin-next-password', route('admin-next-password'));
app.post('/api/signup-request', route('signup-request'));
app.post('/api/admin-impersonate', route('admin-impersonate'));
app.post('/api/lead', route('lead'));
app.post('/api/social-insights', route('social-insights'));
app.post('/api/social-report', route('social-report'));
app.post('/api/connected-accounts', route('connected-accounts'));
app.post('/api/pending-approvals', route('pending-approvals'));
app.post('/api/pedido-folder', route('pedido-folder'));
app.post('/api/post-history', route('post-history'));
app.post('/api/commit', upload.array('files'), route('commit'));
app.post('/api/stage-attachment', upload.array('files'), route('stage-attachment'));
app.post('/api/schedule-post', upload.array('files'), route('schedule-post'));
app.post('/api/approve-pedido', route('approve-pedido'));
app.post('/api/delete-revisao-file', route('delete-revisao-file'));
app.post('/api/delete-pedido', route('delete-pedido'));
app.post('/api/check-call-limit', route('check-call-limit'));
app.post('/api/check-media-limit', route('check-media-limit'));
app.post('/api/support-ask', route('support-ask'));
app.post('/api/creative-chat', route('creative-chat'));
app.post('/api/chat-history', route('chat-history'));
app.post('/api/chat-clear', route('chat-clear'));
app.post('/api/brand', route('brand'));
app.post('/api/share-page', route('share-page'));
app.post('/api/chat-delete-selected', route('chat-delete-selected'));
app.post('/api/chat-trash', route('chat-trash'));
app.post('/api/chat-trash-clear', route('chat-trash-clear'));
app.post('/api/chat-deliver-preview', route('chat-deliver-preview'));
app.post('/api/chat-mark-preview', route('chat-mark-preview'));

// Servidor MCP da rotina de geração automática (ver lib/mcp-automation-server.js
// e routes/mcp-automation.js) — token próprio na URL, não a senha mestra.
app.all('/mcp/:token', route('mcp-automation'));

app.post('/api/meta/oauth-start', route('meta-oauth-start'));
app.get('/api/meta/oauth-callback', route('meta-oauth-callback'));
app.post('/api/meta/publish', route('meta-publish'));
app.post('/api/tiktok/oauth-start', route('tiktok-oauth-start'));
app.get('/api/tiktok/oauth-callback', route('tiktok-oauth-callback'));
app.post('/api/tiktok/publish', route('tiktok-publish'));
app.post('/api/youtube/oauth-start', route('youtube-oauth-start'));
app.get('/api/youtube/oauth-callback', route('youtube-oauth-callback'));
app.post('/api/youtube/publish', route('youtube-publish'));
app.post('/api/telegram/connect', route('telegram-connect'));
app.post('/api/telegram/publish', route('telegram-publish'));
app.post('/api/wordpress/connect', route('wordpress-connect'));
app.post('/api/wordpress/publish', route('wordpress-publish'));

// Módulo Administrativo (fichas/OS) e Loja (WooCommerce) do produto
// "Aplicativo SaaS" — ver CLAUDE.md, modelo RN Cell.
app.post('/api/ficha/create', route('ficha-create'));
app.post('/api/ficha/list', route('ficha-list'));
app.post('/api/ficha/update-status', route('ficha-update-status'));
app.post('/api/woocommerce/connect', route('woocommerce-connect'));
app.post('/api/woocommerce/store', route('woocommerce-store'));
app.post('/api/admin-set-saas-app', route('admin-set-saas-app'));

// Webhook do WhatsApp Cloud API — GET pro handshake de verificação do Meta,
// POST pras mensagens recebidas de verdade. Um endpoint só, compartilhado
// por todos os tenants (ver routes/whatsapp-webhook.js).
app.get('/api/whatsapp/webhook', route('whatsapp-webhook'));
app.post('/api/whatsapp/webhook', route('whatsapp-webhook'));

// Endpoint manual pra forçar uma coleta fora do horário agendado (útil pra
// testar sem esperar a meia-noite) — protegido pela mesma senha mestra do
// resto do painel administrativo.
app.post('/api/cron/collect-social-snapshots', async (req, res) => {
  const { passphrase } = req.body || {};
  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }
  const summary = await collectSnapshots();
  res.status(200).json({ ok: true, collected: summary.length, summary });
});

// Atualização diária às 06:00 de Brasília (Franklin, 2026-10-05: "tudo do
// aplicativo atualiza todo dia às 6h"). Primeiro o retrato de seguidores
// (antes rodava 03:00 UTC), depois o relatório completo (orgânico + anúncios,
// pedido de 2026-09-30) — nessa ordem, pro crescimento já sair com o retrato
// do dia. Extrato, obrigações do CNPJ, painéis e relatório administrativo não
// precisam de rotina: são recalculados na hora em que a página abre.
cron.schedule('0 6 * * *', async () => {
  try { await collectSnapshots(); } catch (e) {
    // Falha na coleta não deve derrubar o servidor — só perde o retrato do dia.
    console.error('[snapshots] falhou:', e.message);
  }
  runDailyReports().then((r) => console.log('[relatorios]', JSON.stringify(r))).catch((e) => console.error('[relatorios] falhou:', e.message));
}, { timezone: 'America/Sao_Paulo' });

// Refazer os relatórios agora (admin, senha mestra).
app.post('/api/relatorios-run', async (req, res) => {
  const { passphrase } = req.body || {};
  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }
  res.status(200).json(await runDailyReports());
});

// Dicas do dia pra todo usuário do app (pedido do Franklin, 2026-09-23):
// 07:00 no horário de Brasília. Ver lib/daily-tips.js.
cron.schedule('0 7 * * *', () => {
  runDailyTips().then((r) => console.log('[daily-tips]', JSON.stringify(r))).catch((e) => console.error('[daily-tips] falhou:', e.message));
}, { timezone: 'America/Sao_Paulo' });

// Rodar as dicas agora (admin, senha mestra) — pra testar ou refazer o dia.
app.post('/api/daily-tips-run', async (req, res) => {
  const { passphrase, client } = req.body || {};
  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }
  res.status(200).json(await runDailyTips({ onlyClient: client || null }));
});

// Checa a cada minuto se algum post agendado (Calendário) já chegou na hora
// de publicar de verdade. Um post que falhar vira "failed" (não fica
// tentando pra sempre sozinho) — aparece assim no relatório/calendário.
cron.schedule('* * * * *', () => {
  dispatchDuePosts().catch(() => {
    // Erro fora do esperado (ex: DATA_DIR indisponível) não deve derrubar
    // o servidor — só essa rodada de checagem é perdida.
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Máquina de Vendas Online rodando na porta ${PORT}`);
});
