const { resolveClient } = require('../lib/auth');
const { loadUsers } = require('../lib/users');
const { signShare } = require('../lib/share-token');
const { contasForClient } = require('../lib/relatorio-completo');

// "🔗 Copiar link para enviar" (Franklin, 2026-10-13): só o admin. Ele entra
// na própria conta (frank) ou "posta como" o cliente e gera, na página aberta,
// o link que o cliente abre sem senha, só pra ver. action 'check' só diz se o
// botão aparece. Com `conta`, o link do Relatório completo fica preso naquela
// empresa (o admin escolhe a empresa no seletor da página).
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { identifier, password, action, conta } = req.body || {};
  const client = await resolveClient({ identifier, password });
  // Admin = conta frank (ou senha mestra) ou o admin "postando como" alguém
  // (chave cliente:… só é emitida pra ele, ver routes/admin-impersonate.js).
  const isAdmin = client === 'frank' || (!!client && String(identifier || '').startsWith('cliente:'));
  if (action === 'check') return res.status(200).json({ ok: true, admin: isAdmin });
  if (!isAdmin) return res.status(403).json({ error: 'Só o administrador gera links de compartilhamento.' });

  // Na conta dele, o admin pode estar vendo o painel de um cliente (?cliente=…).
  let alvo = client;
  if (client === 'frank' && req.body.cliente) {
    const users = await loadUsers();
    if (!users.some((u) => u.client === req.body.cliente)) return res.status(404).json({ error: 'Cliente não encontrado' });
    alvo = req.body.cliente;
  }
  const contaOk = conta && contasForClient(alvo).includes(conta) ? conta : null;
  res.status(200).json({ ok: true, token: signShare({ client: alvo, conta: contaOk }) });
};
