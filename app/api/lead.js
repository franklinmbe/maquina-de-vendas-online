const { putFileToGithub } = require('./_lib/github');

function timestampFilename() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `lead-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { name, email, whatsapp } = req.body || {};

  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'Nome é obrigatório' });
    return;
  }
  if (!email || !String(email).trim()) {
    res.status(400).json({ error: 'E-mail é obrigatório' });
    return;
  }
  if (!whatsapp || !String(whatsapp).trim()) {
    res.status(400).json({ error: 'WhatsApp é obrigatório' });
    return;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    res.status(500).json({ error: 'Configuração do servidor incompleta (variáveis de ambiente)' });
    return;
  }

  const filename = timestampFilename();
  const content =
    `Nome: ${name}\n` +
    `E-mail: ${email}\n` +
    `WhatsApp: ${whatsapp}\n` +
    `Plano de interesse: Personalizado\n`;
  const base64Content = Buffer.from(content, 'utf-8').toString('base64');

  try {
    await putFileToGithub({
      owner,
      repo,
      token,
      path: `.claude/leads/${filename}.txt`,
      message: `novo lead: ${filename}`,
      base64Content,
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao registrar lead' });
  }
};
