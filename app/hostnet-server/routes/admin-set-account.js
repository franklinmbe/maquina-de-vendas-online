const { hashPassword, loadUsers, saveUsers, findUser, normalizeIdentifier } = require('../lib/users');

// Endpoint só de backend, sem página própria: cria (ou substitui) a conta de
// um cliente já com e-mail, senha e plano definidos, pulando o autocadastro —
// pra quando Franklin já vendeu o plano e quer que o cliente só abra o app e
// entre direto, sem nenhuma tela ou botão extra.
//
// Decisão de 2026-08-25 (depois de reverter a página `liberar.html`, que
// levou ~2h de ida e volta pra liberar 1 cliente pelo celular): em vez de
// pedir pro Franklin preencher um formulário, ele passa e-mail + senha + plano
// aqui no chat com o Claude, e é o próprio Claude (numa sessão com acesso real
// à internet — isto é, não esta sessão remota, que tem o egress pro domínio do
// site bloqueado) quem chama este endpoint diretamente, sem nenhuma UI
// envolvida. O cliente nunca vê nada disso — só recebe e-mail/senha de
// Franklin (por fora, ex: WhatsApp) e usa a tela normal de login do app.
//
// A senha do cliente passa pelo chat com o Claude neste fluxo — é uma exceção
// explícita, pedida repetidamente por Franklin como dono do produto, depois de
// testar a alternativa (autocadastro / formulário próprio) e não funcionar na
// prática. Continua protegido pela senha mestra (APP_PASSPHRASE).
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase, name, identifier, client, plan, altIdentifier, password } = req.body || {};

  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  const trimmedName = String(name || '').trim();
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const trimmedClient = String(client || '').trim();

  if (!trimmedName || !normalizedIdentifier || !trimmedClient) {
    res.status(400).json({ error: 'Nome, identificador e cliente são obrigatórios' });
    return;
  }

  if (!password || String(password).length < 6) {
    res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres' });
    return;
  }

  const normalizedAlt = altIdentifier ? normalizeIdentifier(altIdentifier) : '';

  const users = await loadUsers();
  const existing = findUser(users, normalizedIdentifier);
  const record = {
    name: trimmedName,
    identifier: normalizedIdentifier,
    client: trimmedClient,
    plan: String(plan || '').trim(),
    passwordHash: hashPassword(password),
  };
  if (normalizedAlt) record.altIdentifier = normalizedAlt;
  if (existing && existing.connections) record.connections = existing.connections;
  if (existing && existing.stats) record.stats = existing.stats;
  if (existing && existing.loginCount) record.loginCount = existing.loginCount;
  if (existing && existing.lastLogin) record.lastLogin = existing.lastLogin;
  record.createdAt = (existing && existing.createdAt) || new Date().toISOString();

  const otherUsers = users.filter((u) => normalizeIdentifier(u.identifier) !== normalizedIdentifier);
  otherUsers.push(record);
  await saveUsers(otherUsers);

  res.status(200).json({ ok: true, identifier: normalizedIdentifier, created: !existing });
};
