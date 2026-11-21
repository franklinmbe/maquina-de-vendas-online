// Conexão Google (Analytics + Meu Negócio) — Franklin, 2026-11-20.
// Usa o mesmo cliente OAuth do YouTube (projeto "My Project",
// charged-epsilon-241016), com escopos só de leitura do Analytics e de
// gestão do Perfil da Empresa. Uma conexão serve pros dois botões.
const { refreshAccessToken } = require('./youtube');

const AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/business.manage',
  // Google Ads (Franklin, 2026-11-21): desde 09/09/2026 o Google não pede
  // mais token de desenvolvedor — o nível de acesso vem do projeto do
  // Google Cloud dono deste cliente OAuth (hoje "Exploração").
  'https://www.googleapis.com/auth/adwords',
];
const ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';
const ADS_API = 'https://googleads.googleapis.com/v26';

function getAppCredentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Credenciais do Google não configuradas no servidor');
  return { clientId, clientSecret };
}

function buildAuthorizeUrl({ redirectUri, state }) {
  const { clientId } = getAppCredentials();
  const url = new URL(AUTH_BASE);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeCodeForToken({ code, redirectUri }) {
  const { clientId, clientSecret } = getAppCredentials();
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString(),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Google recusou: ${body.error_description || body.error || response.status}`);
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || null,
    expiresAt: Date.now() + (body.expires_in || 3600) * 1000,
    scope: body.scope || '',
  };
}

async function getEmail(accessToken) {
  const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  const b = await r.json().catch(() => ({}));
  return b.email || null;
}

// Propriedades do GA4 que a conta enxerga (nome + id), pra mostrar na tela.
async function listAnalyticsProperties(accessToken) {
  const r = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=50', { headers: { Authorization: `Bearer ${accessToken}` } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error?.message || `Analytics ${r.status}`);
  return (b.accountSummaries || []).flatMap((a) => (a.propertySummaries || []).map((p) => ({ account: a.displayName, property: p.property, name: p.displayName })));
}

// Contas do Perfil da Empresa (Meu Negócio). A API só responde depois que o
// Google aprova o acesso do projeto — até lá volta erro de cota (429/403).
async function listBusinessAccounts(accessToken) {
  const r = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', { headers: { Authorization: `Bearer ${accessToken}` } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error?.message || `Meu Negócio ${r.status}`);
  return (b.accounts || []).map((a) => ({ name: a.accountName, id: a.name, type: a.type }));
}

// Google Ads: contas que o login enxerga (ids "customers/123…").
async function listAdsCustomers(accessToken) {
  const r = await fetch(`${ADS_API}/customers:listAccessibleCustomers`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(adsError(b, r.status));
  return (b.resourceNames || []).map((n) => n.split('/')[1]);
}

function adsError(b, status) {
  const e = b.error || (Array.isArray(b) && b[0] && b[0].error) || {};
  const det = (e.details || []).flatMap((d) => d.errors || []).map((x) => x.message).filter(Boolean)[0];
  return det || e.message || `Google Ads ${status}`;
}

// Consulta GAQL numa conta. loginCustomerId = conta gerente (MCC) quando o
// acesso à conta vem por ela.
async function adsSearch(accessToken, customerId, query, loginCustomerId) {
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  if (loginCustomerId) headers['login-customer-id'] = String(loginCustomerId);
  const r = await fetch(`${ADS_API}/customers/${customerId}/googleAds:search`, { method: 'POST', headers, body: JSON.stringify({ query }) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(adsError(b, r.status));
  return b.results || [];
}

module.exports = { SCOPES, ADS_SCOPE, listAdsCustomers, adsSearch, buildAuthorizeUrl, exchangeCodeForToken, refreshAccessToken, getEmail, listAnalyticsProperties, listBusinessAccounts };
