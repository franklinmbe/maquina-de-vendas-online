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

const ATUALIZADO_EM = '2026-10-30';

const RESUMO =
  'Franklin pagou 4 parcelas de cerca de R$ 317 (uns R$ 1.270 no total) na semana de 12/10/2026, incluindo a Dívida Ativa de R$ 317,65. O CNPJ continua ativo para trabalhar, mas em 18/10/2026 a Receita ainda NÃO emitiu a certidão pela internet ("informações insuficientes"), sinal de que ainda há pendência a resolver. O contador orientou um novo parcelamento (entrada de R$ 700 + 60 parcelas de R$ 107), que Franklin vai fazer em janeiro/2027, junto com a troca de endereço e de nome fantasia. Seu CNPJ não é mais MEI desde 01/01/2026, então o contador também precisa definir os impostos de agora.';

const SITUACAO = {
  cnpj: '22.934.417/0001-64',
  simples: 'NÃO optante',
  simei: 'NÃO enquadrado (não é MEI)',
  lidoEm: '2026-10-05',
  fonte: 'e-CAC (Parcelamento do MEI) e Portal Regularize da PGFN, lidos em 05/10/2026; Consulta Optantes e "Minhas Dívidas e Pendências", lidos em 20/09/2026',
  historico:
    'O CNPJ foi Simples Nacional e MEI de 27/07/2015 a 31/12/2025. Saiu por "ato administrativo" da Receita Federal (a Receita tirou o CNPJ do regime, você não pediu). Não há evento futuro marcado.',
  cartao:
    'Cartão do CNPJ lido na Receita em 18/10/2026: ATIVA desde 08/08/2024 · Empresário (Individual) · porte ME · nome fantasia em branco (em 2015 era "Dietamil Suplementos") · atividade principal 47.63-6-02 Comércio varejista de artigos esportivos · secundária 47.29-6-99 Comércio varejista de produtos alimentícios · endereço R. Cerqueira Daltro, 738, Cascadura, Rio de Janeiro/RJ, CEP 21.380-320 · telefone (21) 6468-2207 (antigo) · e-mail franklinmbe@gmail.com.',
  cpf: 'Situação cadastral do CPF: regular (20/09/2026). A dívida ativa abaixo está no nome do CNPJ, que no MEI é você mesmo.',
  consequencia:
    'Como o CNPJ não é mais MEI, NÃO existe DAS-MEI mensal de 2026. Ele está em outro regime, com outros tributos e declarações, que ainda precisam ser definidos com um contador.',
};

// Quanto aparece hoje, por lugar. `valor: null` = não lido/sem valor confirmado.
const TOTAIS = [
  { onde: 'Pago na semana de 12/10/2026', valor: 1270, nota: '4 parcelas de cerca de R$ 317 (informado por Franklin; valor exato a conferir nos comprovantes)' },
  { onde: 'Certidão do CNPJ (Receita)', valor: null, nota: 'NÃO emitida pela internet em 18/10/2026: "informações insuficientes" — ainda há pendência' },
  { onde: 'Novo parcelamento (contador)', valor: 700, nota: 'entrada de R$ 700 + 60 × R$ 107 — previsto para janeiro/2027' },
  { onde: 'Parcelamento do MEI antigo', valor: null, nota: 'encerrado em 15/09/2026 — não há parcela a pagar' },
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
    gravidade: 'pago',
    titulo: 'Dívida Ativa — inscrição 70.4.26.099629-42 (PAGA)',
    oQueE:
      'Imposto do MEI (DAS-MEI, do Simples Nacional) que ficou sem pagar e foi mandado para a cobrança da Procuradoria (PGFN). Inscrita em 30/03/2026, processo 12376.659136/2026-99, em nome do CNPJ 22.934.417/0001-64.',
    situacao:
      '"Ativa a ser ajuizada", não protestada: a PGFN ainda NÃO entrou na Justiça. Enquanto estiver em aberto, o CNPJ fica no Cadin e não consegue Certidão de Regularidade Fiscal. É a única inscrição em dívida ativa (no CNPJ e no seu CPF).',
    valor: 317.65,
    valorNota: 'PAGA por Franklin na semana de 12/10/2026, junto com outras parcelas (4 de ~R$ 317, ~R$ 1.270 no total — informado por ele em 18/10/2026)',
    proximoPasso: 'Só conferir no Portal Regularize se a inscrição já aparece como extinta/paga (a baixa pode levar alguns dias).',
  },
  {
    grupo: 'parcelamento',
    gravidade: 'atencao',
    titulo: 'Novo parcelamento orientado pelo contador — janeiro/2027',
    oQueE:
      'Orientação do contador para colocar os débitos do CNPJ em dia: entrada de R$ 700 para abrir um novo parcelamento, depois 60 parcelas de R$ 107. Pagando a primeira parcela, libera tudo para trocar endereço, nome fantasia e os outros dados do CNPJ.',
    situacao:
      'Franklin decidiu fazer em janeiro/2027 (depois da eleição), junto com a atualização do cadastro do CNPJ. Até lá o CNPJ continua ativo e dá para trabalhar normalmente (serviço e produto, pela WeDrop e nos marketplaces).',
    valor: 700,
    valorNota: 'entrada; depois 60 × R$ 107 (valores passados pelo contador, informados por Franklin em 18/10/2026)',
    proximoPasso: 'Em janeiro/2027: pagar a entrada com o contador, depois atualizar endereço, nome fantasia e, se for vender produto como CNPJ, conferir a atividade (CNAE) e a inscrição estadual.',
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
    grupo: 'cnpj',
    gravidade: 'atencao',
    titulo: 'Atualizar o cadastro do CNPJ (janeiro/2027)',
    oQueE:
      'O cartão do CNPJ (lido em 18/10/2026) ainda tem o endereço de Cascadura, o telefone antigo e o nome fantasia em branco. As atividades são só de COMÉRCIO (artigos esportivos e alimentos) — não há nenhuma atividade de serviço (marketing, treinamento, aplicativo).',
    situacao:
      'O CNPJ está ATIVO e dá para trabalhar. Mas, para emitir nota de SERVIÇO dos planos do app, provavelmente vai precisar incluir uma atividade de serviço (e a inscrição na prefeitura); e para nota de PRODUTO, a inscrição estadual + o certificado digital. A inscrição estadual não pôde ser conferida (o cadastro público dos estados pede login gov.br).',
    valor: null,
    valorNota: null,
    proximoPasso: 'Em janeiro/2027, com o contador: trocar endereço, telefone e nome fantasia; incluir a atividade de serviço certa; conferir/abrir a inscrição estadual (RJ) e a inscrição municipal.',
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
  'Feito: Dívida Ativa de R$ 317,65 paga (semana de 12/10/2026). Só conferir a baixa no Portal Regularize.',
  'Com o contador: abrir a Situação Fiscal do CNPJ no e-CAC (gov.br) para ver qual pendência ainda impede a certidão (a Receita recusou emitir pela internet em 18/10/2026 e de novo em 30/10/2026).',
  'Janeiro/2027: novo parcelamento com o contador (entrada R$ 700 + 60 × R$ 107) e, em seguida, atualizar endereço, nome fantasia e dados do CNPJ.',
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
    { data: '2026-10-27', texto: 'Pedida a nova Carteira de Identidade Nacional (CIN) no Poupa Tempo Bangu (Detran-RJ, pedido nº 55704519742). Previsão de entrega no protocolo: 12/11/2026. O atendente disse que a versão digital apareceria no app gov.br até 30/10.' },
  ],
  proximoPasso:
    'Quando a nova identidade (CIN) aparecer no app gov.br (Serviços → Carteira de Documentos) ou for retirada no Poupa Tempo Bangu, reagendar pelo mesmo pedido (Certisign nº 26786158), de preferência por videoconferência. Antes, confirmar se a Certisign aceita a CIN na validação por vídeo. O certificado sai em até 3 dias úteis depois da validação.',
  paraQueServe:
    'Emitir nota fiscal eletrônica (NF-e/NFS-e), entregar declarações da empresa e fazer a verificação de empresa na Meta (Facebook/Instagram). Pela regra da WeDrop, também é exigido para vender com CNPJ.',
};

// Cada consulta feita, com data — para o contador saber quão recente é cada dado.
const PESQUISAS = [
  { data: '2026-10-30', onde: 'Receita → Certidão de Pessoa Jurídica (CNPJ 22.934.417/0001-64)', resultado: 'Não emitiu: duas tentativas (14h12 e 14h15) deram "Não foi possível concluir a ação para o contribuinte informado" (erro 106). Ainda não dá para dizer que o CNPJ está limpo.' },
  { data: '2026-10-30', onde: 'Portal Regularize (PGFN)', resultado: 'Não conferido: a baixa dos R$ 317,65 só aparece com o login do Franklin (gov.br ou senha do Regularize).' },
  { data: '2026-10-30', onde: 'Detran-RJ → nova identidade (CIN)', resultado: 'O site do Detran não tem consulta pública pelo protocolo. A versão digital aparece só no app gov.br (Serviços → Carteira de Documentos), com o login do Franklin.' },
  { data: '2026-10-18', onde: 'Receita → Comprovante de Inscrição e Situação Cadastral', resultado: 'ATIVA desde 08/08/2024, porte ME, nome fantasia em branco, atividades só de comércio (47.63-6-02 artigos esportivos; 47.29-6-99 alimentos), endereço Cascadura/RJ, telefone antigo.' },
  { data: '2026-10-18', onde: 'Inscrição estadual (CCC/Sintegra)', resultado: 'Não conferida: o CCC pede login gov.br e o site do Sintegra deu alerta de segurança.' },
  { data: '2026-10-18', onde: 'Receita → Certidão de Pessoa Jurídica (CNPJ 22.934.417/0001-64)', resultado: 'Não emitiu: "As informações disponíveis na Receita Federal sobre o contribuinte são insuficientes para emitir a certidão pela Internet." Quer dizer que ainda há alguma pendência (débito ou declaração). Ver a Situação Fiscal no e-CAC com o contador.' },
  { data: '2026-10-18', onde: 'Informado por Franklin', resultado: 'Dívida Ativa de R$ 317,65 paga na semana de 12/10/2026. Contador orientou novo parcelamento: entrada R$ 700 + 60 × R$ 107. Franklin vai fazer em janeiro/2027, junto com a troca de endereço e de nome fantasia.' },
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
