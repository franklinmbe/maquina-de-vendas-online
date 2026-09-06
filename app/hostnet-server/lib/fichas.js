const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ordens de Serviço / fichas do módulo Administrativo (ver CLAUDE.md, produto
// "Aplicativo" — modelo RN Cell) — um arquivo JSON por cliente, mesmo padrão
// de lib/users.js (arquivo local em vez de banco separado), só que guardado
// numa subpasta própria pra não misturar com o cadastro de usuários.
function fichasFilePath(client) {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado (precisa apontar pra um volume persistente)');
  return path.join(dir, 'fichas', `${client}.json`);
}

function loadFichas(client) {
  const file = fichasFilePath(client);
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf-8');
  if (!text.trim()) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

function saveFichas(client, fichas) {
  const file = fichasFilePath(client);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpFile = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(fichas, null, 2));
  fs.renameSync(tmpFile, file);
}

function createFicha(client, { cliente, contato, item, defeito, pipeline }) {
  const fichas = loadFichas(client);
  const firstStatus = (pipeline && pipeline[0]) || 'Recebido';
  const now = new Date().toISOString();
  const ficha = {
    id: crypto.randomUUID(),
    cliente: String(cliente || '').trim(),
    contato: String(contato || '').replace(/\D/g, ''),
    item: String(item || '').trim(),
    defeito: String(defeito || '').trim(),
    status: firstStatus,
    statusHistory: [{ status: firstStatus, at: now }],
    createdAt: now,
    updatedAt: now,
  };
  fichas.push(ficha);
  saveFichas(client, fichas);
  return ficha;
}

function listFichas(client, { contato, status } = {}) {
  let fichas = loadFichas(client);
  if (contato) {
    const normalized = String(contato).replace(/\D/g, '');
    fichas = fichas.filter((f) => f.contato === normalized);
  }
  if (status) fichas = fichas.filter((f) => f.status === status);
  return fichas.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function findFicha(client, id) {
  return loadFichas(client).find((f) => f.id === id) || null;
}

function updateFichaStatus(client, id, status) {
  const fichas = loadFichas(client);
  const ficha = fichas.find((f) => f.id === id);
  if (!ficha) throw new Error('Ficha não encontrada');
  ficha.status = status;
  ficha.updatedAt = new Date().toISOString();
  ficha.statusHistory.push({ status, at: ficha.updatedAt });
  saveFichas(client, fichas);
  return ficha;
}

module.exports = { loadFichas, saveFichas, createFicha, listFichas, findFicha, updateFichaStatus };
