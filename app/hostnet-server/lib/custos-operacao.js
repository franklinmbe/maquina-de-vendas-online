// Extrato da Operação — lista mantida manualmente (por Franklin+Claude) de
// toda ferramenta/serviço PAGO usado no projeto, com dia de vencimento e
// custo. Não existe forma automática de "descobrir" essas assinaturas (são
// contas externas, cada uma com seu próprio painel/cartão) — sempre que uma
// ferramenta nova entrar com custo novo, ou um valor/dia mudar, atualizar
// este arquivo é o único lugar que precisa mudar; o dashboard recalcula os
// dias-até-vencer sozinho a cada carregamento, nunca precisa editar datas.

// Cobrança recorrente com dia fixo do mês (cartão, boleto, Pix).
//
// Pagamento: quando Franklin avisar "paguei X", acrescentar no item
// `ultimoPagamento: { referencia: 'AAAA-MM', informadoEm: 'AAAA-MM-DD' }` —
// `referencia` é o mês do VENCIMENTO que foi pago (não o mês em que caiu o
// dinheiro). O extrato mostra "✔ pago" e, se o pagamento já cobre o próximo
// vencimento (pago adiantado), tira o item do aviso. Sem esse campo o item
// só mostra a contagem regressiva — nunca inventar pagamento não informado.
const RECORRENTES_MENSAIS = [
  {
    id: 'hostinger-vps',
    nome: 'Hostinger VPS (KVM 2)',
    categoria: 'Infraestrutura',
    nota: 'servidor do app (app.maquinadevendasonline.com.br), da loja maquinadevendasonline.com.br e da academia. Atualizado de KVM 1 para KVM 2 em 21/10/2026, no mesmo servidor (2 vCPU, 8 GB, 100 GB): pago R$ 78,00 (R$ 89,99 do mês − R$ 11,99 de saldo Hostinger), cartão Visa •••• 0307, plano mensal. Renovação automática DESLIGADA. No anual sairia R$ 69,49/mês (R$ 833,88 de uma vez).',
    oQueE: 'O "computador na internet" onde o seu aplicativo e a loja rodam. Se vencer sem pagar, tudo sai do ar, com todos os clientes.',
    valor: 89.99,
    moeda: 'BRL',
    diaVencimento: 21,
    autoRenovacao: false,
    critico: true, // se vencer sem renovar, o app inteiro sai do ar
    ultimoPagamento: { referencia: '2026-10', informadoEm: '2026-10-21' },
  },
  {
    id: 'claude',
    nome: 'Claude (Anthropic) — Pro',
    categoria: 'Ferramenta de IA',
    nota: 'cartão Visa •••• 2936 · sobe para o Max de US$ 100/mês (≈ R$ 550) quando entrar o próximo cliente com aplicativo (decisão de 12/10, ver Tarefas pendentes em Fluxos operacionais)',
    oQueE: 'A sua assinatura do Claude, a IA que trabalha com você na construção do app. Cobra sozinha no cartão.',
    valor: 110,
    moeda: 'BRL',
    diaVencimento: 16,
    autoRenovacao: true,
    ultimoPagamento: { referencia: '2026-09', informadoEm: '2026-09-20' },
  },
  {
    id: 'hostnet',
    nome: 'Hostnet',
    categoria: 'Infraestrutura',
    nota: 'hospedagem tradicional (franklinmorais.com) + DNS do domínio · Boleto/Pix · MANTIDA (decisão de 20/10: "é baratinha"): vira o site pessoal do Franklin e a loja com AliExpress',
    oQueE: 'A hospedagem do seu site pessoal e da loja franklinmorais.com (ligada ao AliExpress). Paga por boleto ou Pix, não é automática.',
    valor: 47.32,
    moeda: 'BRL',
    diaVencimento: 20,
    autoRenovacao: false,
    ultimoPagamento: { referencia: '2026-09', informadoEm: '2026-09-20' },
  },
  {
    id: 'tva-net',
    nome: 'TVA NET',
    categoria: 'Conta fixa',
    nota: 'informado por Franklin em 20/09/2026 — R$150,00 todo dia 15. Forma de pagamento não informada.',
    oQueE: 'Conta fixa mensal que você me informou (TVA NET). Não sei se é internet ou TV, então não classifiquei — me diga que eu ajusto.',
    valor: 150,
    moeda: 'BRL',
    diaVencimento: 15,
    autoRenovacao: null,
  },
];

// Cobrança recorrente anual, ou vencimento único numa data fixa conhecida.
const DATAS_FIXAS = [
  {
    id: 'dominio-franklinmorais',
    nome: 'Domínio franklinmorais.com',
    categoria: 'Infraestrutura',
    nota: 'via Hostnet (eNom) · NÃO RENOVAR (decisão de 17/10): app, loja e site mudaram para maquinadevendasonline.com.br',
    valor: null,
    moeda: 'BRL',
    dataVencimento: '2027-08-20',
    ciclo: 'anual',
    oQueE: 'O endereço antigo franklinmorais.com. Já está pago até 20/08/2027 e não vai ser renovado: tudo passou para maquinadevendasonline.com.br.',
  },
  {
    id: 'dominio-maquinadevendasonline',
    nome: 'Domínio maquinadevendasonline.com.br',
    categoria: 'Infraestrutura',
    nota: 'Registro.br, registrado em 17/10/2026 · DNS do próprio Registro.br (loja, www e app) · valor pago não informado',
    valor: null,
    moeda: 'BRL',
    dataVencimento: '2027-10-17',
    ciclo: 'anual',
    critico: true,
    oQueE: 'O endereço principal da empresa: loja, site e aplicativo. Renova uma vez por ano no Registro.br; se vencer, tudo sai do ar.',
  },
  {
    id: 'guia-cnpj-2026-09-21',
    nome: 'Guia de imposto do CNPJ — vence 21/09 (a confirmar qual é)',
    categoria: 'Fiscal',
    nota: 'Franklin viu um vencimento em 21/09/2026. Tipo e valor ainda NÃO identificados (a consulta de pendências da Receita falhou em 05/10/2026). Guia vencida não serve: é preciso emitir uma nova. A Dívida Ativa de R$ 317,65 já foi paga (semana de 12/10/2026). O próximo passo é o novo parcelamento com o contador em janeiro/2027 — ver a aba Obrigações CNPJ / MEI.',
    oQueE: 'Uma guia de imposto do seu CNPJ. Atenção: a Receita mostra que o CNPJ NÃO é mais MEI desde 01/01/2026 (consulta de 20/09/2026), então não deve ser o DAS-MEI mensal de 2026. Pode ser de um período antigo (até 12/2025) ou de outro tributo.',
    valor: null,
    moeda: 'BRL',
    dataVencimento: '2026-09-21',
    ciclo: 'única',
  },
];

// Pontuais, pendentes ou fora de uso — sem data de vencimento recorrente
// pra calcular contagem regressiva, só status.
const PONTUAIS = [
  {
    nome: 'WeDrop Start - Shopee (Hubla)',
    nota: 'comprado em 26/09/2026 pela Hubla (vendedor Marcelo Menezes): produto R$ 297,00, total cobrado R$ 368,64 (diferença provavelmente é juros de parcelamento, não conferido). Inclui o MarketPro (20 créditos). Ver Trilha WeDrop.',
    valor: 368.64,
    moeda: 'BRL',
    oQueE: 'O plano da WeDrop que dá o estoque e o envio da nossa loja na Shopee, mais o curso e o MarketPro. Já foi pago; o plano completo (TikTok Shop, Mercado Livre, WooCommerce) seria cobrado à parte.',
    status: 'já pago',
  },
  {
    nome: 'Canva Pro',
    nota: 'cobrou o plano anual sem autorização (era mensal) — cartão bloqueado por Franklin pra não cobrar de novo. Também não está em uso na produção (só a autenticação foi testada, nunca gerou conteúdo real de cliente).',
    oQueE: 'Programa de design gráfico. Cobrou o plano anual sem você autorizar; o cartão foi bloqueado para não cobrar de novo.',
    status: 'não vai renovar',
  },
  {
    nome: 'CapCut',
    nota: 'substituído por FFmpeg no pipeline de vídeo — assinatura já expirou, não paga mais',
    oQueE: 'Programa de edição de vídeo que foi trocado por outro processo automático. Não precisa pagar.',
    status: 'inativo',
  },
  {
    nome: 'Certificado digital e-CNPJ A1 (Bling/Certisign)',
    nota: 'pago via Pix em 09/09/2026 · validação de identidade ainda pendente (ver Tarefas pendentes em Fluxos operacionais)',
    valor: 79,
    moeda: 'BRL',
    oQueE: 'A "assinatura eletrônica" oficial do CNPJ. É o que falta para o Meta liberar as métricas avançadas e para os clientes conectarem sozinhos. Já foi pago, só falta a validação de identidade.',
    status: 'já pago, único',
  },
  {
    nome: 'Parcelamento MEI 2019-2023 (SIMEI + MAED) — ENCERRADO',
    nota: 'lido no e-CAC em 05/10/2026: pedido 09/10/2024, R$ 5.177,56 em 60 x R$ 86,29; só 1 parcela registrada como paga (10/2024); situação "Encerrado a Pedido do Contribuinte" em 15/09/2026. Não há mais parcela mensal a pagar.',
    valor: 86.29,
    moeda: 'BRL',
    oQueE: 'O parcelamento das dívidas antigas do MEI. Foi encerrado em 15/09/2026, então não existe mais parcela de dia 10. O que sobrou da dívida precisa ser conferido na aba Obrigações CNPJ / MEI.',
    status: 'encerrado em 15/09/2026',
  },
  {
    nome: 'Obrigações do CNPJ / MEI (situação na Receita, dívida ativa, o que fazer)',
    nota: 'O resumo completo mora na aba própria (Ajustes → Obrigações CNPJ / MEI — pendências), separado em CNPJ, Dívida Ativa, Parcelamento e CPF. Aqui fica só a guia de 21/09, que gera o aviso.',
    oQueE: 'Em uma frase: o CNPJ deixou de ser MEI em 01/01/2026, a Dívida Ativa de R$ 317,65 foi paga (12/10/2026), e em janeiro/2027 entra o novo parcelamento (R$ 700 + 60 × R$ 107) e a definição dos tributos do regime atual com o contador.',
    status: 'urgente: ver a aba Obrigações CNPJ / MEI',
  },
  {
    nome: 'Hostinger — KVM 2 comprado por engano (reembolso)',
    nota: 'em 21/10/2026 a Hostinger vendeu um VPS NOVO (srv2084635) em vez do upgrade. Cancelado no chat da Hostinger no mesmo dia; reembolso de R$ 70,99 para o cartão usado (pode levar alguns dias para aparecer na fatura). Conferir na fatura.',
    valor: 70.99,
    moeda: 'BRL',
    oQueE: 'Um servidor que a Hostinger vendeu por engano no lugar da atualização. Foi cancelado e o dinheiro volta para o cartão. Só falta conferir na fatura.',
    status: 'reembolso a caminho',
  },
  {
    nome: 'Postiz — CANCELADA',
    nota: 'plano TEAM (US$ 39/mês ≈ R$ 200, cartão Visa •••• 2936). Cancelada por Franklin em 20/10/2026; o cartão também foi cancelado. TikTok fica pausado até o certificado digital e a aprovação do app do TikTok.',
    oQueE: 'A ferramenta que publicava os TikToks. Foi cancelada em 20/10/2026, junto com o cartão. Não cobra mais.',
    status: 'cancelada em 20/10/2026',
  },
  {
    nome: 'ElevenLabs (voz clonada real)',
    nota: 'plano Creator, cogitado pro clone digital do cliente',
    valor: 22,
    moeda: 'USD',
    ciclo: 'mensal (se assinar)',
    oQueE: 'Serviço que clona a voz real do cliente para os vídeos. Ainda não assinado, sem cobrança.',
    status: 'ainda não assinado',
  },
  {
    nome: 'HeyGen (clone digital em vídeo)',
    nota: 'pay-as-you-go, ~US$4/min gerado',
    valor: 5,
    moeda: 'USD',
    ciclo: 'a partir de (se ativar)',
    oQueE: 'Serviço que cria vídeo com o rosto clonado do cliente. Conta ainda não criada, sem cobrança.',
    status: 'conta ainda não criada',
  },
  {
    nome: 'Vercel',
    nota: 'hospedagem antiga do app — Franklin decidiu encerrar em 01/09/2026',
    oQueE: 'A hospedagem antiga do app, que você decidiu encerrar. Falta confirmar o cancelamento no painel deles para não cobrar mais.',
    status: 'cancelamento ainda não confirmado no painel',
  },
];

// Crédito de uso variável (pré-pago, não é assinatura com dia fixo) — o
// saldo só é atualizado manualmente aqui toda vez que alguém confere ao
// vivo no painel do fornecedor (não tem API ligada nesse dado ainda).
// `limiteAlerta`: abaixo desse valor, mostra alerta de saldo baixo.
const CREDITOS_VARIAVEIS = [
  {
    id: 'google-gemini',
    nome: 'Google AI Studio (Gemini / Nano Banana)',
    nota: 'paga a geração de imagem/vídeo/narração (banners, slideshow narrado, TTS) de todos os clientes',
    saldoAtual: 111.64,
    moeda: 'BRL',
    ultimaRecarga: { valor: 100, data: '2026-09-13' },
    recargaAutomatica: false,
    conferidoEm: '2026-09-13',
    painel: 'aistudio.google.com/billing',
    limiteAlerta: 20,
  },
];

// Tributo que cai em sábado/domingo vence na segunda (`ajustaFimDeSemana`).
// Feriado NÃO é tratado — se cair num, conferir na guia.
function ocorrenciaDoMes(ano, mes, diaVencimento, ajustaFimDeSemana) {
  const data = new Date(ano, mes, diaVencimento);
  data.setHours(0, 0, 0, 0);
  if (ajustaFimDeSemana) {
    if (data.getDay() === 6) data.setDate(data.getDate() + 2);
    else if (data.getDay() === 0) data.setDate(data.getDate() + 1);
  }
  return data;
}

function proximaOcorrenciaMensal(diaVencimento, hoje, ajustaFimDeSemana) {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  let candidata = ocorrenciaDoMes(ano, mes, diaVencimento, ajustaFimDeSemana);
  const hojeSemHora = new Date(ano, mes, hoje.getDate());
  if (candidata < hojeSemHora) {
    candidata = ocorrenciaDoMes(ano, mes + 1, diaVencimento, ajustaFimDeSemana);
  }
  return candidata;
}

function diasEntre(dataAlvo, hoje) {
  const msPorDia = 24 * 60 * 60 * 1000;
  const alvoSemHora = new Date(dataAlvo.getFullYear(), dataAlvo.getMonth(), dataAlvo.getDate());
  const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvoSemHora - hojeSemHora) / msPorDia);
}

// Calcula a contagem regressiva de cada item hoje — nunca guardar a data já
// calculada em lugar nenhum, sempre recalcular na hora de servir a resposta,
// senão o "faltam N dias" fica errado no dia seguinte.
function calcularExtrato() {
  const hoje = new Date();

  const recorrentes = RECORRENTES_MENSAIS.map((item) => {
    const proxima = proximaOcorrenciaMensal(item.diaVencimento, hoje, item.ajustaFimDeSemana);
    const diasParaVencer = diasEntre(proxima, hoje);
    const referenciaProxima = `${proxima.getFullYear()}-${String(proxima.getMonth() + 1).padStart(2, '0')}`;
    const pagoNoCiclo = !!item.ultimoPagamento && item.ultimoPagamento.referencia === referenciaProxima;
    return {
      ...item,
      ciclo: 'mensal',
      proximaData: proxima.toISOString().slice(0, 10),
      diasParaVencer,
      pagoNoCiclo,
      alerta: diasParaVencer <= 5 && !pagoNoCiclo,
    };
  });

  const anuais = DATAS_FIXAS.map((item) => {
    const alvo = new Date(`${item.dataVencimento}T00:00:00`);
    const diasParaVencer = diasEntre(alvo, hoje);
    return {
      ...item,
      proximaData: item.dataVencimento,
      diasParaVencer,
      alerta: diasParaVencer <= 5 && diasParaVencer >= 0,
    };
  });

  const todosComData = [...recorrentes, ...anuais].sort((a, b) => a.diasParaVencer - b.diasParaVencer);
  const alertas = todosComData.filter((item) => item.alerta);

  const fixoMensalConhecido = recorrentes.reduce((soma, item) => {
    const valorBRL = item.moeda === 'BRL' ? item.valor : item.valorAproxBRL || 0;
    return soma + (valorBRL || 0);
  }, 0);

  const creditos = CREDITOS_VARIAVEIS.map((item) => ({
    ...item,
    saldoBaixo: item.saldoAtual < item.limiteAlerta,
  }));

  return {
    recorrentes: todosComData,
    pontuais: PONTUAIS,
    creditos,
    alertas,
    fixoMensalConhecido: Math.round(fixoMensalConhecido * 100) / 100,
  };
}

module.exports = { calcularExtrato, RECORRENTES_MENSAIS };
