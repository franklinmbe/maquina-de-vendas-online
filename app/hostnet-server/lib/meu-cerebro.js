const { listGithubFolder } = require('./github');
const { loadLog } = require('./fluxo2-log');
const { loadTips } = require('./fluxo2-tips');
const { getTodosRecursos, PLANO_RECURSOS } = require('./recursos-por-plano');
const { platformAllowedForPlan } = require('./plan-limits');
const { friendlyName } = require('./painel');

// "Meu cérebro": o mapa da trajetória de UM cliente com a IA, montado só com
// dados dele — o plano, as ferramentas que o plano inclui, os pedidos, as
// redes, o registro do Fluxo 2 (sem as notas internas). Nunca entra nada de
// outro cliente nem da empresa (memória, infra, valores). Mesmo formato do
// mapa da empresa (lib/mapa-cerebro.js), então a mesma página desenha os dois.

const PLAN_NAMES = {
  teste7dias: 'Teste Grátis 7 Dias',
  iniciante: 'Iniciante',
  profissional: 'Profissional',
  especialista: 'Especialista',
  personalizado: 'Personalizado',
  'aplicativo-saas': 'Aplicativos ou SaaS',
};
const TRAFEGO_PLANS = ['especialista', 'personalizado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const PALETTE = ['#33d6cb', '#8b7cf6', '#ffb84d', '#35d07f'];
const NETWORKS = [
  { id: 'facebook', label: 'Facebook', platform: 'meta' },
  { id: 'instagram', label: 'Instagram', platform: 'meta' },
  { id: 'tiktok', label: 'TikTok', platform: 'tiktok' },
  { id: 'youtube', label: 'YouTube', platform: 'youtube' },
  { id: 'telegram', label: 'Telegram', platform: 'telegram' },
  { id: 'wordpress', label: 'WordPress', platform: 'wordpress' },
];

const pedidosCache = new Map();
// Só a lista de pastas de pedido do PRÓPRIO cliente (nomes, que são datas):
// uma ida ao GitHub, guardada 5 minutos.
async function listPedidos(client) {
  const hit = pedidosCache.get(client);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;
  const owner = process.env.GITHUB_OWNER, repo = process.env.GITHUB_REPO, token = process.env.GITHUB_TOKEN;
  let value = { items: [], failed: true };
  if (owner && repo && token) {
    try {
      const entries = await listGithubFolder({ owner, repo, token, path: `.claude/skills/${client}` });
      const items = entries.filter((e) => e.type === 'dir' && /^app-\d{8}-\d{6}$/.test(e.name)).map((e) => e.name).sort();
      value = { items, failed: false };
    } catch {
      value = { items: [], failed: true };
    }
  }
  pedidosCache.set(client, { at: Date.now(), value });
  return value;
}

function pedidoDate(name) {
  const m = String(name).match(/^app-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);
  return m ? { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}`, ym: `${m[1]}-${m[2]}`, y: m[1], mo: Number(m[2]) } : null;
}

const fmt = (d) => String(d).split('-').reverse().join('/');

async function buildUserBrain(user) {
  const client = user.client;
  const plan = user.plan || '';
  const isAdminUser = client === 'frank';
  const { items: pedidos, failed } = await listPedidos(client);
  const events = loadLog().filter((e) => e.client === client && e.visibility !== 'admin');
  const tips = loadTips().filter((t) => t.client === client);
  const stats = user.stats || {};
  const scheduled = (user.scheduledPosts || []).filter((p) => p.status === 'pending');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const hasTrafego = isAdminUser || TRAFEGO_PLANS.includes(plan);

  // ---- redes (anel de fora) ----
  const conn = user.connections || {};
  const pages = conn.meta && Array.isArray(conn.meta.pages) ? conn.meta.pages : [];
  const direct = {
    facebook: pages.length > 0,
    instagram: pages.some((p) => p.instagramBusinessId),
    tiktok: Array.isArray(conn.tiktok) && conn.tiktok.length > 0,
    youtube: !!conn.youtube,
    telegram: !!conn.telegram,
    wordpress: !!conn.wordpress,
  };
  const viaPostiz = new Set((Array.isArray(user.postizConnections) ? user.postizConnections : []).map((p) => p && p.platform));
  const apps = NETWORKS.map((n) => {
    let status, desc;
    if (direct[n.id]) { status = 'ok'; desc = 'Conectada direto pelo app. As publicações saem por aqui.'; }
    else if (viaPostiz.has(n.id)) { status = 'ok'; desc = 'Conectada. A nossa equipe publica pra você (via Postiz).'; }
    else if (!isAdminUser && !platformAllowedForPlan(plan, n.platform)) { status = 'off'; desc = 'Essa rede não faz parte do seu plano. Peça upgrade pela IA (Suporte).'; }
    else { status = 'planned'; desc = 'Ainda não conectada. Conecte na aba Redes pra publicar aqui.'; }
    return { id: `app:${n.id}`, label: n.label, kind: 'app', group: 'Redes sociais', status, desc };
  });
  if (hasTrafego) {
    const hasF2 = events.length > 0;
    apps.push({ id: 'app:meta-ads', label: 'Meta Ads', kind: 'app', group: 'Anúncios', status: hasF2 ? 'ok' : 'wip', desc: hasF2 ? 'Sua conta de anúncios está sendo acompanhada pelo Gestor de Tráfego.' : 'Falta liberar o acesso à sua conta de anúncios pra o Gestor de Tráfego começar.' });
  }
  apps.push({ id: 'app:mvo', label: 'Máquina de Vendas Online', kind: 'app', group: 'A empresa', status: 'ok', desc: 'A empresa por trás do seu cérebro: a equipe e a IA que criam, aprovam com você e publicam o seu conteúdo.' });

  // ---- ferramentas (anel 1): o que o plano inclui + o que fica em planos acima ----
  const inPlan = new Set(isAdminUser ? getTodosRecursos().map((r) => r.id) : PLANO_RECURSOS[plan] || []);
  const skills = getTodosRecursos().map((r) => {
    const has = inPlan.has(r.id);
    let status = has ? 'ok' : 'planned';
    let extra = has ? '' : ' Disponível em planos superiores: peça upgrade pela IA (Suporte).';
    if (has && r.id === 'gestor-trafego' && events.length === 0) { status = 'wip'; extra = ' Começa quando o acesso à sua conta de anúncios for liberado.'; }
    return { id: `skill:${r.id}`, label: `${r.emoji ? `${r.emoji} ` : ''}${r.nome}`.slice(0, 60), kind: 'skill', group: has ? 'Do seu plano' : 'Em planos superiores', status, desc: `${r.desc}${extra}` };
  });

  // ---- rotinas ----
  const conectouDireto = ['facebook', 'instagram', 'tiktok', 'youtube'].some((k) => direct[k]);
  const routines = [
    { id: 'routine:aprovacao', label: 'Aprovação antes de publicar', status: 'ok', desc: 'Todo conteúdo gerado espera o seu OK antes de ir pro ar. Nada sai sem você aprovar.' },
    { id: 'routine:seguidores', label: 'Crescimento de seguidores', status: conectouDireto ? 'ok' : 'planned', desc: conectouDireto ? 'O app registra todo dia o crescimento das suas redes conectadas.' : 'Começa quando você conectar uma rede direto pelo app.' },
  ];
  if (inPlan.has('agendamento')) {
    routines.push({ id: 'routine:agendados', label: 'Posts agendados', status: 'ok', desc: scheduled.length ? `Você tem ${scheduled.length} post${scheduled.length === 1 ? '' : 's'} agendado${scheduled.length === 1 ? '' : 's'}. Saem sozinhos no dia e na hora marcados.` : 'Nenhum post agendado agora. Agende pela aba Calendário.' });
  }
  if (hasTrafego) {
    const tipsHoje = tips.filter((t) => t.date === today).length;
    routines.push({ id: 'routine:f2', label: 'Registro do Fluxo 2', status: events.length ? 'ok' : 'wip', desc: events.length ? 'Tudo que acontece nos seus anúncios fica registrado dia a dia.' : 'Começa quando o Gestor de Tráfego tiver acesso à sua conta de anúncios.' });
    routines.push({ id: 'routine:dicas', label: 'Dicas do dia', status: tipsHoje ? 'ok' : 'wip', desc: tipsHoje ? `${tipsHoje} dicas de estratégia esperando você marcar as que quer.` : 'As dicas de estratégia do dia aparecem aqui e em Ajustes → Meu fluxo de tráfego.' });
  }

  // ---- memória: seus pedidos, por mês ----
  const recent = pedidos.slice(-60);
  const byMonth = new Map();
  for (const name of recent) {
    const d = pedidoDate(name);
    if (!d) continue;
    if (!byMonth.has(d.ym)) byMonth.set(d.ym, { mo: d.mo, y: d.y, docs: [] });
    byMonth.get(d.ym).docs.push({ title: `Pedido de ${fmt(d.date).slice(0, 5)} às ${d.time}`, file: name, date: d.date });
  }
  const months = [...byMonth.entries()].sort().slice(-4);
  const departments = months.map(([ym, m], i) => ({
    id: ym,
    name: `${MONTHS[m.mo - 1].charAt(0).toUpperCase()}${MONTHS[m.mo - 1].slice(1)} de ${m.y}`,
    short: `${MONTHS[m.mo - 1].slice(0, 3)}/${m.y.slice(2)}`,
    color: PALETTE[i % PALETTE.length],
    docs: m.docs,
  }));
  if (!departments.length) departments.push({ id: 'vazio', name: 'Seus pedidos', short: 'Pedidos', color: PALETTE[0], docs: [] });

  // ---- evolução ----
  const milestones = [];
  if (user.createdAt) milestones.push({ date: String(user.createdAt).slice(0, 10), area: 'Conta', title: 'Você entrou na Máquina de Vendas Online' });
  [1, 10, 25, 50, 100, 200].forEach((n) => {
    const name = pedidos[n - 1];
    const d = name && pedidoDate(name);
    if (d) milestones.push({ date: d.date, area: 'Conteúdo', title: n === 1 ? 'Primeiro pedido no seu histórico' : `${n} pedidos no seu histórico` });
  });
  events.filter((e) => ['acesso', 'pausa', 'criacao', 'ativacao', 'orcamento', 'resumo'].includes(e.type)).slice(-12).forEach((e) => {
    milestones.push({ date: e.date, area: 'Tráfego', title: e.title });
  });
  milestones.sort((a, b) => a.date.localeCompare(b.date));

  let acc = 0;
  const perDate = {};
  pedidos.forEach((name) => { const d = pedidoDate(name); if (d) perDate[d.date] = (perDate[d.date] || 0) + 1; });
  const docsByDate = Object.keys(perDate).sort().map((date) => ({ date, total: (acc += perDate[date]) }));
  const commitsByDay = Object.keys(perDate).sort().slice(-45).map((date) => ({ date, count: perDate[date] }));

  // ---- ligações ----
  const connectedIds = apps.filter((a) => a.status === 'ok' && a.id !== 'app:mvo' && a.id !== 'app:meta-ads').map((a) => a.id);
  const links = [
    ['skill:geracao-ia', 'app:mvo'], ['skill:suporte-ia', 'app:mvo'], ['routine:aprovacao', 'app:mvo'],
    ['skill:geracao-ia', 'routine:aprovacao'], ['skill:gestor-trafego', 'app:meta-ads'], ['skill:gestor-trafego', 'routine:dicas'],
    ['skill:gestor-trafego', 'routine:f2'], ['routine:dicas', 'app:meta-ads'], ['routine:f2', 'app:meta-ads'], ['skill:agendamento', 'routine:agendados'],
    ['skill:relatorio-desempenho', 'app:facebook'], ['skill:relatorio-desempenho', 'app:instagram'], ['skill:relatorio-desempenho', 'routine:seguidores'],
    ...connectedIds.map((id) => ['skill:geracao-ia', id]),
    ...connectedIds.map((id) => ['skill:agendamento', id]),
    ...['app:facebook', 'app:instagram', 'app:tiktok', 'app:youtube'].map((id) => ['routine:seguidores', id]),
    ['skill:clone-digital', 'skill:geracao-ia'], ['skill:time-agentes', 'app:mvo'], ['skill:multi-conta', 'app:tiktok'],
  ];
  const known = new Set([...skills.map((s) => s.id), ...routines.map((r) => r.id), ...apps.map((a) => a.id)]);

  const nome = friendlyName(user);
  const totalDocs = pedidos.length;
  // O contador de pedidos enviados conta tudo que o cliente mandou; as pastas guardadas
  // podem ser menos (pedido descartado ou apagado some da pasta) — o mapa mostra as guardadas.
  const sent = Number(stats.totalPedidos) || totalDocs;
  return {
    generatedAt: new Date().toISOString(),
    center: {
      id: 'center',
      label: nome,
      status: 'ok',
      desc: `O seu espaço na Máquina de Vendas Online${PLAN_NAMES[plan] ? `, plano ${PLAN_NAMES[plan]}` : ''}. Aqui está tudo que a IA faz por você e a sua trajetória${user.createdAt ? ` desde ${fmt(String(user.createdAt).slice(0, 10))}` : ''}.`,
      sections: [
        PLAN_NAMES[plan] ? `Plano ${PLAN_NAMES[plan]}` : 'Plano ainda não definido',
        `${sent} pedido${sent === 1 ? '' : 's'} enviado${sent === 1 ? '' : 's'}${totalDocs !== sent ? `, ${totalDocs} guardado${totalDocs === 1 ? '' : 's'} no histórico` : ''}${failed ? ' (não consegui conferir o histórico agora)' : ''}`,
        `${stats.fotos || 0} foto${(stats.fotos || 0) === 1 ? '' : 's'} e ${stats.videos || 0} vídeo${(stats.videos || 0) === 1 ? '' : 's'} enviados por você`,
        `${apps.filter((a) => a.status === 'ok' && a.group === 'Redes sociais').length} rede${apps.filter((a) => a.status === 'ok' && a.group === 'Redes sociais').length === 1 ? '' : 's'} social conectada`,
      ],
    },
    skills,
    routines,
    apps,
    memory: { total: recent.length, departments },
    links: links.filter(([a, b]) => known.has(a) && known.has(b)),
    evolution: { milestones, docsByDate, commitsByDay, totalCommits: totalDocs },
    labels: {
      title: 'Meu Cérebro',
      search: 'Buscar: instagram, agendamento, pedido, anúncios...',
      lede: 'A sua trajetória com a IA num mapa só: o seu negócio no centro, as <strong>ferramentas</strong> do seu plano em volta, os seus <strong>pedidos</strong>, as <strong>rotinas</strong> que rodam por você e as <strong>redes</strong> por fora. Toque num ponto pra ver o detalhe e as ligações.',
      layers: { skill: 'Ferramentas', memory: 'Pedidos', routine: 'Rotinas', app: 'Redes' },
      titles: { skills: 'FERRAMENTAS', memory: 'PEDIDOS', routines: 'ROTINAS', apps: 'REDES' },
      kinds: { skill: 'Ferramenta', routine: 'Rotina', app: 'Rede' },
      docNote: 'O conteúdo desse pedido (fotos, vídeos e textos) fica guardado com segurança e não aparece aqui. Aqui você vê só a trajetória.',
      evoTitle: 'Sua evolução',
      evoDocsTitle: 'Seus pedidos crescendo',
      evoDocsCap: docsByDate.length ? `${acc} pedido${acc === 1 ? '' : 's'} guardado${acc === 1 ? '' : 's'} no histórico, do primeiro em ${fmt(docsByDate[0].date)} até ${fmt(docsByDate[docsByDate.length - 1].date)}.` : 'Quando você fizer o primeiro pedido, a curva aparece aqui.',
      evoCommitsTitle: 'Seu ritmo de pedidos',
      evoCommitsCap: commitsByDay.length ? `Pedidos por dia nos últimos ${commitsByDay.length} dias em que você pediu.` : 'Ainda sem pedidos pra mostrar o ritmo.',
      milestonesTitle: 'Sua trajetória',
      showHistory: false,
      footNote: 'Este mapa é montado na hora só com os seus dados. Ninguém mais vê o seu cérebro, além da equipe da Máquina de Vendas Online.',
    },
  };
}

module.exports = { buildUserBrain };
