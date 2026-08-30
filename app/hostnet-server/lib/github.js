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

module.exports = { putFileToGithub, listGithubFolder };
