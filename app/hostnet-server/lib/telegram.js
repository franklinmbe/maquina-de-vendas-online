const API_BASE = 'https://api.telegram.org';

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN não configurado');
  return token;
}

async function callApi(method, params) {
  const token = getBotToken();
  const response = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = await response.json();
  if (!body.ok) {
    throw new Error(`Telegram recusou (${method}): ${body.description || 'erro desconhecido'}`);
  }
  return body.result;
}

let cachedBotId = null;
async function getBotId() {
  if (cachedBotId) return cachedBotId;
  const me = await callApi('getMe', {});
  cachedBotId = me.id;
  return cachedBotId;
}

// Telegram não usa OAuth: o cliente precisa adicionar o bot como
// administrador do canal/grupo dele por fora, e a gente só confirma isso
// aqui (equivalente a "autorizar" nas outras redes) antes de salvar a
// conexão.
async function verifyBotIsAdmin(chatUsername) {
  const chat = await callApi('getChat', { chat_id: chatUsername });
  const botId = await getBotId();
  const member = await callApi('getChatMember', { chat_id: chatUsername, user_id: botId });
  if (!['administrator', 'creator'].includes(member.status)) {
    throw new Error('O bot ainda não é administrador desse canal/grupo — adiciona ele como admin e tenta de novo');
  }
  return { chatId: chat.id, title: chat.title || chat.username };
}

async function sendPhoto({ chatId, photoUrl, caption }) {
  const result = await callApi('sendPhoto', { chat_id: chatId, photo: photoUrl, caption: caption || '' });
  return { messageId: result.message_id };
}

async function sendVideo({ chatId, videoUrl, caption }) {
  const result = await callApi('sendVideo', { chat_id: chatId, video: videoUrl, caption: caption || '' });
  return { messageId: result.message_id };
}

module.exports = { verifyBotIsAdmin, sendPhoto, sendVideo };
