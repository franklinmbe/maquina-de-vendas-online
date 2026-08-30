// Limite diário de "chamadas" por plano (definido por Franklin em
// 2026-08-30) — soma pedido de conteúdo (banner/foto/vídeo) e pergunta de
// suporte no mesmo contador, dividido em 3 janelas por dia (manhã/tarde/
// noite, horário de Brasília). Ver CLAUDE.md, seção "Suporte pelo Claude na
// caixa de pedido + limite de chamadas por dia".
const PLAN_CALL_LIMITS = {
  iniciante: 2,
  teste7dias: 2,
  profissional: 3,
  especialista: 10,
  // Personalizado usa o mesmo teto do Especialista por padrão — ajustável
  // caso a caso se a empresa contratante precisar de mais (não é rígido
  // como os outros planos, mas precisa de UM valor pra não ficar sem teto).
  personalizado: 10,
};

const WINDOW_LABEL = { manha: 'da manhã', tarde: 'da tarde', noite: 'da noite' };

// Janelas cobrindo o dia inteiro (horário de Brasília): manhã 00h–12h, tarde
// 12h–18h, noite 18h–24h. "Manhã" fica mais longa de propósito pra cobrir a
// madrugada também, sem criar uma 4ª janela que Franklin não pediu.
function currentWindow() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour);
  const period = hour < 12 ? 'manha' : hour < 18 ? 'tarde' : 'noite';
  return { key: `${parts.year}-${parts.month}-${parts.day}-${period}`, period };
}

// Confere e já consome uma chamada da janela atual pro plano do usuário-alvo
// do pedido (o `user` passado deve ser o dono do plano — ver planOwner em
// commit.js/schedule-post.js, mesmo padrão do teto de agendamento). Planos
// sem entrada em PLAN_CALL_LIMITS (conta do Franklin/admin, ou plano não
// reconhecido) passam sem limite. Só grava o incremento quando permite —
// quem chamar essa função ainda precisa dar `saveUsers(users)` depois.
function checkAndConsumeCall(user) {
  if (!user) return { allowed: true };
  const limit = PLAN_CALL_LIMITS[user.plan];
  if (!limit) return { allowed: true };

  const { key, period } = currentWindow();
  const existing = user.callWindow && user.callWindow.key === key ? user.callWindow.count : 0;

  if (existing >= limit) {
    return {
      allowed: false,
      error: `Limite de ${limit} chamadas ${WINDOW_LABEL[period]} atingido pro seu plano. Tente de novo na próxima janela (manhã/tarde/noite) ou peça upgrade de plano.`,
    };
  }

  user.callWindow = { key, count: existing + 1 };
  return { allowed: true };
}

module.exports = { checkAndConsumeCall, PLAN_CALL_LIMITS };
