const fs = require('fs');
const path = require('path');
const { loadUsers, findUser, verifyPassword } = require('../lib/users');

// Recibos de venda do estoque próprio (Franklin, 24/11/2026).
// Até janeiro/2027 o CNPJ não tem inscrição estadual, então não sai nota fiscal
// de produto: a venda do balcão / entrega na mão leva um RECIBO (não é nota),
// e o envio pelo Correios leva a Declaração de Conteúdo do Melhor Envio.
// Cada recibo fica salvo aqui — é a "planilha de controle de vendas" que o
// contador usa em janeiro para lançar o faturamento. Só admin (Franklin).
// Ações: listar | criar | cancelar.

function arquivo() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado');
  return path.join(dir, 'recibos.json');
}
function ler() {
  try { return JSON.parse(fs.readFileSync(arquivo(), 'utf8')); } catch (e) { return { proximo: 1, recibos: [] }; }
}
function gravar(db) {
  const f = arquivo();
  fs.writeFileSync(f + '.tmp', JSON.stringify(db, null, 1));
  fs.renameSync(f + '.tmp', f);
}
const txt = (v, n = 200) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const { passphrase, identifier, password, acao } = req.body || {};
  const master = process.env.APP_PASSPHRASE;
  let isAdmin = !!master && (passphrase === master || password === master);
  if (!isAdmin && identifier && password) {
    const user = findUser(await loadUsers(), identifier);
    isAdmin = !!user && user.client === 'frank' && verifyPassword(password, user.passwordHash);
  }
  if (!isAdmin) { res.status(401).json({ error: 'Acesso só do administrador' }); return; }

  const db = ler();
  if (acao === 'criar') {
    const r = req.body.recibo || {};
    const itens = (Array.isArray(r.itens) ? r.itens : []).slice(0, 30)
      .map((i) => ({ produto: txt(i.produto, 120), qtd: Math.max(1, Math.round(num(i.qtd) || 1)), unit: num(i.unit), notaCompra: txt(i.notaCompra, 60) }))
      .filter((i) => i.produto && i.unit > 0);
    if (!itens.length) { res.status(400).json({ error: 'Coloque pelo menos um produto com valor' }); return; }
    const novo = {
      numero: db.proximo,
      data: new Date().toISOString(),
      cliente: txt(r.cliente, 100),
      documento: txt(r.documento, 20),
      telefone: txt(r.telefone, 20),
      entrega: ['balcao', 'mao', 'correios'].includes(r.entrega) ? r.entrega : 'balcao',
      pagamento: txt(r.pagamento, 40) || 'Pix',
      itens,
      total: Math.round(itens.reduce((s, i) => s + i.qtd * i.unit, 0) * 100) / 100,
      obs: txt(r.obs, 300),
      cancelado: false,
    };
    db.recibos.push(novo);
    db.proximo += 1;
    gravar(db);
    res.status(200).json({ ok: true, recibo: novo });
    return;
  }
  if (acao === 'cancelar') {
    const r = db.recibos.find((x) => x.numero === Number(req.body.numero));
    if (!r) { res.status(404).json({ error: 'Recibo não encontrado' }); return; }
    r.cancelado = true; r.canceladoEm = new Date().toISOString();
    gravar(db);
    res.status(200).json({ ok: true });
    return;
  }
  res.status(200).json({ ok: true, recibos: db.recibos.slice().reverse() });
};
