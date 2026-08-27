const { resolveClient } = require('../lib/auth');
const { putFileToGithub } = require('../lib/github');
const { loadUsers, saveUsers, findUser } = require('../lib/users');

// Registra o uso de cada conta pro relatório administrativo (quantidade de
// pedidos, fotos e vídeos por cliente) — só pra contas de verdade cadastradas
// (login legado da senha mestra não conta, não é uma conta de cliente).
async function recordUsage(identifier, imageCount, videoCount) {
  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user) return;

  const stats = user.stats || { totalPedidos: 0, fotos: 0, videos: 0 };
  stats.totalPedidos += 1;
  stats.fotos += imageCount;
  stats.videos += videoCount;
  stats.lastRequestAt = new Date().toISOString();
  user.stats = stats;

  await saveUsers(users);
}

function sanitizeFilename(name) {
  return String(name || 'arquivo')
    .replace(/[\\/]/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-100);
}

function timestampFolderName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `app-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}

// Diferença da versão Vercel: lá o navegador subia o arquivo primeiro pro
// Vercel Blob (pra não estourar o limite de payload da função serverless) e
// aqui só chegava a URL. Aqui não existe esse limite (servidor Node normal,
// sempre ligado) — o navegador manda o arquivo direto no multipart, e o
// multer (configurado em server.js) já entrega o conteúdo em req.files.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, instruction } = req.body || {};
  const uploadedFiles = req.files || [];
  const imageCount = uploadedFiles.filter((f) => f.mimetype.startsWith('image/')).length;
  const videoCount = uploadedFiles.filter((f) => f.mimetype.startsWith('video/')).length;

  const client = await resolveClient({ identifier, password });
  if (!client) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  if (!instruction || !String(instruction).trim()) {
    res.status(400).json({ error: 'Pedido em texto livre é obrigatório' });
    return;
  }

  if (!identifier || !String(identifier).trim()) {
    res.status(400).json({ error: 'E-mail ou telefone é obrigatório' });
    return;
  }

  if (uploadedFiles.length === 0) {
    res.status(400).json({ error: 'Nenhum arquivo enviado' });
    return;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    res.status(500).json({ error: 'Configuração do servidor incompleta (variáveis de ambiente)' });
    return;
  }

  const subfolder = timestampFolderName();
  const basePath = `.claude/skills/${client}/${subfolder}`;

  const results = [];
  for (const file of uploadedFiles) {
    const filename = sanitizeFilename(file.originalname);
    try {
      const base64Content = file.buffer.toString('base64');

      await putFileToGithub({
        owner,
        repo,
        token,
        path: `${basePath}/${filename}`,
        message: `app upload: ${subfolder}/${filename}`,
        base64Content,
      });

      results.push({ file: filename, status: 'ok' });
    } catch (error) {
      results.push({ file: filename, status: 'erro', error: error.message });
    }
  }

  const anyMediaFailed = results.some((r) => r.status === 'erro');

  // instrucoes.txt vai por último: sua presença é o sinal que a rotina automática
  // usa pra saber que a tarefa está pronta, então só comitamos depois que os
  // arquivos de mídia já estão no repositório.
  let instructionsResult = null;
  try {
    const instructionsContent = `Enviado por: ${identifier}\n\n${instruction}`;
    const base64Content = Buffer.from(instructionsContent, 'utf-8').toString('base64');
    await putFileToGithub({
      owner,
      repo,
      token,
      path: `${basePath}/instrucoes.txt`,
      message: `app upload: ${subfolder}/instrucoes.txt`,
      base64Content,
    });
    instructionsResult = { status: 'ok' };
  } catch (error) {
    instructionsResult = { status: 'erro', error: error.message };
  }

  try {
    await recordUsage(identifier, imageCount, videoCount);
  } catch (error) {
    // Estatística é secundária - não deve derrubar o pedido do cliente se falhar.
  }

  res.status(anyMediaFailed || instructionsResult.status === 'erro' ? 207 : 200).json({
    client,
    subfolder: basePath,
    files: results,
    instructions: instructionsResult,
  });
};
