// Cota mensal de posts publicados nas redes sociais — hoje só o plano
// Iniciante tem teto (100/mês, definido por Franklin em 2026-09-03). Mesmo
// padrão de media-quota.js: checkPostQuota confere ANTES de publicar
// (bloqueia a chamada inteira se já estourou) e recordPostsPublished conta
// DEPOIS, só as publicações que realmente saíram (status 'ok'), pra não
// gastar cota em erro de rede/API.
const PLAN_POST_LIMITS = {
  iniciante: 100,
  // profissional, especialista, personalizado e teste7dias: sem entrada
  // aqui — "posts ilimitados por mês" continua valendo pra eles.
};

function currentMonthKey() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}`;
}

function postWindowBucket(user) {
  const key = currentMonthKey();
  return user.postWindow && user.postWindow.key === key ? user.postWindow : { key, count: 0 };
}

// Chamar ANTES de publicar de verdade. Não consome nada sozinho — só diz se
// a chamada pode prosseguir. Planos sem entrada em PLAN_POST_LIMITS passam
// sempre.
function checkPostQuota(user) {
  if (!user) return { allowed: true };
  const limit = PLAN_POST_LIMITS[user.plan];
  if (!limit) return { allowed: true };

  const bucket = postWindowBucket(user);
  if (bucket.count >= limit) {
    return {
      allowed: false,
      error: `Limite de ${limit} posts por mês do plano ${user.plan} atingido — já publicou ${bucket.count} esse mês. Peça upgrade de plano ou aguarde o próximo mês.`,
    };
  }
  return { allowed: true };
}

// Chamar DEPOIS de publicar, só com a quantidade de publicações que
// realmente deram certo. Quem chamar ainda precisa dar saveUsers(users)
// depois — essa função só muda o objeto do usuário em memória.
function recordPostsPublished(user, count = 1) {
  if (!user || count <= 0) return;
  if (!PLAN_POST_LIMITS[user.plan]) return;

  const bucket = postWindowBucket(user);
  bucket.count += count;
  user.postWindow = bucket;
}

module.exports = { checkPostQuota, recordPostsPublished, PLAN_POST_LIMITS };
