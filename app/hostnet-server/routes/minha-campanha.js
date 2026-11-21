// Painel "Minha campanha" (Franklin, 2026-11-18): todo plano pago já vem
// com gestor de tráfego, então o cliente configura o mínimo das campanhas
// dele no app — objetivo, pra onde o anúncio leva, região (estado, cidade,
// bairro, raio) e quanto quer gastar por dia, com uma simulação simples.
// Fica em user.campanhaConfig. Salvar avisa o admin, que monta/ajusta a
// campanha no Meta do jeito que o cliente escolheu (cliente novo: a
// estratégia é combinada com o Franklin antes de automatizar).
// Conta em teste (user.teste) vê o painel bloqueado: abre depois de pagar.
// action: 'ver' (padrão), 'salvar' (config), 'clientes' (admin)
const { loadUsers, saveUsers, findUser, verifyPassword } = require('../lib/users');
const { avisarAdmin } = require('../lib/avisar-admin');

const OBJETIVOS = ['vendas', 'engajamento', 'trafego', 'cadastros', 'reconhecimento', 'app', 'video', 'seguidores', 'youtube', 'pesquisa', 'loja', 'vagas'];
const REDES = ['meta', 'tiktok', 'google', 'linkedin', 'kwai', 'pinterest'];
const NOME_REDE = { meta: 'Meta Ads', tiktok: 'TikTok Ads', google: 'Google Ads', linkedin: 'LinkedIn Ads', kwai: 'Kwai Ads', pinterest: 'Pinterest Ads' };
const DESTINOS = ['whatsapp', 'site', 'instagram', 'formulario'];
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const NOME_OBJ = { vendas: 'Vendas', engajamento: 'Engajamento', trafego: 'Tráfego', cadastros: 'Cadastros', reconhecimento: 'Reconhecimento', app: 'Promoção do app', video: 'Visualizações de vídeo', seguidores: 'Seguidores', youtube: 'Vídeo no YouTube', pesquisa: 'Pesquisa no Google', loja: 'Visitas à loja', vagas: 'Candidatos a vagas' };
const NOME_DEST = { whatsapp: 'WhatsApp', site: 'Site', instagram: 'Perfil na rede', formulario: 'Formulário da rede' };

// Redes de anúncio por plano — as mesmas das páginas de cada plano
// (public/plano-*.html): Iniciante só Meta Ads; Profissional Meta + TikTok;
// Especialista e Personalizado Meta + TikTok + Google. Plano fora da lista:
// só Meta. users.json → anuncioRedes (lista) sobrepõe, pra admin liberar mais.
const ADS_POR_PLANO = {
  iniciante: ['meta'],
  profissional: ['meta', 'tiktok'],
  especialista: ['meta', 'tiktok', 'google'],
  personalizado: ['meta', 'tiktok', 'google'],
};
function redesAnuncio(user) {
  if (user && Array.isArray(user.anuncioRedes) && user.anuncioRedes.length) return user.anuncioRedes;
  return ADS_POR_PLANO[user && user.plan] || ['meta'];
}

const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

function limpar(c) {
  c = c || {};
  const objetivos = (Array.isArray(c.objetivos) ? c.objetivos : []).filter((o) => OBJETIVOS.includes(o));
  const destino = DESTINOS.includes(c.destino) ? c.destino : 'whatsapp';
  let link = txt(c.link, 300);
  if (destino === 'site' && link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
  const raio = Math.min(80, Math.max(1, Math.round(Number(c.raio) || 3)));
  const orcamentoDia = Math.min(2000, Math.max(6, Math.round(Number(c.orcamentoDia) || 30)));
  const uf = UFS.includes(c.uf) ? c.uf : '';
  return {
    rede: REDES.includes(c.rede) ? c.rede : 'meta',
    objetivos: objetivos.length ? [...new Set(objetivos)].slice(0, 3) : ['vendas'],
    destino,
    link,
    uf,
    cidade: txt(c.cidade, 80),
    bairro: txt(c.bairro, 160),
    raio,
    todoEstado: Boolean(c.todoEstado),
    orcamentoDia,
    observacao: txt(c.observacao, 600),
  };
}

// O que os clientes que já estão rodando escolheram (Franklin, 18/11):
// Vendas + Engajamento, tudo pelo WhatsApp.
function padrao(user) {
  return { objetivos: ['vendas', 'engajamento'], destino: 'whatsapp', link: '', uf: 'RJ', cidade: '', bairro: '', raio: 3, todoEstado: false, orcamentoDia: 30, observacao: '' };
}

function resumo(u, c) {
  const regiao = c.todoEstado ? `todo o estado ${c.uf}` : [c.bairro, c.cidade, c.uf].filter(Boolean).join(', ') + ` (raio ${c.raio} km)`;
  return [
    `🎯 ${u.name || u.client} configurou a campanha no app — ${NOME_REDE[c.rede] || 'Meta Ads'}:`,
    `Objetivo: ${c.objetivos.map((o) => NOME_OBJ[o]).join(' + ')}`,
    `Leva para: ${NOME_DEST[c.destino]}${c.link ? ` (${c.link})` : ''}`,
    `Região: ${regiao}`,
    `Quer gastar: R$ ${c.orcamentoDia}/dia (≈ R$ ${c.orcamentoDia * 30}/mês)`,
    c.observacao ? `Recado: ${c.observacao}` : '',
    'Próximo passo: falar com ele pra confirmar, gerar o código do crédito na rede (valor dentro do plano) e só então montar a campanha.',
    /^\d{10,11}$/.test(String(u.identifier || '')) ? `WhatsApp: https://wa.me/55${u.identifier}` : `Contato: ${u.identifier || '-'}`,
  ].filter(Boolean).join('\n');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { identifier, password, action, client, config } = req.body || {};
  const users = await loadUsers();

  let me = null;
  let isAdmin = false;
  if (process.env.APP_PASSPHRASE && password === process.env.APP_PASSPHRASE) {
    isAdmin = true;
    me = users.find((u) => u.client === 'frank');
  } else {
    me = findUser(users, identifier);
    if (!me || !verifyPassword(password, me.passwordHash)) {
      return res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    }
    isAdmin = me.client === 'frank';
  }

  if (action === 'clientes') {
    if (!isAdmin) return res.status(403).json({ error: 'Só o admin' });
    const lista = users.filter((u) => u.client && u.client !== 'frank')
      .map((u) => ({ client: u.client, name: u.name, temConfig: Boolean(u.campanhaConfig || (u.campanhas && Object.keys(u.campanhas).length)) }))
      .sort((a, b) => String(a.name || a.client).localeCompare(String(b.name || b.client), 'pt-BR'));
    return res.json({ ok: true, clientes: lista });
  }

  const alvo = isAdmin && client ? users.find((u) => u.client === client) : me;
  if (!alvo) return res.status(404).json({ error: 'Cliente não encontrado' });
  const bloqueado = !isAdmin && Boolean(alvo.teste);

  if (action === 'redes-anuncio') {
    return res.json({ ok: true, redes: isAdmin && !client ? REDES : redesAnuncio(alvo) });
  }

  if (action === 'salvar') {
    if (bloqueado) return res.json({ ok: false, bloqueado, mensagem: 'O painel de campanha abre quando você assinar um plano.' });
    const c = limpar(config);
    if (c.destino === 'site' && !c.link) return res.json({ ok: false, mensagem: 'Coloque o endereço do seu site.' });
    if (!c.todoEstado && !c.cidade && !c.bairro) return res.json({ ok: false, mensagem: 'Diga a cidade ou o bairro onde quer anunciar.' });
    if (!c.uf) return res.json({ ok: false, mensagem: 'Escolha o estado.' });
    if (!isAdmin && !redesAnuncio(alvo).includes(c.rede)) return res.json({ ok: false, mensagem: 'Essa rede de anúncio não está no seu plano. Fale com a administração para liberar.' });
    const salvo = { ...c, salvoEm: new Date().toISOString(), salvoPor: isAdmin ? 'admin' : 'cliente', status: 'aguardando' };
    // Uma campanha por rede (campanhas.<rede>); a do Meta também fica em
    // campanhaConfig, onde o resto do app já procura.
    alvo.campanhas = { ...(alvo.campanhas || {}), [c.rede]: salvo };
    if (c.rede === 'meta') alvo.campanhaConfig = salvo;
    await saveUsers(users);
    if (!isAdmin) avisarAdmin(resumo(alvo, c)).catch(() => {});
    return res.json({ ok: true, config: salvo });
  }

  return res.json({
    ok: true,
    bloqueado,
    isAdmin,
    client: alvo.client,
    nome: alvo.name,
    config: alvo.campanhaConfig || null,
    campanhas: { ...(alvo.campanhas || {}), ...(alvo.campanhaConfig ? { meta: alvo.campanhaConfig } : {}) },
    redesAnuncio: isAdmin && !client ? REDES : redesAnuncio(alvo),
    sugestao: padrao(alvo),
    redeConectada: Boolean(alvo.connections && alvo.connections.meta && (alvo.connections.meta.pages || []).length),
  });
};

module.exports.redesAnuncio = redesAnuncio;
