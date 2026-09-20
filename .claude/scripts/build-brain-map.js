// Gera o "mapa do cérebro" do projeto Máquina de Vendas Online: varre o que
// existe de verdade (CLAUDE.md, pastas de skills, índice da memória, rotinas
// agendadas do servidor) e monta o JSON dos 5 anéis — CLAUDE.md (centro),
// Skills, Memory (departamentos + documentos), Routines e Applications.
//
// Uso:
//   node .claude/scripts/build-brain-map.js            -> só gera e mostra o resumo
//   node .claude/scripts/build-brain-map.js --upload   -> gera e envia pro servidor
//
// Segurança: só entram TÍTULOS de memória e descrições de skills já limpas
// (números de telefone e afins são mascarados). Nunca o conteúdo dos arquivos
// de memória, que tem credenciais.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_DIR =
  process.env.MVO_MEMORY_DIR ||
  path.join(os.homedir(), '.claude', 'projects', 'c--Users-rjino-OneDrive-Desktop-Franklin-MAESTROS-DA-IA-M-QUINA-DE-VENDAS-ONLINE', 'memory');

function clean(text, max = 300) {
  const full = cleanRaw(text);
  return full.length > max ? `${full.slice(0, max).replace(/\s+\S*$/, '')}…` : full;
}

function cleanRaw(text) {
  return String(text || '')
    // telefones e ids longos: só sequências com 9+ dígitos (datas como 2026-08-31 têm 8 e ficam)
    .replace(/\d[\d\s().-]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '•••' : m))
    .replace(/\S+@\S+\.\S+/g, '•••') // e-mails
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Centro: CLAUDE.md ----------
function buildCenter() {
  const file = path.join(ROOT, 'CLAUDE.md');
  const text = fs.readFileSync(file, 'utf8');
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => clean(m[1], 90)).slice(0, 14);
  return {
    id: 'center',
    label: 'CLAUDE.md',
    status: 'ok',
    desc: `Instruções permanentes do projeto (${text.split('\n').length} linhas). É a primeira coisa que o Claude lê em toda sessão: regras, planos, arquitetura e decisões do Franklin.`,
    sections: headings,
  };
}

// ---------- Skills ----------
const SKILL_STATUS = {
  'gestor-de-clone-digital': ['wip', 'Falta a chave da HeyGen pra rodar de verdade.'],
  'gestor-de-conteudo-capcut': ['wip', 'Integração existe, mas o caminho padrão hoje é gerar com IA e montar com FFmpeg.'],
  'gestor-de-design-canva': ['wip', 'Integração existe, sem modelos de marca cadastrados ainda.'],
  'gestor-de-geracao-automatica': ['off', 'Aposentada em 15/09/2026: a geração agora roda dentro do servidor.'],
};
const SKILL_GROUP = (name) =>
  name === 'frank' || name.endsWith('-rjinox') || name === 'kleber-construcao' ? 'Clientes' : 'Criação e ferramentas';

function buildSkills() {
  const dir = path.join(ROOT, '.claude', 'skills');
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('_')) continue;
    const skillFile = path.join(dir, name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const text = fs.readFileSync(skillFile, 'utf8');
    const fm = text.match(/^description:\s*(.+)$/m);
    const override = SKILL_STATUS[name];
    out.push({
      id: `skill:${name}`,
      label: name,
      kind: 'skill',
      group: SKILL_GROUP(name),
      status: override ? override[0] : 'ok',
      desc: clean(fm ? fm[1].replace(/^["']|["']$/g, '') : 'Skill do projeto.') + (override ? ` ${override[1]}` : ''),
    });
  }
  // Agentes especialistas usados no Fluxo 2 (não moram no repositório).
  out.push(
    { id: 'skill:paid-social', label: 'Paid Social Strategist', kind: 'agente', group: 'Agentes', status: 'ok', desc: 'Agente que decide a estratégia de anúncios do Fluxo 2: qual campanha recebe o criativo novo e o que pausar.' },
    { id: 'skill:ad-creative', label: 'Ad Creative Strategist', kind: 'agente', group: 'Agentes', status: 'planned', desc: 'Agente de criativos de anúncio, citado nas dicas do dia. Ainda não foi acionado na prática.' },
    { id: 'skill:analytics', label: 'Analytics Reporter', kind: 'agente', group: 'Agentes', status: 'planned', desc: 'Agente de análise de resultados, citado nas dicas do dia. Ainda não foi acionado na prática.' }
  );
  return out;
}

// ---------- Memory ----------
const DEPARTMENTS = [
  { id: 'clientes', name: 'Clientes', short: 'Clientes', color: '#ffb84d', match: /client|rjinox|kleber|testing|onboard/i },
  { id: 'trafego', name: 'Tráfego pago', short: 'Tráfego', color: '#ff7a63', match: /ads|trafego|fluxo|desk|creative-pipeline/i },
  { id: 'redes', name: 'Redes sociais', short: 'Redes', color: '#8b7cf6', match: /tiktok|meta|postiz|linkedin|youtube|insights|publish|telegram|wordpress/i },
  { id: 'conteudo', name: 'Conteúdo e geração', short: 'Conteúdo', color: '#35d07f', match: /generation|video|image|banner|capcut|canva|voice|caption|text-in|reels|content|composer/i },
  { id: 'infra', name: 'Infra e deploy', short: 'Infra', color: '#4d9eff', match: /deploy|hostinger|storage|vps|migration|branch|merge|mcp|browser|routine|automation|webhook|bug|powershell/i },
  { id: 'produto', name: 'Produto e planos', short: 'Produto', color: '#33d6cb', match: /plan|saas|app-|admin|pitch|guide|design|agency|scope/i },
  { id: 'regras', name: 'Regras e preferências', short: 'Regras', color: '#f2f2f0', match: /feedback|permission|wait|read-instructions|dictation|working-files|confirm|verify|keep|gated|stop-asking|bypass/i },
  { id: 'admin', name: 'Administrativo', short: 'Admin', color: '#ff9ff3', match: /cnpj|certificado|billing|extrato|custos/i },
];

function buildMemory() {
  const index = path.join(MEMORY_DIR, 'MEMORY.md');
  const lines = fs.existsSync(index) ? fs.readFileSync(index, 'utf8').split('\n') : [];
  const docs = [];
  for (const line of lines) {
    const m = line.match(/^- \[(.+?)\]\((.+?\.md)\)/);
    if (!m) continue;
    const [, title, file] = m;
    const date = (file.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
    const haystack = `${file} ${title}`;
    // "regras" e "admin" têm prioridade: são mais específicos que o resto.
    const order = [DEPARTMENTS[6], DEPARTMENTS[7], DEPARTMENTS[0], DEPARTMENTS[1], DEPARTMENTS[2], DEPARTMENTS[3], DEPARTMENTS[4], DEPARTMENTS[5]];
    const dept = order.find((d) => d.match.test(haystack)) || DEPARTMENTS[5];
    docs.push({ title: clean(title, 90), file, date, dept: dept.id });
  }
  return {
    departments: DEPARTMENTS.map((d) => ({
      id: d.id,
      name: d.name,
      short: d.short,
      color: d.color,
      docs: docs.filter((x) => x.dept === d.id),
    })).filter((d) => d.docs.length),
    total: docs.length,
  };
}

// ---------- Routines ----------
function buildRoutines() {
  const server = fs.readFileSync(path.join(ROOT, 'app', 'hostnet-server', 'server.js'), 'utf8');
  const cronOf = (fnName) => {
    const m = server.match(new RegExp(`cron\\.schedule\\('([^']+)'[^]*?${fnName}`));
    return m ? m[1] : '';
  };
  const humanCron = (expr) => ({ '0 3 * * *': 'todo dia às 03:00', '* * * * *': 'a cada minuto' }[expr] || expr);
  const collect = cronOf('collectSnapshots');
  const dispatch = cronOf('dispatchDuePosts');
  return [
    { id: 'routine:snapshots', label: 'Seguidores (03h)', status: collect ? 'ok' : 'off', desc: `Grava o crescimento de seguidores das redes conectadas, ${humanCron(collect) || 'agendamento não encontrado no servidor'} (node-cron dentro do servidor).` },
    { id: 'routine:agendados', label: 'Posts agendados', status: dispatch ? 'ok' : 'off', desc: `Confere ${humanCron(dispatch) || 'agendamento não encontrado'} se algum post do Calendário chegou na hora e publica.` },
    { id: 'routine:voz', label: 'Voz alta', status: 'ok', desc: 'Hook Stop no computador do Franklin: lê em voz alta a resposta do Claude quando ele termina.' },
    { id: 'routine:dicas', label: 'Dicas do dia', status: 'wip', desc: 'O Claude escreve as dicas de estratégia de cada cliente com base nos números da conta. Hoje acontece quando uma sessão roda; ainda não é automático.' },
    { id: 'routine:semanal', label: 'Relatório semanal', status: 'planned', desc: 'Lista semanal de anúncios sem conversa pra pausar. Ainda não agendado.' },
    { id: 'routine:coleta-f2', label: 'Coleta Fluxo 2', status: 'planned', desc: 'O servidor ler sozinho a conta de anúncios de cada cliente todo dia. Depende de acesso à API de anúncios de cada um.' },
    { id: 'routine:nuvem', label: 'Rotina de nuvem', status: 'off', desc: 'Rodava a cada 2 horas gerando conteúdo. Aposentada em 15/09/2026: a geração passou pra dentro do servidor.' },
  ];
}

// ---------- Applications ----------
function buildApps() {
  return [
    { id: 'app:hostnet', label: 'App MVO', status: 'ok', desc: 'O aplicativo dos clientes (app.franklinmorais.com): pedidos, geração, aprovação, publicação, relatórios e Fluxo 2.' },
    { id: 'app:hostinger', label: 'Hostinger VPS', status: 'ok', desc: 'Servidor KVM1 com Docker, Nginx e SSL. Deploy manual por SSH.' },
    { id: 'app:github', label: 'GitHub', status: 'ok', desc: 'Repositório público: código, skills e as pastas de pedidos dos clientes.' },
    { id: 'app:meta', label: 'Meta (FB + IG)', status: 'ok', desc: 'Publicação direta pela API do Meta. Métricas avançadas dependem do certificado digital.' },
    { id: 'app:tiktok', label: 'TikTok', status: 'wip', desc: 'Publica pela Postiz. O app próprio está em análise no TikTok.' },
    { id: 'app:youtube', label: 'YouTube', status: 'ok', desc: 'Publicação direta de vídeo pela API do Google.' },
    { id: 'app:telegram', label: 'Telegram', status: 'ok', desc: 'Bot administrador de canal, validado ao vivo.' },
    { id: 'app:wordpress', label: 'WordPress', status: 'ok', desc: 'Ciclo completo testado no site do Franklin: post, mídia e exclusão.' },
    { id: 'app:linkedin', label: 'LinkedIn', status: 'blocked', desc: 'Travado na verificação de identidade da própria rede. Vale tentar de novo.' },
    { id: 'app:x', label: 'X (Twitter)', status: 'planned', desc: 'Adiado pelo custo da API.' },
    { id: 'app:postiz', label: 'Postiz', status: 'ok', desc: 'Publica o TikTok e as redes que o Franklin conecta à mão. Limite de 10 canais.' },
    { id: 'app:gemini', label: 'Gemini (Google)', status: 'ok', desc: 'Imagens (Nano Banana), narração (TTS) e vídeo. Base do caminho barato de geração.' },
    { id: 'app:meta-ads', label: 'Meta Ads', status: 'ok', desc: 'Conector lê e pausa anúncios. Testado na conta do Kleber. Criar anúncio novo ainda não foi testado.' },
    { id: 'app:heygen', label: 'HeyGen', status: 'planned', desc: 'Clone de vídeo do cliente (Plano Personalizado). Falta a chave.' },
    { id: 'app:elevenlabs', label: 'ElevenLabs', status: 'planned', desc: 'Clonagem de voz. Ainda sem assinatura.' },
    { id: 'app:canva', label: 'Canva', status: 'wip', desc: 'Integração real, sem modelos de marca ainda.' },
    { id: 'app:whatsapp', label: 'WhatsApp API', status: 'wip', desc: 'Atendente de WhatsApp do pilar 4. Código existe; falta ligar em cliente real.' },
    { id: 'app:browser', label: 'Playwright', status: 'ok', desc: 'Controle do navegador pra painéis sem API. Login continua sendo só do Franklin.' },
    { id: 'app:vercel', label: 'Vercel', status: 'off', desc: 'Encerrada em 01/09/2026. Tudo roda na Hostinger.' },
  ];
}

// ---------- Ligações ----------
const LINKS = [
  ['skill:frank', 'app:hostnet'], ['skill:frank', 'app:meta'], ['skill:frank', 'app:youtube'], ['skill:frank', 'app:postiz'],
  ['skill:kleber-construcao', 'app:hostnet'], ['skill:kleber-construcao', 'app:meta'], ['skill:kleber-construcao', 'app:postiz'], ['skill:kleber-construcao', 'app:meta-ads'],
  ['skill:alessandra-rjinox', 'app:postiz'], ['skill:aline-rjinox', 'app:postiz'], ['skill:eduardo-rjinox', 'app:postiz'], ['skill:jaqueline-rjinox', 'app:postiz'],
  ['skill:gestor-de-geracao-ia-google', 'app:gemini'], ['skill:gestor-de-clone-digital', 'app:heygen'], ['skill:gestor-de-clone-digital', 'app:elevenlabs'],
  ['skill:gestor-de-design-canva', 'app:canva'], ['skill:paid-social', 'app:meta-ads'], ['skill:ad-creative', 'app:meta-ads'], ['skill:analytics', 'app:meta-ads'],
  ['routine:snapshots', 'app:hostnet'], ['routine:snapshots', 'app:meta'], ['routine:agendados', 'app:hostnet'],
  ['routine:dicas', 'skill:paid-social'], ['routine:dicas', 'app:meta-ads'], ['routine:semanal', 'skill:analytics'], ['routine:semanal', 'app:meta-ads'],
  ['routine:coleta-f2', 'app:meta-ads'], ['routine:coleta-f2', 'app:hostnet'], ['routine:nuvem', 'app:github'],
  ['app:hostnet', 'app:hostinger'], ['app:hostnet', 'app:github'], ['app:hostnet', 'app:gemini'], ['app:postiz', 'app:tiktok'],
  ['app:hostnet', 'app:meta'], ['app:hostnet', 'app:youtube'], ['app:hostnet', 'app:telegram'], ['app:hostnet', 'app:wordpress'], ['app:hostnet', 'app:whatsapp'],
  ['dept:clientes', 'skill:kleber-construcao'], ['dept:clientes', 'skill:frank'], ['dept:trafego', 'app:meta-ads'], ['dept:trafego', 'skill:paid-social'],
  ['dept:redes', 'app:meta'], ['dept:redes', 'app:tiktok'], ['dept:redes', 'app:postiz'], ['dept:conteudo', 'app:gemini'], ['dept:conteudo', 'skill:gestor-de-geracao-ia-google'],
  ['dept:infra', 'app:hostinger'], ['dept:infra', 'app:github'], ['dept:produto', 'app:hostnet'],
];

function build() {
  const skills = buildSkills();
  const memory = buildMemory();
  const routines = buildRoutines();
  const apps = buildApps();
  const known = new Set([...skills.map((s) => s.id), ...routines.map((r) => r.id), ...apps.map((a) => a.id), ...memory.departments.map((d) => `dept:${d.id}`)]);
  const links = LINKS.filter(([a, b]) => known.has(a) && known.has(b));
  return { generatedAt: new Date().toISOString(), center: buildCenter(), skills, memory, routines, apps, links, dropped: LINKS.length - links.length };
}

async function upload(map) {
  // MVO_BASE_URL / MVO_UPLOAD_PASSPHRASE só existem pra testar contra um servidor local.
  const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.local.json'), 'utf8'));
  const passphrase = process.env.MVO_UPLOAD_PASSPHRASE || (settings.env && settings.env.MVO_APP_PASSPHRASE);
  if (!passphrase) throw new Error('MVO_APP_PASSPHRASE não encontrada em .claude/settings.local.json');
  const base = process.env.MVO_BASE_URL || 'https://app.franklinmorais.com';
  const response = await fetch(`${base}/api/mapa-cerebro-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase, map }),
  });
  return { status: response.status, body: await response.json() };
}

(async () => {
  const map = build();
  const dropped = map.dropped ? ` (${map.dropped} ligações ignoradas: ponta inexistente)` : '';
  console.log(`Centro: ${map.center.label} | Skills: ${map.skills.length} | Memória: ${map.memory.total} docs em ${map.memory.departments.length} departamentos | Rotinas: ${map.routines.length} | Apps: ${map.apps.length} | Ligações: ${map.links.length}${dropped}`);
  console.log('Departamentos:', map.memory.departments.map((d) => `${d.name}=${d.docs.length}`).join(', '));
  if (process.argv.includes('--upload')) {
    const result = await upload(map);
    console.log('Upload:', result.status, JSON.stringify(result.body));
  }
})().catch((e) => {
  console.error('FALHA:', e.message);
  process.exit(1);
});
