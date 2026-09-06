const { resolveClient } = require('../lib/auth');
const { loadUsers } = require('../lib/users');
const { decryptToken } = require('../lib/token-crypto');
const { listProducts, listOrders } = require('../lib/woocommerce');

// Dados da aba Loja do painel administrativo — produtos e pedidos recentes,
// puxados ao vivo do WooCommerce do cliente (nunca guardados aqui, mudam o
// tempo todo). targetClient permite o admin (frank) ver a Loja de outro
// cliente, mesmo padrão de commit.js.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, targetClient } = req.body || {};

  const resolvedClient = await resolveClient({ identifier, password });
  if (!resolvedClient) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }
  const client = resolvedClient === 'frank' && targetClient ? String(targetClient).trim() : resolvedClient;

  const users = await loadUsers();
  const user = users.find((u) => u.client === client);
  const conn = user && user.connections && user.connections.woocommerce;
  if (!conn) {
    res.status(404).json({ error: 'Loja (WooCommerce) ainda não conectada' });
    return;
  }

  try {
    const creds = {
      siteUrl: conn.siteUrl,
      consumerKey: conn.consumerKey,
      consumerSecret: decryptToken(conn.consumerSecret),
    };
    const [products, orders] = await Promise.all([listProducts(creds), listOrders(creds)]);
    res.status(200).json({ ok: true, products, orders });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao carregar a Loja' });
  }
};
