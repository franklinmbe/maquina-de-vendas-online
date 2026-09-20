// Obrigações do CNPJ / MEI — resumo mantido à mão (por Franklin+Claude) da
// situação fiscal do CNPJ, do que está pendente e do que fazer, em português
// simples. É o ÚNICO dono dessa informação no app: o Extrato da operação só
// tem um ponteiro pra cá (e a contagem dos vencimentos, que vem de lá).
//
// Regras: nunca inventar valor, data ou situação — só o que foi lido na
// Receita/PGFN (ver `lidoEm` e `fonte`) ou dito por Franklin. Quando
// Franklin (logado no gov.br numa aba do navegador) pedir, reler a Receita e
// atualizar este arquivo + ATUALIZADO_EM.
const { calcularExtrato } = require('./custos-operacao');

const ATUALIZADO_EM = '2026-09-20';

const RESUMO =
  'Seu CNPJ deixou de ser MEI em 01/01/2026 (a Receita tirou). Existe uma Dívida Ativa da União de DAS-MEI antigo que ainda dá para negociar. Falta um contador dizer quais tributos valem agora, para nada juntar e atrasar de novo.';

const SITUACAO = {
  cnpj: '22.934.417/0001-64',
  simples: 'NÃO optante',
  simei: 'NÃO enquadrado (não é MEI)',
  lidoEm: '2026-09-20',
  fonte: 'Consulta Optantes (Receita Federal) e "Minhas Dívidas e Pendências" (gov.br), lidas em 20/09/2026',
  historico:
    'O CNPJ foi Simples Nacional e MEI de 27/07/2015 a 31/12/2025. Saiu por "ato administrativo" da Receita Federal (a Receita tirou o CNPJ do regime, você não pediu). Não há evento futuro marcado.',
  cpf: 'Situação cadastral do CPF: regular. A única pendência achada foi a Dívida Ativa da União abaixo. A Situação Fiscal do CNPJ em si ainda não foi lida.',
  consequencia:
    'Como o CNPJ não é mais MEI, NÃO existe DAS-MEI mensal de 2026. Ele está em outro regime, com outros tributos e declarações, que ainda precisam ser definidos com um contador.',
};

const PENDENCIAS = [
  {
    gravidade: 'urgente',
    titulo: 'Dívida Ativa da União — inscrição 70.4.26.099629-42',
    oQueE:
      'Imposto do MEI (DAS-MEI) que ficou sem pagar e foi enviado para a cobrança da Procuradoria (PGFN). Inscrita em 30/03/2026, processo 12376.659.136/2026-99.',
    situacao:
      'Situação "ativa a ser ajuizada": a PGFN ainda NÃO entrou com ação na Justiça, então ainda dá para negociar ou parcelar. Depois de ajuizada, pode virar ação com custas.',
    valor: null,
    valorNota: 'O valor não aparece na Receita. Só aparece no Portal Regularize da PGFN.',
    proximoPasso: 'Entrar no Portal Regularize com o gov.br, ver o valor e escolher pagar à vista ou parcelar.',
  },
  {
    gravidade: 'atencao',
    titulo: 'Débito novo 2024 — exclusão do Simples (2025)',
    oQueE:
      'Dívida ligada ao Termo de Exclusão nº 202503125076 (01/08/2025). Estava anotada como "ainda não parcelada".',
    situacao:
      'Provavelmente é a mesma coisa que a Dívida Ativa acima, mas isso NÃO foi confirmado. Enquanto não for paga ou parcelada, cresce com juros e pode travar a volta ao MEI/Simples.',
    valor: 1103.67,
    valorNota: 'Valor anotado antes; conferir no Portal Regularize se ainda é esse.',
    proximoPasso: 'Conferir no Regularize se é a mesma inscrição e tratar as duas juntas.',
  },
  {
    gravidade: 'atencao',
    titulo: 'Tributos e declarações do regime atual (a definir com contador)',
    oQueE:
      'Tudo que o CNPJ tem que pagar e declarar todo mês agora que saiu do MEI: tributos, honorário contábil e outras obrigações.',
    situacao: 'Sem lista, sem valor e sem dia de vencimento ainda. Sem isso, o atraso pode se acumular sem você ver.',
    valor: null,
    valorNota: null,
    proximoPasso: 'Falar com um contador e levar este resumo.',
  },
  {
    gravidade: 'conferir',
    titulo: 'Declaração anual do MEI (DASN-SIMEI)',
    oQueE:
      'Declaração que o MEI entrega uma vez por ano, até 31 de maio, com o faturamento do ano anterior.',
    situacao:
      'Não sei se as dos anos anteriores foram entregues, inclusive a de 2025, ano em que o CNPJ saiu do MEI. Não foi conferido.',
    valor: null,
    valorNota: null,
    proximoPasso: 'Pedir ao contador para conferir se está tudo entregue.',
  },
];

const PASSOS = [
  'ANTES de pagar a guia que vence em 21/09: veja o nome e o período que aparecem nela. Um DAS-MEI de 2026 não deveria existir. Se for de período até 12/2025, ou da dívida ativa, tudo bem.',
  'Entre no Portal Regularize (link abaixo) com o gov.br, veja o valor da inscrição e decida entre pagar à vista ou parcelar. Faça isso enquanto está "a ser ajuizada".',
  'Marque um contador. Leve este resumo, o número da inscrição (70.4.26.099629-42), o Termo de Exclusão nº 202503125076 e o parcelamento do MEI.',
  'Mantenha o parcelamento do MEI 2019–2023 em dia (todo dia 10, R$ 86,29): atrasar várias parcelas pode fazer a Receita cancelar.',
  'Em janeiro, pergunte ao contador se dá para voltar ao MEI ou entrar no Simples. Isso costuma depender de regularizar as dívidas antes.',
];

const CUIDADO =
  'Pague só guia que VOCÊ emitiu no PGMEI ou no Portal Regularize, ou que o contador mandou. Boleto de MEI que chega por e-mail, WhatsApp ou SMS costuma ser golpe.';

const LINKS = [
  { nome: 'e-CAC (Receita Federal)', url: 'https://cav.receita.fazenda.gov.br/' },
  { nome: 'Minhas Dívidas e Pendências', url: 'https://servicos.receitafederal.gov.br/servico/pendencias/' },
  { nome: 'Consulta Optantes (Simples/MEI)', url: 'https://consopt.www8.receita.fazenda.gov.br/consultaoptantes' },
  { nome: 'Portal Regularize (PGFN): ver valor, pagar, parcelar', url: 'https://www.regularize.pgfn.gov.br/' },
  { nome: 'PGMEI: guias antigas do MEI', url: 'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao' },
];

const GLOSSARIO = [
  ['MEI (SIMEI)', 'Regime simplificado do microempreendedor. Paga uma guia mensal fixa (DAS-MEI) que já inclui os impostos e o INSS.'],
  ['Simples Nacional', 'Regime para empresas maiores que o MEI. O imposto é uma porcentagem do faturamento, numa guia mensal calculada.'],
  ['DAS-MEI', 'A guia mensal do MEI. Vence todo dia 20 (passa para segunda se cair no fim de semana).'],
  ['Ato administrativo', 'Quando a Receita mexe no seu cadastro por conta própria, sem você pedir. Costuma ser por dívida ou por passar do limite de faturamento. O motivo exato está no Termo de Exclusão, dentro do e-CAC.'],
  ['Dívida Ativa da União', 'Dívida com a União que não foi paga no prazo e foi passada para a PGFN cobrar.'],
  ['PGFN', 'Procuradoria-Geral da Fazenda Nacional: o órgão que cobra as dívidas ativas.'],
  ['Ativa a ser ajuizada', 'A PGFN ainda não entrou com ação na Justiça. É o melhor momento para negociar.'],
  ['Portal Regularize', 'O site da PGFN onde você vê o valor da dívida, paga e parcela.'],
  ['e-CAC', 'O portal da Receita onde, logado no gov.br, você consulta situação fiscal, dívidas e declarações.'],
  ['DASN-SIMEI', 'A declaração anual do MEI, entregue até 31 de maio de cada ano.'],
];

function buildObrigacoes() {
  // Vencimentos com data vêm do Extrato (dono das datas e dos valores), já
  // com a contagem regressiva recalculada — nada duplicado aqui.
  const extrato = calcularExtrato();
  const vencimentos = extrato.recorrentes
    .filter((item) => item.categoria === 'Fiscal')
    .map((item) => ({
      nome: item.nome,
      valor: item.valor,
      moeda: item.moeda,
      proximaData: item.proximaData,
      diasParaVencer: item.diasParaVencer,
      ciclo: item.ciclo,
      nota: item.nota || '',
      pagoNoCiclo: !!item.pagoNoCiclo,
    }));

  return {
    atualizadoEm: ATUALIZADO_EM,
    resumo: RESUMO,
    situacao: SITUACAO,
    pendencias: PENDENCIAS,
    vencimentos,
    passos: PASSOS,
    cuidado: CUIDADO,
    links: LINKS,
    glossario: GLOSSARIO.map(([termo, significado]) => ({ termo, significado })),
  };
}

module.exports = { buildObrigacoes };
