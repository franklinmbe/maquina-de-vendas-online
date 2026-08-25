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

module.exports = { putFileToGithub };
