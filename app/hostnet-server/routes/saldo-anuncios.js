const { resolveClient } = require('../lib/auth');
const { verifyShare } = require('../lib/share-token');
const { saldoDoCliente } = require('../lib/saldo-anuncios');
const { contasForClient } = require('../lib/relatorio-completo');

// Saldo da conta de anúncios (Meta Ads) — lib/saldo-anuncios.js.
// Body: { identifier, password | share, cliente? (só admin), conta? (relatório
// completo), atualizar? (botão "Atualizar agora") }.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { identifier, password, share, cliente, conta, atualizar } = req.body || {};
  const shared = share ? verifyShare(share) : null;
  if (share && !shared) {
    res.status(401).json({ error: 'Este link venceu ou não é válido. Peça um novo.' });
    return;
  }
  const me = shared ? shared.client : await resolveClient({ identifier, password });
  if (!me) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }
  const client = !shared && me === 'frank' && cliente ? String(cliente) : me;
  try {
    // conta do relatório só vale se o login pode ver essa empresa
    const contaOk = conta && contasForClient(me).includes(conta) && (!shared || !shared.conta || shared.conta === conta) ? conta : null;
    const out = await saldoDoCliente(client, { force: !!atualizar && !shared, contaRelatorio: contaOk });
    res.status(200).json({ ok: true, client, ...out });
  } catch (e) {
    res.status(500).json({ error: `Não consegui ler o saldo agora (${e.message}).` });
  }
};
