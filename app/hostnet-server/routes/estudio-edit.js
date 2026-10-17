const { loadUsers, saveUsers, findUser, verifyPassword } = require('../lib/users');
const { runEdit, usesAi } = require('../lib/estudio-edit');
const { getMediaUsage, checkAndConsumeMedia } = require('../lib/media-quota');

// Edição na hora do Cut Estúdio (cortar, velocidade, câmera lenta,
// estabilizar, tamanho, música, legendas, tirar fundo, melhorar foto).
// Devolve o arquivo pronto na própria resposta — nada é gravado nem
// publicado aqui. Ferramenta com IA de imagem (tirar fundo) gasta 1 imagem
// da cota do plano, só quando dá certo.
module.exports = async function handler(req, res) {
  const { identifier, password } = req.body || {};
  const tool = String((req.body || {}).tool || '');
  const isMaster = !!(process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE);
  let user = null;
  if (!isMaster) {
    user = findUser(await loadUsers(), identifier);
    if (!user || !verifyPassword(password, user.passwordHash)) { res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' }); return; }
  }

  const file = (req.files || [])[0];
  if (!file) { res.status(400).json({ error: 'Envie o arquivo.' }); return; }
  let options = {};
  try { options = JSON.parse(req.body.options || '{}'); } catch (e) {}

  const ai = usesAi(tool) && user;
  if (ai) {
    const s = getMediaUsage(user);
    if (s && s.images.used >= s.images.limit) {
      res.status(403).json({ error: `As ${s.images.limit} imagens do seu plano neste ${s.periodo} já foram usadas. Mude de plano pelo WhatsApp ou aguarde o próximo mês.` });
      return;
    }
  }

  try {
    const result = await runEdit(tool, file, options, (req.files || [])[1] || null);
    if (ai) {
      // Relê o cadastro pra não sobrescrever o que mudou enquanto a IA trabalhava.
      const users = await loadUsers();
      const fresh = findUser(users, identifier);
      if (fresh) { checkAndConsumeMedia(fresh, 'images', 1); await saveUsers(users); }
    }
    res.set('Content-Type', result.mime);
    res.set('X-Result-Name', result.name);
    res.send(result.buffer);
  } catch (error) {
    console.error(`[estudio-edit] ${tool} falhou:`, error.message);
    const friendly = /^[A-ZÀ-Ú]/.test(error.message) && !/ffmpeg|Command failed|Gemini|GEMINI/i.test(error.message);
    res.status(400).json({ error: friendly ? error.message : 'Não deu pra editar esse arquivo. Tente de novo ou use outro vídeo ou foto.' });
  }
};
