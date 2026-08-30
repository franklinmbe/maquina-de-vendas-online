const { resolveClient } = require('../lib/auth');
const { publishPedido } = require('../lib/publish-pedido');
const { loadUsers, saveUsers, findUser } = require('../lib/users');
const { checkAndConsumeCall } = require('../lib/call-limit');

// Diferença da versão Vercel: lá o navegador subia o arquivo primeiro pro
// Vercel Blob (pra não estourar o limite de payload da função serverless) e
// aqui só chegava a URL. Aqui não existe esse limite (servidor Node normal,
// sempre ligado) — o navegador manda o arquivo direto no multipart, e o
// multer (configurado em server.js) já entrega o conteúdo em req.files.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, instruction, targetClient, networks } = req.body || {};
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

  // Só o admin (frank) pode postar em nome de outro cliente — selecionado
  // pelas contas marcadas em Contas Conectadas. Qualquer outra conta que
  // tente mandar targetClient é ignorada, sempre usa o próprio client.
  const client = resolvedClient === 'frank' && targetClient ? String(targetClient).trim() : resolvedClient;

  if (!instruction || !String(instruction).trim()) {
    res.status(400).json({ error: 'Pedido em texto livre é obrigatório' });
    return;
  }

  if (!identifier || !String(identifier).trim()) {
    res.status(400).json({ error: 'E-mail ou telefone é obrigatório' });
    return;
  }

  if (uploadedFiles.length === 0) {
    res.status(400).json({ error: 'Nenhum arquivo enviado' });
    return;
  }

  // Limite diário de chamadas por plano (ver lib/call-limit.js e CLAUDE.md)
  // — conta pedido de conteúdo e pergunta de suporte no mesmo contador.
  // Quando é o admin (frank) postando por outro cliente, o plano que conta é
  // o do cliente-alvo, não o de quem está logado (mesma regra já usada pro
  // agendamento em schedule-post.js).
  const users = await loadUsers();
  const user = findUser(users, identifier);
  const planOwner = resolvedClient === 'frank' && targetClient
    ? users.find((u) => u.client === client)
    : user;
  const callCheck = checkAndConsumeCall(planOwner);
  if (!callCheck.allowed) {
    res.status(429).json({ error: callCheck.error });
    return;
  }
  if (planOwner) await saveUsers(users);

  try {
    const result = await publishPedido({ identifier, client, instruction, files: uploadedFiles, networks: parsedNetworks });
    res.status(result.partial ? 207 : 200).json({
      client,
      subfolder: result.subfolder,
      files: result.files,
      instructions: result.instructions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao processar o pedido' });
  }
};
