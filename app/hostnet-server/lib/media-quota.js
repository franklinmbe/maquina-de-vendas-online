// Cota mensal de imagens/vídeos gerados por IA, por plano (ver CLAUDE.md,
// seção "Planos de venda e roteamento de produção de vídeo") — mesmo padrão
// de call-limit.js: quem está processando o pedido (Claude, numa sessão)
// chama isso ANTES de gerar cada imagem/vídeo, nunca depois.
const PLAN_MEDIA_LIMITS = {
  iniciante: { images: 10, videos: 4 },
  profissional: { images: 90, videos: 10 },
  especialista: { images: 150, videos: 30 },
  // teste7dias não usa PLAN_MEDIA_LIMITS — tem cota própria pro período de
  // 7 dias inteiro, não mensal (ver checkAndConsumeTrialMedia).
  // personalizado e qualquer plano não listado: sem teto.
};

const TRIAL_MEDIA_LIMITS = { images: 10, videos: 2 };
const TRIAL_DAYS = 7;

function currentMonthKey() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}`;
}

const TYPE_LABEL = { images: 'imagens', videos: 'vídeos' };

// Teste Grátis 7 Dias: cota fixa (10 imagens / 2 vídeos) pro período inteiro
// de 7 dias a partir do cadastro (user.createdAt), não mensal.
function checkAndConsumeTrialMedia(user, type, count) {
  const limit = TRIAL_MEDIA_LIMITS[type];
  const createdAt = user.createdAt ? new Date(user.createdAt) : null;
  const trialEndsAt = createdAt ? new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000) : null;
  if (trialEndsAt && Date.now() > trialEndsAt.getTime()) {
    return { allowed: false, error: 'Seu teste grátis de 7 dias expirou — peça pra assinar um plano.' };
  }

  user.trialMediaUsed = user.trialMediaUsed || { images: 0, videos: 0 };
  const existing = user.trialMediaUsed[type] || 0;
  if (existing + count > limit) {
    return {
      allowed: false,
      error: `Limite de ${limit} ${TYPE_LABEL[type]} do teste grátis (7 dias) atingido — já usou ${existing}. Peça pra assinar um plano.`,
    };
  }

  user.trialMediaUsed[type] = existing + count;
  return { allowed: true };
}

// type: 'images' | 'videos'. `count` é quantas unidades esse pedido
// específico está gerando (pode ser mais de uma de uma vez, ex: 3 banners).
// Confere e já consome do plano do usuário-alvo. Planos sem entrada em
// PLAN_MEDIA_LIMITS (admin, personalizado, plano não reconhecido) passam
// sem limite. Só grava o incremento quando permite — quem chamar ainda
// precisa dar saveUsers(users) depois.
function checkAndConsumeMedia(user, type, count = 1) {
  if (!user) return { allowed: true };
  if (type !== 'images' && type !== 'videos') return { allowed: true };
  if (user.plan === 'teste7dias') return checkAndConsumeTrialMedia(user, type, count);

  const limits = PLAN_MEDIA_LIMITS[user.plan];
  if (!limits) return { allowed: true };
  const limit = limits[type];

  const key = currentMonthKey();
  const bucket = user.mediaWindow && user.mediaWindow.key === key ? user.mediaWindow : { key, images: 0, videos: 0 };
  const existing = bucket[type] || 0;

  if (existing + count > limit) {
    return {
      allowed: false,
      error: `Limite de ${limit} ${TYPE_LABEL[type]} por IA/mês atingido pro plano ${user.plan} — já usou ${existing} esse mês. Peça upgrade de plano ou aguarde o próximo mês.`,
    };
  }

  bucket[type] = existing + count;
  user.mediaWindow = bucket;
  return { allowed: true };
}

module.exports = { checkAndConsumeMedia, PLAN_MEDIA_LIMITS, TRIAL_MEDIA_LIMITS };
