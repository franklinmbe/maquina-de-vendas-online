const { resolveClient } = require('../lib/auth');
const { retryFailedPublication } = require('../lib/auto-publish');

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '');
}

// "🔁 Repostar onde falhou" (Franklin, 2026-11-17): o próprio cliente tenta
// de novo, de dentro do app, só as redes/formatos que deram erro num pedido
// já publicado — ver retryFailedPublication em lib/auto-publish.js.
// Exige login: cliente só reposta os próprios pedidos; o admin (frank) pode
// repostar de qualquer cliente.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  const resolved = await resolveClient({ identifier, password });
  if (!resolved) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  const requested = safeSegment(req.body?.client);
  const pasta = safeSegment(req.body?.pasta);
  const client = resolved === 'frank' && requested ? requested : resolved;
  if (!pasta || (requested && requested !== client)) {
    res.status(400).json({ error: 'Pedido inválido' });
    return;
  }

  try {
    const only = Array.isArray(req.body?.only) ? req.body.only.filter((n) => Number.isInteger(n) && n >= 0).slice(0, 100) : undefined;
    const r = await retryFailedPublication({ client, pasta, only });
    if (!r.ok) {
      res.status(400).json({ error: r.error || 'Não deu pra repostar', published: r.results || [] });
      return;
    }
    res.status(200).json({ ok: true, published: r.results });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao repostar' });
  }
};
