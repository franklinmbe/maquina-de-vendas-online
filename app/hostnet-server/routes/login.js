const { resolveClient } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};

  const client = await resolveClient({ identifier, password });
  if (!client) {
    // Teste com prazo que já acabou (lib/testes.js): explica em vez de
    // dizer "senha incorreta".
    try {
      const { loadUsers, findUser } = require('../lib/users');
      const { testeAcabou, MSG_TESTE_ACABOU } = require('../lib/testes');
      if (testeAcabou(findUser(await loadUsers(), identifier))) {
        res.status(403).json({ error: MSG_TESTE_ACABOU });
        return;
      }
    } catch {}
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  res.status(200).json({ ok: true, client });
};
