const { loadRequests, addRequest, removeRequest } = require('../lib/signup-requests');

// Pedidos de cadastro (ver lib/signup-requests.js).
// - action "create" (público, aba Cadastrar): { name, phone }
// - action "list" / "delete" (só admin, senha mestra): { passphrase, phone? }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { action, name, phone, passphrase } = req.body || {};
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2);

  if (action === 'create') {
    const trimmedName = String(name || '').trim().slice(0, 80);
    if (!trimmedName) {
      res.status(400).json({ error: 'Nome é obrigatório' });
      return;
    }
    if (digits.length < 10 || digits.length > 11) {
      res.status(400).json({ error: 'WhatsApp inválido' });
      return;
    }
    addRequest(trimmedName, digits);
    res.status(200).json({ ok: true });
    return;
  }

  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  if (action === 'list') {
    res.status(200).json({ ok: true, requests: loadRequests() });
    return;
  }
  if (action === 'delete' && digits) {
    removeRequest(digits);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(400).json({ error: 'Ação inválida' });
};
