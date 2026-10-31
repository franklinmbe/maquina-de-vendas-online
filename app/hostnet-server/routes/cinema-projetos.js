const { resolveClient } = require('../lib/auth');
const CP = require('../lib/cinema-projetos');

// 🎬 Estúdio de Cinema → Meus projetos (ver lib/cinema-projetos.js). action:
//   lista   → projetos do usuário (frank vê todos)
//   abrir   → um projeto completo
//   aprovar → aprova ou pede mudança no roteiro / cenas / vídeo de um bloco
//   salvar  → (só senha mestra) Claude grava o conteúdo do projeto
// Por enquanto só o admin usa (Franklin, 2026-10-31); cliente entra depois.
const LIBERADOS = ['frank'];

function isMaster(body) {
  return !!process.env.APP_PASSPHRASE && body.passphrase === process.env.APP_PASSPHRASE;
}

async function handler(req, res) {
  const body = req.body || {};
  const action = String(body.action || 'lista');
  try {
    if (action === 'salvar') {
      if (!isMaster(body)) { res.status(401).json({ error: 'Senha mestra incorreta' }); return; }
      res.json({ ok: true, projeto: CP.salvar(body.projeto || {}) });
      return;
    }
    const client = await resolveClient({ identifier: body.identifier, password: body.password });
    if (!client) { res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' }); return; }
    if (!LIBERADOS.includes(client)) { res.status(403).json({ error: 'Meus projetos do Estúdio de Cinema ainda não está liberado para a sua conta.' }); return; }

    if (action === 'lista') { res.json({ projetos: CP.listar(client) }); return; }
    if (action === 'abrir') {
      const p = CP.abrir(client, body.id);
      if (!p) { res.status(404).json({ error: 'Projeto não encontrado.' }); return; }
      res.json({ projeto: p });
      return;
    }
    if (action === 'aprovar') {
      const p = CP.aprovar(client, body);
      if (!p) { res.status(404).json({ error: 'Projeto não encontrado.' }); return; }
      res.json({ ok: true, projeto: p });
      return;
    }
    res.status(400).json({ error: 'Ação desconhecida.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Vídeo de um bloco (multipart: passphrase, id, bloco, files[0]).
async function video(req, res) {
  const body = req.body || {};
  if (!isMaster(body)) { res.status(401).json({ error: 'Senha mestra incorreta' }); return; }
  const f = (req.files || [])[0];
  if (!f) { res.status(400).json({ error: 'Mande o arquivo do vídeo.' }); return; }
  try {
    res.json({ ok: true, projeto: CP.salvarVideo(body.id, body.bloco, f.buffer) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

function arquivo(req, res) {
  const p = CP.caminhoArquivo(req.params.id, req.params.file, req.query.t);
  if (!p) { res.status(404).end(); return; }
  res.sendFile(p);
}

module.exports = { handler, video, arquivo };
