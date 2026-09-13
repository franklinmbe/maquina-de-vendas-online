const { CATALOGO, contarTotais } = require('../lib/agentes-catalogo');

// Vitrine pública do time de agentes de IA — sem dado de cliente nenhum,
// então sem autenticação: usada na página de Planos (visitante sem login)
// e reaproveitada em Ajustes.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const totais = contarTotais();
  res.status(200).json({ ok: true, catalogo: CATALOGO, ...totais });
};
