const { buildObrigacoes } = require('../lib/obrigacoes-cnpj');

// Obrigações do CNPJ / MEI — resumo da situação fiscal do CNPJ de Franklin.
// Admin-only, mesma checagem de senha mestra do extrato-operacao.js. É dado
// do próprio negócio (impostos), nunca de cliente.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase } = req.body || {};

  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  res.status(200).json({ ok: true, ...buildObrigacoes() });
};
