// Faturamento real da Máquina de Vendas Online (definido por Franklin em
// 2026-10-06). Hoje NINGUÉM paga plano: todo o faturamento é "mão de obra do
// projeto do tráfego pago", cobrada como 50% do valor total investido em
// anúncios no Meta Ads — separado empresa por empresa.
//
// O investimento NÃO é fixo: é o gasto real dos últimos 30 dias da conta de
// anúncios de cada empresa, lido do mesmo relatório de anúncios do app
// (lib/relatorio-completo.js → campanhas-<conta>.json). Se a empresa gastar
// mais, o faturamento sobe sozinho. `investimentoReferencia` (o valor que
// Franklin informou) só é usado se o relatório de anúncios não existir.
//
// As contas cobertas por um contrato NÃO entram na receita de planos.
const { loadAds } = require('./relatorio-completo');

const CONTRATOS = [
  {
    id: 'rjinox',
    nome: 'RJ Inox',
    tipo: 'Mão de obra do projeto do tráfego pago',
    adsConta: 'rjinox',
    investimentoReferencia: 7000,
    plataformas: 'Meta Ads',
    percentual: 0.5,
    cobre: (client) => /-rjinox$/.test(client || ''),
  },
  {
    id: 'kleber',
    nome: 'Kleber Materiais de Construção',
    tipo: 'Mão de obra do projeto do tráfego pago',
    adsConta: 'kleber',
    investimentoReferencia: 1200,
    plataformas: 'Meta Ads',
    percentual: 0.5,
    cobre: (client) => client === 'kleber-construcao',
  },
];

const PLAN_PRICES = { iniciante: 100, profissional: 200, especialista: 300 };
const round2 = (n) => Math.round(n * 100) / 100;

function contratoDe(client) {
  return CONTRATOS.find((c) => c.cobre(client)) || null;
}

// Gasto dos últimos 30 dias no relatório de anúncios da empresa.
async function gasto30dias(adsConta) {
  try {
    const ads = await loadAds(adsConta);
    const p = ads && ads.periodos && (ads.periodos['30'] || ads.periodos[30]);
    if (!p) return null;
    const gasto = p.total && typeof p.total.gasto === 'number'
      ? p.total.gasto
      : (p.campanhas || []).reduce((s, c) => s + (Number(c.gasto) || 0), 0);
    return { gasto: round2(gasto), periodo: p.rotulo || 'Últimos 30 dias', atualizadoEm: ads.atualizadoEm || null };
  } catch {
    return null;
  }
}

// `users`: lista de contas (sem o admin). Devolve o faturamento mensal.
async function faturamentoMensal(users) {
  const maoDeObra = await Promise.all(CONTRATOS.map(async (c) => {
    const real = await gasto30dias(c.adsConta);
    const investimento = real ? real.gasto : c.investimentoReferencia;
    return {
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      plataformas: c.plataformas,
      percentual: c.percentual,
      investimento,
      fonte: real ? 'gasto real' : 'valor informado',
      periodo: real ? real.periodo : null,
      lidoEm: real ? real.atualizadoEm : null,
      valor: round2(investimento * c.percentual),
      contas: users.filter((u) => c.cobre(u.client)).length,
    };
  }));
  // Plano só entra quando Franklin avisa que a pessoa contratou e pagou
  // (marcado à mão como `pagaPlano: true` no cadastro). O plano do cadastro,
  // sozinho, só libera recursos e não é faturamento.
  const pagantes = users.filter((u) => !contratoDe(u.client) && u.pagaPlano === true && PLAN_PRICES[u.plan]);
  const planos = { valor: pagantes.reduce((n, u) => n + PLAN_PRICES[u.plan], 0), pagantes: pagantes.length };
  const totalMaoDeObra = round2(maoDeObra.reduce((n, c) => n + c.valor, 0));
  return { total: round2(totalMaoDeObra + planos.valor), maoDeObra, totalMaoDeObra, planos };
}

module.exports = { CONTRATOS, PLAN_PRICES, contratoDe, faturamentoMensal };
