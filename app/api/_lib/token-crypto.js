const crypto = require('crypto');

// Tokens de acesso das redes sociais dos clientes precisam ficar cifrados
// dentro do JSON do Blob — diferente da senha do cadastro (que é hash de mão
// única), o token tem que ser recuperável pra gente poder publicar depois,
// então usamos criptografia simétrica com uma chave que só existe no servidor.
function getKey() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) throw new Error('TOKEN_ENCRYPTION_KEY não configurado');
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY precisa ter 32 bytes (64 caracteres hex)');
  return key;
}

function encryptToken(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptToken(stored) {
  const [ivB64, authTagB64, dataB64] = String(stored || '').split(':');
  if (!ivB64 || !authTagB64 || !dataB64) throw new Error('Token cifrado em formato inválido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf-8');
}

module.exports = { encryptToken, decryptToken };
