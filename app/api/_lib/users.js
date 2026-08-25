const crypto = require('crypto');
const { put, list } = require('@vercel/blob');

// O Vercel Blob (nesta versão) só tem acesso público — não existe modo privado.
// Pra não deixar o cadastro num caminho adivinhável, o nome do arquivo carrega um
// segredo que só existe como variável de ambiente do servidor (nunca é enviado
// pro navegador), então mesmo quem descobrir o host do Blob pelas uploads de
// mídia (que são públicas de propósito) não sabe o caminho certo pra pedir isso.
function usersBlobPathname() {
  const secret = process.env.USERS_BLOB_SECRET;
  if (!secret) throw new Error('USERS_BLOB_SECRET não configurado');
  return `data/users-${secret}.json`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function loadUsers() {
  const pathname = usersBlobPathname();
  const { blobs } = await list({ prefix: pathname });
  const entry = blobs.find((b) => b.pathname === pathname);
  if (!entry) return [];

  const response = await fetch(entry.url);
  if (!response.ok) throw new Error(`Falha ao ler cadastro de usuários: ${response.status}`);

  const text = await response.text();
  if (!text.trim()) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  await put(usersBlobPathname(), JSON.stringify(users, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// Identidade pode ser e-mail ou telefone (Kleber pode se cadastrar com qualquer
// um dos dois). E-mail normaliza por minúsculas; telefone normaliza mantendo só dígitos.
function normalizeIdentifier(value) {
  const trimmed = String(value || '').trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return trimmed.replace(/\D/g, '');
}

function findUser(users, identifier) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return undefined;
  return users.find(
    (u) =>
      normalizeIdentifier(u.identifier) === normalized ||
      (u.altIdentifier && normalizeIdentifier(u.altIdentifier) === normalized)
  );
}

// Salva as conexões de redes sociais (tokens já cifrados por quem chamar
// esta função) direto no registro do cliente, substituindo a lista anterior
// pra aquela rede (ex: reconectar o Facebook troca a conexão antiga por essa).
async function saveUserConnection(identifier, platform, connection) {
  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user) throw new Error('Usuário não encontrado');

  user.connections = user.connections || {};
  user.connections[platform] = connection;

  await saveUsers(users);
  return user;
}

// Grava um retrato do dia (seguidores/curtidas por página) no histórico de
// crescimento do cliente — usado tanto sob demanda (quando o relatório é
// aberto, ver social-insights.js) quanto pela coleta automática diária
// (ver api/cron/collect-social-snapshots.js). 1 retrato por dia por página,
// não duplica se rodar mais de uma vez no mesmo dia.
function recordGrowthSnapshot(user, pageId, counts) {
  const today = new Date().toISOString().slice(0, 10);
  user.growthHistory = user.growthHistory || [];
  const already = user.growthHistory.find((s) => s.pageId === pageId && s.date === today);
  if (already) {
    Object.assign(already, counts);
    return false;
  }
  user.growthHistory.push({ date: today, pageId, ...counts });
  return true;
}

module.exports = {
  hashPassword,
  verifyPassword,
  loadUsers,
  saveUsers,
  findUser,
  normalizeIdentifier,
  saveUserConnection,
  recordGrowthSnapshot,
};
