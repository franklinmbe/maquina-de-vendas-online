const { saveMap, sanitizeMap, appendHistory } = require('../lib/mapa-cerebro');

// Recebe o mapa gerado por .claude/scripts/build-brain-map.js. Só a senha
// mestra grava — é o Claude, na sessão que roda o gerador, quem chama.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase, map } = req.body || {};
  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  const clean = sanitizeMap(map);
  if (!clean) {
    res.status(400).json({ error: 'Formato do mapa inválido' });
    return;
  }

  saveMap(clean);
  appendHistory(clean);
  res.status(200).json({
    ok: true,
    skills: clean.skills.length,
    docs: clean.memory.departments.reduce((n, d) => n + d.docs.length, 0),
    routines: clean.routines.length,
    apps: clean.apps.length,
    links: clean.links.length,
  });
};
