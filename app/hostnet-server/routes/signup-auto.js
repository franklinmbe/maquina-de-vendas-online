const { hashPassword, loadUsers, saveUsers, findUser, normalizeIdentifier } = require('../lib/users');
const { addRequest, markReleased } = require('../lib/signup-requests');
const { avisarAdmin } = require('../lib/avisar-admin');

// Cadastro automático (Franklin, 2026-11-23): "não precisa nem falar comigo".
// A pessoa põe nome, WhatsApp e cria a própria senha na aba Cadastrar; a conta
// nasce na hora no Teste Grátis 7 Dias (teste/testeAte — lib/testes.js corta
// sozinho quando vence) e ela já entra no app. Plano pago continua pelo
// "Conheça nossos planos" (QR do Mercado Pago libera sozinho).
// O Franklin só recebe o aviso, com o que a empresa precisa (se a pessoa
// escreveu).
const TESTE_DIAS = 7;
const POR_IP_DIA = 5;
const tentativas = new Map(); // ip -> [timestamps]

function slugify(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cliente';
}

function limiteIp(ip) {
  const agora = Date.now();
  const lista = (tentativas.get(ip) || []).filter((t) => agora - t < 864e5);
  if (lista.length >= POR_IP_DIA) return false;
  lista.push(agora);
  tentativas.set(ip, lista);
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { name, whatsapp, password, necessidade } = req.body || {};
  const nome = String(name || '').trim().slice(0, 80);
  let phone = String(whatsapp || '').replace(/\D/g, '');
  if (phone.length >= 12 && phone.startsWith('55')) phone = phone.slice(2);
  const senha = String(password || '');
  const precisa = String(necessidade || '').trim().slice(0, 1000);

  if (!nome) { res.status(400).json({ error: 'Escreva o seu nome ou o nome da sua empresa.' }); return; }
  if (phone.length < 10 || phone.length > 11) { res.status(400).json({ error: 'Esse WhatsApp não parece certo — coloque com DDD, ex: (21) 99999-9999.' }); return; }
  if (senha.length < 6) { res.status(400).json({ error: 'Crie uma senha com pelo menos 6 letras ou números.' }); return; }

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (!limiteIp(ip)) { res.status(429).json({ error: 'Muitos cadastros deste aparelho hoje. Tente amanhã ou fale com a gente no WhatsApp (21) 99905-9608.' }); return; }

  try {
    const users = await loadUsers();
    const identifier = normalizeIdentifier(phone);
    if (findUser(users, identifier)) {
      res.status(409).json({ error: 'Esse WhatsApp já tem conta. Use a aba "Entrar" com a sua senha.' });
      return;
    }
    let client = slugify(nome);
    const base = client;
    let n = 2;
    while (users.some((u) => u.client === client)) client = `${base}-${n++}`;
    const agora = new Date();
    const user = {
      name: nome, identifier, client, plan: 'teste7dias', passwordHash: hashPassword(senha),
      teste: true, testeDias: TESTE_DIAS, testeAte: new Date(agora.getTime() + TESTE_DIAS * 864e5).toISOString(),
      createdAt: agora.toISOString(), origem: 'cadastro-automatico',
    };
    if (precisa) user.necessidade = precisa;
    users.push(user);
    await saveUsers(users);

    try { addRequest(nome, phone, 'teste7dias'); markReleased(phone); } catch (e) { /* lista é só registro */ }
    console.log(`[signup-auto] conta criada sozinha: ${nome} (${phone}) → ${client}, teste ${TESTE_DIAS} dias`);
    avisarAdmin(`🆕 Cadastro automático no app!\n${nome} · WhatsApp ${phone}\nTeste grátis de ${TESTE_DIAS} dias (vence ${new Date(user.testeAte).toLocaleDateString('pt-BR')})${precisa ? `\nO que a empresa precisa: ${precisa}` : ''}\nhttps://wa.me/55${phone}`).catch(() => {});
    res.status(200).json({ ok: true, identifier: phone, client, testeAte: user.testeAte });
  } catch (error) {
    console.error('[signup-auto] falhou:', error.message);
    res.status(500).json({ error: 'Não consegui criar a conta agora. Tente de novo em instantes.' });
  }
};
