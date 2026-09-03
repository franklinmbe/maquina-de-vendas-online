// Cota de posts publicados nas redes sociais — hoje só o plano Iniciante tem
// teto: 2 posts por dia, máximo 60 por mês (definido por Franklin em
// 2026-09-03, revisando ainda no mesmo dia o teto anterior de 100/mês fixo).
// Mesmo padrão de media-quota.js/call-limit.js: checkPostQuota confere ANTES
// de publicar (bloqueia a chamada inteira se já estourou o dia OU o mês) e
// recordPostsPublished conta DEPOIS, só as publicações que realmente saíram
// (status 'ok'), pra não gastar cota em erro de rede/API.
const PLAN_POST_LIMITS = {
  iniciante: { perDay: 2, perMonth: 60 },
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

function currentDayKey() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function windowBucket(user, field, key) {
  return user[field] && user[field].key === key ? user[field] : { key, count: 0 };
}

// Chamar ANTES de publicar de verdade. Não consome nada sozinho — só diz se
// a chamada pode prosseguir. Planos sem entrada em PLAN_POST_LIMITS passam
// sempre. Checa o teto diário primeiro (é o que normalmente estoura antes),
// depois o mensal.
function checkPostQuota(user) {
  if (!user) return { allowed: true };
  const limits = PLAN_POST_LIMITS[user.plan];
  if (!limits) return { allowed: true };

  const dayBucket = windowBucket(user, 'postDayWindow', currentDayKey());
  if (dayBucket.count >= limits.perDay) {
    return {
      allowed: false,
      error: `Limite de ${limits.perDay} posts por dia do plano ${user.plan} atingido — já publicou ${dayBucket.count} hoje. Tente de novo amanhã ou peça upgrade de plano.`,
    };
  }

  const monthBucket = windowBucket(user, 'postWindow', currentMonthKey());
  if (monthBucket.count >= limits.perMonth) {
    return {
      allowed: false,
      error: `Limite de ${limits.perMonth} posts por mês do plano ${user.plan} atingido — já publicou ${monthBucket.count} esse mês. Peça upgrade de plano ou aguarde o próximo mês.`,
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

  const dayBucket = windowBucket(user, 'postDayWindow', currentDayKey());
  dayBucket.count += count;
  user.postDayWindow = dayBucket;

  const monthBucket = windowBucket(user, 'postWindow', currentMonthKey());
  monthBucket.count += count;
  user.postWindow = monthBucket;
}

module.exports = { checkPostQuota, recordPostsPublished, PLAN_POST_LIMITS };
