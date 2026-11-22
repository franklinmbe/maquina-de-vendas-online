// Painel "Criar campanha" — ver lib/criar-campanha.js.
// action: 'ver' (padrão), 'postagens' (Instagram p/ o anúncio do Meta),
// 'criar' (rede, config[, teste admin]) — no Meta, config.campanhas =
//   [{ objetivo, valor }] cria uma campanha por objetivo, cada uma com o seu valor,
// 'ativar' (admin, id), 'clientes' (admin),
// crédito: 'credito-pedir' (rede, valor, forma), 'credito-codigo' (admin: id,
//   codigo), 'credito-paguei' (id), 'credito-confirmar' (admin: id).
// O código de pagamento (Pix/boleto) do crédito é gerado pela equipe na
// própria rede (Meta/Google não têm API pra isso) e colado aqui pro cliente.
const crypto = require('crypto');
const { loadUsers, saveUsers, findUser, verifyPassword } = require('../lib/users');
const { avisarAdmin } = require('../lib/avisar-admin');
const { listarPostagens } = require('../lib/virar-anuncio');
const { criarMeta, criarGoogle, ativarMeta, ativarGoogle } = require('../lib/criar-campanha');
const { redesAnuncio } = require('./minha-campanha');

const LIMITE_DIA = 6; // campanhas criadas por dia por cliente (não admin)
const NOME_REDE = { meta: 'Meta Ads', google: 'Google Ads' };
const FORMAS = { pix: 'Pix', boleto: 'Boleto' };
const brl = (n) => `R$ ${Number(n || 0).toLocaleString('pt-BR')}`;

function resumoAdmin(u, regs) {
  const r0 = regs[0];
  const g = r0.regiao || {};
  return [
    `🆕 ${u.name || u.client} criou ${regs.length > 1 ? `${regs.length} campanhas` : 'uma campanha'} pelo app — ${NOME_REDE[r0.rede]} (PAUSADA, aguardando sua aprovação):`,
    ...regs.map((r) => `• ${r.nome} — ${r.modo === 'semana' ? `${brl(r.valor)}/semana (≈ ${brl(r.orcamentoDia)}/dia)` : `${brl(r.orcamentoDia)}/dia`}`),
    `Região: ${g.endereco || `${g.lat}, ${g.lng}`} — raio ${g.raio} km`,
    r0.palavras ? `Palavras-chave: ${r0.palavras.join(', ')}` : '',
    r0.site ? `Site: ${r0.site}` : '',
    'Para ligar: app → Criar campanha (escolha o cliente) → "Aprovar e ativar".',
  ].filter(Boolean).join('\n');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { identifier, password, action, client, rede, config, teste, id } = req.body || {};
  const users = await loadUsers();

  let me = null;
  let isAdmin = false;
  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    isAdmin = true;
    me = users.find((u) => u.client === 'frank');
  } else {
    me = findUser(users, identifier);
    if (!me || !verifyPassword(password, me.passwordHash)) return res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    isAdmin = me.client === 'frank';
  }

  if (action === 'clientes') {
    if (!isAdmin) return res.status(403).json({ error: 'Só o admin' });
    const lista = users.filter((u) => u.client && u.client !== 'frank')
      .map((u) => ({
        client: u.client,
        name: u.name,
        pendentes: (u.campanhasCriadas || []).filter((c) => c.status === 'pausada').length
          + (u.pedidosCredito || []).filter((c) => c.status === 'aguardando-codigo' || c.status === 'pago-informado').length,
      }))
      .sort((a, b) => (b.pendentes - a.pendentes) || String(a.name || a.client).localeCompare(String(b.name || b.client), 'pt-BR'));
    return res.json({ ok: true, clientes: lista });
  }

  const alvo = isAdmin && client ? users.find((u) => u.client === client) : me;
  if (!alvo) return res.status(404).json({ error: 'Cliente não encontrado' });
  const bloqueado = !isAdmin && Boolean(alvo.teste);
  const liberadas = (isAdmin ? ['meta', 'google'] : redesAnuncio(alvo)).filter((r) => r === 'meta' || r === 'google');
  let dirty = false;
  const save = () => { dirty = true; };
  const quem = alvo.name || alvo.client;

  try {
    if (action === 'postagens') return res.json(await listarPostagens(alvo, users));

    if (action === 'criar') {
      if (bloqueado) return res.json({ ok: false, mensagem: 'O painel abre quando você assinar um plano.' });
      if (!['meta', 'google'].includes(rede)) return res.json({ ok: false, mensagem: 'Escolha Meta Ads ou Google Ads.' });
      if (!liberadas.includes(rede)) return res.json({ ok: false, mensagem: `${NOME_REDE[rede]} não está no seu plano. Fale com a administração para liberar.` });
      const cfg = config || {};
      const itens = rede === 'meta'
        ? (Array.isArray(cfg.campanhas) ? cfg.campanhas : []).slice(0, 4).map((x) => ({ ...cfg, objetivo: x.objetivo, valor: x.valor }))
        : [cfg];
      if (!itens.length) return res.json({ ok: false, mensagem: 'Marque pelo menos uma campanha.' });
      const deHoje = (alvo.campanhasCriadas || []).filter((c) => String(c.criadaEm).slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
      if (!isAdmin && deHoje + itens.length > LIMITE_DIA) return res.json({ ok: false, mensagem: `Dá para criar até ${LIMITE_DIA} campanhas por dia. Amanhã libera de novo.` });
      const t = Boolean(teste && isAdmin);
      const feitas = [];
      const erros = [];
      for (const it of itens) {
        const r = rede === 'meta' ? await criarMeta(alvo, users, it, { teste: t }) : await criarGoogle(alvo, users, it, { teste: t, save });
        if (r.ok && r.registro) { r.registro.criadaPor = isAdmin ? 'admin' : 'cliente'; feitas.push(r.registro); }
        else if (r.ok) feitas.push(r);
        else erros.push(r.mensagem);
      }
      const regs = feitas.filter((x) => x.id);
      if (regs.length) {
        alvo.campanhasCriadas = [...regs, ...(alvo.campanhasCriadas || [])].slice(0, 50);
        dirty = true;
        if (!isAdmin) avisarAdmin(resumoAdmin(alvo, regs)).catch(() => {});
      }
      if (dirty) await saveUsers(users);
      return res.json({ ok: feitas.length > 0 && !erros.length, criadas: feitas.length, feitas, erros, mensagem: erros.join(' | ') || undefined });
    }

    if (action === 'ativar') {
      if (!isAdmin) return res.status(403).json({ ok: false, mensagem: 'Só a administração liga a campanha (envolve dinheiro).' });
      const reg = (alvo.campanhasCriadas || []).find((c) => c.id === id);
      if (!reg) return res.json({ ok: false, mensagem: 'Campanha não encontrada.' });
      if (reg.rede === 'meta') await ativarMeta(alvo, users, reg);
      else await ativarGoogle(alvo, users, reg, save);
      reg.status = 'ativa';
      reg.ativadaEm = new Date().toISOString();
      await saveUsers(users);
      return res.json({ ok: true, registro: reg });
    }

    // ---------- crédito / código de pagamento ----------
    const pedidos = () => (alvo.pedidosCredito = alvo.pedidosCredito || []);
    if (action === 'credito-pedir') {
      if (bloqueado) return res.json({ ok: false, mensagem: 'O painel abre quando você assinar um plano.' });
      if (!['meta', 'google'].includes(rede) || !liberadas.includes(rede)) return res.json({ ok: false, mensagem: 'Essa rede de anúncio não está no seu plano.' });
      const valor = Math.round(Number(req.body.valor) || 0);
      const forma = FORMAS[req.body.forma] ? req.body.forma : 'pix';
      if (valor < 20) return res.json({ ok: false, mensagem: 'O crédito mínimo é R$ 20.' });
      if (valor > 20000) return res.json({ ok: false, mensagem: 'Para valores acima de R$ 20.000, fale com a equipe.' });
      if (pedidos().filter((p) => p.status === 'aguardando-codigo').length >= 3) return res.json({ ok: false, mensagem: 'Você já tem pedidos de código esperando. Aguarde a equipe enviar.' });
      const p = { id: crypto.randomBytes(6).toString('hex'), rede, valor, forma, status: 'aguardando-codigo', criadoEm: new Date().toISOString() };
      pedidos().unshift(p);
      alvo.pedidosCredito = alvo.pedidosCredito.slice(0, 30);
      await saveUsers(users);
      if (!isAdmin) avisarAdmin(`💳 ${quem} pediu um código de pagamento: ${brl(valor)} de crédito no ${NOME_REDE[rede]} (${FORMAS[forma]}).\nGere o ${FORMAS[forma]} na conta de anúncios dele e cole no app: Criar campanha → escolha o cliente → Códigos de pagamento.`).catch(() => {});
      return res.json({ ok: true, pedido: p });
    }
    if (['credito-codigo', 'credito-paguei', 'credito-confirmar', 'credito-cancelar'].includes(action)) {
      const p = pedidos().find((x) => x.id === id);
      if (!p) return res.json({ ok: false, mensagem: 'Pedido não encontrado.' });
      if (action === 'credito-paguei') {
        if (p.status !== 'codigo-enviado') return res.json({ ok: false, mensagem: 'Esse código ainda não foi enviado.' });
        p.status = 'pago-informado'; p.pagoEm = new Date().toISOString();
        if (!isAdmin) avisarAdmin(`✅ ${quem} avisou que pagou o código de ${brl(p.valor)} (${NOME_REDE[p.rede]}). Confira o saldo e confirme no app.`).catch(() => {});
      } else {
        if (!isAdmin) return res.status(403).json({ ok: false, mensagem: 'Só a administração.' });
        if (action === 'credito-codigo') {
          const codigo = String(req.body.codigo || '').trim().slice(0, 1200);
          if (codigo.length < 10) return res.json({ ok: false, mensagem: 'Cole o código completo.' });
          p.codigo = codigo; p.status = 'codigo-enviado'; p.codigoEm = new Date().toISOString();
          const venc = String(req.body.vencimento || '').trim().slice(0, 40);
          if (venc) p.vencimento = venc;
        }
        if (action === 'credito-confirmar') { p.status = 'creditado'; p.creditadoEm = new Date().toISOString(); }
        if (action === 'credito-cancelar') { p.status = 'cancelado'; }
      }
      await saveUsers(users);
      return res.json({ ok: true, pedido: p });
    }

    const conn = alvo.connections || {};
    const g = conn.google;
    if (dirty) await saveUsers(users);
    return res.json({
      ok: true,
      isAdmin,
      bloqueado,
      client: alvo.client,
      nome: alvo.name,
      liberadas,
      metaConectado: Boolean(conn.meta && (conn.meta.pages || []).length),
      googleConectado: Boolean(g && String(g.scope || '').includes('auth/adwords')) || Boolean(alvo.googleAds && alvo.googleAds.customerId),
      criadas: alvo.campanhasCriadas || [],
      creditos: (alvo.pedidosCredito || []).filter((p) => p.status !== 'cancelado'),
    });
  } catch (e) {
    return res.json({ ok: false, mensagem: e.message || 'Falha inesperada' });
  }
};
