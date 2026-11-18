// Anúncios do cliente pela Marketing API, com o token que o próprio cliente
// liberou ao conectar o Facebook no app (connections.meta.ads, ver
// routes/meta-oauth-callback.js). Assim o servidor cria/pausa anúncios de
// qualquer cliente conectado, sem navegador nem VS Code (Franklin, 2026-11-18).
//
// Uso pelo Claude no servidor (dentro do container):
//   docker exec mvo node /app/lib/meta-ads.js <client> GET  /act_<id>/ads 'fields=name,effective_status'
//   docker exec mvo node /app/lib/meta-ads.js <client> POST /act_<id>/ads '{"name":"...","adset_id":"...","creative":{"creative_id":"..."},"status":"ACTIVE"}'
// Ações com dinheiro de verdade seguem as regras de confirmação do CLAUDE.md.

const { decryptToken } = require('./token-crypto');
const { loadUsers } = require('./users');

const GRAPH = 'https://graph.facebook.com/v21.0';

async function getClientAds(client) {
  const users = await loadUsers();
  const list = Array.isArray(users) ? users : (users.users || Object.values(users));
  const user = list.find((u) => u && u.client === client && u.connections && u.connections.meta && u.connections.meta.ads);
  if (!user) throw new Error(`Cliente "${client}" não liberou anúncios ao conectar o Facebook (reconectar no app)`);
  const ads = user.connections.meta.ads;
  return { token: decryptToken(ads.userAccessToken), adAccounts: ads.adAccounts || [], pages: user.connections.meta.pages || [] };
}

async function graph(client, method, path, params) {
  const { token } = await getClientAds(client);
  const m = String(method || 'GET').toUpperCase();
  let url = `${GRAPH}${path.startsWith('/') ? '' : '/'}${path}`;
  const init = { method: m };
  if (m === 'GET' || m === 'DELETE') {
    const qs = new URLSearchParams(typeof params === 'string' ? params : (params || {}));
    qs.set('access_token', token);
    url += `?${qs.toString()}`;
  } else {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) body.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    body.set('access_token', token);
    init.body = body;
  }
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) {
    const e = new Error(`Meta: ${json.error.message}${json.error.error_user_msg ? ` — ${json.error.error_user_msg}` : ''}`);
    e.meta = json.error;
    throw e;
  }
  return json;
}

module.exports = { getClientAds, graph };

if (require.main === module) {
  const [client, method, path, raw] = process.argv.slice(2);
  (async () => {
    if (!client) throw new Error('uso: node lib/meta-ads.js <client> [GET|POST|DELETE] [path] [params]');
    if (!path) {
      const { adAccounts, pages } = await getClientAds(client);
      console.log(JSON.stringify({ adAccounts, pages: pages.map((p) => ({ pageId: p.pageId, pageName: p.pageName, instagramBusinessId: p.instagramBusinessId })) }, null, 2));
      return;
    }
    let params = raw || '';
    if (raw && raw.trim().startsWith('{')) params = JSON.parse(raw);
    console.log(JSON.stringify(await graph(client, method, path, params), null, 2));
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
