const { loadUsers, findUser, verifyPassword } = require('./users');

// Login legado: a senha mestra sozinha continua identificando o Franklin (frank),
// sem precisar de cadastro — mantém o fluxo que já funcionava antes do cadastro por cliente existir.
async function resolveClient({ identifier, password }) {
  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    return 'frank';
  }

  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (user && verifyPassword(password, user.passwordHash)) {
    return user.client;
  }

  return null;
}

module.exports = { resolveClient };
