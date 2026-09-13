const { calcularExtrato } = require('../lib/custos-operacao');

// Extrato da Operação — custos e vencimentos de toda ferramenta paga do
// projeto (Hostinger, Claude, Postiz, Hostnet, etc). Admin-only, mesma
// checagem de senha mestra do admin-report.js — nenhum dado de cliente
// aqui, só infraestrutura/fornecedores do próprio negócio.
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

  const extrato = calcularExtrato();
  res.status(200).json({ ok: true, ...extrato, atualizadoEm: new Date().toISOString() });
};
