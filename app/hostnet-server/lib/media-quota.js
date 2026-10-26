// Cota mensal de imagens/vídeos gerados por IA, por plano (ver CLAUDE.md,
// seção "Planos de venda e roteamento de produção de vídeo") — mesmo padrão
// de call-limit.js: quem está processando o pedido (Claude, numa sessão)
// chama isso ANTES de gerar cada imagem/vídeo, nunca depois.
const PLAN_MEDIA_LIMITS = {
  iniciante: { images: 30, videos: 7 }, // 3 em movimento + 4 comuns (Franklin, 2026-10-11)
  profissional: { images: 90, videos: 10 },
  especialista: { images: 150, videos: 30 },
  'aplicativo-saas': { images: 150, videos: 30 }, // Treinamento = recursos do Especialista (2026-10-11)
  // teste7dias não usa PLAN_MEDIA_LIMITS — tem cota própria pro período de
  // 7 dias inteiro, não mensal (ver checkAndConsumeTrialMedia).
  // Personalizado com a cota do Especialista (Franklin, 2026-10-11). O admin
  // (frank) nunca tem teto, mesmo estando marcado como personalizado.
  personalizado: { images: 150, videos: 30 },
};

// Vídeos em movimento (Veo, 8 s, botão do composer) por mês — Franklin,
// 2026-10-05. É um sub-limite: cada um também gasta 1 vídeo da cota acima.
// Teste grátis fica só com os 2 vídeos dele; admin (frank) sem teto.
const PLAN_MOTION_LIMITS = { iniciante: 3, profissional: 4, especialista: 8, 'aplicativo-saas': 8, personalizado: 8 };

// Planos que já passaram pra créditos (Franklin, 2026-10-26): em vez de
// "X imagens + Y vídeos", o plano dá N créditos por mês e cada coisa gasta
// um tanto. Vídeo em movimento = vídeo comum (15) + 20 a mais = 35. Os
// créditos do plano zeram todo mês; os comprados (lib/creditos.js) são outra
// coisa e não vencem. Plano aqui ignora PLAN_MEDIA_LIMITS/PLAN_MOTION_LIMITS.
const PLAN_CREDITS = { iniciante: 300 };
const CREDIT_COST = { images: 2, videos: 15, motionExtra: 20 };

const ADMIN_CLIENT = 'frank';
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
// PLAN_MEDIA_LIMITS (admin frank, plano não reconhecido) passam
// sem limite. Só grava o incremento quando permite — quem chamar ainda
// precisa dar saveUsers(users) depois.
function checkAndConsumeMedia(user, type, count = 1) {
  if (!user) return { allowed: true };
  if (type !== 'images' && type !== 'videos') return { allowed: true };
  if (user.client === ADMIN_CLIENT) return { allowed: true };
  if (user.plan === 'teste7dias') return checkAndConsumeTrialMedia(user, type, count);
  if (PLAN_CREDITS[user.plan]) return spendPlanCredits(user, CREDIT_COST[type] * count, type, count);

  const limits = PLAN_MEDIA_LIMITS[user.plan];
  if (!limits) return { allowed: true };
  const limit = limits[type];

  const key = currentMonthKey();
  const bucket = user.mediaWindow && user.mediaWindow.key === key ? user.mediaWindow : { key, images: 0, videos: 0 };
  const existing = bucket[type] || 0;

  if (existing + count > limit) {
    return {
      allowed: false,
      error: `Limite de ${limit} ${TYPE_LABEL[type]} por IA/mês atingido pro plano ${user.plan} — já usou ${existing} esse mês. Peça upgrade de plano ou aguarde o próximo mês.${type === 'videos' ? CREDITOS_DICA : ''}`,
    };
  }

  bucket[type] = existing + count;
  user.mediaWindow = bucket;
  return { allowed: true };
}

// Acabou o vídeo do plano: dá pra continuar pagando com créditos (Franklin,
// 2026-10-26), na aba 🎬 Especial do Cut Studio Pro.
const CREDITOS_DICA = ' Ou continue agora com créditos: Cut Studio Pro → aba 🎬 Especial (a partir de R$ 15).';

// Vídeo em movimento: confere e consome 1 do sub-limite mensal do plano.
// Mesmo balde mensal (user.mediaWindow) das imagens/vídeos.
function checkAndConsumeMotion(user) {
  if (!user || user.client === ADMIN_CLIENT) return { allowed: true };
  if (PLAN_CREDITS[user.plan]) {
    const r = spendPlanCredits(user, CREDIT_COST.motionExtra, 'motion', 1);
    return r.allowed ? r : { allowed: false, error: `Os créditos do seu plano deste mês não dão pra mais um vídeo em movimento — o vídeo saiu sem movimento.${CREDITOS_DICA}` };
  }
  const limit = PLAN_MOTION_LIMITS[user.plan];
  if (limit == null) return { allowed: true };

  const key = currentMonthKey();
  const bucket = user.mediaWindow && user.mediaWindow.key === key ? user.mediaWindow : { key, images: 0, videos: 0 };
  const existing = bucket.motion || 0;
  if (existing + 1 > limit) {
    return {
      allowed: false,
      error: `Limite de ${limit} vídeos em movimento/mês atingido pro plano ${user.plan} — o vídeo saiu sem movimento. Peça upgrade de plano ou aguarde o próximo mês.${CREDITOS_DICA}`,
    };
  }
  bucket.motion = existing + 1;
  user.mediaWindow = bucket;
  return { allowed: true };
}

// Devolve 1 do sub-limite quando o Veo falhou e o pedido caiu no slideshow
// (o cliente não recebeu o vídeo em movimento, então não conta).
function refundMotion(user) {
  if (!user || !user.mediaWindow || user.mediaWindow.key !== currentMonthKey()) return;
  user.mediaWindow.motion = Math.max(0, (user.mediaWindow.motion || 0) - 1);
  if (PLAN_CREDITS[user.plan]) user.mediaWindow.credits = Math.max(0, (user.mediaWindow.credits || 0) - CREDIT_COST.motionExtra);
}

// Gasta créditos do plano no balde do mês. Também soma a quantidade por tipo
// (images/videos/motion), que o relatório e o Cut Estúdio mostram.
function spendPlanCredits(user, cost, type, count) {
  const limit = PLAN_CREDITS[user.plan];
  const key = currentMonthKey();
  const bucket = user.mediaWindow && user.mediaWindow.key === key ? user.mediaWindow : { key, images: 0, videos: 0 };
  const used = bucket.credits || 0;
  if (used + cost > limit) {
    return {
      allowed: false,
      error: `Os ${limit} créditos do seu plano neste mês acabaram (restam ${limit - used}, este pedido precisa de ${cost}). Peça upgrade de plano ou aguarde o próximo mês.${CREDITOS_DICA}`,
    };
  }
  bucket.credits = used + cost;
  bucket[type] = (bucket[type] || 0) + count;
  user.mediaWindow = bucket;
  return { allowed: true };
}

// Saldo do mês (só leitura, não consome) — barrinha do Cut Estúdio.
// null = sem teto (admin frank ou plano sem limite).
function getMediaUsage(user) {
  if (!user || user.client === ADMIN_CLIENT) return null;
  if (user.plan === 'teste7dias') {
    const used = user.trialMediaUsed || {};
    return {
      images: { used: used.images || 0, limit: TRIAL_MEDIA_LIMITS.images },
      videos: { used: used.videos || 0, limit: TRIAL_MEDIA_LIMITS.videos },
      motion: null,
      periodo: '7 dias',
    };
  }
  const bucket = user.mediaWindow && user.mediaWindow.key === currentMonthKey() ? user.mediaWindow : {};
  const credLimit = PLAN_CREDITS[user.plan];
  if (credLimit) {
    // Plano em créditos: o "limite" de cada tipo é o que ainda cabe no saldo.
    const rest = Math.max(0, credLimit - (bucket.credits || 0));
    const cabe = (used, custo) => ({ used: used || 0, limit: (used || 0) + Math.floor(rest / custo) });
    return {
      creditos: { used: bucket.credits || 0, limit: credLimit },
      images: cabe(bucket.images, CREDIT_COST.images),
      videos: cabe(bucket.videos, CREDIT_COST.videos),
      motion: cabe(bucket.motion, CREDIT_COST.videos + CREDIT_COST.motionExtra),
      periodo: 'mês',
    };
  }
  const limits = PLAN_MEDIA_LIMITS[user.plan];
  if (!limits) return null;
  const motionLimit = PLAN_MOTION_LIMITS[user.plan];
  return {
    images: { used: bucket.images || 0, limit: limits.images },
    videos: { used: bucket.videos || 0, limit: limits.videos },
    motion: motionLimit == null ? null : { used: bucket.motion || 0, limit: motionLimit },
    periodo: 'mês',
  };
}

module.exports = { getMediaUsage, checkAndConsumeMedia, checkAndConsumeMotion, refundMotion, PLAN_CREDITS, CREDIT_COST, PLAN_MEDIA_LIMITS, PLAN_MOTION_LIMITS, TRIAL_MEDIA_LIMITS };
