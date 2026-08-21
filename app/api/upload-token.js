const { handleUpload } = require('@vercel/blob/client');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload = {};
        try {
          payload = clientPayload ? JSON.parse(clientPayload) : {};
        } catch {
          throw new Error('clientPayload inválido');
        }

        if (!process.env.APP_PASSPHRASE || payload.passphrase !== process.env.APP_PASSPHRASE) {
          throw new Error('Senha incorreta');
        }

        return {
          allowedContentTypes: ['image/*', 'video/*'],
          addRandomSuffix: true,
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB, mesmo teto do GitHub Contents API
        };
      },
      onUploadCompleted: async () => {
        // O envio pro GitHub acontece explicitamente em /api/commit,
        // disparado pelo navegador depois que todos os uploads terminam.
      },
    });

    res.status(200).json(jsonResponse);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Falha ao gerar token de upload' });
  }
};
