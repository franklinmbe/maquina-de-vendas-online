const { verifyState } = require('../lib/oauth-state');
const { exchangeCodeForLongLivedUserToken, listManagedPages } = require('../lib/meta');
const { encryptToken } = require('../lib/token-crypto');
const { saveUserConnection, loadUsers, findUser } = require('../lib/users');
const { checkPlanAllowsConnection } = require('../lib/plan-limits');

function getRedirectUri(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/meta/oauth-callback`;
}

// Essa página só existe dentro do popup — ela nunca é vista de fato pelo
// cliente por mais que um instante, só serve pra fechar a janela e avisar a
// aba principal do app (via postMessage) que a conexão terminou (ok ou erro).
function popupResponseHtml({ ok, message }) {
  const payload = JSON.stringify({ source: 'mvo-meta-connect', ok, message: message || '' });
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
    const userAccessToken = await exchangeCodeForLongLivedUserToken({ code, redirectUri });
    const pages = await listManagedPages(userAccessToken);

    if (pages.length === 0) {
      res.status(200).send(popupResponseHtml({ ok: false, message: 'Nenhuma Página do Facebook encontrada — o cliente precisa ser administrador de uma Página' }));
      return;
    }

    const users = await loadUsers();
    const user = findUser(users, identifier);
    if (!user) {
      res.status(200).send(popupResponseHtml({ ok: false, message: 'Usuário não encontrado' }));
      return;
    }
    const newCount = pages.reduce((sum, page) => sum + 1 + (page.instagramBusinessId ? 1 : 0), 0);
    const planCheck = checkPlanAllowsConnection(user, 'meta', newCount);
    if (!planCheck.ok) {
      res.status(200).send(popupResponseHtml({ ok: false, message: planCheck.error }));
      return;
    }

    const connection = {
      connectedAt: new Date().toISOString(),
      pages: pages.map((page) => ({
        pageId: page.pageId,
        pageName: page.pageName,
        pageAccessToken: encryptToken(page.pageAccessToken),
        instagramBusinessId: page.instagramBusinessId,
        instagramUsername: page.instagramUsername,
      })),
    };

    await saveUserConnection(identifier, 'meta', connection);

    res.status(200).send(popupResponseHtml({ ok: true }));
  } catch (error) {
    res.status(200).send(popupResponseHtml({ ok: false, message: error.message || 'falha desconhecida' }));
  }
};
