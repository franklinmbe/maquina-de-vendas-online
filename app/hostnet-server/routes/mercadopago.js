// Pagamento dos planos pelo Mercado Pago (Franklin, 2026-10-18). Conta
// PESSOAL (CPF) até o CNPJ ser regularizado em janeiro/2027. Credenciais só no
// .env do servidor (MP_ACCESS_TOKEN). Os links de cada plano (Checkout Pro)
// ficam em $DATA_DIR/mp-planos.json; o QR Code de cada cartão aponta pra
// /pagar/<plano>, então dá pra trocar o link sem trocar o QR impresso.
// Cada pagamento avisado pelo Mercado Pago fica em $DATA_DIR/vendas-mp.json
// (relatório pro contador).
const fs = require('fs/promises');
const path = require('path');

const { avisarAdmin } = require('../lib/avisar-admin');

const ALIAS = { treinamento: 'aplicativo-saas' };
const dataFile = (name) => path.join(process.env.DATA_DIR || '/data', name);

async function readJson(name, fallback) {
  try { return JSON.parse(await fs.readFile(dataFile(name), 'utf8')); } catch (e) { return fallback; }
}

async function pagar(req, res) {
  const plano = ALIAS[req.params.plano] || req.params.plano;
  const links = await readJson('mp-planos.json', {});
  if (!links[plano] || !links[plano].link) {
    res.redirect(302, 'https://wa.me/5521999059608?text=' + encodeURIComponent('Olá! Quero contratar o plano ' + req.params.plano + ' da Máquina de Vendas Online.'));
    return;
  }
  res.redirect(302, links[plano].link);
}

async function webhook(req, res) {
  // Responde rápido (o Mercado Pago reenvia se demorar) e busca o pagamento depois.
  res.status(200).json({ ok: true });
  const id = (req.body && req.body.data && req.body.data.id) || req.query['data.id'] || (req.query.topic === 'payment' && req.query.id);
  const tipo = (req.body && req.body.type) || req.query.type || req.query.topic;
  if (!id || (tipo && tipo !== 'payment') || !process.env.MP_ACCESS_TOKEN) return;
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return;
    const p = await r.json();
    const vendas = await readJson('vendas-mp.json', []);
    const venda = {
      id: p.id,
      status: p.status,
      valor: p.transaction_amount,
      liquido: p.transaction_details && p.transaction_details.net_received_amount,
      forma: p.payment_method_id,
      referencia: p.external_reference,
      item: p.description || (p.additional_info && p.additional_info.items && p.additional_info.items[0] && p.additional_info.items[0].title),
      comprador: { nome: [p.payer && p.payer.first_name, p.payer && p.payer.last_name].filter(Boolean).join(' '), email: p.payer && p.payer.email, documento: p.payer && p.payer.identification && p.payer.identification.number },
      criadoEm: p.date_created,
      aprovadoEm: p.date_approved,
      atualizadoEm: new Date().toISOString(),
    };
    const i = vendas.findIndex((v) => String(v.id) === String(p.id));
    const jaAvisado = i >= 0 && vendas[i].status === 'approved';
    if (i >= 0) vendas[i] = { ...vendas[i], ...venda }; else vendas.unshift(venda);
    await fs.writeFile(dataFile('vendas-mp.json'), JSON.stringify(vendas, null, 2));
    if (p.status === 'approved' && !jaAvisado) {
      const plano = String(p.external_reference || '').replace(/^plano:/, '') || venda.item || 'pagamento';
      await avisarAdmin(`💰 Pagamento recebido no Mercado Pago!\n${plano} · R$ ${Number(p.transaction_amount || 0).toFixed(2).replace('.', ',')} · ${p.payment_method_id || ''}\n${venda.comprador.nome || venda.comprador.email || ''}\nVeja em: app → Pedidos de cadastro`);
    }
    console.log(`[mercadopago] pagamento ${p.id} ${p.status} R$ ${p.transaction_amount} ${p.external_reference || ''}`);
  } catch (error) {
    console.error('[mercadopago] webhook falhou:', error.message);
  }
}

// ===== Liberação automática (Franklin, 2026-10-18) =====
// Depois de pagar, o Mercado Pago devolve o cliente pra /ativar.html com o
// payment_id. A página pede nome + WhatsApp e chama esta rota, que confere o
// pagamento direto no Mercado Pago (aprovado, de um plano, ainda não usado),
// cria a conta com o plano pago e devolve login + senha na tela.
const { hashPassword, loadUsers, saveUsers, findUser, normalizeIdentifier, verifyPassword } = require('../lib/users');
const PLANOS_VALIDOS = ['iniciante', 'profissional', 'especialista', 'personalizado', 'aplicativo-saas'];

function slugify(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cliente';
}

async function fetchPayment(id) {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) return null;
  return r.json();
}

async function ativar(req, res) {
  const { payment_id: paymentId, name, whatsapp } = req.body || {};
  try {
    if (!paymentId || !process.env.MP_ACCESS_TOKEN) { res.status(400).json({ error: 'Pagamento não encontrado.' }); return; }
    const p = await fetchPayment(paymentId);
    if (!p) { res.status(404).json({ error: 'Não achei esse pagamento no Mercado Pago.' }); return; }
    if (p.status !== 'approved') {
      res.status(409).json({ error: p.status === 'pending' || p.status === 'in_process' ? 'O pagamento ainda está sendo confirmado (boleto leva até 3 dias úteis). Volte por este mesmo link quando ele for aprovado, ou fale com a gente no WhatsApp.' : 'Esse pagamento não foi aprovado.' });
      return;
    }
    const plano = String(p.external_reference || '').replace(/^plano:/, '');
    if (!PLANOS_VALIDOS.includes(plano)) { res.status(400).json({ error: 'Esse pagamento não é de um plano do aplicativo.' }); return; }

    const vendas = await readJson('vendas-mp.json', []);
    const venda = vendas.find((v) => String(v.id) === String(p.id));
    if (venda && venda.ativadoPara) {
      res.status(409).json({ error: 'Esse pagamento já liberou uma conta (WhatsApp final ' + String(venda.ativadoPara).slice(-4) + '). Para entrar, use o login e a senha mostrados na hora, ou fale com a gente no WhatsApp.' });
      return;
    }

    const nome = String(name || '').trim().slice(0, 80);
    let phone = String(whatsapp || '').replace(/\D/g, '');
    if (phone.length >= 12 && phone.startsWith('55')) phone = phone.slice(2);
    if (!nome) { res.status(400).json({ error: 'Escreva o seu nome ou o nome da sua empresa.' }); return; }
    if (phone.length < 10 || phone.length > 11) { res.status(400).json({ error: 'Confira o seu WhatsApp, com DDD.' }); return; }

    const users = await loadUsers();
    const identifier = normalizeIdentifier(phone);
    if (findUser(users, identifier)) {
      res.status(409).json({ error: 'Esse WhatsApp já tem conta no aplicativo. Fale com a gente no WhatsApp que ajustamos o seu plano.' });
      return;
    }
    // Senha na mesma sequência do "Liberar cliente" (@maquina1, @maquina2...).
    const maxSeq = users.reduce((m, u) => Math.max(m, Number(u.autoPasswordSeq) || 0), 0);
    let seq = maxSeq + 1;
    while (users.some((u) => u.passwordHash && verifyPassword(`@maquina${seq}`, u.passwordHash))) seq += 1;
    const password = `@maquina${seq}`;
    let client = slugify(nome);
    const base = client;
    let n = 2;
    while (users.some((u) => u.client === client)) client = `${base}-${n++}`;
    users.push({
      name: nome, identifier, client, plan: plano, passwordHash: hashPassword(password), autoPasswordSeq: seq,
      createdAt: new Date().toISOString(), origem: 'mercadopago', pagamentoMp: String(p.id),
    });
    await saveUsers(users);

    const item = venda || { id: p.id, status: p.status, valor: p.transaction_amount, referencia: p.external_reference, criadoEm: p.date_created };
    item.ativadoPara = phone;
    item.ativadoNome = nome;
    item.ativadoEm = new Date().toISOString();
    if (!venda) vendas.unshift(item);
    await fs.writeFile(dataFile('vendas-mp.json'), JSON.stringify(vendas, null, 2));
    console.log(`[mercadopago] conta liberada sozinha: ${nome} (${phone}) plano ${plano}, pagamento ${p.id}`);
    avisarAdmin(`✅ Conta liberada sozinha depois do pagamento!\n${nome} · WhatsApp ${phone}\nPlano: ${plano}\nChame no WhatsApp pra dar as boas-vindas: https://wa.me/55${phone}`).catch(() => {});
    res.status(200).json({ ok: true, login: phone, password, plano });
  } catch (error) {
    console.error('[mercadopago] ativar falhou:', error.message);
    res.status(500).json({ error: 'Não consegui liberar agora. Fale com a gente no WhatsApp que liberamos na hora.' });
  }
}

// Lista de pagamentos pro painel do admin (senha mestra).
async function vendasAdmin(req, res) {
  const { passphrase } = req.body || {};
  if (!process.env.APP_PASSPHRASE || passphrase !== process.env.APP_PASSPHRASE) { res.status(401).json({ error: 'Senha mestra incorreta' }); return; }
  res.status(200).json({ ok: true, vendas: await readJson('vendas-mp.json', []) });
}

module.exports = { pagar, webhook, ativar, vendasAdmin };
