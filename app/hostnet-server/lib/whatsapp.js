// Cloud API do WhatsApp Business (Meta) — envio e leitura de mensagens.
// Cada tenant do "Aplicativo SaaS" tem seu próprio número (phone_number_id),
// mas o webhook de recebimento é um só, compartilhado: toda mensagem chega
// junto com o phone_number_id de quem recebeu, então dá pra identificar o
// tenant sem precisar de uma URL de webhook por cliente
// (ver findUserByPhoneNumberId em lib/saas-tenant.js).
const GRAPH_VERSION = 'v20.0';

async function sendMessage({ phoneNumberId, accessToken, to, text }) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`WhatsApp recusou o envio: ${(body.error && body.error.message) || response.status}`);
  }
  return body;
}

// Extrai a primeira mensagem de texto de um payload de webhook do WhatsApp
// Cloud API, ou null se não for uma mensagem de texto nova (status de
// entrega, mídia, etc. — fora de escopo por enquanto, ver CLAUDE.md sobre o
// agente de suporte ser só texto/status de ficha).
function extractInboundMessage(payload) {
  const entry = payload && payload.entry && payload.entry[0];
  const change = entry && entry.changes && entry.changes[0];
  const value = change && change.value;
  const phoneNumberId = value && value.metadata && value.metadata.phone_number_id;
  const message = value && value.messages && value.messages[0];
  if (!phoneNumberId || !message) return null;
  return {
    phoneNumberId,
    from: message.from,
    text: (message.text && message.text.body) || null,
    messageId: message.id,
  };
}

module.exports = { sendMessage, extractInboundMessage };
