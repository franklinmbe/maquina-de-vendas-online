const crypto = require('crypto');

// O "state" do OAuth precisa provar, quando o Facebook chama de volta o nosso
// /api/meta/oauth-callback, quem foi o cliente que iniciou a conexão — sem
// precisar de sessão/cookie no servidor (o app inteiro já funciona sem isso,
// mandando identifier+senha em cada chamada). Assinamos o identifier com HMAC
// e um prazo de validade curto, então o callback só precisa verificar a
// assinatura, sem consultar nada.
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutos é de sobra pro cliente autorizar no Facebook

function getStateSecret() {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error('OAUTH_STATE_SECRET não configurado');
  return secret;
}

function signState(identifier) {
  const payload = JSON.stringify({ identifier, exp: Date.now() + STATE_TTL_MS });
  const base64Payload = Buffer.from(payload, 'utf-8').toString('base64url');
  const signature = crypto.createHmac('sha256', getStateSecret()).update(base64Payload).digest('base64url');
  return `${base64Payload}.${signature}`;
}

function verifyState(state) {
  const [base64Payload, signature] = String(state || '').split('.');
  if (!base64Payload || !signature) return null;

  const expectedSignature = crypto.createHmac('sha256', getStateSecret()).update(base64Payload).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf-8'));
    if (!payload.identifier || !payload.exp || Date.now() > payload.exp) return null;
    return payload.identifier;
  } catch {
    return null;
  }
}

module.exports = { signState, verifyState };
