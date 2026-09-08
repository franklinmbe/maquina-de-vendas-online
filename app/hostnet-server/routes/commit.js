const { resolveClient } = require('../lib/auth');
const { publishPedido } = require('../lib/publish-pedido');

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

  const { identifier, password, instruction, targetClient, networks, voice, music, narrationText, format } = req.body || {};
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

  // Sem arquivo nenhum é permitido — é exatamente o caso de "gere uma imagem
  // do zero" (Nano Banana não precisa de imagem de referência), que passa
  // pela geração/aprovação normal (ver gestor-de-geracao-automatica). Só
  // agendamento (schedule-post.js) continua exigindo arquivo, porque esse
  // fluxo publica direto o que foi enviado, sem passar por geração.

  // Postar (inclusive pedir só pra publicar a foto/vídeo que o cliente já
  // mandou) é ilimitado em todos os planos — o limite diário de chamadas
  // (ver lib/call-limit.js) só vale pra geração de banner/vídeo por IA e
  // suporte, que são decisões tomadas manualmente por quem processa o
  // pedido, não algo que dá pra distinguir automaticamente aqui só pelo
  // texto livre do pedido. Ver rota /api/check-call-limit.

  try {
    const result = await publishPedido({
      identifier,
      client,
      instruction,
      files: uploadedFiles,
      networks: parsedNetworks,
      voice,
      music,
      narrationText,
      format: parsedFormat,
    });
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
