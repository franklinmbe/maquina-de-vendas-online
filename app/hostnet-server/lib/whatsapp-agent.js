const { listFichas } = require('./fichas');

function formatFichaStatus(ficha) {
  const data = new Date(ficha.updatedAt).toLocaleDateString('pt-BR');
  return `Ficha de ${ficha.item}: status atual "${ficha.status}" (atualizado em ${data}).`;
}

// Bot de regras, sem IA — responde consulta de status de ficha pelo telefone
// de quem escreveu. Escopo combinado com Franklin (ver CLAUDE.md, produto
// "Aplicativo" — modelo RN Cell): só suporte/status de atendimento, nunca
// venda. Sem IA de propósito: é dado real (a ficha), não texto gerado — um
// bot determinístico não tem risco de inventar status errado, e não tem
// custo de API por mensagem. Se um dia quiser conversas mais livres aqui,
// isso vira uma decisão separada (precisa de ANTHROPIC_API_KEY e orçamento
// por mensagem, nenhum dos dois configurado hoje neste servidor).
function buildReply(client, fromPhone) {
  const fichas = listFichas(client, { contato: fromPhone });
  if (fichas.length === 0) {
    return {
      text: 'Não encontrei nenhuma ficha aberta com esse número. Vou avisar a loja pra verificar direitinho com você.',
      escalate: true,
    };
  }
  const lines = fichas.slice(0, 3).map(formatFichaStatus);
  return { text: lines.join('\n'), escalate: false };
}

module.exports = { buildReply };
