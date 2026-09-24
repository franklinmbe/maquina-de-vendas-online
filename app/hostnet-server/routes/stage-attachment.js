const { resolveClient } = require('../lib/auth');
const { loadUsers, saveUsers } = require('../lib/users');
const { putFileToGithub } = require('../lib/github');
const { analyzeAttachment } = require('../lib/attachment-analysis');

function sanitizeFilename(name) {
  return String(name || 'arquivo')
    .replace(/[\\/]/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-100);
}

// Sobe anexo(s) de foto/vídeo pro GitHub assim que o cliente escolhe no
// composer, ANTES de clicar Publicar — bug real 2026-09-14 (Kleber): anexo
// só existia como blob: local no navegador, então se o app fechasse/
// recarregasse antes do Publicar (celular travando, bem comum), o anexo
// simplesmente sumia — o texto sobrevivia (chatHistory já era persistido),
// a mídia não. Salva em .claude/skills/<client>/_staging/ (pasta separada
// da pasta final do pedido, que só existe depois do Publicar de verdade) e
// registra uma mensagem de anexo real no chatHistory — loadCreativeChatHistory
// (index.html) consegue restaurar isso com uma URL de verdade em vez de
// blob:, e o Publicar (lib/publish-pedido.js, campo stagedFiles) consegue
// mover pra pasta final sem precisar dos bytes originais de novo.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password } = req.body || {};
  const files = req.files || [];
  if (files.length === 0) {
    res.status(400).json({ error: 'Nenhum arquivo enviado' });
    return;
  }

  const resolvedClient = await resolveClient({ identifier, password });
  if (!resolvedClient) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    res.status(500).json({ error: 'Configuração do servidor incompleta' });
    return;
  }

  const media = [];
  for (const file of files) {
    const filename = `${Date.now()}-${sanitizeFilename(file.originalname)}`;
    const stagedPath = `.claude/skills/${resolvedClient}/_staging/${filename}`;
    try {
      const uploaded = await putFileToGithub({
        owner,
        repo,
        token,
        path: stagedPath,
        message: `staging: ${resolvedClient}/${filename}`,
        base64Content: file.buffer.toString('base64'),
      });
      media.push({
        type: file.mimetype.startsWith('video/') ? 'video' : 'image',
        url: uploaded.content && uploaded.content.download_url,
        stagedPath,
        filename: sanitizeFilename(file.originalname),
        mimetype: file.mimetype,
      });
    } catch (error) {
      // Um arquivo falhar no staging não deve travar os outros — ele só
      // não vai ter recuperação automática se o app fechar antes do Publicar
      // (mesmo comportamento de antes desta correção, não piora nada).
    }
  }

  if (media.length === 0) {
    res.status(500).json({ error: 'Falha ao salvar os anexos' });
    return;
  }

  let serverIndex = null;
  try {
    const users = await loadUsers();
    const user = users.find((u) => u.client === resolvedClient);
    if (user) {
      user.chatHistory = user.chatHistory || [];
      const label = media.length === 1 ? 'Anexei 1 arquivo:' : `Anexei ${media.length} arquivos:`;
      user.chatHistory.push({ role: 'user', type: 'attachment', text: label, media });
      serverIndex = user.chatHistory.length - 1;
      await saveUsers(users);
    }
  } catch (error) {
    // Sem persistir a mensagem, o anexo ainda está salvo no GitHub (staging),
    // só não aparece de novo se o app recarregar — degrada pro comportamento
    // antigo, não perde o arquivo em si.
  }

  res.status(200).json({ ok: true, media, serverIndex });

  // Já começa a ler o conteúdo de cada anexo em segundo plano, pro chat de
  // criação ter a leitura pronta (ou quase) quando o cliente perguntar sobre
  // ele — ver lib/attachment-analysis.js. Guarda o resultado na própria
  // mensagem de anexo, pra sobreviver a um reinício do servidor.
  for (const item of media) {
    analyzeAttachment(item)
      .then(async (analysis) => {
        if (!analysis) return;
        const users = await loadUsers();
        const user = users.find((u) => u.client === resolvedClient);
        const target = user && (user.chatHistory || [])
          .flatMap((m) => (m.type === 'attachment' && Array.isArray(m.media) ? m.media : []))
          .find((m) => m.stagedPath === item.stagedPath);
        if (!target) return;
        target.analysis = analysis;
        await saveUsers(users);
      })
      .catch(() => {});
  }
};
