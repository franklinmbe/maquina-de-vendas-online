const { resolveClient } = require('../lib/auth');
const { audioParaTexto } = require('../lib/voz-chat');

// Áudio do botão VOZ dos chats → texto (Franklin, 2026-11-20). Vale pra
// cliente logado e pra visitante (chat de vendas antes do login), com teto
// por dia pra ninguém abusar.
const contadores = new Map(); // chave -> { dia, n }
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
  const { identifier, password } = req.body || {};
  const client = identifier && password ? await resolveClient({ identifier, password }).catch(() => null) : null;
  const ip = req.headers['x-real-ip'] || req.ip;
  const ok = client ? dentroDoLimite(`c:${client}`, 300) : dentroDoLimite(`ip:${ip}`, 20);
  if (!ok) return res.status(429).json({ error: 'Limite de áudios de hoje atingido. Pode escrever a mensagem.' });
  const arquivo = req.file || (req.files && req.files[0]);
  if (!arquivo || !arquivo.buffer || !arquivo.buffer.length) return res.status(400).json({ error: 'Áudio não chegou. Tente de novo.' });
  if (arquivo.buffer.length > 15 * 1024 * 1024) return res.status(413).json({ error: 'Áudio muito longo. Fale até 2 minutos.' });
  try {
    const texto = await audioParaTexto(arquivo.buffer, arquivo.originalname);
    res.json({ texto });
  } catch (e) {
    console.error('[transcrever-audio]', client || ip, e.message);
    res.status(500).json({ error: 'Não deu pra entender o áudio. Tente de novo, falando mais perto do celular.' });
  }
};
