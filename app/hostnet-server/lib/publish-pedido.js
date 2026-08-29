const { putFileToGithub } = require('./github');
const { loadUsers, saveUsers, findUser } = require('./users');

const HISTORY_LIMIT = 200;

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

async function recordUsage(identifier, imageCount, videoCount, instruction) {
  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user) return;

  const stats = user.stats || { totalPedidos: 0, fotos: 0, videos: 0 };
  stats.totalPedidos += 1;
  stats.fotos += imageCount;
  stats.videos += videoCount;
  const now = new Date().toISOString();
  stats.lastRequestAt = now;
  user.stats = stats;

  user.history = user.history || [];
  user.history.push({
    date: now,
    instruction: String(instruction || '').slice(0, 200),
    imageCount,
    videoCount,
  });
  if (user.history.length > HISTORY_LIMIT) {
    user.history = user.history.slice(user.history.length - HISTORY_LIMIT);
  }

  await saveUsers(users);
}

// Lógica central de "mandar um pedido pro GitHub" — usada tanto pelo envio
// imediato (routes/commit.js) quanto pelo disparo de posts agendados
// (lib/scheduled-dispatcher.js), pra não duplicar essa parte em dois lugares.
async function publishPedido({ identifier, client, instruction, files }) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    throw new Error('Configuração do servidor incompleta (variáveis de ambiente)');
  }

  const imageCount = files.filter((f) => f.mimetype.startsWith('image/')).length;
  const videoCount = files.filter((f) => f.mimetype.startsWith('video/')).length;

  const subfolder = timestampFolderName();
  const basePath = `.claude/skills/${client}/${subfolder}`;

  const results = [];
  for (const file of files) {
    const filename = sanitizeFilename(file.originalname);
    try {
      const base64Content = Buffer.isBuffer(file.buffer)
        ? file.buffer.toString('base64')
        : Buffer.from(file.buffer).toString('base64');
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

  let instructionsResult;
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
    await recordUsage(identifier, imageCount, videoCount, instruction);
  } catch (error) {
    // Estatística é secundária - não deve derrubar o pedido do cliente se falhar.
  }

  return {
    subfolder: basePath,
    files: results,
    instructions: instructionsResult,
    partial: anyMediaFailed || instructionsResult.status === 'erro',
  };
}

module.exports = { publishPedido, sanitizeFilename };
