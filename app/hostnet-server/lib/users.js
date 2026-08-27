const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Versão self-hosted do "banco de dados" de usuários: um arquivo JSON local,
// em vez do Vercel Blob (que não existe fora do Vercel). Precisa de um disco
// persistente montado em DATA_DIR (ex: /data no App Cloud da Hostnet) — sem
// isso, os cadastros somem toda vez que o contêiner reinicia.
function dataFilePath() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado (precisa apontar pra um volume persistente)');
  return path.join(dir, 'users.json');
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
  const file = dataFilePath();
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf-8');
  if (!text.trim()) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  const file = dataFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Escreve num arquivo temporário e renomeia por cima — evita corromper o
  // arquivo se o processo cair no meio da escrita.
  const tmpFile = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(users, null, 2));
  fs.renameSync(tmpFile, file);
}

// Identidade pode ser e-mail ou telefone. E-mail normaliza por minúsculas;
// telefone normaliza mantendo só dígitos.
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

// Por padrão cada plataforma guarda 1 conexão só (sobrescreve a anterior).
// Passando { multi: true, dedupeKey } vira uma lista — usado pelo TikTok, onde
// o Franklin tem 2 contas reais. dedupeKey identifica o campo que diferencia
// uma conta da outra (ex: "openId") pra reconectar a mesma conta atualizar em
// vez de duplicar na lista.
async function saveUserConnection(identifier, platform, connection, { multi = false, dedupeKey } = {}) {
  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user) throw new Error('Usuário não encontrado');

  user.connections = user.connections || {};

  if (multi) {
    const list = Array.isArray(user.connections[platform]) ? user.connections[platform] : [];
    const existingIndex = dedupeKey
      ? list.findIndex((item) => item[dedupeKey] === connection[dedupeKey])
      : -1;
    if (existingIndex >= 0) {
      list[existingIndex] = connection;
    } else {
      list.push(connection);
    }
    user.connections[platform] = list;
  } else {
    user.connections[platform] = connection;
  }

  await saveUsers(users);
  return user;
}

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
