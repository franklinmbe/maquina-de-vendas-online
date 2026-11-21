// Painel "Criar campanha" — ver lib/criar-campanha.js.
// action: 'ver' (padrão), 'postagens' (Instagram p/ o anúncio do Meta),
// 'criar' (rede, config[, teste admin]), 'ativar' (admin, id), 'clientes' (admin)
const { loadUsers, saveUsers, findUser, verifyPassword } = require('../lib/users');
const { avisarAdmin } = require('../lib/avisar-admin');
const { listarPostagens } = require('../lib/virar-anuncio');
const { criarMeta, criarGoogle, ativarMeta, ativarGoogle } = require('../lib/criar-campanha');
const { redesAnuncio } = require('./minha-campanha');

const LIMITE_DIA = 3; // criações por dia por cliente (não admin)
const NOME_REDE = { meta: 'Meta Ads', google: 'Google Ads' };

function resumoAdmin(u, r) {
  const g = r.regiao || {};
  return [
    `🆕 ${u.name || u.client} criou uma campanha pelo app — ${NOME_REDE[r.rede]} (PAUSADA, aguardando sua aprovação):`,
    `Nome: ${r.nome}`,
    `Objetivo: ${r.objetivo}`,
    `Região: ${g.endereco || `${g.lat}, ${g.lng}`} — raio ${g.raio} km`,
    `Orçamento: R$ ${r.orcamentoDia}/dia${r.dias ? ` por ${r.dias} dias` : ''}`,
    r.palavras ? `Palavras-chave: ${r.palavras.join(', ')}` : '',
    r.site ? `Site: ${r.site}` : '',
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
    const lista = users.filter((u) => u.client)
      .map((u) => ({ client: u.client, name: u.client === 'frank' ? 'Franklin (minha conta)' : u.name, pendentes: (u.campanhasCriadas || []).filter((c) => c.status === 'pausada').length }))
      .sort((a, b) => String(a.name || a.client).localeCompare(String(b.name || b.client), 'pt-BR'));
    return res.json({ ok: true, clientes: lista });
  }

  const alvo = isAdmin && client ? users.find((u) => u.client === client) : me;
  if (!alvo) return res.status(404).json({ error: 'Cliente não encontrado' });
  const bloqueado = !isAdmin && Boolean(alvo.teste);
  const liberadas = (isAdmin ? ['meta', 'google'] : redesAnuncio(alvo)).filter((r) => r === 'meta' || r === 'google');
  let dirty = false;
  const save = () => { dirty = true; };

  try {
    if (action === 'postagens') {
      const r = await listarPostagens(alvo, users);
      return res.json(r);
    }

    if (action === 'criar') {
      if (bloqueado) return res.json({ ok: false, mensagem: 'O painel abre quando você assinar um plano.' });
      if (!['meta', 'google'].includes(rede)) return res.json({ ok: false, mensagem: 'Escolha Meta Ads ou Google Ads.' });
      if (!liberadas.includes(rede)) return res.json({ ok: false, mensagem: `${NOME_REDE[rede]} não está no seu plano. Fale com a administração para liberar.` });
      const deHoje = (alvo.campanhasCriadas || []).filter((c) => String(c.criadaEm).slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
      if (!isAdmin && deHoje >= LIMITE_DIA) return res.json({ ok: false, mensagem: `Hoje você já criou ${LIMITE_DIA} campanhas. Amanhã libera de novo.` });
      const t = Boolean(teste && isAdmin);
      const r = rede === 'meta' ? await criarMeta(alvo, users, config, { teste: t }) : await criarGoogle(alvo, users, config, { teste: t, save });
      if (r.ok && r.registro) {
        r.registro.criadaPor = isAdmin ? 'admin' : 'cliente';
        alvo.campanhasCriadas = [r.registro, ...(alvo.campanhasCriadas || [])].slice(0, 50);
        dirty = true;
        if (!isAdmin) avisarAdmin(resumoAdmin(alvo, r.registro)).catch(() => {});
      }
      if (dirty) await saveUsers(users);
      return res.json(r);
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
    });
  } catch (e) {
    return res.json({ ok: false, mensagem: e.message || 'Falha inesperada' });
  }
};
