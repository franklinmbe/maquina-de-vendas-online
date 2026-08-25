const { put, list } = require('@vercel/blob');

// Allowlist "dinâmica": complementa a SIGNUP_ALLOWLIST (env var do Vercel, que só
// vale a partir do próximo deploy). Guardada no mesmo Blob usado por users.js,
// pra dar pra liberar um cliente novo na hora, de qualquer lugar (celular, sem
// precisar mexer no painel do Vercel nem esperar redeploy).
//
// Mesma lógica de segredo-no-nome-do-arquivo do users.js: o pathname carrega um
// segredo (env var, nunca vai pro navegador) pra não ficar adivinhável mesmo com
// o host do Blob sendo público.
function allowlistBlobPathname() {
  const secret = process.env.USERS_BLOB_SECRET;
  if (!secret) throw new Error('USERS_BLOB_SECRET não configurado');
  return `data/allowlist-${secret}.json`;
}

async function loadDynamicAllowlist() {
  const pathname = allowlistBlobPathname();
  const { blobs } = await list({ prefix: pathname });
  const entry = blobs.find((b) => b.pathname === pathname);
  if (!entry) return [];

  const response = await fetch(entry.url);
  if (!response.ok) throw new Error(`Falha ao ler allowlist dinâmica: ${response.status}`);

  const text = await response.text();
  if (!text.trim()) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

async function saveDynamicAllowlist(entries) {
  await put(allowlistBlobPathname(), JSON.stringify(entries, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

module.exports = { loadDynamicAllowlist, saveDynamicAllowlist };
