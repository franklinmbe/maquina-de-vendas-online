const { resolveClient } = require('../lib/auth');
const { signState } = require('../lib/oauth-state');
const { buildAuthorizeUrl } = require('../lib/google');

function getRedirectUri(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/google/oauth-callback`;
}

// Botões "Google Analytics" e "Google Meu Negócio" (Franklin, 2026-11-20).
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
    res.status(200).json({ url: buildAuthorizeUrl({ redirectUri: getRedirectUri(req), state: signState(identifier) }) });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao iniciar conexão com o Google' });
  }
};
