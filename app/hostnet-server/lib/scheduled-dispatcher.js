const fs = require('fs');
const path = require('path');
const { loadUsers, saveUsers } = require('./users');
const { publishPedido } = require('./publish-pedido');
const { publishScheduledPiece } = require('./auto-publish');

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
        const archived = await publishPedido({
          identifier: user.identifier,
          client: entry.client,
          instruction: entry.instruction,
          files,
          networks: entry.networks,
          voice: entry.voice,
          music: entry.music,
          narrationText: entry.narrationText,
          format: entry.format,
        });

        // Arquivar no GitHub (acima) só guarda o registro do pedido — quem
        // publica de verdade nas redes é publishScheduledPiece, usando os
        // download_url que acabaram de sair do upload. Sem isso, "agendar"
        // só arquivava e nunca publicava sozinho de verdade.
        const publishResult = await publishScheduledPiece({
          users,
          targetClient: entry.client,
          files: archived.files,
          caption: entry.instruction,
          networks: entry.networks,
          formats: entry.format,
        });
        if (publishResult.dirty) changed = true;

        if (publishResult.ok) {
          entry.status = 'sent';
          entry.sentAt = new Date().toISOString();
          entry.publishResults = publishResult.results;
        } else {
          // O pedido já ficou arquivado no GitHub (acima) mesmo se a
          // publicação de verdade falhar aqui (ex: cota do plano estourada)
          // — não adianta tentar de novo depois, então marca failed em vez
          // de deixar pending pra sempre.
          entry.status = 'failed';
          entry.error = publishResult.error;
        }
        fs.rmSync(dir, { recursive: true, force: true });
        dispatched.push({ id: entry.id, identifier: user.identifier, status: entry.status, published: publishResult.results });
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
