// Servidor Node "de verdade" pra rodar fora da Vercel (ex: Hostinger VPS).
// Cada arquivo em api/**.js já exporta `async function handler(req, res)` no
// formato de função serverless da Vercel — esse servidor só recria, na mão,
// o roteamento que a Vercel faz sozinha (1 arquivo = 1 rota, mesmo caminho),
// e serve public/ como site estático. Nenhum arquivo dentro de api/ precisou
// mudar.
const path = require('path');
const express = require('express');

const app = express();

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Registra uma rota que delega pro handler do arquivo — aceita qualquer
// método HTTP porque cada handler já confere `req.method` sozinho e responde
// 405 quando não bate (mesmo comportamento de hoje na Vercel).
function route(routePath, relativeModulePath) {
  const handler = require(relativeModulePath);
  app.all(routePath, (req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      console.error(`Erro não tratado em ${routePath}:`, error);
      if (!res.headersSent) res.status(500).json({ error: 'Erro interno do servidor' });
    });
  });
}

route('/api/login', './api/login');
route('/api/register', './api/register');
route('/api/commit', './api/commit');
route('/api/lead', './api/lead');
route('/api/upload-token', './api/upload-token');
route('/api/admin-report', './api/admin-report');
route('/api/admin-set-account', './api/admin-set-account');
route('/api/social-report', './api/social-report');
route('/api/social-insights', './api/social-insights');
route('/api/meta/oauth-start', './api/meta/oauth-start');
route('/api/meta/oauth-callback', './api/meta/oauth-callback');
route('/api/meta/publish', './api/meta/publish');
route('/api/tiktok/oauth-start', './api/tiktok/oauth-start');
route('/api/tiktok/oauth-callback', './api/tiktok/oauth-callback');
route('/api/tiktok/publish', './api/tiktok/publish');
route('/api/cron/collect-social-snapshots', './api/cron/collect-social-snapshots');

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Máquina de Vendas Online rodando na porta ${PORT}`);
});
