const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { listGithubFolder } = require('../lib/github');

// Histórico de pedidos pra mostrar no Calendário — mesmo padrão de admin de
// connected-accounts.js: quem loga como frank vê o histórico de todos os
// clientes, cliente comum vê só o próprio.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  const users = await loadUsers();

  let targetUsers;

  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    targetUsers = users;
  } else {
    const user = findUser(users, identifier);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
      return;
    }
    targetUsers = user.client === 'frank' ? users : [user];
  }

  const entries = targetUsers.flatMap((u) => [
    ...(u.history || []).map((h) => ({ ...h, client: u.client })),
    // Agendados ainda na fila aparecem no dia/hora marcados (Franklin, 2026-10-28).
    ...(u.scheduledPosts || []).filter((p) => p.status === 'pending').map((p) => ({
      date: p.scheduledFor,
      instruction: p.instruction,
      client: p.client || u.client,
      agendado: true,
      pasta: p.pasta,
    })),
  ]);

  // Miniatura dos agendados: a 1ª foto/vídeo pronta da criação (revisao/).
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  await Promise.all(entries.filter((e) => e.agendado && e.pasta).map(async (e) => {
    try {
      const rev = await listGithubFolder({ owner, repo, token, path: `.claude/skills/${e.client}/${e.pasta}/revisao` });
      const media = rev.find((f) => f.type === 'file' && /\.(jpe?g|png|webp|mp4|mov|webm|m4v)$/i.test(f.name));
      if (media) {
        e.thumb = media.download_url;
        e.video = /\.(mp4|mov|webm|m4v)$/i.test(media.name);
      }
    } catch {
      // Sem miniatura: o calendário mostra só o texto.
    }
  }));

  res.status(200).json({ ok: true, entries });
};
