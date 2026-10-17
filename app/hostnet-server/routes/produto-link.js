const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { readProductLink } = require('../lib/produto-link');

// Lê a página de um produto (Cut Estúdio → "Link do produto → anúncio").
// Só lê: o pedido do anúncio é enviado depois pelo /api/commit de sempre.
module.exports = async function handler(req, res) {
  const { identifier, password, link } = req.body || {};
  let ok = !!(process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE);
  if (!ok) {
    const user = findUser(await loadUsers(), identifier);
    ok = !!(user && verifyPassword(password, user.passwordHash));
  }
  if (!ok) { res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' }); return; }
  try {
    res.status(200).json({ ok: true, ...(await readProductLink(link)) });
  } catch (error) {
    const msg = /^[A-ZÀ-Ú]/.test(error.message) && !/fetch|ENOTFOUND|timeout|Invalid URL/i.test(error.message) ? error.message : 'Não consegui abrir esse link. Confira se ele está certo e se a página abre no navegador.';
    res.status(400).json({ error: /Invalid URL/i.test(error.message) ? 'Esse link não parece certo. Copie o endereço inteiro da página do produto.' : msg });
  }
};
