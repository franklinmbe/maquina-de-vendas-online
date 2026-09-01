const { verifyState } = require('../lib/oauth-state');
const { exchangeCodeForToken } = require('../lib/youtube');
const { encryptToken } = require('../lib/token-crypto');
const { saveUserConnection, loadUsers, findUser } = require('../lib/users');
const { checkPlanAllowsConnection } = require('../lib/plan-limits');

function getRedirectUri(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/youtube/oauth-callback`;
}

// Igual ao popup do Meta/TikTok: essa página só existe dentro da janela do
// Google, fecha sozinha e avisa a aba principal do app via postMessage.
function popupResponseHtml({ ok, message }) {
  const payload = JSON.stringify({ source: 'mvo-youtube-connect', ok, message: message || '' });
  return `<!DOCTYPE html><html><body style="background:#0a0d12;color:#f2f2f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;">
<p>${ok ? 'Conectado! Pode fechar esta janela.' : `Erro: ${message || 'falha desconhecida'}`}</p>
<script>
  if (window.opener) { window.opener.postMessage(${payload}, '*'); }
  ${ok ? "setTimeout(function () { window.close(); }, 1500);" : ''}
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
    const redirectUri = getRedirectUri(req);
    const token = await exchangeCodeForToken({ code, redirectUri });

    if (!token.refreshToken) {
      // Acontece se o cliente já tinha autorizado o app antes sem
      // access_type=offline/prompt=consent — sem refresh_token não dá pra
      // renovar o acesso depois de ~1h. Pede pra revogar e reconectar.
      res.status(200).send(
        popupResponseHtml({
          ok: false,
          message: 'Google não devolveu permissão de acesso contínuo — revogue o acesso em myaccount.google.com/permissions e tente conectar de novo',
        })
      );
      return;
    }

    const users = await loadUsers();
    const user = findUser(users, identifier);
    if (!user) {
      res.status(200).send(popupResponseHtml({ ok: false, message: 'Usuário não encontrado' }));
      return;
    }
    const planCheck = checkPlanAllowsConnection(user, 'youtube', 1);
    if (!planCheck.ok) {
      res.status(200).send(popupResponseHtml({ ok: false, message: planCheck.error }));
      return;
    }

    const connection = {
      connectedAt: new Date().toISOString(),
      expiresAt: token.expiresAt,
      accessToken: encryptToken(token.accessToken),
      refreshToken: encryptToken(token.refreshToken),
    };

    await saveUserConnection(identifier, 'youtube', connection);

    res.status(200).send(popupResponseHtml({ ok: true }));
  } catch (error) {
    res.status(200).send(popupResponseHtml({ ok: false, message: error.message || 'falha desconhecida' }));
  }
};
