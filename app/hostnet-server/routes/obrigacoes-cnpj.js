const crypto = require('crypto');
const { buildObrigacoes } = require('../lib/obrigacoes-cnpj');

// Obrigações do CNPJ / MEI — resumo da situação fiscal do CNPJ de Franklin.
// Admin-only, mesma checagem de senha mestra do extrato-operacao.js. É dado
// do próprio negócio (impostos), nunca de cliente.
//
// Exceção: o contador de Franklin vê a mesma página sem login, pelo link
// /obrigacoes-cnpj.html?k=<CONTADOR_KEY>. A chave fica só no .env da VPS
// (o repositório é público); sem CONTADOR_KEY configurada, o link não abre.
function keyMatches(given) {
  const expected = process.env.CONTADOR_KEY;
  if (!expected || typeof given !== 'string' || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase, contadorKey } = req.body || {};

  const isAdmin = !!process.env.APP_PASSPHRASE && passphrase === process.env.APP_PASSPHRASE;
  const isContador = !isAdmin && keyMatches(contadorKey);
  if (!isAdmin && !isContador) {
    res.status(401).json({ error: contadorKey ? 'Link inválido ou expirado' : 'Senha mestra incorreta' });
    return;
  }

  res.status(200).json({ ok: true, viewer: isContador ? 'contador' : 'admin', ...buildObrigacoes() });
};
