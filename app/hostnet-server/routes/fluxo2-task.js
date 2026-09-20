const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { loadTips, setSelected } = require('../lib/fluxo2-tips');
const { appendEvents } = require('../lib/fluxo2-log');

// Marca ou desmarca a caixinha de uma dica do dia. Cliente só mexe nas dicas
// do próprio registro; o admin (frank) mexe em qualquer uma. Marcar coloca a
// tarefa na fila do agente responsável — não executa nada (ver
// lib/fluxo2-tips.js) — e registra o pedido no dia a dia do Fluxo 2.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, tipId, selected } = req.body || {};
  if (!tipId || typeof selected !== 'boolean') {
    res.status(400).json({ error: 'Faltou informar a dica e se ela foi marcada ou desmarcada' });
    return;
  }

  let isAdmin = false;
  let ownClient = null;
  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    isAdmin = true;
    ownClient = 'frank';
  } else {
    const users = await loadUsers();
    const user = findUser(users, identifier);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
      return;
    }
    ownClient = user.client;
    isAdmin = user.client === 'frank';
  }

  const existing = loadTips().find((t) => t.id === tipId);
  if (!existing) {
    res.status(404).json({ error: 'Dica não encontrada' });
    return;
  }
  if (!isAdmin && existing.client !== ownClient) {
    res.status(403).json({ error: 'Essa dica não é do seu registro' });
    return;
  }

  const result = setSelected(tipId, selected, isAdmin ? 'Franklin' : 'Cliente');
  if (result.error) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const { added } = appendEvents(existing.client, [
    {
      type: 'nota',
      by: isAdmin ? 'Franklin' : 'Cliente',
      title: `${selected ? 'Tarefa marcada' : 'Tarefa desmarcada'}: ${existing.title}`,
      detail: selected
        ? `Entrou na fila do agente responsável (${existing.agent || 'a definir'}).${existing.needsApproval ? ' Vai ao ar só depois do OK do Franklin.' : ''}`
        : 'Saiu da fila antes de começar.',
    },
  ]);

  res.status(200).json({ ok: true, tip: result.tip, event: added[0] || null });
};
