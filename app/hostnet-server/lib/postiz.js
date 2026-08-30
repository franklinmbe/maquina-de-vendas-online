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

module.exports = { getPostizIntegrations };
