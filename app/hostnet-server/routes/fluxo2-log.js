const { appendEvents } = require('../lib/fluxo2-log');
const { addTips, updateTips } = require('../lib/fluxo2-tips');

// Grava eventos do Fluxo 2 no registro diário de um cliente, e também as dicas
// de estratégia do dia (`tips`) e o andamento delas (`tipUpdates`). Só a senha
// mestra escreve — é o Claude, na sessão que executa o fluxo, quem chama (ver
// lib/fluxo2-log.js e lib/fluxo2-tips.js). Cliente comum nunca escreve aqui.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase, client, events, tips, tipUpdates } = req.body || {};

  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  if (!/^[a-z0-9-]{2,60}$/.test(String(client || ''))) {
    res.status(400).json({ error: 'client inválido (use o identificador interno, ex: kleber-construcao)' });
    return;
  }

  const lists = { events, tips, tipUpdates };
  for (const [name, list] of Object.entries(lists)) {
    if (list != null && (!Array.isArray(list) || list.length > 50)) {
      res.status(400).json({ error: `${name} precisa ser uma lista de até 50 itens` });
      return;
    }
  }
  if (!(events && events.length) && !(tips && tips.length) && !(tipUpdates && tipUpdates.length)) {
    res.status(400).json({ error: 'Envie ao menos um evento, dica ou atualização de dica' });
    return;
  }

  const ev = events && events.length ? appendEvents(client, events) : { added: [], skipped: 0 };
  const tp = tips && tips.length ? addTips(client, tips) : { added: [], skipped: 0 };
  const updated = tipUpdates && tipUpdates.length ? updateTips(client, tipUpdates) : 0;
  res.status(200).json({
    ok: true,
    added: ev.added.length,
    skipped: ev.skipped,
    tipsAdded: tp.added.length,
    tipsSkipped: tp.skipped,
    tipsUpdated: updated,
  });
};
