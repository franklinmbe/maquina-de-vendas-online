const { resolveClient } = require('../lib/auth');

// Links para compartilhamento — só o admin (frank) vê. Cada link abre uma
// página do app só para leitura, sem login, para quem Franklin quiser mandar
// (ex.: contador). As chaves ficam só no .env da VPS (o repositório é
// público), por isso o link é montado aqui e nunca escrito no HTML.
const LINKS = [
  {
    id: 'obrigacoes-cnpj',
    titulo: 'Obrigações CNPJ',
    descricao: 'Situação do CNPJ na Receita, dívidas, certificado digital e datas das consultas. Para mandar ao contador.',
    envKey: 'CONTADOR_KEY',
    path: '/obrigacoes-cnpj.html?k=',
  },
];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const client = await resolveClient(req.body || {});
  if (client !== 'frank') {
    res.status(403).json({ error: 'Só o administrador vê os links de compartilhamento' });
    return;
  }

  const base = `https://${req.get('host') || 'app.franklinmorais.com'}`;
  const links = LINKS.map(({ id, titulo, descricao, envKey, path }) => {
    const key = process.env[envKey];
    return { id, titulo, descricao, url: key ? base + path + encodeURIComponent(key) : null };
  });

  res.status(200).json({ ok: true, links });
};
