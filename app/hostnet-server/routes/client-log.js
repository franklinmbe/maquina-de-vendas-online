const { resolveClient } = require('../lib/auth');

// Diagnóstico do envio pelo celular (Franklin, 2026-11-20): a Ale ficava com
// o "Publicar" parado em 90% e NADA chegava ao servidor (nem o anexo), então
// não havia como saber o motivo. O navegador manda aqui um registro pequeno
// (JSON, sem o arquivo) quando o envio falha ou demora: tamanho e tipo dos
// arquivos, conexão do aparelho, tempo, erro. Erro avisa o admin no WhatsApp/
// Telegram (no máximo 1 aviso a cada 10 min por cliente).
const ultimoAviso = new Map();
const AVISO_EVENTOS = new Set(['envio-erro', 'anexo-erro']);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { identifier, password, evento, detalhe } = req.body || {};
  const client = await resolveClient({ identifier, password }).catch(() => null);
  if (!client) return res.status(401).json({ error: 'não autorizado' });
  const ev = String(evento || '').slice(0, 40);
  const info = JSON.stringify(detalhe || {}).slice(0, 1500);
  console.log(`[client-log] ${client} ${ev} ${info}`);
  if (AVISO_EVENTOS.has(ev)) {
    const agora = Date.now();
    if (agora - (ultimoAviso.get(client) || 0) > 10 * 60 * 1000) {
      ultimoAviso.set(client, agora);
      require('../lib/avisar-admin').avisarAdmin(`⚠️ ${client}: envio pelo app falhou (${ev}). ${info.slice(0, 400)}`).catch(() => {});
    }
  }
  res.json({ ok: true });
};
