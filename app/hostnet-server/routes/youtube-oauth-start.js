const { resolveClient } = require('../lib/auth');
const { signState } = require('../lib/oauth-state');
const { buildAuthorizeUrl } = require('../lib/youtube');

function getRedirectUri(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/youtube/oauth-callback`;
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

  try {
    const state = signState(identifier);
    const url = buildAuthorizeUrl({ redirectUri: getRedirectUri(req), state });
    res.status(200).json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao iniciar conexão com o YouTube' });
  }
};
