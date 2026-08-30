const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { decryptToken } = require('../lib/token-crypto');
const { getPageAvatar, getInstagramAvatar } = require('../lib/meta');
const { getUserInfo: getTikTokUserInfo, refreshAccessToken: refreshTikTokToken } = require('../lib/tiktok');
const { getChannelInfo, refreshAccessToken: refreshYouTubeToken } = require('../lib/youtube');

// Lista achatada de todas as contas conectadas de um cliente, com nome e
// foto de perfil buscados ao vivo em cada rede (nunca ficam salvos, porque
// mudam com o tempo). Cada plataforma que falhar (token vencido demais,
// rede fora do ar, etc.) some da lista silenciosamente em vez de derrubar
// as outras — mesmo padrão de graphGetSafe já usado no resto do projeto.
async function accountsForUser(user) {
  const accounts = [];
  const conn = user.connections || {};

  if (Array.isArray(conn.meta?.pages)) {
    await Promise.all(
      conn.meta.pages.map(async (page) => {
        let pageAccessToken = null;
        try {
          pageAccessToken = decryptToken(page.pageAccessToken);
        } catch {
          // token ilegível (ex: cifrado com chave antiga) — sem foto, mantém o nome
        }

        let fbAvatar = null;
        let igAvatar = null;
        if (pageAccessToken) {
          [fbAvatar, igAvatar] = await Promise.all([
            getPageAvatar(pageAccessToken, page.pageId),
            page.instagramBusinessId ? getInstagramAvatar(pageAccessToken, page.instagramBusinessId) : Promise.resolve(null),
          ]);
        }

        accounts.push({ platform: 'facebook', name: page.pageName || 'Facebook', avatarUrl: fbAvatar });
        if (page.instagramBusinessId) {
          accounts.push({
            platform: 'instagram',
            name: page.instagramUsername || page.pageName || 'Instagram',
            avatarUrl: igAvatar,
          });
        }
      })
    );
  }

  if (Array.isArray(conn.tiktok)) {
    await Promise.all(
      conn.tiktok.map(async (tt) => {
        let name = tt.displayName || null;
        let avatarUrl = null;
        try {
          let accessToken = decryptToken(tt.accessToken);
          if (Date.now() >= tt.expiresAt - 60000) {
            const refreshToken = decryptToken(tt.refreshToken);
            const refreshed = await refreshTikTokToken(refreshToken);
            accessToken = refreshed.accessToken;
          }
          const info = await getTikTokUserInfo(accessToken);
          name = info.displayName || name;
          avatarUrl = info.avatarUrl;
        } catch {
          // token vencido/irrecuperável — mantém o nome que já tinha salvo, sem foto
        }
        accounts.push({ platform: 'tiktok', name: name || 'TikTok', avatarUrl });
      })
    );
  }

  if (conn.youtube) {
    let name = null;
    let avatarUrl = null;
    try {
      let accessToken = decryptToken(conn.youtube.accessToken);
      if (Date.now() >= conn.youtube.expiresAt - 60000) {
        const refreshToken = decryptToken(conn.youtube.refreshToken);
        const refreshed = await refreshYouTubeToken(refreshToken);
        accessToken = refreshed.accessToken;
      }
      const info = await getChannelInfo(accessToken);
      name = info.title;
      avatarUrl = info.avatarUrl;
    } catch {
      // idem — sem canal legível, entra só com nome genérico
    }
    accounts.push({ platform: 'youtube', name: name || 'YouTube', avatarUrl });
  }

  if (conn.telegram) {
    accounts.push({
      platform: 'telegram',
      name: conn.telegram.title || conn.telegram.username || 'Telegram',
      avatarUrl: null, // API do Telegram não entrega foto direto, fica com o ícone da rede
    });
  }

  if (conn.wordpress) {
    accounts.push({
      platform: 'wordpress',
      name: conn.wordpress.name || conn.wordpress.siteUrl || 'WordPress',
      avatarUrl: null,
    });
  }

  return accounts;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  const users = await loadUsers();

  let targetUsers;
  let isAdmin = false;

  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    // Login legado (senha mestra): mesmo comportamento de social-report.js —
    // conta como admin e enxerga todo mundo, inclusive a conta real do
    // Franklin (franklinmbe@gmail.com) já presente em `users`.
    isAdmin = true;
    targetUsers = users;
  } else {
    const user = findUser(users, identifier);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
      return;
    }
    isAdmin = user.client === 'frank';
    targetUsers = isAdmin ? users : [user];
  }

  try {
    const groups = await Promise.all(
      targetUsers.map(async (u) => ({
        client: u.client,
        name: u.name,
        identifier: u.identifier,
        plan: u.plan,
        accounts: await accountsForUser(u),
      }))
    );
    const accounts = groups.flatMap((g) => g.accounts.map((a) => ({ ...a, client: g.client })));
    // Clientes já liberados (admin_set_account) mas que ainda não conectaram
    // nenhuma rede social de verdade — pra aparecerem como "pendente" na aba
    // Redes do Franklin assim que ele libera o acesso, mesmo sem token ainda.
    const pendingClients = isAdmin
      ? groups
          .filter((g) => g.client !== 'frank' && g.accounts.length === 0)
          .map((g) => ({ client: g.client, name: g.name, identifier: g.identifier, plan: g.plan }))
      : [];
    res.status(200).json({ ok: true, admin: isAdmin, accounts, pendingClients });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao carregar contas conectadas' });
  }
};
