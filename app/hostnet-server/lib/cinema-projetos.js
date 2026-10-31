const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 🎬 Estúdio de Cinema → Meus projetos (Franklin, 2026-10-31): o projeto de
// vídeo (roteiro em blocos, cenas, vídeo de cada bloco) fica aqui pra ele
// acompanhar e aprovar parte por parte pelo app. É o primeiro rascunho da
// ferramenta que o cliente do Estúdio de Cinema vai usar depois.
// Quem monta o conteúdo do projeto é o Claude (ação "salvar", senha mestra);
// quem aprova é o dono do projeto, pelo app.
function baseDir() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado (precisa apontar pra um volume persistente)');
  return dir;
}
function dataFile() { return path.join(baseDir(), 'cinema-projetos.json'); }
function mediaDir(id) { return path.join(baseDir(), 'cinema', safeId(id)); }

function safeId(id) { return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80); }

function loadAll() {
  const file = dataFile();
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(list) {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, file);
}

const ALVOS = ['roteiro', 'cenas', 'video'];
const STATUS = ['aprovado', 'mudar'];

// Etapas que andam sozinhas com as aprovações; as outras o Claude marca.
const ETAPA_POR_ALVO = { roteiro: 'roteiro', cenas: 'cenas', video: 'revisao' };

function etapasComStatus(p) {
  const blocos = p.blocos || [];
  return (p.etapas || []).map((e) => {
    const alvo = Object.keys(ETAPA_POR_ALVO).find((a) => ETAPA_POR_ALVO[a] === e.key);
    if (!alvo || !blocos.length) return e;
    const st = blocos.map((b) => (b.aprov && b.aprov[alvo] && b.aprov[alvo].status) || 'pendente');
    if (st.every((s) => s === 'aprovado')) return { ...e, status: 'feito' };
    if (st.includes('mudar')) return { ...e, status: 'mudar' };
    return { ...e, status: e.status === 'bloqueado' ? 'bloqueado' : 'aguardando' };
  });
}

function assinar(id, file) {
  const segredo = process.env.OAUTH_STATE_SECRET || process.env.APP_PASSPHRASE || '';
  return crypto.createHmac('sha256', segredo).update(`cine:${safeId(id)}:${file}`).digest('hex').slice(0, 32);
}

// O que a tela recebe: etapas com status calculado e link assinado dos vídeos.
function publico(p) {
  return {
    ...p,
    etapas: etapasComStatus(p),
    blocos: (p.blocos || []).map((b) => ({
      ...b,
      videoUrl: b.video ? arquivoUrl(p.id, b.video) : null,
      verticalUrl: b.videoVertical ? arquivoUrl(p.id, b.videoVertical) : null,
      vertical2Url: b.videoVertical2 ? arquivoUrl(p.id, b.videoVertical2) : null,
      cheiaUrl: b.videoCheia ? arquivoUrl(p.id, b.videoCheia) : null,
      cheia2Url: b.videoCheia2 ? arquivoUrl(p.id, b.videoCheia2) : null,
    })),
    finalUrl: p.videoFinal ? arquivoUrl(p.id, p.videoFinal) : null,
    finalVerticalUrl: p.videoFinalVertical ? arquivoUrl(p.id, p.videoFinalVertical) : null,
    vozes: (p.vozes || []).map((v) => ({ ...v, url: v.arquivo ? arquivoUrl(p.id, v.arquivo) : null })),
  };
}

function arquivoUrl(id, file) {
  return `/api/cinema/arquivo/${safeId(id)}/${encodeURIComponent(file)}?t=${assinar(id, file)}`;
}

// Voz do narrador: o dono ouve as amostras (p.vozes) e escolhe uma.
function escolherVoz(client, { id, voz }) {
  const list = loadAll();
  const p = list.find((x) => x.id === safeId(id));
  if (!p || (client !== 'frank' && p.client !== client)) return null;
  const v = (p.vozes || []).find((x) => x.nome === voz);
  if (!v) throw new Error('Voz não encontrada.');
  const em = new Date().toISOString();
  p.voz = { nome: v.nome, em };
  p.historico = [{ em, quem: 'Franklin', texto: `Escolheu a voz do narrador: ${v.nome}.` }, ...(p.historico || [])].slice(0, 200);
  p.atualizadoEm = em;
  saveAll(list);
  return publico(p);
}

function listar(client) {
  return loadAll().filter((p) => client === 'frank' || p.client === client).map((p) => ({
    id: p.id, titulo: p.titulo, canal: p.canal, duracao: p.duracao, atualizadoEm: p.atualizadoEm,
    etapas: etapasComStatus(p),
  }));
}

function abrir(client, id) {
  const p = loadAll().find((x) => x.id === safeId(id));
  if (!p || (client !== 'frank' && p.client !== client)) return null;
  return publico(p);
}

function aprovar(client, { id, bloco, alvo, status, obs, quem }) {
  if (!ALVOS.includes(alvo) || !STATUS.includes(status)) throw new Error('Aprovação inválida.');
  const list = loadAll();
  const p = list.find((x) => x.id === safeId(id));
  if (!p || (client !== 'frank' && p.client !== client)) return null;
  const alvoBlocos = bloco === 'todos' ? (p.blocos || []) : (p.blocos || []).filter((b) => b.n === Number(bloco));
  if (!alvoBlocos.length) throw new Error('Bloco não encontrado.');
  const texto = String(obs || '').trim().slice(0, 2000);
  if (status === 'mudar' && !texto) throw new Error('Escreva o que você quer mudar.');
  const em = new Date().toISOString();
  alvoBlocos.forEach((b) => {
    b.aprov = b.aprov || {};
    b.aprov[alvo] = { status, obs: texto, em };
  });
  const nomeAlvo = { roteiro: 'roteiro', cenas: 'lista de cenas', video: 'vídeo' }[alvo];
  const onde = bloco === 'todos' ? 'todos os blocos' : `bloco ${bloco}`;
  p.historico = [{ em, quem: quem || 'Franklin', texto: status === 'aprovado' ? `Aprovou o ${nomeAlvo} (${onde}).` : `Pediu mudança no ${nomeAlvo} (${onde}): ${texto}` }, ...(p.historico || [])].slice(0, 200);
  p.atualizadoEm = em;
  saveAll(list);
  return publico(p);
}

// Claude grava/atualiza o projeto inteiro. As aprovações que já existem são
// mantidas quando o conteúdo do bloco não mudou; se o roteiro ou as cenas de
// um bloco mudarem, aquela aprovação volta a ficar pendente.
function salvar(projeto) {
  const id = safeId(projeto && projeto.id);
  if (!id || !projeto.titulo) throw new Error('Projeto precisa de id e titulo.');
  const list = loadAll();
  const antigo = list.find((x) => x.id === id);
  const em = new Date().toISOString();
  const blocos = (projeto.blocos || []).map((b) => {
    const velho = antigo && (antigo.blocos || []).find((x) => x.n === b.n);
    const aprov = { ...((velho && velho.aprov) || {}), ...(b.aprov || {}) };
    if (velho && JSON.stringify(velho.roteiro) !== JSON.stringify(b.roteiro)) delete aprov.roteiro;
    if (velho && JSON.stringify(velho.cenas || []) !== JSON.stringify(b.cenas || [])) delete aprov.cenas;
    return {
      ...b,
      video: b.video !== undefined ? b.video : (velho && velho.video) || null,
      videoVertical: b.videoVertical !== undefined ? b.videoVertical : (velho && velho.videoVertical) || null,
      videoVertical2: b.videoVertical2 !== undefined ? b.videoVertical2 : (velho && velho.videoVertical2) || null,
      videoCheia: b.videoCheia !== undefined ? b.videoCheia : (velho && velho.videoCheia) || null,
      videoCheia2: b.videoCheia2 !== undefined ? b.videoCheia2 : (velho && velho.videoCheia2) || null,
      aprov,
    };
  });
  const novo = {
    ...projeto,
    voz: projeto.voz !== undefined ? projeto.voz : (antigo && antigo.voz) || null,
    videoFinal: (antigo && antigo.videoFinal) || null,
    videoFinalVertical: (antigo && antigo.videoFinalVertical) || null,
    id,
    client: projeto.client || (antigo && antigo.client) || 'frank',
    criadoEm: (antigo && antigo.criadoEm) || em,
    atualizadoEm: em,
    blocos,
    historico: [...(projeto.novoHistorico ? [{ em, quem: 'Claude', texto: String(projeto.novoHistorico).slice(0, 500) }] : []), ...((antigo && antigo.historico) || [])].slice(0, 200),
  };
  delete novo.novoHistorico;
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) list[i] = novo; else list.unshift(novo);
  saveAll(list);
  return publico(novo);
}

// Vídeo pronto de um bloco (ou do vídeo inteiro, bloco "final"). formato
// "vertical" = versão em pé para Reels/Shorts/TikTok, mostrada abaixo da deitada.
// Só o vídeo deitado de um bloco volta a pedir aprovação.
function salvarVideo(id, n, buffer, formato) {
  const list = loadAll();
  const p = list.find((x) => x.id === safeId(id));
  if (!p) throw new Error('Projeto não encontrado.');
  // Em pé: "vertical" (vídeo inteiro com fundo desfocado) e "cheia" (tela cheia 9:16).
  // O "2" é a segunda parte, quando o bloco passa de 3 min (limite do Instagram).
  // Cada formato fica no seu campo: os anteriores continuam para comparar.
  const CAMPOS = { vertical: 'videoVertical', vertical2: 'videoVertical2', cheia: 'videoCheia', cheia2: 'videoCheia2' };
  const vertical = !!CAMPOS[formato];
  const final = String(n) === 'final';
  const b = final ? null : (p.blocos || []).find((x) => x.n === Number(n));
  if (!final && !b) throw new Error('Bloco não encontrado.');
  const file = `${final ? 'final' : `bloco-${b.n}`}${vertical ? `-${formato}` : ''}-${Date.now()}.mp4`;
  fs.mkdirSync(mediaDir(p.id), { recursive: true });
  fs.writeFileSync(path.join(mediaDir(p.id), file), buffer);
  const campo = vertical
    ? (final ? 'videoFinalVertical' : CAMPOS[formato])
    : (final ? 'videoFinal' : 'video');
  const alvo = final ? p : b;
  const antigo = alvo[campo];
  alvo[campo] = file;
  if (antigo && antigo !== file) fs.rmSync(path.join(mediaDir(p.id), antigo), { force: true });
  if (!final && !vertical) {
    b.aprov = b.aprov || {};
    delete b.aprov.video;
  }
  const em = new Date().toISOString();
  const nome = final ? 'Vídeo completo' : `Vídeo do bloco ${b.n}`;
  p.historico = [{ em, quem: 'Claude', texto: `${nome}${vertical ? ' em pé (Reels)' : ''} pronto para você assistir.` }, ...(p.historico || [])].slice(0, 200);
  p.atualizadoEm = em;
  saveAll(list);
  return publico(p);
}

function caminhoArquivo(id, file, t) {
  const nome = path.basename(String(file || ''));
  if (!nome || t !== assinar(id, nome)) return null;
  const p = path.join(mediaDir(id), nome);
  return fs.existsSync(p) ? p : null;
}

module.exports = { listar, abrir, aprovar, escolherVoz, salvar, salvarVideo, caminhoArquivo };
