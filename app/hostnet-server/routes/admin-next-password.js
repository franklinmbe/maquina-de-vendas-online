const { loadUsers, verifyPassword } = require('../lib/users');

// Botão "🔑 Gerar senha" da seção "Liberar cliente" (só admin). Regra do
// Franklin (2026-10-15): a senha automática é sempre a sequência @maquina1,
// @maquina2, @maquina3... (tudo minúsculo, sem acento), simples de controlar.
// Antes de devolver, confere no cadastro se nenhum usuário já usa aquela
// senha — como só guardamos o hash, testa o candidato contra o hash de cada
// um. `autoPasswordSeq` (gravado por admin-set-account.js) só serve de atalho
// pra começar a busca do maior número já usado.
const PREFIX = '@maquina';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase } = req.body || {};
  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  const users = await loadUsers();
  const maxSeq = users.reduce((max, u) => Math.max(max, Number(u.autoPasswordSeq) || 0), 0);

  for (let n = maxSeq + 1; n < maxSeq + 1000; n += 1) {
    const candidate = `${PREFIX}${n}`;
    const taken = users.some((u) => u.passwordHash && verifyPassword(candidate, u.passwordHash));
    if (!taken) {
      res.status(200).json({ ok: true, password: candidate, seq: n });
      return;
    }
  }

  res.status(500).json({ error: 'Não achei uma senha livre na sequência' });
};
