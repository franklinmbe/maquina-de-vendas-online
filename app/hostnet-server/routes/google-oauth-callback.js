const { verifyState } = require('../lib/oauth-state');
const { exchangeCodeForToken, getEmail } = require('../lib/google');
const { encryptToken } = require('../lib/token-crypto');
const { saveUserConnection, loadUsers, findUser } = require('../lib/users');

function getRedirectUri(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/google/oauth-callback`;
}

function popupResponseHtml({ ok, message }) {
  const payload = JSON.stringify({ source: 'mvo-google-connect', ok, message: message || '' });
  return `<!DOCTYPE html><html><body style="background:#0a0d12;color:#f2f2f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;">
<p>${ok ? 'Google conectado! Pode fechar esta janela.' : `Erro: ${message || 'falha desconhecida'}`}</p>
<script>
  if (window.opener) { window.opener.postMessage(${payload}, '*'); }
  ${ok ? 'setTimeout(function () { window.close(); }, 1500);' : ''}
</script>
</body></html>`;
}

module.exports = async function handler(req, res) {
  const { code, state, error: oauthError, error_description: oauthErrorDescription } = req.query || {};
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (oauthError) {
    res.status(200).send(popupResponseHtml({ ok: false, message: oauthErrorDescription || oauthError }));
    return;
  }
  const identifier = verifyState(state);
  if (!identifier || !code) {
    res.status(200).send(popupResponseHtml({ ok: false, message: 'Sessão de conexão expirada, tenta de novo' }));
    return;
  }
  try {
    const token = await exchangeCodeForToken({ code, redirectUri: getRedirectUri(req) });
    if (!token.refreshToken) {
      res.status(200).send(popupResponseHtml({ ok: false, message: 'O Google não devolveu acesso contínuo — revogue em myaccount.google.com/permissions e conecte de novo' }));
      return;
    }
    const users = await loadUsers();
    if (!findUser(users, identifier)) {
      res.status(200).send(popupResponseHtml({ ok: false, message: 'Usuário não encontrado' }));
      return;
    }
    const email = await getEmail(token.accessToken).catch(() => null);
    await saveUserConnection(identifier, 'google', {
      connectedAt: new Date().toISOString(),
      email,
      scope: token.scope,
      expiresAt: token.expiresAt,
      accessToken: encryptToken(token.accessToken),
      refreshToken: encryptToken(token.refreshToken),
    });
    res.status(200).send(popupResponseHtml({ ok: true }));
  } catch (error) {
    res.status(200).send(popupResponseHtml({ ok: false, message: error.message || 'falha desconhecida' }));
  }
};
