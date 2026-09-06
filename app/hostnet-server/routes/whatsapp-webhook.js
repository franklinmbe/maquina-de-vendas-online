const { loadUsers } = require('../lib/users');
const { decryptToken } = require('../lib/token-crypto');
const { findUserByPhoneNumberId } = require('../lib/saas-tenant');
const { sendMessage, extractInboundMessage } = require('../lib/whatsapp');
const { buildReply } = require('../lib/whatsapp-agent');

// Endpoint único do webhook do WhatsApp Cloud API (Meta) — atende TODOS os
// tenants do "Aplicativo SaaS" (ver CLAUDE.md), porque cada mensagem chega
// já identificando o phone_number_id de quem recebeu. Registrado uma única
// vez no painel do app Meta (Configuração → Webhooks), não por cliente.
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    // Handshake de verificação exigido pelo Meta ao cadastrar essa URL —
    // acontece uma vez só, não a cada mensagem.
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (
      mode === 'subscribe' &&
      token &&
      process.env.WHATSAPP_VERIFY_TOKEN &&
      token === process.env.WHATSAPP_VERIFY_TOKEN
    ) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // O Meta espera 200 rápido e reenvia a mesma mensagem várias vezes se não
  // receber a tempo — responde logo e processa depois, sem bloquear o Meta
  // esperando a gente terminar.
  res.status(200).end();

  try {
    const inbound = extractInboundMessage(req.body);
    if (!inbound || !inbound.text) return;

    const users = await loadUsers();
    const user = findUserByPhoneNumberId(users, inbound.phoneNumberId);
    if (!user || !user.saasApp || !user.saasApp.whatsapp) return;

    const { accessToken, escalationPhone } = user.saasApp.whatsapp;
    const reply = buildReply(user.client, inbound.from);

    let text = reply.text;
    if (reply.escalate && escalationPhone) {
      text += `\n\nSe for urgente, chame direto: ${escalationPhone}`;
    }

    await sendMessage({
      phoneNumberId: inbound.phoneNumberId,
      accessToken: decryptToken(accessToken),
      to: inbound.from,
      text,
    });
  } catch {
    // Falha aqui não pode derrubar o servidor nem disparar retry automático
    // (evita loop de reenvio) — só essa mensagem específica fica sem resposta.
  }
};
