const { resolveClient } = require('../lib/auth');
const { verifyBotIsAdmin } = require('../lib/telegram');
const { saveUserConnection, loadUsers, findUser } = require('../lib/users');
const { checkPlanAllowsConnection } = require('../lib/plan-limits');

// Diferente do Meta/TikTok/YouTube: não tem popup de OAuth. O cliente
// adiciona o bot como admin do canal/grupo por fora do app e manda o
// @usuário aqui — a gente confere e salva.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, channelUsername } = req.body || {};

  const client = await resolveClient({ identifier, password });
  if (!client) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  const trimmed = String(channelUsername || '').trim();
  if (!trimmed) {
    res.status(400).json({ error: 'Informe o @usuário do canal ou grupo' });
    return;
  }

  const users = await loadUsers();
  const user = findUser(users, identifier);
  const planCheck = checkPlanAllowsConnection(user, 'telegram', 1);
  if (!planCheck.ok) {
    res.status(403).json({ error: planCheck.error });
    return;
  }

  try {
    const normalized = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
    const { chatId, title } = await verifyBotIsAdmin(normalized);
    await saveUserConnection(identifier, 'telegram', {
      connectedAt: new Date().toISOString(),
      chatId,
      title,
      username: normalized,
    });
    res.status(200).json({ ok: true, title });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Falha ao conectar o Telegram' });
  }
};
