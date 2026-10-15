const fs = require('fs');
const path = require('path');

// Pedidos de cadastro feitos pela aba "Cadastrar" (Franklin, 2026-10-15):
// a pessoa manda nome + WhatsApp, o pedido vai pro WhatsApp do Franklin e
// fica guardado aqui pra ele ver na Área administrativa ("Pedidos de
// cadastro"). Quando o Franklin libera aquele telefone em "Liberar usuário",
// o pedido vira "liberado" sozinho. Mesmo esquema de arquivo de users.js.
const MAX_REQUESTS = 500;

function filePath() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado (precisa apontar pra um volume persistente)');
  return path.join(dir, 'signup-requests.json');
}

function loadRequests() {
  const file = filePath();
  if (!fs.existsSync(file)) return [];
  try {
    const list = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveRequests(list) {
  const file = filePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpFile = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(list, null, 2));
  fs.renameSync(tmpFile, file);
}

// Mesmo telefone pedindo de novo só atualiza o pedido que já existe.
function addRequest(name, phone) {
  const list = loadRequests();
  const now = new Date().toISOString();
  const existing = list.find((r) => r.phone === phone);
  if (existing) {
    existing.name = name;
    existing.lastAt = now;
    existing.count = (existing.count || 1) + 1;
    if (existing.status !== 'liberado') existing.status = 'novo';
  } else {
    list.unshift({ name, phone, createdAt: now, lastAt: now, count: 1, status: 'novo' });
  }
  saveRequests(list.slice(0, MAX_REQUESTS));
}

function markReleased(phone) {
  const list = loadRequests();
  const req = list.find((r) => r.phone === phone);
  if (!req || req.status === 'liberado') return;
  req.status = 'liberado';
  req.releasedAt = new Date().toISOString();
  saveRequests(list);
}

function removeRequest(phone) {
  saveRequests(loadRequests().filter((r) => r.phone !== phone));
}

module.exports = { loadRequests, addRequest, markReleased, removeRequest };
