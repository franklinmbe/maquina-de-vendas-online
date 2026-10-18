// Pagamento dos planos pelo Mercado Pago (Franklin, 2026-10-18). Conta
// PESSOAL (CPF) até o CNPJ ser regularizado em janeiro/2027. Credenciais só no
// .env do servidor (MP_ACCESS_TOKEN). Os links de cada plano (Checkout Pro)
// ficam em $DATA_DIR/mp-planos.json; o QR Code de cada cartão aponta pra
// /pagar/<plano>, então dá pra trocar o link sem trocar o QR impresso.
// Cada pagamento avisado pelo Mercado Pago fica em $DATA_DIR/vendas-mp.json
// (relatório pro contador).
const fs = require('fs/promises');
const path = require('path');

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
    if (i >= 0) vendas[i] = venda; else vendas.unshift(venda);
    await fs.writeFile(dataFile('vendas-mp.json'), JSON.stringify(vendas, null, 2));
    console.log(`[mercadopago] pagamento ${p.id} ${p.status} R$ ${p.transaction_amount} ${p.external_reference || ''}`);
  } catch (error) {
    console.error('[mercadopago] webhook falhou:', error.message);
  }
}

module.exports = { pagar, webhook };
