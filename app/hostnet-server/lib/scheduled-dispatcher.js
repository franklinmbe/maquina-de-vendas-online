const fs = require('fs');
const path = require('path');
const { loadUsers, saveUsers } = require('./users');
const { publishPedido } = require('./publish-pedido');

function scheduledDir() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado');
  return path.join(dir, 'scheduled');
}

// Roda a cada minuto (ver server.js) — procura posts agendados cuja hora já
// chegou e publica de verdade (mesmo caminho do envio imediato). Continua
// pendente automaticamente se ainda não chegou a hora; nunca reprocessa um
// que já esteja "sent"/"failed".
async function dispatchDuePosts() {
  const users = await loadUsers();
  const now = Date.now();
  let changed = false;
  const dispatched = [];

  for (const user of users) {
    const pending = (user.scheduledPosts || []).filter(
      (p) => p.status === 'pending' && new Date(p.scheduledFor).getTime() <= now
    );

    for (const entry of pending) {
      changed = true;
      try {
        const dir = path.join(scheduledDir(), entry.id);
        const files = entry.files.map((f) => ({
          originalname: f.filename,
          mimetype: f.mimetype,
          buffer: fs.readFileSync(path.join(dir, f.filename)),
        }));
        await publishPedido({
          identifier: user.identifier,
          client: entry.client,
          instruction: entry.instruction,
          files,
          networks: entry.networks,
        });
        entry.status = 'sent';
        entry.sentAt = new Date().toISOString();
        fs.rmSync(dir, { recursive: true, force: true });
        dispatched.push({ id: entry.id, identifier: user.identifier, status: 'sent' });
      } catch (error) {
        entry.status = 'failed';
        entry.error = error.message || String(error);
        dispatched.push({ id: entry.id, identifier: user.identifier, status: 'failed', error: entry.error });
      }
    }
  }

  if (changed) await saveUsers(users);
  return dispatched;
}

module.exports = { dispatchDuePosts };
