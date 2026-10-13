const crypto = require('crypto');

// Link de compartilhamento das páginas do cliente (Franklin, 2026-10-13): o
// admin gera, pela página aberta, um link que o dono da empresa abre direto,
// sem senha, SÓ PARA VER — Relatório completo, Meu painel, Meu cérebro e as
// páginas "Saiba mais". A chave diz de quem é (c = cliente) e, no Relatório
// completo, qual empresa (k = conta). Assinada com o segredo do servidor;
// vale 1 ano. Nunca dá acesso a nada que grava ou publica.
const DAYS = 365;

function secret() {
  const s = process.env.OAUTH_STATE_SECRET || process.env.APP_PASSPHRASE;
  if (!s) throw new Error('segredo do servidor não configurado');
  return s;
}

function sig(payload) {
  return crypto.createHmac('sha256', secret()).update(`share:${payload}`).digest('base64url').slice(0, 32);
}

function signShare({ client, conta }) {
  const body = { c: client, e: Date.now() + DAYS * 86400000 };
  if (conta) body.k = conta;
  const payload = Buffer.from(JSON.stringify(body)).toString('base64url');
  return `${payload}.${sig(payload)}`;
}

// Devolve { client, conta } ou null se a chave for inválida/vencida.
function verifyShare(token) {
  const [payload, s] = String(token || '').split('.');
  if (!payload || !s) return null;
  const expected = sig(payload);
  if (s.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!body.c || !(body.e > Date.now())) return null;
    return { client: body.c, conta: body.k || null };
  } catch {
    return null;
  }
}

module.exports = { signShare, verifyShare };
