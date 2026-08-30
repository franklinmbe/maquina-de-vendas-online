// Chama a API pública da Postiz só pra buscar nome/foto reais das contas
// marcadas como "via Postiz" (solução provisória pra clientes cujas redes
// ainda não foram conectadas via OAuth direto no app — ver connected-accounts.js).
// Nunca publica nem autentica nada daqui, só lê o /integrations pra exibição.
async function getPostizIntegrations() {
  const apiKey = process.env.POSTIZ_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch('https://api.postiz.com/public/v1/integrations', {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Sobe um arquivo (imagem ou vídeo) pro storage da Postiz — necessário antes
// de criar o post, porque a Postiz não aceita URL externa direto no /posts,
// só o objeto devolvido por esse upload.
async function uploadToPostiz({ buffer, filename, mimetype }) {
  const apiKey = process.env.POSTIZ_API_KEY;
  if (!apiKey) throw new Error('POSTIZ_API_KEY não configurada');

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimetype }), filename);

  const res = await fetch('https://api.postiz.com/public/v1/upload', {
    method: 'POST',
    headers: { Authorization: apiKey },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Postiz recusou o upload: ${res.status} ${body}`);
  }
  return res.json();
}

// Cria o post de verdade numa integração já conectada na Postiz (Franklin
// TikTok, ou qualquer conta de cliente marcada como "via Postiz" — ver
// user.postizConnections em connected-accounts.js). `mediaObj` é o objeto
// que uploadToPostiz devolveu, passado como veio (formato documentado nos
// SKILL.md de frank/kleber-construcao).
async function createPostizPost({ integrationId, content, mediaObj }) {
  const apiKey = process.env.POSTIZ_API_KEY;
  if (!apiKey) throw new Error('POSTIZ_API_KEY não configurada');

  const res = await fetch('https://api.postiz.com/public/v1/posts', {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'now',
      shortLink: false,
      date: new Date().toISOString(),
      tags: [],
      posts: [{ integration: { id: integrationId }, value: [{ content, image: [mediaObj] }] }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Postiz recusou o post: ${res.status} ${body}`);
  }
  return res.json();
}

module.exports = { getPostizIntegrations, uploadToPostiz, createPostizPost };
