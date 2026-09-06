// Loja do módulo "Aplicativo SaaS" — não é reimplementada aqui, é a API REST
// do WooCommerce (plugin de loja do próprio WordPress do cliente, ver
// CLAUDE.md). Cada cliente gera uma Chave/Segredo em WooCommerce →
// Configurações → Avançado → API REST (permissão "Leitura" já basta, essa
// integração só lê produtos/pedidos pra mostrar na aba Loja do painel).
function authHeader(consumerKey, consumerSecret) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  return `Basic ${auth}`;
}

async function verifyCredentials({ siteUrl, consumerKey, consumerSecret }) {
  const base = siteUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/wp-json/wc/v3/products?per_page=1`, {
    headers: { Authorization: authHeader(consumerKey, consumerSecret) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`WooCommerce recusou: ${body.message || response.status}`);
  }
  return { ok: true };
}

async function listProducts({ siteUrl, consumerKey, consumerSecret, perPage = 50 }) {
  const base = siteUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/wp-json/wc/v3/products?per_page=${perPage}&status=publish`, {
    headers: { Authorization: authHeader(consumerKey, consumerSecret) },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`WooCommerce recusou ao listar produtos: ${body.message || response.status}`);
  }
  return body.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    stockStatus: p.stock_status,
    image: (p.images && p.images[0] && p.images[0].src) || null,
    permalink: p.permalink,
  }));
}

async function listOrders({ siteUrl, consumerKey, consumerSecret, perPage = 20 }) {
  const base = siteUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/wp-json/wc/v3/orders?per_page=${perPage}&orderby=date&order=desc`, {
    headers: { Authorization: authHeader(consumerKey, consumerSecret) },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`WooCommerce recusou ao listar pedidos: ${body.message || response.status}`);
  }
  return body.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    total: o.total,
    currency: o.currency,
    customerName: `${(o.billing && o.billing.first_name) || ''} ${(o.billing && o.billing.last_name) || ''}`.trim(),
    createdAt: o.date_created,
  }));
}

module.exports = { verifyCredentials, listProducts, listOrders };
