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
// SKILL.md de frank/kleber-construcao). `settings` é opcional — o TikTok
// exige um objeto de configuração próprio (privacy_level, duet, etc, ver
// TIKTOK_POSTIZ_SETTINGS em lib/auto-publish.js); Facebook/Instagram via
// Postiz não precisam disso.
// `mediaObjs` (várias mídias num post só) é usado pro post de fotos do
// TikTok (carrossel de fotos); o normal continua sendo um `mediaObj`.
async function createPostizPost({ integrationId, content, mediaObj, mediaObjs, settings }) {
  const apiKey = process.env.POSTIZ_API_KEY;
  if (!apiKey) throw new Error('POSTIZ_API_KEY não configurada');

  const post = { integration: { id: integrationId }, value: [{ content, image: mediaObjs || [mediaObj] }] };
  if (settings) post.settings = settings;

  const res = await fetch('https://api.postiz.com/public/v1/posts', {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'now',
      shortLink: false,
      date: new Date().toISOString(),
      tags: [],
      posts: [post],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Postiz recusou o post: ${res.status} ${body}`);
  }
  return res.json();
}

// Lista posts da Postiz num intervalo de datas (mesmo endpoint usado pela
// ferramenta MCP "List Posts"). Usado só pra conferir, depois de criar um
// post, se a rede de verdade aceitou ou rejeitou — createPostizPost só
// confirma que a Postiz aceitou a fila, o processamento na rede em si
// (TikTok, etc) é assíncrono e pode terminar em erro minutos depois (achado
// real 2026-09-15: vídeo do Kleber ficou "ok" no nosso registro, mas a
// Postiz já mostrava state:"ERROR", TikTok tinha recusado por frame rate
// inválido).
async function listPostizPosts({ startDate, endDate }) {
  const apiKey = process.env.POSTIZ_API_KEY;
  if (!apiKey) return [];
  try {
    const url = `https://api.postiz.com/public/v1/posts?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data && data.posts)) return data.posts;
    return [];
  } catch {
    return [];
  }
}

module.exports = { getPostizIntegrations, uploadToPostiz, createPostizPost, listPostizPosts };
