const { loadUsers, saveUsers, findUser, verifyPassword } = require('./users');

// Login legado: a senha mestra sozinha continua identificando o Franklin (frank),
// sem precisar de cadastro — mantém o fluxo que já funcionava antes do cadastro por cliente existir.
async function resolveClient({ identifier, password }) {
  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    return 'frank';
  }

  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (user && verifyPassword(password, user.passwordHash)) {
    // Registra data e contagem de acesso pro relatório administrativo
    // ("quantidade logado", "frequência de uso"). Dispara em qualquer chamada
    // autenticada (login, envio de pedido, etc.), não só na tela de "Entrar" —
    // é uma medida de atividade geral da conta, não só de cliques em "Entrar".
    user.lastLogin = new Date().toISOString();
    user.loginCount = (user.loginCount || 0) + 1;
    await saveUsers(users);
    return user.client;
  }

  return null;
}

module.exports = { resolveClient };
