// Envia .claude/scripts/roteiro-admin.json pro servidor: é o conteúdo da seção
// "Tarefas pendentes e roteiro" da página Fluxos operacionais (admin).
// Uso: node .claude/scripts/upload-roteiro.js
// Atualize o JSON sempre que uma pendência mudar de status (e o campo
// "atualizadoEm"), depois rode este script. Não precisa de deploy.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const roteiro = JSON.parse(fs.readFileSync(path.join(__dirname, 'roteiro-admin.json'), 'utf8'));
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.local.json'), 'utf8'));
const passphrase = process.env.MVO_UPLOAD_PASSPHRASE || (settings.env && settings.env.MVO_APP_PASSPHRASE);
const base = process.env.MVO_BASE_URL || 'https://app.franklinmorais.com';

(async () => {
  if (!passphrase) throw new Error('MVO_APP_PASSPHRASE não encontrada em .claude/settings.local.json');
  const r = await fetch(`${base}/api/roteiro-update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase, roteiro }) });
  console.log('Upload:', r.status, JSON.stringify(await r.json()));
})().catch((e) => {
  console.error('FALHA:', e.message);
  process.exit(1);
});
