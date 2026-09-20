const { loadUsers, saveUsers, recordGrowthSnapshot } = require('./users');
const { decryptToken } = require('./token-crypto');
const { getFollowerCounts } = require('./meta');

// Coleta automática diária de seguidores, pra alimentar o crescimento do
// "Relatório das redes sociais" e do painel do usuário sem depender de alguém
// abrir a página. No Vercel isso dependia do "crons" do vercel.json (removido
// depois de quebrar o deploy — ver CLAUDE.md). Aqui, como o processo fica
// sempre ligado (não é serverless), um agendador simples dentro do próprio
// servidor (node-cron, ver server.js) já resolve.
//
// Usa só os contadores básicos (fan_count / followers_count), que funcionam
// mesmo enquanto as métricas avançadas do Meta (insights) estão bloqueadas
// — antes usava a chamada de insights, que falha no Instagram sem o acesso
// avançado, e por isso o crescimento do Instagram nunca era gravado. Vale pra
// todos os planos com conexão direta (o relatório de desempenho é liberado
// pra todos desde 2026-09-12).
async function collectSnapshots() {
  const users = await loadUsers();
  let changed = false;
  const summary = [];

  for (const user of users) {
    const pages = user.connections && user.connections.meta && user.connections.meta.pages;
    if (!Array.isArray(pages) || pages.length === 0) continue;

    for (const page of pages) {
      let pageAccessToken;
      try {
        pageAccessToken = decryptToken(page.pageAccessToken);
      } catch {
        continue; // token cifrado com chave antiga: precisa reconectar, não derruba a coleta dos outros
      }

      const counts = await getFollowerCounts(pageAccessToken, page.pageId, page.instagramBusinessId);
      if (counts.fans != null) {
        if (recordGrowthSnapshot(user, page.pageId, { fans: counts.fans })) changed = true;
        summary.push({ identifier: user.identifier, page: page.pageName, fans: counts.fans });
      }
      if (page.instagramBusinessId && counts.followers != null) {
        if (recordGrowthSnapshot(user, page.instagramBusinessId, { followers: counts.followers })) changed = true;
        summary.push({ identifier: user.identifier, page: page.instagramUsername, followers: counts.followers });
      }
    }
  }

  if (changed) await saveUsers(users);
  return summary;
}

module.exports = { collectSnapshots };
