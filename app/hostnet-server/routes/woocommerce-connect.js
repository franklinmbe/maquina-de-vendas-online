const { resolveClient } = require('../lib/auth');
const { verifyCredentials } = require('../lib/woocommerce');
const { encryptToken } = require('../lib/token-crypto');
const { saveUserConnection } = require('../lib/users');

// Loja (WooCommerce) não usa OAuth: o cliente gera uma Chave/Segredo de API
// no próprio WooCommerce dele (Configurações → Avançado → API REST →
// Adicionar chave, permissão "Leitura") e informa aqui — a gente confere
// chamando /wp-json/wc/v3/products antes de salvar. Mesmo desenho do
// WordPress (lib/wordpress.js / routes/wordpress-connect.js), API própria do
// WooCommerce (plugin de loja, separado do WordPress em si).
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, siteUrl, consumerKey, consumerSecret } = req.body || {};

  const client = await resolveClient({ identifier, password });
  if (!client) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  if (!siteUrl || !consumerKey || !consumerSecret) {
    res.status(400).json({ error: 'Informe o site, a chave e o segredo da API do WooCommerce' });
    return;
  }

  try {
    await verifyCredentials({ siteUrl, consumerKey, consumerSecret });
    await saveUserConnection(identifier, 'woocommerce', {
      connectedAt: new Date().toISOString(),
      siteUrl: String(siteUrl).replace(/\/$/, ''),
      consumerKey,
      consumerSecret: encryptToken(consumerSecret),
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Falha ao conectar a Loja (WooCommerce)' });
  }
};
