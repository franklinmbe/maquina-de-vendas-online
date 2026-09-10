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

module.exports = { putFileToGithub, listGithubFolder, deleteFileFromGithub };
