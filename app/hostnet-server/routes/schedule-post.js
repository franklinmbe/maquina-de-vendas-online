const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveClient } = require('../lib/auth');
const { loadUsers, saveUsers, findUser } = require('../lib/users');
const { sanitizeFilename, publishPedido } = require('../lib/publish-pedido');
const { findDuplicatePedido, duplicateMessage, gitBlobSha, sameRequest } = require('../lib/duplicate-pedido');
const { putFileToGithub } = require('../lib/github');
const { addProjeto } = require('../lib/projetos');

// "Só postar" agendado (Franklin, 2026-10-28): o conteúdo é preparado NA HORA
// (vira criação em Minhas criações, já com as descrições de cada rede e, pro
// Eduardo, sem o tremido) e sai sozinho no horário marcado — sem pedir texto
// nem aprovação. Ver lib/scheduled-dispatcher.js (entradas com `pasta`).
const ONLY_PUBLISH_RE = /só publique minhas fotos\/vídeos do jeito que estão/i;

function scheduledDir() {
  const dir = process.env.DATA_DIR;
  if (!dir) throw new Error('DATA_DIR não configurado');
  return path.join(dir, 'scheduled');
}

// Guarda um pedido pra publicar depois, no horário marcado no Calendário —
// os arquivos ficam salvos em disco (não vão pro GitHub ainda) até o
// lib/scheduled-dispatcher.js disparar na hora certa.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, instruction, scheduledFor, targetClient, networks, voice, music, narrationText, motionVideo, motionExtend, motionVideoVoice, format, formatNetworks } = req.body || {};
  const uploadedFiles = req.files || [];

  let parsedNetworks = null;
  if (networks) {
    try {
      const parsed = JSON.parse(networks);
      if (Array.isArray(parsed)) parsedNetworks = parsed;
    } catch {
      // Lista malformada — ignora e segue sem ela (publicador cai no padrão).
    }
  }

  let parsedFormat = null;
  if (format) {
    try {
      const parsed = JSON.parse(format);
      if (Array.isArray(parsed) && parsed.length > 0) parsedFormat = parsed;
    } catch {
      // Lista malformada — ignora e segue sem ela (publicador cai no padrão "post").
    }
  }

  // Mapa formato → redes (pedido do Franklin, 2026-09-22) — mesmo campo do
  // commit.js, ver lá pro comentário completo.
  let parsedFormatNetworks = null;
  if (formatNetworks) {
    try {
      const parsed = JSON.parse(formatNetworks);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) parsedFormatNetworks = parsed;
    } catch {
      // Malformado — ignora, cai no padrão (todo formato pra toda rede marcada).
    }
  }

  const resolvedClient = await resolveClient({ identifier, password });
  if (!resolvedClient) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  // Mesma regra do commit.js: só o admin (frank) pode agendar em nome de
  // outro cliente, via as contas marcadas em Contas Conectadas.
  const client = resolvedClient === 'frank' && targetClient ? String(targetClient).trim() : resolvedClient;

  if (!instruction || !String(instruction).trim()) {
    res.status(400).json({ error: 'Pedido em texto livre é obrigatório' });
    return;
  }
  if (uploadedFiles.length === 0) {
    res.status(400).json({ error: 'Nenhum arquivo enviado' });
    return;
  }
  const scheduledDate = new Date(scheduledFor);
  if (!scheduledFor || Number.isNaN(scheduledDate.getTime())) {
    res.status(400).json({ error: 'Data/hora de agendamento inválida' });
    return;
  }
  if (scheduledDate.getTime() <= Date.now()) {
    res.status(400).json({ error: 'A data de agendamento já passou' });
    return;
  }

  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user) {
    res.status(400).json({
      error: 'Pra agendar é preciso estar logado com sua conta cadastrada (não vale a senha mestra sozinha).',
    });
    return;
  }

  // Agendamento não é recurso do Iniciante (definido por Franklin em
  // 2026-08-30) — a aba Calendário continua visível pra eles verem que o
  // recurso existe, só a finalização é bloqueada aqui. Teste Grátis 7 Dias
  // fica de fora dessa restrição (decisão revista no mesmo dia): agendamento
  // não consome nenhuma cota/custo variável, então não há motivo pra
  // restringir do trial. Quando for pedido em nome de outro cliente
  // (targetClient), o plano que conta é o do cliente-alvo, não o de quem
  // está logado (normalmente o admin).
  const planOwner = resolvedClient === 'frank' && targetClient
    ? users.find((u) => u.client === client)
    : user;
  if (planOwner && planOwner.plan === 'iniciante') {
    res.status(403).json({
      error: 'Agendamento de posts é um recurso a partir do plano Profissional. Peça pra IA (Suporte) fazer upgrade do plano pra ativar essa função.',
    });
    return;
  }

  // Profissional tem cota de 10 agendamentos por mês (definido por Franklin
  // em 2026-08-30) — Especialista e Personalizado continuam sem teto. A
  // cota conta por mês/ano de entrega (scheduledFor), não da data em que o
  // pedido foi feito, e soma agendamentos de qualquer usuário que tenha
  // marcado esse mesmo cliente (o admin frank agendando por um cliente e o
  // próprio cliente agendando contam pro mesmo teto).
  if (planOwner && planOwner.plan === 'profissional') {
    const targetMonthKey = `${scheduledDate.getUTCFullYear()}-${scheduledDate.getUTCMonth()}`;
    const usedThisMonth = users
      .flatMap((u) => u.scheduledPosts || [])
      .filter((p) => p.client === client)
      .filter((p) => {
        const d = new Date(p.scheduledFor);
        return `${d.getUTCFullYear()}-${d.getUTCMonth()}` === targetMonthKey;
      }).length;
    if (usedThisMonth >= 10) {
      res.status(403).json({
        error: 'Limite de 10 agendamentos por mês do plano Profissional atingido. Peça pra IA (Suporte) fazer upgrade pro Especialista pra agendar mais posts.',
      });
      return;
    }
  }

  // Trava de pedido repetido (Franklin, 2026-09-23) — mesma regra do
  // commit.js, e também contra agendamentos ainda na fila (arquivos em disco).
  // 2026-10-13: só o MESMO pedido inteiro conta (ver sameRequest).
  const narracao = { voice, music, narrationText, motionVideo, motionExtend, motionVideoVoice };
  let duplicate = await findDuplicatePedido({ client, files: uploadedFiles, instruction, narracao });
  if (!duplicate) {
    const sameGroup = (c) => c === client || (client.endsWith('-rjinox') && String(c || '').endsWith('-rjinox'));
    const newShas = new Map(uploadedFiles.map((f) => [gitBlobSha(f.buffer), f.originalname]));
    const newRequest = { shas: new Set(newShas.keys()), instruction, narracao };
    for (const p of users.flatMap((u) => u.scheduledPosts || []).filter((p) => p.status === 'pending' && sameGroup(p.client))) {
      const shas = new Set();
      for (const f of p.files || []) {
        try {
          shas.add(gitBlobSha(fs.readFileSync(path.join(scheduledDir(), p.id, f.filename))));
        } catch {
          // Arquivo já disparado/removido — ignora.
        }
      }
      if (sameRequest(newRequest, { shas, instruction: p.instruction, narracao: p })) {
        const sha = [...shas].find((s) => newShas.has(s));
        duplicate = { file: newShas.get(sha), date: new Date(p.createdAt || p.scheduledFor) };
        break;
      }
    }
  }
  if (duplicate) {
    res.status(409).json({ error: duplicateMessage(duplicate), duplicate: true });
    return;
  }

  const id = crypto.randomUUID();

  if (ONLY_PUBLISH_RE.test(String(instruction))) {
    try {
      const result = await publishPedido({
        identifier: user.identifier,
        client,
        instruction,
        files: uploadedFiles,
        networks: parsedNetworks,
        format: parsedFormat,
        formatNetworks: parsedFormatNetworks,
      });
      const pasta = String(result.subfolder).split('/').pop();
      const quando = scheduledDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const titulo = `Agendado para ${quando}`;
      await putFileToGithub({ owner: process.env.GITHUB_OWNER, repo: process.env.GITHUB_REPO, token: process.env.GITHUB_TOKEN,
        path: `${result.subfolder}/projeto.json`, message: `agendamento: ${client}/${pasta}`,
        base64Content: Buffer.from(JSON.stringify({ origem: 'agendamento', titulo, semAprovacao: true, scheduledFor: scheduledDate.toISOString() }, null, 2)).toString('base64') });
      await addProjeto(client, { pasta, titulo, semAprovacao: true, agendadoPara: scheduledDate.toISOString() }, { tipo: 'pedido', texto: `📅 Postagem agendada para ${quando}` });
      // publishPedido/addProjeto gravaram o cadastro — relê antes de gravar.
      const fresh = await loadUsers();
      const owner = findUser(fresh, identifier);
      owner.scheduledPosts = owner.scheduledPosts || [];
      owner.scheduledPosts.push({
        id,
        client,
        pasta,
        instruction: titulo,
        scheduledFor: scheduledDate.toISOString(),
        createdAt: new Date().toISOString(),
        files: uploadedFiles.map((f) => ({ filename: sanitizeFilename(f.originalname), mimetype: f.mimetype })),
        networks: parsedNetworks || undefined,
        format: parsedFormat || undefined,
        formatNetworks: parsedFormatNetworks || undefined,
        status: 'pending',
      });
      await saveUsers(fresh);
      res.status(200).json({ ok: true, id, pasta, scheduledFor: scheduledDate.toISOString() });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Falha ao agendar' });
    }
    return;
  }

  const dir = path.join(scheduledDir(), id);
  fs.mkdirSync(dir, { recursive: true });

  const savedFiles = [];
  for (const file of uploadedFiles) {
    const filename = sanitizeFilename(file.originalname);
    fs.writeFileSync(path.join(dir, filename), file.buffer);
    savedFiles.push({ filename, mimetype: file.mimetype });
  }

  user.scheduledPosts = user.scheduledPosts || [];
  user.scheduledPosts.push({
    id,
    client,
    instruction: String(instruction),
    scheduledFor: scheduledDate.toISOString(),
    createdAt: new Date().toISOString(),
    files: savedFiles,
    networks: parsedNetworks || undefined,
    voice: voice || undefined,
    music: music || undefined,
    narrationText: narrationText || undefined,
    motionVideo: motionVideo === 'true' || motionVideo === true || undefined,
    motionExtend: motionExtend === 'true' || motionExtend === true || undefined,
    motionVideoVoice: motionVideoVoice === 'true' || motionVideoVoice === true || undefined,
    format: parsedFormat || undefined,
    formatNetworks: parsedFormatNetworks || undefined,
    status: 'pending',
  });
  await saveUsers(users);

  res.status(200).json({ ok: true, id, scheduledFor: scheduledDate.toISOString() });
};
