// Limites de conexão de rede social por plano — ver CLAUDE.md ("Limite de
// redes sociais por plano"). Só o Iniciante tem restrição de QUAIS
// plataformas (só Meta = Facebook+Instagram juntos, sem TikTok/YouTube/
// Telegram/WordPress) — os outros planos só limitam a QUANTIDADE total de
// contas conectadas. `personalizado` (e qualquer plano não listado aqui)
// não tem limite.
const PLAN_LIMITS = { iniciante: 2, profissional: 5, especialista: 10, teste7dias: 3 };
const PLAN_ALLOWED_PLATFORMS = { iniciante: ['meta'] };

function planLimit(plan) {
  return PLAN_LIMITS[plan]; // undefined = sem limite
}

function platformAllowedForPlan(plan, platform) {
  const allowlist = PLAN_ALLOWED_PLATFORMS[plan];
  return !allowlist || allowlist.includes(platform);
}

// Quantas contas uma plataforma contribui hoje pro total (Facebook e
// Instagram contam separado, mesmo critério da aba Redes em
// connected-accounts.js) — sem chamar nenhuma API externa, só olhando o
// que já está salvo.
function countForPlatform(user, platform) {
  const conn = (user && user.connections) || {};
  if (platform === 'meta') {
    const pages = Array.isArray(conn.meta && conn.meta.pages) ? conn.meta.pages : [];
    return pages.reduce((sum, page) => sum + 1 + (page.instagramBusinessId ? 1 : 0), 0);
  }
  if (platform === 'tiktok') return Array.isArray(conn.tiktok) ? conn.tiktok.length : 0;
  return conn[platform] ? 1 : 0;
}

function countConnectedAccounts(user) {
  return ['meta', 'tiktok', 'youtube', 'telegram', 'wordpress'].reduce(
    (sum, platform) => sum + countForPlatform(user, platform),
    0
  );
}

// Chamar antes de saveUserConnection(). `newCountForPlatform` é quantas
// contas essa plataforma vai ter DEPOIS de salvar essa conexão (não
// "quantas está adicionando") — pra reconectar uma plataforma que já
// tinha conexão (troca o token, não soma de novo) não ser barrado sem
// necessidade. Ex Meta: 1 (só Facebook) ou 2 (com Instagram vinculado).
// TikTok (multi-conta): soma da lista depois do dedupe.
function checkPlanAllowsConnection(user, platform, newCountForPlatform = 1) {
  const plan = user && user.plan;
  if (!platformAllowedForPlan(plan, platform)) {
    return { ok: false, error: 'Seu plano não inclui essa rede social — fale com o Franklin pra fazer upgrade.' };
  }
  const limit = planLimit(plan);
  if (limit == null) return { ok: true };
  const projectedTotal = countConnectedAccounts(user) - countForPlatform(user, platform) + newCountForPlatform;
  if (projectedTotal > limit) {
    return { ok: false, error: `Seu plano permite até ${limit} redes sociais conectadas — fale com o Franklin pra fazer upgrade.` };
  }
  return { ok: true };
}

module.exports = {
  PLAN_LIMITS,
  planLimit,
  platformAllowedForPlan,
  countConnectedAccounts,
  checkPlanAllowsConnection,
};
