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

const ATUALIZADO_EM = '2026-10-05';

const RESUMO =
  'Hoje a única dívida com valor confirmado é a Dívida Ativa de R$ 317,65 (DAS-MEI antigo), que dá para pagar à vista no Portal Regularize. O parcelamento do MEI foi encerrado em 15/09/2026. Seu CNPJ não é mais MEI desde 01/01/2026, então falta um contador definir os impostos de agora.';

const SITUACAO = {
  cnpj: '22.934.417/0001-64',
  simples: 'NÃO optante',
  simei: 'NÃO enquadrado (não é MEI)',
  lidoEm: '2026-10-05',
  fonte: 'e-CAC (Parcelamento do MEI) e Portal Regularize da PGFN, lidos em 05/10/2026; Consulta Optantes e "Minhas Dívidas e Pendências", lidos em 20/09/2026',
  historico:
    'O CNPJ foi Simples Nacional e MEI de 27/07/2015 a 31/12/2025. Saiu por "ato administrativo" da Receita Federal (a Receita tirou o CNPJ do regime, você não pediu). Não há evento futuro marcado.',
  cpf: 'Situação cadastral do CPF: regular (20/09/2026). A dívida ativa abaixo está no nome do CNPJ, que no MEI é você mesmo.',
  consequencia:
    'Como o CNPJ não é mais MEI, NÃO existe DAS-MEI mensal de 2026. Ele está em outro regime, com outros tributos e declarações, que ainda precisam ser definidos com um contador.',
};

// Quanto aparece hoje, por lugar. `valor: null` = não lido/sem valor confirmado.
const TOTAIS = [
  { onde: 'Dívida Ativa (PGFN)', valor: 317.65, nota: '1 inscrição, em cobrança, lida em 05/10/2026' },
  { onde: 'Parcelamento do MEI', valor: null, nota: 'encerrado em 15/09/2026 — não há parcela a pagar' },
  { onde: 'Pendências na Receita (CNPJ)', valor: null, nota: 'consulta da Receita falhou em 05/10/2026 — reler' },
  { onde: 'Seu CPF', valor: null, nota: 'CPF regular; pendências do CPF ainda não relidas' },
];

// Cada pendência pertence a um grupo, mostrado como bloco separado na página.
const GRUPOS = [
  { id: 'divida', titulo: 'Dívida Ativa da União (PGFN)' },
  { id: 'parcelamento', titulo: 'Parcelamento do MEI' },
  { id: 'cnpj', titulo: 'No CNPJ (Receita Federal)' },
  { id: 'cpf', titulo: 'No seu CPF (seu nome)' },
];

const PENDENCIAS = [
  {
    grupo: 'divida',
    gravidade: 'urgente',
    titulo: 'Dívida Ativa — inscrição 70.4.26.099629-42',
    oQueE:
      'Imposto do MEI (DAS-MEI, do Simples Nacional) que ficou sem pagar e foi mandado para a cobrança da Procuradoria (PGFN). Inscrita em 30/03/2026, processo 12376.659136/2026-99, em nome do CNPJ 22.934.417/0001-64.',
    situacao:
      '"Ativa a ser ajuizada", não protestada: a PGFN ainda NÃO entrou na Justiça. Enquanto estiver em aberto, o CNPJ fica no Cadin e não consegue Certidão de Regularidade Fiscal. É a única inscrição em dívida ativa (no CNPJ e no seu CPF).',
    valor: 317.65,
    valorNota: 'valor consolidado no Portal Regularize em 05/10/2026, com juros até hoje',
    proximoPasso: 'Portal Regularize → Consultar Dívida Ativa → botão "Pagar" (à vista) gera a guia. Ou "Negociar dívida" para parcelar.',
  },
  {
    grupo: 'parcelamento',
    gravidade: 'atencao',
    titulo: 'Parcelamento MEI 2019–2023 — encerrado',
    oQueE:
      'Parcelamento das dívidas antigas do MEI (2019 a 2023), pedido em 09/10/2024: R$ 5.177,56 em 60 parcelas de R$ 86,29.',
    situacao:
      'O e-CAC mostra só 1 parcela paga (10/2024, R$ 86,29) e a situação "Encerrado a Pedido do Contribuinte" em 15/09/2026. Ou seja: NÃO existe mais parcela mensal de dia 10. O que sobrou dessa dívida não apareceu na Dívida Ativa (lá só tem os R$ 317,65), então pode estar ainda na Receita.',
    valor: null,
    valorNota: 'Saldo que sobrou: não mostrado no parcelamento. Conferir na Situação Fiscal da Receita.',
    proximoPasso: 'Reler a Situação Fiscal do CNPJ no e-CAC (deu erro em 05/10/2026) para ver se o saldo voltou como débito em aberto.',
  },
  {
    grupo: 'cnpj',
    gravidade: 'atencao',
    titulo: 'Débito da exclusão do Simples (Termo nº 202503125076)',
    oQueE:
      'Dívida ligada ao Termo de Exclusão do Simples de 01/08/2025, anotada antes como "ainda não parcelada".',
    situacao:
      'A consulta desses débitos no e-CAC deu "Erro na consulta" em 05/10/2026. Pode ser o mesmo débito que virou a Dívida Ativa acima, mas isso não foi confirmado.',
    valor: 1103.67,
    valorNota: 'valor anotado antes de 20/09/2026, NÃO reconfirmado',
    proximoPasso: 'Reler no e-CAC: Simples Nacional → Débitos do Termo de Exclusão.',
  },
  {
    grupo: 'cnpj',
    gravidade: 'atencao',
    titulo: 'Impostos e declarações do regime atual (a definir com contador)',
    oQueE:
      'Tudo que o CNPJ tem que pagar e declarar agora que saiu do MEI (ver "Impostos explicados" abaixo).',
    situacao: 'Sem lista, sem valor e sem dia de vencimento ainda. Sem isso, o atraso pode se acumular sem você ver.',
    valor: null,
    valorNota: null,
    proximoPasso: 'Falar com um contador e levar este resumo.',
  },
  {
    grupo: 'cnpj',
    gravidade: 'conferir',
    titulo: 'Guia que venceu em 21/09/2026',
    oQueE: 'Uma guia que você viu com vencimento em 21/09. O tipo e o valor ainda não foram identificados.',
    situacao: 'Guia vencida não serve mais: é preciso emitir uma nova, com juros. Se ela for do DAS-MEI antigo, é a Dívida Ativa acima.',
    valor: null,
    valorNota: null,
    proximoPasso: 'Se tiver a guia em mãos, veja o nome e o período escritos nela e me diga.',
  },
  {
    grupo: 'cnpj',
    gravidade: 'conferir',
    titulo: 'Declaração anual do MEI (DASN-SIMEI)',
    oQueE: 'Declaração que o MEI entrega uma vez por ano, até 31 de maio, com o faturamento do ano anterior.',
    situacao: 'Não sei se as dos anos anteriores foram entregues, inclusive a de 2025. Não foi conferido.',
    valor: null,
    valorNota: null,
    proximoPasso: 'Pedir ao contador para conferir se está tudo entregue.',
  },
  {
    grupo: 'cpf',
    gravidade: 'conferir',
    titulo: 'Pendências no seu CPF',
    oQueE: 'Dívidas e declarações no seu nome de pessoa física, separadas do CNPJ.',
    situacao:
      'Em 20/09/2026 o CPF estava regular e a única pendência achada foi a Dívida Ativa acima (que é do CNPJ). Em 05/10/2026 o Regularize não mostrou nenhuma outra inscrição no seu nome. A consulta de pendências do CPF na Receita ainda não foi relida.',
    valor: null,
    valorNota: null,
    proximoPasso: 'Reler "Minhas Dívidas e Pendências" com o perfil do CPF e conferir a declaração do Imposto de Renda (Meu Imposto de Renda).',
  },
];

// O que é cada imposto/tributo, separado pelo seu enquadramento.
const IMPOSTOS = [
  {
    bloco: 'Até 31/12/2025 — quando o CNPJ era MEI',
    itens: [
      ['DAS-MEI (mensal)', 'Guia fixa do MEI, todo dia 20. Já inclui INSS, ISS (serviço) e/ou ICMS (comércio). As que ficaram sem pagar viraram a Dívida Ativa e o parcelamento.'],
      ['DASN-SIMEI (anual)', 'Declaração do faturamento do ano anterior, até 31 de maio. Não tem guia, mas atrasar gera multa.'],
    ],
  },
  {
    bloco: 'Desde 01/01/2026 — CNPJ fora do MEI e do Simples (CONFIRMAR COM CONTADOR)',
    itens: [
      ['Regime provável: Lucro Presumido', 'Quando a empresa não está no Simples, normalmente fica no Lucro Presumido. Quem confirma e escolhe é o contador.'],
      ['IRPJ (trimestral)', 'Imposto de Renda da empresa, calculado sobre uma porcentagem do faturamento. Pago por DARF.'],
      ['CSLL (trimestral)', 'Contribuição sobre o lucro, junto com o IRPJ. Paga por DARF.'],
      ['PIS e COFINS (mensais)', 'Contribuições federais sobre o faturamento. Pagas por DARF todo mês.'],
      ['ISS (mensal, prefeitura)', 'Imposto da prefeitura sobre serviços. Guia da prefeitura, não da Receita.'],
      ['INSS do pró-labore (mensal)', 'Se você tirar pró-labore, a empresa recolhe o INSS. Declarado na DCTFWeb, pago por DARF.'],
      ['Declarações (DCTFWeb, EFD, ECF)', 'Relatórios que o contador entrega todo mês ou todo ano. Não entregar gera multa mesmo sem imposto a pagar.'],
    ],
  },
  {
    bloco: 'No seu CPF (pessoa física)',
    itens: [
      ['IRPF (anual)', 'Declaração do Imposto de Renda, até 31 de maio, se você estiver obrigado (renda acima do limite, bens, ser sócio etc.). Pode ter imposto a pagar ou a restituir.'],
      ['Carnê-leão (mensal, se houver)', 'Só se você receber renda de pessoa física ou do exterior sem desconto na fonte.'],
    ],
  },
];

const PASSOS = [
  'Pague a Dívida Ativa de R$ 317,65 no Portal Regularize (Consultar Dívida Ativa → Pagar). Isso tira o CNPJ do Cadin.',
  'Peça para o Claude reler a Situação Fiscal do CNPJ e do CPF no e-CAC (deu erro em 05/10/2026). É ela que mostra o que sobrou do parcelamento encerrado e o débito da exclusão do Simples.',
  'Marque um contador. Leve este resumo, a inscrição 70.4.26.099629-42, o Termo de Exclusão nº 202503125076 e o parcelamento encerrado.',
  'Com o contador, defina os impostos e declarações de 2026 (ver "Impostos explicados") e coloque os vencimentos no Extrato.',
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

// Certificado digital e-CNPJ — o que trava as verificações da Meta (e o que
// o contador precisa saber para emitir nota). Só fatos registrados, com data.
const CERTIFICADO = {
  status: 'Pendente — não emitido',
  tipo: 'e-CNPJ A1 (ICP-Brasil), Certisign, comprado pela parceria do Bling',
  pedido: 'Bling nº 26825497398 · Certisign nº 26786158',
  pagoEm: '2026-09-09',
  valor: 79,
  linhaDoTempo: [
    { data: '2026-09-09', texto: 'Certificado comprado e pago (R$ 79,00, Pix). Escolhida a validação presencial, porque a CNH estava em renovação.' },
    { data: '2026-09-10', texto: 'Validação presencial no posto AR Certifique Online, em Madureira (RJ). O RG foi recusado porque a borda do documento está danificada. Os dados estavam legíveis, mas a Certisign exige documento sem avarias.' },
    { data: '2026-09-10', texto: 'Agendamento cancelado no portal da Certisign, com o motivo "Documentação pendente". Nenhum novo agendamento foi marcado.' },
  ],
  proximoPasso:
    'Com a CNH renovada em mãos, reagendar pelo mesmo pedido (Certisign nº 26786158), por videoconferência (exige CNH válida) ou presencial. O certificado sai em até 3 dias úteis depois da validação.',
  paraQueServe:
    'Emitir nota fiscal eletrônica (NF-e/NFS-e), entregar declarações da empresa e fazer a verificação de empresa na Meta (Facebook/Instagram). Pela regra da WeDrop, também é exigido para vender com CNPJ.',
};

// Cada consulta feita, com data — para o contador saber quão recente é cada dado.
const PESQUISAS = [
  { data: '2026-10-05', onde: 'Portal Regularize (PGFN)', resultado: 'Dívida Ativa 70.4.26.099629-42, R$ 317,65. É a única inscrição no CNPJ e no CPF.' },
  { data: '2026-10-05', onde: 'e-CAC → Parcelamento MEI', resultado: 'Parcelamento de 09/10/2024 (R$ 5.177,56 em 60 parcelas): só 1 parcela paga, situação "Encerrado a Pedido do Contribuinte" em 15/09/2026.' },
  { data: '2026-10-05', onde: 'Receita → Minhas Dívidas e Pendências', resultado: 'Não foi possível ler: o sistema da Receita deu erro 107.3.' },
  { data: '2026-10-05', onde: 'e-CAC → Débitos do Termo de Exclusão (SIVER)', resultado: 'Não foi possível ler: "Erro na consulta".' },
  { data: '2026-10-05', onde: 'PGMEI', resultado: 'Não foi possível ler: a verificação (hCaptcha) travou.' },
  { data: '2026-09-20', onde: 'Consulta Optantes (Simples/MEI)', resultado: 'NÃO optante do Simples e NÃO enquadrado no SIMEI. Foi Simples/MEI de 27/07/2015 a 31/12/2025, e saiu por ato administrativo.' },
  { data: '2026-09-20', onde: 'Receita → Minhas Dívidas e Pendências', resultado: 'CPF regular. A pendência achada era a Dívida Ativa do CNPJ.' },
  { data: '2026-09-10', onde: 'Certisign (validação do certificado)', resultado: 'RG recusado por avaria na borda. Agendamento cancelado.' },
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
    totais: TOTAIS,
    grupos: GRUPOS,
    pendencias: PENDENCIAS,
    impostos: IMPOSTOS.map((b) => ({ bloco: b.bloco, itens: b.itens.map(([nome, oQueE]) => ({ nome, oQueE })) })),
    vencimentos,
    certificado: CERTIFICADO,
    pesquisas: PESQUISAS,
    passos: PASSOS,
    cuidado: CUIDADO,
    links: LINKS,
    glossario: GLOSSARIO.map(([termo, significado]) => ({ termo, significado })),
  };
}

module.exports = { buildObrigacoes };
