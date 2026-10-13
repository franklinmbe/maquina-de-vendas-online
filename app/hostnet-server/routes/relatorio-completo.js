const { resolveClient } = require('../lib/auth');
const { verifyShare } = require('../lib/share-token');
const { CONTAS, contasForClient, getOrganic, loadAds, adsHistory } = require('../lib/relatorio-completo');

// Relatório completo (aba Orgânico + aba Anúncios) — relatorio-completo.html.
// Admin (frank) escolhe qualquer empresa; vendedores da RJ Inox veem a RJ Inox;
// Kleber vê a dele. Ver lib/relatorio-completo.js.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { identifier, password, share } = req.body || {};
  let { conta } = req.body || {};
  // Link de compartilhamento: só a empresa do link, só pra ver (lib/share-token.js).
  const shared = share ? verifyShare(share) : null;
  if (share && !shared) {
    res.status(401).json({ error: 'Este link venceu ou não é válido. Peça um novo.' });
    return;
  }
  const client = shared ? shared.client : await resolveClient({ identifier, password });
  if (!client) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }
  let allowed = contasForClient(client);
  if (shared && shared.conta && allowed.includes(shared.conta)) allowed = [shared.conta];
  else if (shared) allowed = allowed.slice(0, 1);
  if (shared) conta = allowed[0];
  if (allowed.length === 0) {
    res.status(403).json({ error: 'Seu relatório completo ainda não foi montado. Fale com o suporte.' });
    return;
  }
  const contaId = allowed.includes(conta) ? conta : allowed[0];
  const [organico, anuncios] = await Promise.all([getOrganic(contaId), loadAds(contaId)]);
  res.status(200).json({
    ok: true,
    isAdmin: !shared && client === 'frank',
    compartilhado: !!shared,
    client,
    conta: contaId,
    contas: allowed.map((id) => ({ id, nome: CONTAS[id].nome })),
    organico,
    anuncios,
    historicoAnuncios: adsHistory(contaId, anuncios),
  });
};
