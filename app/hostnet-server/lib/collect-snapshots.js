const { loadUsers, saveUsers, recordGrowthSnapshot } = require('./users');
const { decryptToken } = require('./token-crypto');
const { getPageWeeklyInsights, getInstagramWeeklyInsights } = require('./meta');

// Coleta automática diária de seguidores/curtidas, pra alimentar o gráfico de
// crescimento do "Relatório das redes sociais" sem depender de alguém abrir a
// página. No Vercel isso dependia do "crons" do vercel.json (removido depois
// de quebrar o deploy — ver CLAUDE.md). Aqui, como o processo fica sempre
// ligado (não é serverless), um agendador simples dentro do próprio servidor
// (node-cron, ver server.js) já resolve, sem depender de nenhum recurso
// específico da plataforma de hospedagem.
const PLANS_WITH_INSIGHTS = ['especialista', 'personalizado'];

async function collectSnapshots() {
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
  return summary;
}

module.exports = { collectSnapshots };
