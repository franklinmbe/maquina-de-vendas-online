const { loadUsers, saveUsers } = require('../lib/users');
const { encryptToken } = require('../lib/token-crypto');

// Configura o "Aplicativo SaaS" (domínio próprio/subdomínio, módulos
// habilitados, pipeline de status da ficha e número do WhatsApp) de um
// cliente já cadastrado via admin-set-account.js — separado dessa rota
// porque é uma configuração adicional por cima do cadastro básico, feita uma
// vez ao fechar um cliente novo desse produto (ver CLAUDE.md, modelo RN
// Cell). Protegida pela senha mestra, mesmo padrão do resto do painel admin.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { passphrase, client, domains, modules, businessType, statusPipeline, whatsapp } = req.body || {};

  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) {
    res.status(401).json({ error: 'Senha mestra incorreta' });
    return;
  }

  const trimmedClient = String(client || '').trim();
  if (!trimmedClient) {
    res.status(400).json({ error: 'client é obrigatório' });
    return;
  }

  const users = await loadUsers();
  const user = users.find((u) => u.client === trimmedClient);
  if (!user) {
    res.status(404).json({ error: `Cliente "${trimmedClient}" não encontrado` });
    return;
  }

  user.saasApp = user.saasApp || {};
  if (Array.isArray(domains)) {
    user.saasApp.domains = domains.map((d) => String(d).trim().toLowerCase()).filter(Boolean);
  }
  if (modules && typeof modules === 'object') {
    user.saasApp.modules = { ...user.saasApp.modules, ...modules };
  }
  if (businessType) user.saasApp.businessType = String(businessType).trim();
  if (Array.isArray(statusPipeline) && statusPipeline.length) {
    user.saasApp.statusPipeline = statusPipeline;
  }
  if (whatsapp && whatsapp.phoneNumberId && whatsapp.accessToken) {
    user.saasApp.whatsapp = {
      phoneNumberId: String(whatsapp.phoneNumberId).trim(),
      accessToken: encryptToken(whatsapp.accessToken),
      escalationPhone: whatsapp.escalationPhone ? String(whatsapp.escalationPhone).trim() : undefined,
    };
  }

  await saveUsers(users);
  res.status(200).json({ ok: true, saasApp: user.saasApp });
};
