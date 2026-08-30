const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveClient } = require('../lib/auth');
const { loadUsers, saveUsers, findUser } = require('../lib/users');
const { sanitizeFilename } = require('../lib/publish-pedido');

function scheduledDir() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado');
  return path.join(dir, 'scheduled');
}

// Guarda um pedido pra publicar depois, no horário marcado no Calendário —
// os arquivos ficam salvos em disco (não vão pro GitHub ainda) até o
// lib/scheduled-dispatcher.js disparar na hora certa.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, instruction, scheduledFor, targetClient } = req.body || {};
  const uploadedFiles = req.files || [];

  const resolvedClient = await resolveClient({ identifier, password });
  if (!resolvedClient) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  // Mesma regra do commit.js: só o admin (frank) pode agendar em nome de
  // outro cliente, via as contas marcadas em Contas Conectadas.
  const client = resolvedClient === 'frank' && targetClient ? String(targetClient).trim() : resolvedClient;

  if (!instruction || !String(instruction).trim()) {
    res.status(400).json({ error: 'Pedido em texto livre é obrigatório' });
    return;
  }
  if (uploadedFiles.length === 0) {
    res.status(400).json({ error: 'Nenhum arquivo enviado' });
    return;
  }
  const scheduledDate = new Date(scheduledFor);
  if (!scheduledFor || Number.isNaN(scheduledDate.getTime())) {
    res.status(400).json({ error: 'Data/hora de agendamento inválida' });
    return;
  }
  if (scheduledDate.getTime() <= Date.now()) {
    res.status(400).json({ error: 'A data de agendamento já passou' });
    return;
  }

  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user) {
    res.status(400).json({
      error: 'Pra agendar é preciso estar logado com sua conta cadastrada (não vale a senha mestra sozinha).',
    });
    return;
  }

  const id = crypto.randomUUID();
  const dir = path.join(scheduledDir(), id);
  fs.mkdirSync(dir, { recursive: true });

  const savedFiles = [];
  for (const file of uploadedFiles) {
    const filename = sanitizeFilename(file.originalname);
    fs.writeFileSync(path.join(dir, filename), file.buffer);
    savedFiles.push({ filename, mimetype: file.mimetype });
  }

  user.scheduledPosts = user.scheduledPosts || [];
  user.scheduledPosts.push({
    id,
    client,
    instruction: String(instruction),
    scheduledFor: scheduledDate.toISOString(),
    createdAt: new Date().toISOString(),
    files: savedFiles,
    status: 'pending',
  });
  await saveUsers(users);

  res.status(200).json({ ok: true, id, scheduledFor: scheduledDate.toISOString() });
};
