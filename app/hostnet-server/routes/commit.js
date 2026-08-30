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

  const { identifier, password, instruction, targetClient } = req.body || {};
  const uploadedFiles = req.files || [];

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

  try {
    const result = await publishPedido({ identifier, client, instruction, files: uploadedFiles });
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
