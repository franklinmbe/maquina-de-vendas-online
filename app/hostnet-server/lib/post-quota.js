// Cota de posts publicados nas redes sociais — hoje só o plano Iniciante tem
// teto: 10 posts por dia, máximo 300 por mês (era 2/dia e 60/mês; Franklin 2026-11-05) (definido por Franklin em
// 2026-09-03, revisando ainda no mesmo dia o teto anterior de 100/mês fixo).
// Mesmo padrão de media-quota.js/call-limit.js: checkPostQuota confere ANTES
// de publicar (bloqueia a chamada inteira se já estourou o dia OU o mês) e
// recordPostsPublished conta DEPOIS, só as publicações que realmente saíram
// (status 'ok'), pra não gastar cota em erro de rede/API.
// Franklin, 2026-11-18: todo plano tem teto, que acompanha o preço
// (R$100 → 10/dia, R$200 → 20, R$300 → 30, R$400 → 40, R$500 → 50; por mês
// = 30× o do dia). Ex.: app com 5 vendedores × 10 posts = 50/dia. O mesmo
// teto vale pros anúncios que viram no Meta (lib/virar-anuncio.js).
const PLAN_POST_LIMITS = {
  iniciante: { perDay: 10, perMonth: 300 },
  profissional: { perDay: 20, perMonth: 600 },
  especialista: { perDay: 30, perMonth: 900 },
  personalizado: { perDay: 40, perMonth: 1200 },
  'aplicativo-saas': { perDay: 50, perMonth: 1500 },
  teste7dias: { perDay: 10, perMonth: 300 },
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
  // Admin (Franklin, 18/11) não tem limite de postagem.
  if (!user || user.client === 'frank') return { allowed: true };
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
  if (!PLAN_POST_LIMITS[user.plan] || user.client === 'frank') return;

  const dayBucket = windowBucket(user, 'postDayWindow', currentDayKey());
  dayBucket.count += count;
  user.postDayWindow = dayBucket;

  const monthBucket = windowBucket(user, 'postWindow', currentMonthKey());
  monthBucket.count += count;
  user.postWindow = monthBucket;
}

module.exports = { checkPostQuota, recordPostsPublished, PLAN_POST_LIMITS };
