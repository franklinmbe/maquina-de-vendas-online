const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveClient } = require('../lib/auth');
const { loadUsers, saveUsers, findUser } = require('../lib/users');
const { sanitizeFilename } = require('../lib/publish-pedido');

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

  const { identifier, password, instruction, scheduledFor, targetClient, networks } = req.body || {};
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
      error: 'Agendamento de posts é um recurso a partir do plano Profissional. Peça pro Franklin fazer upgrade do plano pra ativar essa função.',
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
        error: 'Limite de 10 agendamentos por mês do plano Profissional atingido. Peça pro Franklin fazer upgrade pro Especialista pra agendar mais posts.',
      });
      return;
    }
  }

  const id = crypto.randomUUID();
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
    status: 'pending',
  });
  await saveUsers(users);

  res.status(200).json({ ok: true, id, scheduledFor: scheduledDate.toISOString() });
};
