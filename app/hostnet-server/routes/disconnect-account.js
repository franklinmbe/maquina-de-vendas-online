const { resolveClient } = require('../lib/auth');
const { loadUsers, saveUsers, findUser } = require('../lib/users');

// Desconectar uma rede (Franklin, 2026-11-20): até aqui o app só tinha
// "Conectar" — uma conexão vencida (ex: YouTube com autorização revogada)
// ficava aparecendo como "Conectado" sem funcionar e o cliente não tinha
// como limpar pra conectar de novo. Facebook e Instagram vêm da MESMA
// autorização da Meta, então desconectar um desconecta os dois.
const CONNECTION_KEY = {
  facebook: 'meta',
  instagram: 'meta',
  youtube: 'youtube',
  telegram: 'telegram',
  wordpress: 'wordpress',
  tiktok: 'tiktok',
  google: 'google',
  googleads: 'google',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { identifier, password, platform } = req.body || {};
  const client = await resolveClient({ identifier, password });
  if (!client) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }
  const key = CONNECTION_KEY[String(platform || '').toLowerCase()];
  if (!key) {
    res.status(400).json({ error: 'Rede desconhecida' });
    return;
  }
  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user || user.client !== client) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }
  if (user.connections && user.connections[key]) {
    delete user.connections[key];
    await saveUsers(users);
  }
  res.status(200).json({ ok: true, removed: key });
};
