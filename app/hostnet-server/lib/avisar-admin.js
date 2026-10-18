// Lembrete pro Franklin quando entra pagamento de plano ou uma conta é
// liberada sozinha (Franklin, 2026-10-18: "o ideal é que venha no WhatsApp").
// Canais (cada um só funciona se estiver configurado no .env do servidor):
// - WhatsApp pelo CallMeBot (grátis, só manda pra o próprio número que
//   autorizou): CALLMEBOT_PHONE (ex: 5521999059608) + CALLMEBOT_APIKEY.
// - Telegram pelo bot do app: ADMIN_TELEGRAM_CHAT_ID (+ TELEGRAM_BOT_TOKEN).
// Falha de aviso nunca derruba o pagamento/liberação — só vai pro log.
async function avisarAdmin(texto) {
  const tarefas = [];
  if (process.env.CALLMEBOT_PHONE && process.env.CALLMEBOT_APIKEY) {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(process.env.CALLMEBOT_PHONE)}&text=${encodeURIComponent(texto)}&apikey=${encodeURIComponent(process.env.CALLMEBOT_APIKEY)}`;
    tarefas.push(fetch(url, { signal: AbortSignal.timeout(20000) }).then((r) => { if (!r.ok) throw new Error(`CallMeBot ${r.status}`); }));
  }
  if (process.env.ADMIN_TELEGRAM_CHAT_ID && process.env.TELEGRAM_BOT_TOKEN) {
    tarefas.push(fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.ADMIN_TELEGRAM_CHAT_ID, text: texto }),
      signal: AbortSignal.timeout(20000),
    }).then((r) => { if (!r.ok) throw new Error(`Telegram ${r.status}`); }));
  }
  const res = await Promise.allSettled(tarefas);
  res.filter((r) => r.status === 'rejected').forEach((r) => console.error('[avisar-admin] falhou:', r.reason && r.reason.message));
  return tarefas.length;
}

module.exports = { avisarAdmin };
