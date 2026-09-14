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

async function listGithubFolder({ owner, repo, token, path }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (response.status === 404) return [];
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub recusou listar ${path}: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// Igual listGithubFolder, mas devolve `null` (não `[]`) quando a pasta não
// existe — usado onde essa distinção importa pro front-end (pasta ainda não
// existe = "ainda gerando" vs. pasta existe mas está vazia = "tudo
// descartado", ver routes/pedido-folder.js). listGithubFolder já tinha
// muita gente chamando ela esperando `[]` nos dois casos, então essa é uma
// função separada em vez de mudar o comportamento dela.
async function listGithubFolderOrNull({ owner, repo, token, path }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub recusou listar ${path}: ${response.status} ${errorBody}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : null;
}

async function getGithubFileSha({ owner, repo, token, path }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub recusou consultar ${path}: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? null : data.sha;
}

// Lê o conteúdo de um arquivo já existente no repo, em base64 — usado pra
// "mover" um arquivo staged (.claude/skills/<client>/_staging/...) pra
// dentro da pasta final do pedido (ver lib/publish-pedido.js). O Contents
// API só devolve `content` inline pra arquivos até 1MB; acima disso vem
// vazio mas `download_url` funciona normalmente — cobre os dois casos.
async function getFileContentBase64({ owner, repo, token, path }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub recusou consultar ${path}: ${response.status} ${errorBody}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) throw new Error(`${path} é uma pasta, não um arquivo`);
  if (data.content) return data.content.replace(/\n/g, '');
  if (data.download_url) {
    const raw = await fetch(data.download_url);
    if (!raw.ok) throw new Error(`Falha ao baixar ${path}: ${raw.status}`);
    return Buffer.from(await raw.arrayBuffer()).toString('base64');
  }
  throw new Error(`Não consegui ler o conteúdo de ${path}`);
}

async function deleteFileFromGithub({ owner, repo, token, path, message }) {
  const sha = await getGithubFileSha({ owner, repo, token, path });
  if (!sha) return { deleted: false, reason: 'not_found' };

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, sha }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub recusou apagar ${path}: ${response.status} ${errorBody}`);
  }

  return { deleted: true };
}

module.exports = { putFileToGithub, listGithubFolder, listGithubFolderOrNull, deleteFileFromGithub, getFileContentBase64 };
