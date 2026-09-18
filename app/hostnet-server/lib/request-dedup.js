// Evita reprocessar (e duplicar upload/publicação) quando o cliente reenvia
// o mesmo pedido depois de um "Failed to fetch" — achado real 2026-09-18:
// o request de commit.js às vezes completa 100% no servidor, mas a resposta
// nunca chega no celular do cliente (conexão cai bem na hora de voltar),
// então o cliente vê erro e tenta de novo, achando que nada foi enviado.
// O front manda um requestId estável (mesmo em cada retry automático); aqui
// guardamos o resultado da primeira vez que aquele id foi processado com
// sucesso, e qualquer reenvio com o mesmo id recebe o mesmo resultado sem
// tocar no GitHub de novo. TTL curto — só precisa cobrir a janela de um
// usuário reenviando manualmente em segundos/poucos minutos, não histórico.
const TTL_MS = 15 * 60 * 1000;
const store = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.storedAt > TTL_MS) store.delete(key);
  }
}

function getCached(requestId) {
  if (!requestId) return null;
  cleanup();
  const entry = store.get(requestId);
  return entry ? entry.result : null;
}

function storeResult(requestId, result) {
  if (!requestId) return;
  store.set(requestId, { result, storedAt: Date.now() });
}

module.exports = { getCached, storeResult };
