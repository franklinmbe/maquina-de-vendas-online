const path = require('path');
const express = require('express');
const multer = require('multer');
const cron = require('node-cron');

const { collectSnapshots } = require('./lib/collect-snapshots');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB, mesmo teto do GitHub Contents API
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function route(name) {
  return require(`./routes/${name}`);
}

app.post('/api/login', route('login'));
app.post('/api/register', route('register'));
app.post('/api/admin-report', route('admin-report'));
app.post('/api/admin-set-account', route('admin-set-account'));
app.post('/api/lead', route('lead'));
app.post('/api/social-insights', route('social-insights'));
app.post('/api/social-report', route('social-report'));
app.post('/api/commit', upload.array('files'), route('commit'));

app.post('/api/meta/oauth-start', route('meta-oauth-start'));
app.get('/api/meta/oauth-callback', route('meta-oauth-callback'));
app.post('/api/tiktok/oauth-start', route('tiktok-oauth-start'));
app.get('/api/tiktok/oauth-callback', route('tiktok-oauth-callback'));

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

// Coleta automática 1x por dia, às 03:00 (horário do contêiner) — ver
// CLAUDE.md sobre por que isso não roda mais via "crons" do Vercel.
cron.schedule('0 3 * * *', () => {
  collectSnapshots().catch(() => {
    // Falha na coleta não deve derrubar o servidor — só perde o retrato do dia.
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Máquina de Vendas Online rodando na porta ${PORT}`);
});
