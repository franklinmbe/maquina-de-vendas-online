const { loadUsers, saveUsers, findUser, verifyPassword } = require('../lib/users');
const { decryptToken, encryptToken } = require('../lib/token-crypto');
const { refreshAccessToken, listAnalyticsProperties, listBusinessAccounts, ADS_SCOPE, listAdsCustomers, adsSearch } = require('../lib/google');

// Relatório do Google (Franklin, 2026-11-20): site (GA4), YouTube e Meu
// Negócio numa caixa só dentro do "Relatório das redes" — pra nós e pros
// clientes que conectarem o Google deles. Cada parte que falhar vira aviso
// em vez de derrubar o resto.

async function freshToken(conn, onSave) {
  let accessToken = decryptToken(conn.accessToken);
  if (Date.now() >= (conn.expiresAt || 0) - 60000) {
    const r = await refreshAccessToken(decryptToken(conn.refreshToken));
    accessToken = r.accessToken;
    conn.accessToken = encryptToken(r.accessToken);
    conn.expiresAt = r.expiresAt;
    onSave();
  }
  return accessToken;
}

async function gget(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error?.message || `HTTP ${r.status}`);
  return b;
}

async function gaReport(token, property, days) {
  const run = async (body) => {
    const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }], ...body }),
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.error?.message || `GA ${r.status}`);
    return b.rows || [];
  };
  const [tot, pages, sources, daily] = await Promise.all([
    run({ metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'newUsers' }] }),
    run({ dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 5 }),
    run({ dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 5 }),
    run({ dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ dimension: { dimensionName: 'date' } }] }),
  ]);
  const t = (tot[0] && tot[0].metricValues) || [];
  return {
    visitantes: Number(t[0]?.value || 0),
    visitas: Number(t[1]?.value || 0),
    paginasVistas: Number(t[2]?.value || 0),
    novos: Number(t[3]?.value || 0),
    topPaginas: pages.map((r) => ({ nome: r.dimensionValues[0].value, valor: Number(r.metricValues[0].value) })),
    origens: sources.map((r) => ({ nome: r.dimensionValues[0].value, valor: Number(r.metricValues[0].value) })),
    porDia: daily.map((r) => ({ date: r.dimensionValues[0].value, value: Number(r.metricValues[0].value) })),
  };
}

// Google Ads (Franklin, 2026-11-21): cada conta de anúncios que o login
// enxerga (pula as contas gerentes/MCC) com investimento, cliques e as
// campanhas do período. Se a conta só abre pela MCC, tenta de novo com o
// cabeçalho login-customer-id de cada gerente.
function ymd(d) { return d.toISOString().slice(0, 10); }
async function googleAdsReport(token, days) {
  const ids = await listAdsCustomers(token);
  const infos = [];
  for (const id of ids) {
    try {
      const [row] = await adsSearch(token, id, 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager, customer.status FROM customer LIMIT 1');
      if (row) infos.push({ id, ...row.customer });
    } catch (e) { infos.push({ id, erro: e.message }); }
  }
  const managers = infos.filter((c) => c.manager).map((c) => c.id);
  const fim = new Date();
  const ini = new Date(Date.now() - (days - 1) * 86400000);
  const q = `SELECT campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${ymd(ini)}' AND '${ymd(fim)}' AND campaign.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 20`;
  const contas = [];
  for (const c of infos.filter((x) => !x.manager)) {
    let rows = null;
    let erro = c.erro || null;
    for (const login of [null, ...managers]) {
      try { rows = await adsSearch(token, c.id, q, login); erro = null; break; } catch (e) { erro = e.message; }
    }
    const campanhas = (rows || []).map((r) => ({
      nome: r.campaign.name,
      status: r.campaign.status,
      impressoes: Number(r.metrics?.impressions || 0),
      cliques: Number(r.metrics?.clicks || 0),
      gasto: Number(r.metrics?.costMicros || 0) / 1e6,
      conversoes: Number(r.metrics?.conversions || 0),
    }));
    const soma = (k) => campanhas.reduce((t, x) => t + x[k], 0);
    contas.push({
      id: c.id.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3'),
      nome: c.descriptiveName || c.id,
      moeda: c.currencyCode || 'BRL',
      status: c.status || null,
      erro: rows ? null : erro,
      gasto: soma('gasto'), impressoes: soma('impressoes'), cliques: soma('cliques'), conversoes: soma('conversoes'),
      campanhas,
    });
  }
  return { contas, gerentes: infos.filter((c) => c.manager).map((c) => c.descriptiveName || c.id) };
}

async function youtubeReport(token) {
  const ch = await gget('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true', token);
  const c = (ch.items || [])[0];
  if (!c) return null;
  const uploads = c.contentDetails?.relatedPlaylists?.uploads;
  let videos = [];
  if (uploads) {
    const pl = await gget(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=5&playlistId=${uploads}`, token);
    const ids = (pl.items || []).map((i) => i.contentDetails.videoId).join(',');
    if (ids) {
      const v = await gget(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids}`, token);
      videos = (v.items || []).map((i) => ({ titulo: i.snippet.title, views: Number(i.statistics.viewCount || 0), likes: Number(i.statistics.likeCount || 0), id: i.id }));
    }
  }
  return {
    canal: c.snippet.title,
    inscritos: c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount || 0),
    visualizacoes: Number(c.statistics.viewCount || 0),
    videos: Number(c.statistics.videoCount || 0),
    ultimos: videos,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { identifier, password } = req.body || {};
  const days = Math.min(365, Math.max(1, Number(req.body?.days) || 30));
  const users = await loadUsers();
  let user;
  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) user = findUser(users, identifier);
  else {
    user = findUser(users, identifier);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
      return;
    }
  }
  const conn = (user && user.connections) || {};
  let dirty = false;
  const save = () => { dirty = true; };
  const out = { days, google: !!conn.google, youtube: !!conn.youtube };

  if (conn.google) {
    try {
      const token = await freshToken(conn.google, save);
      try {
        const props = await listAnalyticsProperties(token);
        const chosen = props.find((p) => p.property === user.googlePropertyId) || props[0];
        out.analytics = chosen ? { propriedade: chosen.name, ...(await gaReport(token, chosen.property, days)) } : { aviso: 'Nenhum site no Google Analytics nessa conta' };
      } catch (e) {
        out.analytics = { aviso: `Analytics: ${e.message}` };
      }
      try {
        const contas = await listBusinessAccounts(token);
        out.meuNegocio = { contas };
      } catch (e) {
        out.meuNegocio = { aviso: /quota|Quota/.test(e.message) ? 'Aguardando o Google liberar o acesso (pedido enviado, 7 a 10 dias úteis)' : `Meu Negócio: ${e.message}` };
      }
      if (!String(conn.google.scope || '').includes(ADS_SCOPE)) {
        out.googleAds = { aviso: 'Para ver o Google Ads aqui, toque em Conectar no Google Ads (tela inicial → redes) e autorize de novo.' };
      } else {
        try {
          out.googleAds = await googleAdsReport(token, days);
        } catch (e) {
          out.googleAds = { aviso: `Google Ads: ${e.message}` };
        }
      }
    } catch (e) {
      out.googleErro = 'Conexão do Google vencida — desconecte e conecte de novo';
    }
  }
  if (conn.youtube) {
    try {
      const token = await freshToken(conn.youtube, save);
      out.youtubeDados = await youtubeReport(token);
    } catch (e) {
      out.youtubeErro = 'Conexão do YouTube vencida — desconecte e conecte de novo';
    }
  }
  if (dirty) await saveUsers(users).catch(() => {});
  res.status(200).json(out);
};
