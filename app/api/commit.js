const ALLOWED_CLIENTS = ['frank', 'kleber-construcao'];

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

async function putFileToGithub({ owner, repo, token, path, message, base64Content }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content: base64Content }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub recusou ${path}: ${response.status} ${errorBody}`);
  }

  return response.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase, email, client, instruction, files } = req.body || {};

  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha incorreta' });
    return;
  }

  if (!ALLOWED_CLIENTS.includes(client)) {
    res.status(400).json({ error: `Cliente inválido: ${client}` });
    return;
  }

  if (!instruction || !String(instruction).trim()) {
    res.status(400).json({ error: 'Pedido em texto livre é obrigatório' });
    return;
  }

  if (!email || !String(email).trim()) {
    res.status(400).json({ error: 'E-mail é obrigatório' });
    return;
  }

  if (!Array.isArray(files) || files.length === 0) {
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
  for (const file of files) {
    const filename = sanitizeFilename(file.name);
    try {
      const blobResponse = await fetch(file.url);
      if (!blobResponse.ok) {
        throw new Error(`Falha ao baixar do Blob: ${blobResponse.status}`);
      }
      const arrayBuffer = await blobResponse.arrayBuffer();
      const base64Content = Buffer.from(arrayBuffer).toString('base64');

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
    const instructionsContent = `Enviado por: ${email}\n\n${instruction}`;
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

  res.status(anyMediaFailed || instructionsResult.status === 'erro' ? 207 : 200).json({
    client,
    subfolder: basePath,
    files: results,
    instructions: instructionsResult,
  });
};
