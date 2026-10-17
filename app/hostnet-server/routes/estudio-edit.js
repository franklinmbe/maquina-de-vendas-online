const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { runEdit } = require('../lib/estudio-edit');

// Edição na hora do Cut Estúdio (cortar, velocidade, câmera lenta,
// estabilizar, tamanho, música, melhorar foto). Devolve o arquivo pronto na
// própria resposta — nada é gravado nem publicado aqui.
module.exports = async function handler(req, res) {
  const { identifier, password, tool } = req.body || {};
  let ok = !!(process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE);
  if (!ok) {
    const user = findUser(await loadUsers(), identifier);
    ok = !!(user && verifyPassword(password, user.passwordHash));
  }
  if (!ok) { res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' }); return; }

  const file = (req.files || [])[0];
  if (!file) { res.status(400).json({ error: 'Envie o arquivo.' }); return; }
  let options = {};
  try { options = JSON.parse(req.body.options || '{}'); } catch (e) {}

  try {
    const result = await runEdit(String(tool || ''), file, options);
    res.set('Content-Type', result.mime);
    res.set('X-Result-Name', result.name);
    res.send(result.buffer);
  } catch (error) {
    console.error(`[estudio-edit] ${tool} falhou:`, error.message);
    const friendly = /^[A-ZÀ-Ú]/.test(error.message) && !/ffmpeg|Command failed/i.test(error.message);
    res.status(400).json({ error: friendly ? error.message : 'Não deu pra editar esse arquivo. Tente outro vídeo ou foto.' });
  }
};
