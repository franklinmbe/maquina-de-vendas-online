const { saveRoteiro, sanitizeRoteiro } = require('../lib/roteiro');

// Recebe o roteiro enviado por .claude/scripts/upload-roteiro.js. Só a senha
// mestra grava (é o Claude, na sessão, quem atualiza).
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { passphrase, roteiro } = req.body || {};
  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }
  const clean = sanitizeRoteiro(roteiro);
  if (!clean) {
    res.status(400).json({ error: 'Formato do roteiro inválido' });
    return;
  }
  saveRoteiro(clean);
  res.status(200).json({ ok: true, blocos: clean.blocos.length, itens: clean.blocos.reduce((n, b) => n + b.itens.length, 0) });
};
