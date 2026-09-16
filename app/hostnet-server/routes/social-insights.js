const { loadUsers, saveUsers, findUser, verifyPassword, recordGrowthSnapshot } = require('../lib/users');
const { decryptToken } = require('../lib/token-crypto');
const { getPageWeeklyInsights, getInstagramWeeklyInsights, getInstagramTopPosts } = require('../lib/meta');

const MAX_RANGE_DAYS = 90;

// Período do relatório — padrão 7 dias, ou o que o cliente escolher no
// seletor de "7 dias / 30 dias / Personalizado" (relatorio-redes.html).
// `since`/`until` chegam como "YYYY-MM-DD" (input type="date" nativo do
// celular). Nunca deixa passar um intervalo maior que MAX_RANGE_DAYS — evita
// abuso e consultas gigantes na Graph API; corta o "until" se precisar.
function resolveRange({ days, since, until }) {
  const now = Math.floor(Date.now() / 1000);
  if (since && until) {
    const sinceMs = Date.parse(`${since}T00:00:00Z`);
    const untilMs = Date.parse(`${until}T23:59:59Z`);
    if (!Number.isNaN(sinceMs) && !Number.isNaN(untilMs) && sinceMs < untilMs) {
      const sinceTs = Math.floor(sinceMs / 1000);
      let untilTs = Math.min(Math.floor(untilMs / 1000), now);
      const maxSpan = MAX_RANGE_DAYS * 24 * 60 * 60;
      if (untilTs - sinceTs > maxSpan) untilTs = sinceTs + maxSpan;
      return { since: sinceTs, until: untilTs };
    }
  }
  const parsedDays = Math.min(Math.max(parseInt(days, 10) || 7, 1), MAX_RANGE_DAYS);
  return { since: now - parsedDays * 24 * 60 * 60, until: now };
}

// Métricas de desempenho de rede social — liberado pra todos os planos
// (decisão do Franklin, 2026-09-12: relatório é indispensável pra motivar o
// cliente a continuar assinando, não faz sentido reservar só pro topo).
// Continua dependendo, de qualquer plano, de a rede estar conectada direto
// via OAuth (ver reason 'sem-conexao'/'sem-permissao' abaixo) — quem publica
// só via Postiz (ex: Kleber hoje) não tem token pra puxar Insights do Meta.

// O histórico de crescimento também é gravado aqui (além da coleta automática
// diária em api/cron/collect-social-snapshots.js) — assim ele já aparece
// mesmo pra quem abrir o relatório antes do primeiro cron rodar.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, days, since, until } = req.body || {};
  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  const range = resolveRange({ days, since, until });

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
      entry.facebook = await getPageWeeklyInsights(pageAccessToken, page.pageId, range);
      if (recordGrowthSnapshot(user, page.pageId, { fans: entry.facebook.fans })) historyChanged = true;
    } catch (error) {
      if (/permission|scope|OAuthException/i.test(error.message)) permissionError = true;
    }

    if (page.instagramBusinessId) {
      try {
        entry.instagram = await getInstagramWeeklyInsights(pageAccessToken, page.instagramBusinessId, range);
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
