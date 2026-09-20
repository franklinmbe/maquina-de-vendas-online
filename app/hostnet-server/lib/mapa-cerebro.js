const fs = require('fs');
const path = require('path');

// Mapa do cérebro do projeto (CLAUDE.md, skills, memória, rotinas, aplicações).
// Quem gera o JSON é o script .claude/scripts/build-brain-map.js, que varre o
// projeto de verdade e envia pra cá (POST /api/mapa-cerebro-update, senha
// mestra). Fica em DATA_DIR, fora do código, pra atualizar sem novo deploy.
// O conteúdo NUNCA vai no HTML público da página — só sai por /api/mapa-cerebro,
// que exige login de admin.
function mapFilePath() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado (precisa apontar pra um volume persistente)');
  return path.join(dir, 'mapa-cerebro.json');
}

function loadMap() {
  const file = mapFilePath();
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function saveMap(map) {
  const file = mapFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpFile = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(map));
  fs.renameSync(tmpFile, file);
}

const STATUSES = ['ok', 'wip', 'blocked', 'planned', 'off'];

function text(value, max) {
  return String(value == null ? '' : value).slice(0, max);
}

function cleanNode(n) {
  return {
    id: text(n && n.id, 80),
    label: text(n && n.label, 80),
    kind: text(n && n.kind, 20),
    group: text(n && n.group, 60),
    status: STATUSES.includes(n && n.status) ? n.status : 'ok',
    desc: text(n && n.desc, 500),
  };
}

// Só aceita o formato esperado e corta tamanhos — o mapa vem de um script
// nosso, mas a rota é pública na internet, então valida do mesmo jeito.
function sanitizeMap(raw) {
  if (!raw || typeof raw !== 'object' || !raw.center || !raw.memory || !Array.isArray(raw.memory.departments)) return null;
  const list = (v, max) => (Array.isArray(v) ? v.slice(0, max).map(cleanNode).filter((n) => n.id) : []);
  return {
    generatedAt: text(raw.generatedAt, 40) || new Date().toISOString(),
    center: {
      ...cleanNode(raw.center),
      sections: Array.isArray(raw.center.sections) ? raw.center.sections.slice(0, 20).map((s) => text(s, 100)) : [],
    },
    skills: list(raw.skills, 80),
    routines: list(raw.routines, 40),
    apps: list(raw.apps, 60),
    memory: {
      total: Number(raw.memory.total) || 0,
      departments: raw.memory.departments.slice(0, 12).map((d) => ({
        id: text(d.id, 30),
        name: text(d.name, 60),
        short: text(d.short || d.name, 20),
        color: /^#[0-9a-fA-F]{6}$/.test(d.color) ? d.color : '#33d6cb',
        docs: (Array.isArray(d.docs) ? d.docs : []).slice(0, 200).map((x) => ({
          title: text(x.title, 100),
          file: text(x.file, 120),
          date: text(x.date, 10),
        })),
      })),
    },
    links: (Array.isArray(raw.links) ? raw.links : [])
      .slice(0, 400)
      .filter((l) => Array.isArray(l) && l.length === 2)
      .map((l) => [text(l[0], 80), text(l[1], 80)]),
  };
}

module.exports = { loadMap, saveMap, sanitizeMap };
