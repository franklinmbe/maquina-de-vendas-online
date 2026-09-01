const { verifyState } = require('../lib/oauth-state');
const { exchangeCodeForToken, getUserInfo } = require('../lib/tiktok');
const { encryptToken } = require('../lib/token-crypto');
const { saveUserConnection, loadUsers, findUser } = require('../lib/users');
const { checkPlanAllowsConnection } = require('../lib/plan-limits');

function getRedirectUri(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/tiktok/oauth-callback`;
}

// Igual ao popup do Meta: essa página só existe dentro da janela do TikTok,
// fecha sozinha e avisa a aba principal do app via postMessage.
function popupResponseHtml({ ok, message }) {
  const payload = JSON.stringify({ source: 'mvo-tiktok-connect', ok, message: message || '' });
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
    const { displayName } = await getUserInfo(token.accessToken);

    const users = await loadUsers();
    const user = findUser(users, identifier);
    if (!user) {
      res.status(200).send(popupResponseHtml({ ok: false, message: 'Usuário não encontrado' }));
      return;
    }
    const existingTikTok = Array.isArray(user.connections && user.connections.tiktok) ? user.connections.tiktok : [];
    const isReconnect = existingTikTok.some((item) => item.openId === token.openId);

    // Ter mais de 1 conta da MESMA rede (ex: 2 TikToks) é caso especial —
    // só a conta admin (frank) e clientes do plano Personalizado (combinado
    // caso a caso com o Franklin) podem. Cliente comum fica no máximo 1
    // conta por plataforma, mesmo que o plano dele ainda tivesse "vaga"
    // numérica pra outra rede diferente.
    if (!isReconnect && existingTikTok.length >= 1 && user.client !== 'frank' && user.plan !== 'personalizado') {
      res.status(200).send(
        popupResponseHtml({
          ok: false,
          message: 'Seu plano permite só 1 conta de TikTok — pra conectar mais de uma, fale com o Franklin sobre o plano Personalizado.',
        })
      );
      return;
    }

    const newCount = isReconnect ? existingTikTok.length : existingTikTok.length + 1;
    const planCheck = checkPlanAllowsConnection(user, 'tiktok', newCount);
    if (!planCheck.ok) {
      res.status(200).send(popupResponseHtml({ ok: false, message: planCheck.error }));
      return;
    }

    const connection = {
      connectedAt: new Date().toISOString(),
      openId: token.openId,
      displayName,
      scope: token.scope,
      expiresAt: token.expiresAt,
      accessToken: encryptToken(token.accessToken),
      refreshToken: encryptToken(token.refreshToken),
    };

    // multi: true porque o Franklin tem mais de uma conta de TikTok (e
    // clientes do Personalizado, caso a caso — ver bloqueio acima que
    // restringe isso pra cliente comum) — dedupeKey evita duplicar se
    // reconectar a mesma conta.
    await saveUserConnection(identifier, 'tiktok', connection, { multi: true, dedupeKey: 'openId' });

    res.status(200).send(popupResponseHtml({ ok: true }));
  } catch (error) {
    res.status(200).send(popupResponseHtml({ ok: false, message: error.message || 'falha desconhecida' }));
  }
};
