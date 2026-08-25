const { loadUsers, saveUsers, recordGrowthSnapshot } = require('../_lib/users');
const { decryptToken } = require('../_lib/token-crypto');
const { getPageWeeklyInsights, getInstagramWeeklyInsights } = require('../_lib/meta');

// Coleta automática diária de seguidores/curtidas, pra alimentar o gráfico de
// crescimento do "Relatório das redes sociais" sem depender de alguém abrir a
// página (ver CLAUDE.md, "Crescimento de seguidores/curtidas ao longo do
// tempo"). Disparado pelo cron do Vercel (ver vercel.json, "crons") — mesmos
// planos que já têm acesso ao relatório de métricas (PLANS_WITH_INSIGHTS em
// social-insights.js).
const PLANS_WITH_INSIGHTS = ['especialista', 'personalizado'];

module.exports = async function handler(req, res) {
  // Vercel Cron manda Authorization: Bearer <CRON_SECRET> nas chamadas
  // automáticas — confere isso pra ninguém de fora poder disparar a coleta
  // (e gastar chamada da Graph API) só de saber a URL.
  const expected = process.env.CRON_SECRET;
  if (expected && req.headers.authorization !== `Bearer ${expected}`) {
    res.status(401).json({ error: 'Não autorizado' });
    return;
  }

  const users = await loadUsers();
  let changed = false;
  const summary = [];

  for (const user of users) {
    if (!PLANS_WITH_INSIGHTS.includes(user.plan)) continue;
    const pages = user.connections && user.connections.meta && user.connections.meta.pages;
    if (!Array.isArray(pages) || pages.length === 0) continue;

    for (const page of pages) {
      const pageAccessToken = decryptToken(page.pageAccessToken);

      try {
        const fb = await getPageWeeklyInsights(pageAccessToken, page.pageId);
        if (recordGrowthSnapshot(user, page.pageId, { fans: fb.fans })) changed = true;
        summary.push({ identifier: user.identifier, page: page.pageName, fans: fb.fans });
      } catch (error) {
        // Sem permissão ainda (falta reconectar) — pula essa página, não derruba a coleta inteira.
      }

      if (page.instagramBusinessId) {
        try {
          const ig = await getInstagramWeeklyInsights(pageAccessToken, page.instagramBusinessId);
          if (recordGrowthSnapshot(user, page.instagramBusinessId, { followers: ig.followers })) changed = true;
          summary.push({ identifier: user.identifier, page: page.instagramUsername, followers: ig.followers });
        } catch (error) {
          // idem
        }
      }
    }
  }

  if (changed) await saveUsers(users);

  res.status(200).json({ ok: true, collected: summary.length, summary });
};
