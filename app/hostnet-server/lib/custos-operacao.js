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
    nome: 'Hostinger VPS (KVM 1)',
    categoria: 'Infraestrutura',
    nota: 'servidor de app.franklinmorais.com — roda o app inteiro. Sem forma de pagamento cadastrada, renovação automática DESLIGADA.',
    valor: 87.99,
    moeda: 'BRL',
    diaVencimento: 25,
    autoRenovacao: false,
    critico: true, // se vencer sem renovar, o app inteiro sai do ar
  },
  {
    id: 'claude',
    nome: 'Claude (Anthropic) — Pro',
    categoria: 'Ferramenta de IA',
    nota: 'cartão Visa •••• 2936 · aumento do plano previsto junto com a saída do Postiz (ver Tarefas pendentes em Fluxos operacionais)',
    valor: 110,
    moeda: 'BRL',
    diaVencimento: 16,
    autoRenovacao: true,
    ultimoPagamento: { referencia: '2026-09', informadoEm: '2026-09-20' },
  },
  {
    id: 'postiz',
    nome: 'Postiz',
    categoria: 'Ferramenta',
    nota: 'plano TEAM · publica TikTok de frank + Kleber · cartão Visa •••• 2936 · sai depois do certificado + CNPJ + TikTok aprovado (ver Tarefas pendentes em Fluxos operacionais)',
    valor: 39,
    moeda: 'USD',
    valorAproxBRL: 200,
    diaVencimento: 21,
    autoRenovacao: true,
  },
  {
    id: 'hostnet',
    nome: 'Hostnet',
    categoria: 'Infraestrutura',
    nota: 'hospedagem tradicional (franklinmorais.com) + DNS do domínio · Boleto/Pix',
    valor: 47.32,
    moeda: 'BRL',
    diaVencimento: 20,
    autoRenovacao: false,
    ultimoPagamento: { referencia: '2026-09', informadoEm: '2026-09-20' },
  },
  {
    id: 'mei-parcelamento',
    nome: 'Parcelamento MEI 2019-2023 (SIMEI + MAED)',
    categoria: 'Fiscal',
    nota: '60 parcelas, concedido 09/10/2024 · total parcelado R$5.177,56',
    valor: 86.29,
    moeda: 'BRL',
    diaVencimento: 10,
    autoRenovacao: null,
  },
  {
    id: 'das-mei',
    nome: 'Imposto mensal do CNPJ (DAS-MEI)',
    categoria: 'Fiscal',
    nota: 'vence todo dia 20 (vai pra segunda se cair no fim de semana — set/2026: 21/09) · Franklin paga sozinho, pelo Mercado Pago · valor exato: conferir na guia (PGMEI), não informado',
    valor: null,
    moeda: 'BRL',
    diaVencimento: 20,
    ajustaFimDeSemana: true,
    autoRenovacao: false,
  },
  {
    id: 'tva-net',
    nome: 'TVA NET',
    categoria: 'Conta fixa',
    nota: 'informado por Franklin em 20/09/2026 — R$150,00 todo dia 15. Forma de pagamento não informada.',
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
    nota: 'via Hostnet (eNom) · DNS nsb1–6.hostnet.com.br',
    valor: null,
    moeda: 'BRL',
    dataVencimento: '2027-08-20',
    ciclo: 'anual',
  },
];

// Pontuais, pendentes ou fora de uso — sem data de vencimento recorrente
// pra calcular contagem regressiva, só status.
const PONTUAIS = [
  {
    nome: 'Canva Pro',
    nota: 'cobrou o plano anual sem autorização (era mensal) — cartão bloqueado por Franklin pra não cobrar de novo. Também não está em uso na produção (só a autenticação foi testada, nunca gerou conteúdo real de cliente).',
    status: 'não vai renovar',
  },
  {
    nome: 'CapCut',
    nota: 'substituído por FFmpeg no pipeline de vídeo — assinatura já expirou, não paga mais',
    status: 'inativo',
  },
  {
    nome: 'Certificado digital e-CNPJ A1 (Bling/Certisign)',
    nota: 'pago via Pix em 09/09/2026 · validação de identidade ainda pendente (ver Tarefas pendentes em Fluxos operacionais)',
    valor: 79,
    moeda: 'BRL',
    status: 'já pago, único',
  },
  {
    nome: 'Obrigações mensais do CNPJ (a definir com contador)',
    nota: 'O imposto mensal (DAS-MEI, dia 20) já está na lista de vencimentos acima. Falta o que Franklin vai organizar com o contador — honorário contábil e demais obrigações do CNPJ. Sem valor nem dia de vencimento ainda: não inventar número aqui, só preencher quando ele confirmar.',
    status: 'aguardando definição com contador',
  },
  {
    nome: 'Débito novo 2024 — exclusão do Simples (2025)',
    nota: 'Termo de Exclusão nº 202503125076 (01/08/2025) · ainda não parcelado',
    valor: 1103.67,
    moeda: 'BRL',
    status: 'pendente, sem parcelamento pedido',
  },
  {
    nome: 'Domínio maquinadevendasonline.com.br',
    nota: 'reservado pro futuro domínio guarda-chuva do SaaS multi-cliente',
    valor: 40,
    moeda: 'BRL',
    status: 'pausado até o CNPJ sair — ainda não registrado',
  },
  {
    nome: 'ElevenLabs (voz clonada real)',
    nota: 'plano Creator, cogitado pro clone digital do cliente',
    valor: 22,
    moeda: 'USD',
    ciclo: 'mensal (se assinar)',
    status: 'ainda não assinado',
  },
  {
    nome: 'HeyGen (clone digital em vídeo)',
    nota: 'pay-as-you-go, ~US$4/min gerado',
    valor: 5,
    moeda: 'USD',
    ciclo: 'a partir de (se ativar)',
    status: 'conta ainda não criada',
  },
  {
    nome: 'Vercel',
    nota: 'hospedagem antiga do app — Franklin decidiu encerrar em 01/09/2026',
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

module.exports = { calcularExtrato };
