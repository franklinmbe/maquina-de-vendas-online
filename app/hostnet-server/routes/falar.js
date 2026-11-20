const { resolveClient } = require('../lib/auth');
const { textoParaAudio } = require('../lib/voz-chat');

// Botão "🔊 Ouvir" dos chats (Franklin, 2026-11-20): resposta escrita → mp3
// com voz feminina de IA animada. Visitante (chat antes do login) também
// ouve, com teto por dia.
const contadores = new Map();
function dentroDoLimite(chave, max) {
  const dia = new Date().toISOString().slice(0, 10);
  const c = contadores.get(chave);
  if (!c || c.dia !== dia) { contadores.set(chave, { dia, n: 1 }); return true; }
  if (c.n >= max) return false;
  c.n += 1;
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { identifier, password, texto } = req.body || {};
  if (!texto || !String(texto).trim()) return res.status(400).json({ error: 'texto é obrigatório' });
  const client = identifier && password ? await resolveClient({ identifier, password }).catch(() => null) : null;
  const ip = req.headers['x-real-ip'] || req.ip;
  const ok = client ? dentroDoLimite(`c:${client}`, 300) : dentroDoLimite(`ip:${ip}`, 30);
  if (!ok) return res.status(429).json({ error: 'Limite de áudios de hoje atingido.' });
  try {
    const mp3 = await textoParaAudio(texto);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(mp3);
  } catch (e) {
    console.error('[falar]', client || ip, e.message);
    res.status(500).json({ error: 'Não deu pra gerar o áudio agora.' });
  }
};
