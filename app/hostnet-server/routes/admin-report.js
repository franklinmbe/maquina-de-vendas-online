const { loadUsers } = require('../lib/users');
const { PLAN_LIMITS } = require('../lib/plan-limits');

// Preço mensal fixo por plano (ver app/public/index.html, cards de plano) —
// Personalizado é "sob consulta", sem preço fixo, não entra na receita estimada.
const PLAN_PRICES = { iniciante: 100, profissional: 200, especialista: 300 };
// teste7dias (Teste Grátis 7 Dias) não entra no PLAN_PRICES — é gratuito.

// Relatório administrativo, conta por conta: identidade, plano, login
// (última vez + quantidade) e uso (pedidos, fotos, vídeos). Mais campos
// entram conforme o Franklin for pedindo (ver app/public/relatorio.html).
// Nunca devolve passwordHash nem senha em texto puro — a senha do cliente
// nunca é armazenada em nenhum lugar, só o hash (scrypt, irreversível), então
// não existe "mostrar a senha" possível aqui, nem em uma versão futura disso.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase } = req.body || {};

  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  const users = await loadUsers();
  const accounts = users.map((u) => {
    const connections = Object.keys(u.connections || {});
    const limit = PLAN_LIMITS[u.plan];
    return {
      name: u.name,
      identifier: u.identifier,
      altIdentifier: u.altIdentifier || '',
      client: u.client,
      plan: u.plan || '',
      createdAt: u.createdAt || null,
      lastLogin: u.lastLogin || null,
      loginCount: u.loginCount || 0,
      totalPedidos: (u.stats && u.stats.totalPedidos) || 0,
      fotos: (u.stats && u.stats.fotos) || 0,
      videos: (u.stats && u.stats.videos) || 0,
      lastRequestAt: (u.stats && u.stats.lastRequestAt) || null,
      connections,
      networksLabel: limit ? `${connections.length}/${limit}` : `${connections.length}`,
    };
  });

  // Só clientes de verdade entram na receita/plano (o próprio Franklin loga
  // como 'frank' via senha mestra e não é uma conta de cliente contratante).
  const clientAccounts = accounts.filter((a) => a.client !== 'frank');
  const planBreakdown = {};
  let estimatedMRR = 0;
  let semPlanoDefinido = 0;
  for (const acc of clientAccounts) {
    if (!acc.plan) {
      semPlanoDefinido += 1;
      continue;
    }
    planBreakdown[acc.plan] = (planBreakdown[acc.plan] || 0) + 1;
    if (PLAN_PRICES[acc.plan]) estimatedMRR += PLAN_PRICES[acc.plan];
  }

  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const inactivos30dias = clientAccounts.filter((a) => !a.lastLogin || now - new Date(a.lastLogin).getTime() > THIRTY_DAYS).length;
  const nuncaFezPedido = clientAccounts.filter((a) => a.totalPedidos === 0).length;

  res.status(200).json({
    ok: true,
    total: accounts.length,
    loggedAtLeastOnce: accounts.filter((a) => a.lastLogin).length,
    estimatedMRR,
    planBreakdown,
    semPlanoDefinido,
    inactivos30dias,
    nuncaFezPedido,
    accounts,
  });
};
