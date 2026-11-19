const { loadUsers, saveUsers, findUser, verifyPassword } = require('../lib/users');
const { encryptToken, decryptToken } = require('../lib/token-crypto');
const { refreshAccessToken, queryCreatorInfo, publishVideoFile, fetchPublishStatus } = require('../lib/tiktok');

// Tela própria de postagem no TikTok (public/tiktok-postar.html), no padrão
// exigido pela análise do TikTok (Content Sharing Guidelines). Enquanto o app
// do TikTok não é aprovado, só contas com `tiktokBeta: true` (revisor e
// testes) e o admin usam — mesmo critério de routes/tiktok-oauth-start.js.
// Na sandbox o TikTok só aceita privacidade SELF_ONLY (só o dono vê).

const PRIVACY_LEVELS = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'];

async function authUser(body) {
  const { identifier, password } = body || {};
  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user || !verifyPassword(password, user.passwordHash)) return { error: [401, 'E-mail/telefone ou senha incorretos'] };
  if (!(user.client === 'frank' || user.tiktokBeta)) return { error: [403, 'TikTok aguardando liberação oficial do TikTok.'] };
  const raw = user.connections && user.connections.tiktok;
  const accounts = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return { users, user, accounts };
}

function pickAccount(accounts, openId) {
  if (!accounts.length) return null;
  return (openId && accounts.find((a) => a.openId === openId)) || accounts[0];
}

// Renova o token se estiver vencendo e grava de volta (cifrado).
async function tokenFor(account, ctx) {
  if (Date.now() < account.expiresAt - 60000) return decryptToken(account.accessToken);
  const refreshed = await refreshAccessToken(decryptToken(account.refreshToken));
  account.accessToken = encryptToken(refreshed.accessToken);
  account.refreshToken = encryptToken(refreshed.refreshToken);
  account.expiresAt = refreshed.expiresAt;
  ctx.user.connections.tiktok = ctx.accounts;
  await saveUsers(ctx.users);
  return refreshed.accessToken;
}

async function creatorInfo(req, res) {
  try {
    const ctx = await authUser(req.body);
    if (ctx.error) return res.status(ctx.error[0]).json({ error: ctx.error[1] });
    if (!ctx.accounts.length) return res.status(200).json({ ok: true, accounts: [] });
    const out = [];
    for (const account of ctx.accounts) {
      try {
        const token = await tokenFor(account, ctx);
        const info = await queryCreatorInfo(token);
        out.push({ openId: account.openId, displayName: account.displayName, ...info });
      } catch (error) {
        out.push({ openId: account.openId, displayName: account.displayName, error: error.message });
      }
    }
    res.status(200).json({ ok: true, accounts: out });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao consultar o TikTok' });
  }
}

async function post(req, res) {
  try {
    const ctx = await authUser(req.body);
    if (ctx.error) return res.status(ctx.error[0]).json({ error: ctx.error[1] });
    const account = pickAccount(ctx.accounts, req.body.openId);
    if (!account) return res.status(400).json({ error: 'Nenhuma conta do TikTok conectada' });
    const file = req.file;
    if (!file || !String(file.mimetype || '').startsWith('video/')) return res.status(400).json({ error: 'Escolha um vídeo para postar.' });
    const privacyLevel = String(req.body.privacyLevel || '');
    if (!PRIVACY_LEVELS.includes(privacyLevel)) return res.status(400).json({ error: 'Escolha quem pode ver o vídeo.' });
    const flag = (v) => v === true || v === 'true';
    const brandContent = flag(req.body.brandContent);
    const brandOrganic = flag(req.body.brandOrganic);
    if (brandContent && privacyLevel === 'SELF_ONLY') {
      return res.status(400).json({ error: 'Conteúdo de marca não pode ser privado (só eu).' });
    }
    const token = await tokenFor(account, ctx);
    const result = await publishVideoFile({
      accessToken: token,
      buffer: file.buffer,
      mimetype: file.mimetype,
      caption: String(req.body.caption || '').slice(0, 2200),
      privacyLevel,
      disableComment: !flag(req.body.allowComment),
      disableDuet: !flag(req.body.allowDuet),
      disableStitch: !flag(req.body.allowStitch),
      brandContent,
      brandOrganic,
    });
    res.status(200).json({ ok: true, openId: account.openId, displayName: account.displayName, ...result });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Falha ao postar no TikTok' });
  }
}

async function status(req, res) {
  try {
    const ctx = await authUser(req.body);
    if (ctx.error) return res.status(ctx.error[0]).json({ error: ctx.error[1] });
    const account = pickAccount(ctx.accounts, req.body.openId);
    if (!account || !req.body.publishId) return res.status(400).json({ error: 'publishId e conta são obrigatórios' });
    const token = await tokenFor(account, ctx);
    const data = await fetchPublishStatus(token, req.body.publishId);
    res.status(200).json({ ok: true, ...data });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Falha ao consultar o status' });
  }
}

module.exports = { creatorInfo, post, status };
