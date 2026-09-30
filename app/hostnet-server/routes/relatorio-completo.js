const { resolveClient } = require('../lib/auth');
const { CONTAS, contasForClient, getOrganic, loadAds } = require('../lib/relatorio-completo');

// Relatório completo (aba Orgânico + aba Anúncios) — relatorio-completo.html.
// Admin (frank) escolhe qualquer empresa; vendedores da RJ Inox veem a RJ Inox;
// Kleber vê a dele. Ver lib/relatorio-completo.js.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { identifier, password, conta } = req.body || {};
  const client = await resolveClient({ identifier, password });
  if (!client) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }
  const allowed = contasForClient(client);
  if (allowed.length === 0) {
    res.status(403).json({ error: 'Seu relatório completo ainda não foi montado. Fale com o suporte.' });
    return;
  }
  const contaId = allowed.includes(conta) ? conta : allowed[0];
  const [organico, anuncios] = await Promise.all([getOrganic(contaId), loadAds(contaId)]);
  res.status(200).json({
    ok: true,
    isAdmin: client === 'frank',
    client,
    conta: contaId,
    contas: allowed.map((id) => ({ id, nome: CONTAS[id].nome })),
    organico,
    anuncios,
  });
};
