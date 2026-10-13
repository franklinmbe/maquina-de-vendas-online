const { loadUsers, saveUsers } = require('../lib/users');
const { resolveClient } = require('../lib/auth');

// "Aplicativo com a cara da sua empresa" (Franklin, 2026-10-13): cada
// cliente escolhe o nome, a logo e as cores do app (fundo, letras, botões,
// destaque). Guardado em user.brand; o navegador aplica com /js/brand.js.
// action: 'get' (padrão) | 'save' (brand) | 'reset'.
const HEX = /^#[0-9a-f]{6}$/i;
const COLOR_KEYS = ['fundo', 'texto', 'botoes', 'destaque'];
const MAX_LOGO = 300 * 1024; // data URL já reduzida no navegador (máx. 256 px)
// Só do Profissional (R$ 200) pra cima (Franklin, 2026-10-13): o Iniciante e o
// teste grátis não personalizam — é um motivo a mais pra subir de plano.
const BLOCKED_PLANS = ['iniciante', 'teste7dias'];
const UPGRADE_MSG = 'O aplicativo com a cara da sua empresa está disponível a partir do Plano Profissional (R$ 200/mês). Fale com a gente no WhatsApp para mudar de plano.';

function clean(input) {
  const b = {};
  if (input && typeof input.nome === 'string') b.nome = input.nome.replace(/\s+/g, ' ').trim().slice(0, 40);
  if (input && typeof input.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(input.logo) && input.logo.length <= MAX_LOGO) b.logo = input.logo;
  for (const k of COLOR_KEYS) if (input && HEX.test(String(input[k] || ''))) b[k] = input[k].toLowerCase();
  return b;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { identifier, password, action, brand } = req.body || {};
  const client = await resolveClient({ identifier, password });
  if (!client) return res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });

  const users = await loadUsers();
  const user = users.find((u) => u.client === client);
  if (!user) return res.status(404).json({ error: 'Conta não encontrada' });

  const allowed = !BLOCKED_PLANS.includes(user.plan);
  if (!allowed) {
    if (action === 'save') return res.status(403).json({ error: UPGRADE_MSG, allowed: false });
    return res.status(200).json({ ok: true, allowed: false, message: UPGRADE_MSG, brand: null });
  }

  if (action === 'save') {
    if (brand && typeof brand.logo === 'string' && brand.logo && !clean({ logo: brand.logo }).logo) {
      return res.status(400).json({ error: 'A logo precisa ser uma imagem PNG, JPG ou WEBP pequena. Tente outra imagem.' });
    }
    user.brand = { ...clean(brand), atualizadoEm: new Date().toISOString() };
    await saveUsers(users);
  } else if (action === 'reset') {
    delete user.brand;
    await saveUsers(users);
  }
  res.status(200).json({ ok: true, allowed: true, brand: user.brand || null });
};
