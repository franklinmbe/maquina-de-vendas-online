const fs = require('fs');
const path = require('path');

const { loadUsers } = require('./users');
const { metaSensor } = require('./painel-usuario');
const { friendlyName, PLAN_PRICES } = require('./painel');
const { PLAN_LIMITS } = require('./plan-limits');
const { PLAN_MEDIA_LIMITS, TRIAL_MEDIA_LIMITS } = require('./media-quota');
const { PLAN_POST_LIMITS } = require('./post-quota');
const { PLAN_CALL_LIMITS } = require('./call-limit');
const { PLANO_RECURSOS } = require('./recursos-por-plano');

// Seção "Tarefas pendentes e roteiro" da página Fluxos operacionais (admin).
// É o ÚNICO lugar dessa informação: o Painel de controle só aponta pra cá e o
// Extrato da operação guarda só uma frase curta nos itens de custo.
//
// O texto e o status de cada item vêm de .claude/scripts/roteiro-admin.json
// (o Claude atualiza e envia com upload-roteiro.js, sem deploy). O que muda
// sozinho é calculado aqui ao vivo: o Meta já liberou? quem ainda depende do
// Postiz? e os PARÂMETROS dos planos são lidos direto do código, então nunca
// ficam desatualizados.
function roteiroFilePath() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado (precisa apontar pra um volume persistente)');
  return path.join(dir, 'roteiro-admin.json');
}

function loadRoteiro() {
  const file = roteiroFilePath();
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function saveRoteiro(roteiro) {
  const file = roteiroFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpFile = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(roteiro));
  fs.renameSync(tmpFile, file);
}

const STATUS = ['feito', 'andamento', 'aguardando', 'travado', 'nao-depende'];
const DONOS = ['Franklin', 'Claude', 'Terceiros'];
const text = (v, max) => String(v == null ? '' : v).slice(0, max);

function sanitizeRoteiro(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.blocos)) return null;
  return {
    atualizadoEm: text(raw.atualizadoEm, 20),
    intro: text(raw.intro, 500),
    blocos: raw.blocos.slice(0, 12).map((b) => ({
      id: text(b && b.id, 40),
      titulo: text(b && b.titulo, 120),
      resumo: text(b && b.resumo, 500),
      // blocos com pendencias:true entram na lista "Tarefas pendentes"
      pendencias: !!(b && b.pendencias),
      itens: (Array.isArray(b && b.itens) ? b.itens : []).slice(0, 20).map((i) => ({
        texto: text(i && i.texto, 220),
        status: STATUS.includes(i && i.status) ? i.status : 'aguardando',
        dono: DONOS.includes(i && i.dono) ? i.dono : '',
        depende: text(i && i.depende, 60),
        nota: text(i && i.nota, 600),
        // 'meta': o item vira "feito" sozinho quando o Meta liberar as métricas
        vivo: (i && i.vivo) === 'meta' ? 'meta' : '',
      })),
    })),
  };
}

// Fatos que mudam sozinhos, direto do servidor.
async function buildVivo() {
  const users = await loadUsers();
  const frank = users.find((u) => u.client === 'frank');
  let metaEstado = null;
  try {
    metaEstado = await metaSensor(frank);
  } catch {
    metaEstado = null;
  }
  const clientes = users.filter((u) => u.client !== 'frank');
  const viaPostiz = clientes.filter((u) => (Array.isArray(u.postizConnections) ? u.postizConnections.length : 0) > 0);
  const ids = new Set();
  for (const u of users) for (const p of Array.isArray(u.postizConnections) ? u.postizConnections : []) ids.add((p && p.integrationId) || `${u.client}:${p && p.platform}`);
  return {
    metaEstado,
    metaLiberou: metaEstado === 'ok',
    canaisPostiz: ids.size,
    clientesPublicadosPelaEquipe: viaPostiz.map(friendlyName),
  };
}

// Parâmetros dos planos, lidos das constantes que o app de fato usa pra
// bloquear/liberar — se um limite mudar no código, esta tabela muda junto.
// Única exceção documentada: o teto de agendamento do Profissional (10 por
// mês) vive dentro de routes/schedule-post.js; se mudar lá, mude aqui.
const AGENDAMENTO_PROFISSIONAL_MES = 10;
const NOMES = { teste7dias: 'Teste Grátis 7 Dias', iniciante: 'Iniciante', profissional: 'Profissional', especialista: 'Especialista', personalizado: 'Personalizado', 'aplicativo-saas': 'Aplicativos ou SaaS' };

function buildParametros() {
  const planos = ['teste7dias', 'iniciante', 'profissional', 'especialista', 'personalizado', 'aplicativo-saas'];
  return planos.map((p) => {
    const recursos = PLANO_RECURSOS[p] || [];
    const media = p === 'teste7dias' ? { images: TRIAL_MEDIA_LIMITS.images, videos: TRIAL_MEDIA_LIMITS.videos, per: 'nos 7 dias' } : PLAN_MEDIA_LIMITS[p] ? { ...PLAN_MEDIA_LIMITS[p], per: 'por mês' } : null;
    const posts = PLAN_POST_LIMITS[p];
    const chamadas = PLAN_CALL_LIMITS[p];
    const redes = PLAN_LIMITS[p];
    return {
      plano: NOMES[p],
      preco: PLAN_PRICES[p] ? `R$ ${PLAN_PRICES[p]}/mês` : p === 'teste7dias' ? 'grátis' : 'sob consulta',
      redes: redes ? `${redes}${p === 'iniciante' ? ' (só Facebook e Instagram)' : ''}` : 'sem limite',
      imagens: media ? `${media.images} ${media.per}` : 'sem limite',
      videos: media ? `${media.videos} ${media.per}` : 'sem limite',
      posts: posts ? `${posts.perDay} por dia, ${posts.perMonth} por mês` : 'ilimitado',
      chamadas: chamadas ? `${chamadas} por janela (${chamadas * 3} por dia)` : 'sem limite',
      agendamento: !recursos.includes('agendamento') ? 'não' : p === 'profissional' ? `até ${AGENDAMENTO_PROFISSIONAL_MES} por mês` : 'sim',
      gestorTrafego: recursos.includes('gestor-trafego') ? 'sim' : 'não',
    };
  });
}

// Quantas pendências abertas o roteiro tem (o Painel de controle usa isso pra
// mostrar uma linha só apontando pra Fluxos operacionais, sem repetir a lista).
function contarPendencias(roteiro) {
  if (!roteiro) return { total: 0, franklin: 0, claude: 0, terceiros: 0 };
  const abertas = roteiro.blocos.filter((b) => b.pendencias).flatMap((b) => b.itens).filter((i) => i.status !== 'feito' && i.status !== 'nao-depende');
  return {
    total: abertas.length,
    franklin: abertas.filter((i) => i.dono === 'Franklin').length,
    claude: abertas.filter((i) => i.dono === 'Claude').length,
    terceiros: abertas.filter((i) => i.dono === 'Terceiros').length,
  };
}

module.exports = { loadRoteiro, saveRoteiro, sanitizeRoteiro, buildVivo, buildParametros, contarPendencias };
