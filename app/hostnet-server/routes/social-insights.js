const { loadUsers, saveUsers, findUser, verifyPassword, recordGrowthSnapshot } = require('../lib/users');
const { decryptToken } = require('../lib/token-crypto');
const { getPageWeeklyInsights, getInstagramWeeklyInsights, getInstagramTopPosts } = require('../lib/meta');

// Métricas de desempenho de rede social — exclusivo dos planos Especialista +
// Gestor de Tráfego e Personalizado (decisão do Franklin, 2026-08-25). Os
// planos abaixo continuam vendo só o "Relatório das redes sociais" básico
// (plano + redes conectadas, via /api/social-report), sem essas métricas.
const PLANS_WITH_INSIGHTS = ['especialista', 'personalizado'];

// O histórico de crescimento também é gravado aqui (além da coleta automática
// diária em api/cron/collect-social-snapshots.js) — assim ele já aparece
// mesmo pra quem abrir o relatório antes do primeiro cron rodar.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  if (!PLANS_WITH_INSIGHTS.includes(user.plan)) {
    res.status(200).json({ ok: true, available: false, reason: 'plano' });
    return;
  }

  const metaConnection = user.connections && user.connections.meta;
  if (!metaConnection || !Array.isArray(metaConnection.pages) || metaConnection.pages.length === 0) {
    res.status(200).json({ ok: true, available: false, reason: 'sem-conexao' });
    return;
  }

  const pagesReport = [];
  let permissionError = false;
  let historyChanged = false;

  for (const page of metaConnection.pages) {
    const pageAccessToken = decryptToken(page.pageAccessToken);
    const entry = { pageName: page.pageName, instagramUsername: page.instagramUsername };

    try {
      entry.facebook = await getPageWeeklyInsights(pageAccessToken, page.pageId);
      if (recordGrowthSnapshot(user, page.pageId, { fans: entry.facebook.fans })) historyChanged = true;
    } catch (error) {
      if (/permission|scope|OAuthException/i.test(error.message)) permissionError = true;
    }

    if (page.instagramBusinessId) {
      try {
        entry.instagram = await getInstagramWeeklyInsights(pageAccessToken, page.instagramBusinessId);
        if (recordGrowthSnapshot(user, page.instagramBusinessId, { followers: entry.instagram.followers })) historyChanged = true;
        entry.topPosts = await getInstagramTopPosts(pageAccessToken, page.instagramBusinessId, 5);
      } catch (error) {
        if (/permission|scope|OAuthException/i.test(error.message)) permissionError = true;
      }
    }

    entry.growthHistory = (user.growthHistory || []).filter(
      (s) => s.pageId === page.pageId || s.pageId === page.instagramBusinessId
    );

    pagesReport.push(entry);
  }

  if (historyChanged) await saveUsers(users);

  const anyData = pagesReport.some((p) => p.facebook || p.instagram);
  if (!anyData && permissionError) {
    // Conexão feita antes das permissões de insights existirem (ver
    // buildAuthorizeUrl em _lib/meta.js) — precisa reconectar a rede.
    res.status(200).json({ ok: true, available: false, reason: 'sem-permissao' });
    return;
  }

  res.status(200).json({ ok: true, available: true, pages: pagesReport });
};
