// Faturamento real da Máquina de Vendas Online (definido por Franklin em
// 2026-10-06). Hoje NINGUÉM paga plano: todo o faturamento é "mão de obra do
// projeto" (manutenção da mão de obra), cobrada como 50% do que a empresa
// investe por mês em anúncios (por enquanto só Meta Ads).
//
// - RJ Inox: um valor só pelos 4 vendedores (e o dono). Investe ~R$ 7.000/mês.
// - Kleber: investe R$ 1.200/mês → R$ 600.
//
// As contas cobertas por um contrato NÃO entram na receita de planos, mesmo
// que o cadastro delas marque um plano (o plano ali só libera recursos).
// Quando o investimento mudar, ou a empresa anunciar em outra plataforma,
// Franklin avisa e o valor é atualizado aqui.
const CONTRATOS = [
  {
    id: 'rjinox',
    nome: 'RJ Inox',
    tipo: 'Mão de obra do projeto',
    investimentoMensal: 7000,
    plataformas: 'Meta Ads',
    percentual: 0.5,
    cobre: (client) => /-rjinox$/.test(client || ''),
  },
  {
    id: 'kleber',
    nome: 'Kleber',
    tipo: 'Manutenção da mão de obra do projeto',
    investimentoMensal: 1200,
    plataformas: 'Meta Ads',
    percentual: 0.5,
    cobre: (client) => client === 'kleber-construcao',
  },
];

const PLAN_PRICES = { iniciante: 100, profissional: 200, especialista: 300 };

function contratoDe(client) {
  return CONTRATOS.find((c) => c.cobre(client)) || null;
}

// `users`: lista de contas (sem o admin). Devolve o faturamento mensal.
function faturamentoMensal(users) {
  const maoDeObra = CONTRATOS.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    investimentoMensal: c.investimentoMensal,
    plataformas: c.plataformas,
    percentual: c.percentual,
    valor: Math.round(c.investimentoMensal * c.percentual * 100) / 100,
    contas: users.filter((u) => c.cobre(u.client)).length,
  }));
  // Plano só entra quando Franklin avisa que a pessoa contratou e pagou
  // (marcado à mão como `pagaPlano: true` no cadastro). O plano do cadastro,
  // sozinho, só libera recursos e não é faturamento.
  const pagantes = users.filter((u) => !contratoDe(u.client) && u.pagaPlano === true && PLAN_PRICES[u.plan]);
  const planos = { valor: pagantes.reduce((n, u) => n + PLAN_PRICES[u.plan], 0), pagantes: pagantes.length };
  const totalMaoDeObra = maoDeObra.reduce((n, c) => n + c.valor, 0);
  return { total: totalMaoDeObra + planos.valor, maoDeObra, totalMaoDeObra, planos };
}

module.exports = { CONTRATOS, PLAN_PRICES, contratoDe, faturamentoMensal };
