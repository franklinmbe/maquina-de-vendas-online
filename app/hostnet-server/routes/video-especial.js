// Rotas do "🎬 Vídeo especial" do Cut Studio Pro e dos créditos que pagam por
// ele (Franklin, 2026-10-26). Ver lib/creditos.js (preço e níveis) e
// lib/video-especial.js (geração em segundo plano).
const fs = require('fs');
const crypto = require('crypto');

const { loadUsers, findUser, verifyPassword } = require('../lib/users');
const C = require('../lib/creditos');
const VE = require('../lib/video-especial');
const { avisarAdmin } = require('../lib/avisar-admin');

const WHATSAPP = '5521999059608';

// Login normal do app. Senha mestra = admin (pasta do frank, sem pagar).
async function autenticar(req) {
  const { identifier, password } = req.body || {};
  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    return { client: 'frank', admin: true, identifier: 'cliente:frank', nome: 'Franklin' };
  }
  const user = findUser(await loadUsers(), identifier);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return { client: user.client, admin: C.isAdmin(user), identifier, nome: user.name || '', user };
}

// Link assinado pro <video> tocar o arquivo (a tag não manda a senha).
function assinar(client, id) {
  const segredo = process.env.OAUTH_STATE_SECRET || process.env.APP_PASSPHRASE || '';
  return crypto.createHmac('sha256', segredo).update(`ve:${client}:${id}`).digest('hex').slice(0, 32);
}

function jobPublico(client, j) {
  return {
    id: j.id, nivel: j.nivel, segundos: j.segundos, descricao: j.descricao, creditos: j.creditos,
    status: j.status, etapa: j.etapa || '', erro: j.erro || '', criadoEm: j.criadoEm,
    url: j.status === 'pronto' ? `/api/video-especial/arquivo/${encodeURIComponent(client)}/${j.id}?t=${assinar(client, j.id)}` : '',
  };
}

async function saldo(req, res) {
  const a = await autenticar(req);
  if (!a) { res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' }); return; }
  const jobs = await VE.listarJobs(a.client);
  res.json({
    ok: true,
    admin: a.admin,
    saldo: a.admin ? null : ((a.user && a.user.creditos) || 0),
    preco: C.PRECO_CREDITO,
    niveis: C.NIVEIS,
    duracoes: C.DURACOES,
    pacotes: C.PACOTES,
    compraOnline: !!process.env.MP_ACCESS_TOKEN,
    extrato: ((a.user && a.user.creditosHist) || []).slice(0, 15),
    videos: jobs.slice(0, 30).map((j) => jobPublico(a.client, j)),
  });
}

async function criar(req, res) {
  const a = await autenticar(req);
  if (!a) { res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' }); return; }
  const { nivel, descricao } = req.body || {};
  const segundos = Number((req.body || {}).segundos);
  const n = C.NIVEIS[nivel];
  if (!n) { res.status(400).json({ error: 'Escolha o tipo de vídeo.' }); return; }
  if (n.sobEncomenda) { res.status(400).json({ error: 'O vídeo Cinema é feito sob encomenda. Fale com a gente no WhatsApp.' }); return; }
  if (!n.pronto) { res.status(400).json({ error: `O vídeo ${n.nome} chega em breve.` }); return; }
  if (!C.DURACOES.includes(segundos)) { res.status(400).json({ error: 'Escolha a duração do vídeo.' }); return; }
  const texto = String(descricao || '').trim().slice(0, 1200);
  if (texto.length < 10) { res.status(400).json({ error: 'Conte com mais detalhes o vídeo que você quer.' }); return; }
  const arq = (req.files || [])[0];
  if (arq && !/^image\//.test(arq.mimetype)) { res.status(400).json({ error: 'Por enquanto, mande só foto (não vídeo).' }); return; }

  const creditos = C.custoEmCreditos(nivel, segundos);
  const deb = await C.debitar(a.identifier, creditos, `Vídeo especial ${n.nome} ${segundos} s`);
  if (!deb.ok) {
    res.status(402).json({ error: `Este vídeo usa ${creditos} créditos e você tem ${deb.saldo}. Compre mais créditos aqui embaixo.`, falta: deb.falta });
    return;
  }
  const job = await VE.iniciar(a.client, {
    nivel, segundos, descricao: texto, creditos, admin: deb.admin,
    foto: arq ? { buffer: arq.buffer, mimeType: arq.mimetype } : null,
  });
  res.json({ ok: true, saldo: deb.saldo, video: jobPublico(a.client, job) });
}

async function arquivo(req, res) {
  const { client, id } = req.params;
  if (req.query.t !== assinar(client, id)) { res.status(403).end(); return; }
  const job = await VE.lerJob(client, id);
  const p = VE.caminhoVideo(client, id);
  if (!job || job.status !== 'pronto' || !fs.existsSync(p)) { res.status(404).end(); return; }
  res.set('Content-Disposition', `inline; filename="video-especial-${id}.mp4"`);
  res.sendFile(p);
}

// ===== Compra de créditos (Mercado Pago, Checkout Pro) =====
// external_reference = "creditos:<cliente>:<créditos>" — o webhook e a volta
// do checkout usam isso pra saber quem paga e quanto creditar.
async function comprar(req, res) {
  const a = await autenticar(req);
  if (!a) { res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' }); return; }
  const pacote = C.PACOTES.find((p) => p.id === (req.body || {}).pacote);
  if (!pacote) { res.status(400).json({ error: 'Escolha um pacote.' }); return; }
  const txt = `Olá! Quero comprar ${pacote.creditos} créditos (R$ ${pacote.preco.toFixed(2).replace('.', ',')}) para o Vídeo especial do Cut Studio Pro. Minha conta: ${a.nome || a.client}`;
  const whatsapp = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(txt)}`;
  if (!process.env.MP_ACCESS_TOKEN) { res.json({ ok: true, link: whatsapp, whatsapp: true }); return; }
  const base = `https://${req.get('host')}`;
  try {
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        items: [{ title: `${pacote.creditos} créditos — Vídeo especial (Cut Studio Pro)`, quantity: 1, unit_price: pacote.preco, currency_id: 'BRL' }],
        external_reference: `creditos:${a.client}:${pacote.creditos}`,
        back_urls: { success: `${base}/estudio.html?creditos=1`, pending: `${base}/estudio.html?creditos=1`, failure: `${base}/estudio.html?creditos=1` },
        auto_return: 'approved',
        notification_url: `${base}/api/mp-webhook`,
      }),
    });
    const pref = await r.json();
    if (!r.ok || !pref.init_point) throw new Error(JSON.stringify(pref).slice(0, 300));
    res.json({ ok: true, link: pref.init_point });
  } catch (error) {
    console.error('[creditos] checkout falhou:', error.message);
    res.json({ ok: true, link: whatsapp, whatsapp: true });
  }
}

// Credita um pagamento aprovado de créditos (chamado pelo webhook e pela
// volta do checkout). Não credita duas vezes o mesmo pagamento.
async function creditarPagamento(p) {
  const m = /^creditos:([a-z0-9-]+):(\d+)$/i.exec(String(p.external_reference || ''));
  if (!m || p.status !== 'approved') return null;
  const creditos = Number(m[2]);
  const pacote = C.PACOTES.find((x) => x.creditos === creditos);
  // Confere o valor pago, pra ninguém mudar a quantidade no meio do caminho.
  if (!pacote || Number(p.transaction_amount) + 0.001 < pacote.preco) return null;
  const r = await C.creditar({ client: m[1] }, creditos, `Compra de ${creditos} créditos (Mercado Pago)`, p.id);
  if (!r.repetido) {
    avisarAdmin(`💳 Créditos vendidos!\n${r.nome} comprou ${creditos} créditos · R$ ${Number(p.transaction_amount).toFixed(2).replace('.', ',')}`).catch(() => {});
  }
  return r;
}

async function confirmar(req, res) {
  const a = await autenticar(req);
  if (!a) { res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' }); return; }
  const id = String((req.body || {}).payment_id || '').replace(/\D/g, '');
  if (!id || !process.env.MP_ACCESS_TOKEN) { res.status(400).json({ error: 'Pagamento não encontrado.' }); return; }
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(20000),
    });
    const p = r.ok ? await r.json() : null;
    if (!p || !String(p.external_reference || '').startsWith(`creditos:${a.client}:`)) { res.status(404).json({ error: 'Não achei essa compra de créditos.' }); return; }
    if (p.status !== 'approved') { res.json({ ok: false, pendente: true, error: 'O pagamento ainda está sendo confirmado. Os créditos entram sozinhos assim que ele for aprovado.' }); return; }
    const c = await creditarPagamento(p);
    res.json({ ok: !!c, saldo: c ? c.saldo : null });
  } catch (error) {
    console.error('[creditos] confirmar falhou:', error.message);
    res.status(500).json({ error: 'Não consegui conferir o pagamento agora. Os créditos entram sozinhos em alguns minutos.' });
  }
}

// Admin põe (ou tira, com número negativo) créditos na mão — venda por Pix no
// WhatsApp, cortesia, correção.
async function admin(req, res) {
  const { passphrase, client, motivo } = req.body || {};
  const creditos = Math.trunc(Number((req.body || {}).creditos));
  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) { res.status(401).json({ error: 'Senha mestra incorreta' }); return; }
  if (!client || !creditos) { res.status(400).json({ error: 'Informe o cliente e a quantidade de créditos.' }); return; }
  try {
    const r = await C.creditar({ client }, creditos, String(motivo || 'Ajuste do admin').slice(0, 120));
    res.json({ ok: true, saldo: r.saldo });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}

module.exports = { saldo, criar, arquivo, comprar, confirmar, admin, creditarPagamento };
