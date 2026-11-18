// Painel "Virar anúncio" — ver lib/virar-anuncio.js.
// action: 'listar' (postagens + histórico), 'virar' (mediaId), 'clientes' (admin)
const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const { listarPostagens, virarAnuncio, historico } = require('../lib/virar-anuncio');
const { avisarAdmin } = require('../lib/avisar-admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { identifier, password, action, mediaId, client, teste } = req.body || {};
  const users = await loadUsers();

  let me = null;
  let isAdmin = false;
  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    isAdmin = true;
    me = users.find((u) => u.client === 'frank');
  } else {
    me = findUser(users, identifier);
    if (!me || !verifyPassword(password, me.passwordHash)) {
      return res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    }
    isAdmin = me.client === 'frank';
  }

  if (action === 'clientes') {
    if (!isAdmin) return res.status(403).json({ error: 'Só o admin' });
    const lista = users
      .filter((u) => u.client !== 'frank' && u.connections && u.connections.meta && (u.connections.meta.pages || []).length)
      .map((u) => ({ client: u.client, name: u.name }));
    return res.json({ ok: true, clientes: lista });
  }

  // admin pode agir por um cliente; cliente só por ele mesmo
  const alvo = isAdmin && client ? users.find((u) => u.client === client) : me;
  if (!alvo) return res.status(404).json({ error: 'Cliente não encontrado' });

  try {
    if (action === 'virar') {
      const r = await virarAnuncio(alvo, mediaId, { teste: Boolean(teste && isAdmin), users });
      if (r.ok && !r.teste) {
        const extra = r.pausado ? ` Pausado para abrir espaço: "${r.pausado.nome}".` : '';
        avisarAdmin(`📢 ${alvo.name || alvo.client} virou anúncio pelo app: "${r.anuncioNome}" na campanha "${r.campanha}".${extra} Post: ${r.link}`).catch(() => {});
      }
      return res.json(r);
    }
    const [lista, hist] = await Promise.all([listarPostagens(alvo, users), historico(alvo.client)]);
    return res.json({ ...lista, historico: hist, client: alvo.client, nome: alvo.name, isAdmin });
  } catch (e) {
    console.error('[virar-anuncio]', alvo.client, e.message);
    return res.status(200).json({ ok: false, mensagem: `O Meta recusou agora: ${e.message}. Nada foi gasto. Tente de novo mais tarde ou fale com a equipe.` });
  }
};
