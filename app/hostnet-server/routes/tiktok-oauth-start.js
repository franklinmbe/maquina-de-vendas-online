const { resolveClient } = require('../lib/auth');
const { signState } = require('../lib/oauth-state');
const { buildAuthorizeUrl } = require('../lib/tiktok');
const { loadUsers, findUser } = require('../lib/users');

async function tiktokLiberado(client, identifier) {
  if (client === 'frank') return true;
  const user = findUser(await loadUsers(), identifier);
  return !!(user && user.tiktokBeta);
}

function getRedirectUri(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/tiktok/oauth-callback`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};

  const client = await resolveClient({ identifier, password });
  if (!client) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  // TikTok pausado (Franklin, 2026-10-20): o app do TikTok ainda está em
  // modo sandbox (não aprovado). Libera só para quem tem `tiktokBeta: true`
  // no users.json (conta do revisor do TikTok e testes) e para o admin —
  // os clientes continuam vendo "Aguardando liberação" (19/11/2026).
  if (!(await tiktokLiberado(client, identifier))) {
    res.status(403).json({ error: 'TikTok aguardando liberação oficial do TikTok. Por enquanto não dá pra conectar.' });
    return;
  }

  try {
    const state = signState(identifier);
    const url = buildAuthorizeUrl({ redirectUri: getRedirectUri(req), state });
    res.status(200).json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao iniciar conexão com o TikTok' });
  }
};
