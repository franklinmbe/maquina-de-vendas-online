const { putFileToGithub, getFileContentBase64, deleteFileFromGithub, listGithubFolder } = require('./github');
const { loadUsers, saveUsers, findUser } = require('./users');
const { triggerAutoGenerate } = require('./auto-generate');

const HISTORY_LIMIT = 200;

function sanitizeFilename(name) {
  return String(name || 'arquivo')
    .replace(/[\\/]/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-100);
}

function timestampFolderName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `app-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}

async function recordUsage(identifier, imageCount, videoCount, instruction) {
  const users = await loadUsers();
  const user = findUser(users, identifier);
  if (!user) return;

  const stats = user.stats || { totalPedidos: 0, fotos: 0, videos: 0 };
  stats.totalPedidos += 1;
  stats.fotos += imageCount;
  stats.videos += videoCount;
  const now = new Date().toISOString();
  stats.lastRequestAt = now;
  user.stats = stats;

  user.history = user.history || [];
  user.history.push({
    date: now,
    instruction: String(instruction || '').slice(0, 200),
    imageCount,
    videoCount,
  });
  if (user.history.length > HISTORY_LIMIT) {
    user.history = user.history.slice(user.history.length - HISTORY_LIMIT);
  }

  await saveUsers(users);
}

// Lógica central de "mandar um pedido pro GitHub" — usada tanto pelo envio
// imediato (routes/commit.js) quanto pelo disparo de posts agendados
// (lib/scheduled-dispatcher.js), pra não duplicar essa parte em dois lugares.
async function publishPedido({ identifier, client, instruction, files, stagedFiles, networks, voice, music, narrationText, format }) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    throw new Error('Configuração do servidor incompleta (variáveis de ambiente)');
  }

  const validStagedFiles = Array.isArray(stagedFiles)
    ? stagedFiles.filter((f) => f && typeof f.stagedPath === 'string' && f.stagedPath.startsWith(`.claude/skills/${client}/_staging/`))
    : [];

  const imageCount =
    files.filter((f) => f.mimetype.startsWith('image/')).length +
    validStagedFiles.filter((f) => (f.mimetype || '').startsWith('image/')).length;
  const videoCount =
    files.filter((f) => f.mimetype.startsWith('video/')).length +
    validStagedFiles.filter((f) => (f.mimetype || '').startsWith('video/')).length;

  const subfolder = timestampFolderName();
  const basePath = `.claude/skills/${client}/${subfolder}`;

  const results = [];
  for (const file of files) {
    const filename = sanitizeFilename(file.originalname);
    try {
      const base64Content = Buffer.isBuffer(file.buffer)
        ? file.buffer.toString('base64')
        : Buffer.from(file.buffer).toString('base64');
      const uploaded = await putFileToGithub({
        owner,
        repo,
        token,
        path: `${basePath}/${filename}`,
        message: `app upload: ${subfolder}/${filename}`,
        base64Content,
      });
      results.push({ file: filename, status: 'ok', mimetype: file.mimetype, downloadUrl: uploaded.content && uploaded.content.download_url });
    } catch (error) {
      results.push({ file: filename, status: 'erro', error: error.message });
    }
  }

  // Anexos restaurados de uma conversa persistida (o navegador fechou/
  // recarregou antes do cliente clicar Publicar, ver routes/stage-attachment.js)
  // — não tem mais o arquivo original em memória, só a cópia já salva em
  // _staging/. "Move" pra pasta final: lê o conteúdo de lá, escreve aqui,
  // apaga o staged. Se a leitura/escrita falhar, o staged fica intacto (não
  // perde o arquivo, só não entra nesse pedido específico).
  // Junta os paths staged resolvidos aqui (explicitamente referenciados) com
  // os que a varredura geral abaixo apagar — os dois casos precisam limpar a
  // MESMA mensagem em user.chatHistory no final, senão ela fica órfã
  // apontando pra um arquivo que já não existe mais (achado ao testar: só
  // limpar o que a varredura via em _staging/ não pega esse caso, porque
  // esse arquivo já foi apagado por aqui antes da varredura rodar).
  const resolvedStagedPaths = [];
  for (const staged of validStagedFiles) {
    const filename = sanitizeFilename(staged.filename);
    try {
      const base64Content = await getFileContentBase64({ owner, repo, token, path: staged.stagedPath });
      const uploaded = await putFileToGithub({
        owner,
        repo,
        token,
        path: `${basePath}/${filename}`,
        message: `app upload (de anexo salvo antes): ${subfolder}/${filename}`,
        base64Content,
      });
      results.push({ file: filename, status: 'ok', mimetype: staged.mimetype, downloadUrl: uploaded.content && uploaded.content.download_url });
      resolvedStagedPaths.push(staged.stagedPath);
      await deleteFileFromGithub({ owner, repo, token, path: staged.stagedPath, message: `staging: limpa ${staged.stagedPath}` }).catch(() => {});
    } catch (error) {
      results.push({ file: filename, status: 'erro', error: error.message });
    }
  }

  const anyMediaFailed = results.some((r) => r.status === 'erro');

  // Redes marcadas pelo cliente na hora de montar o pedido (composer) — usado
  // depois, quando ele aprovar o conteúdo gerado (aprovacao.html), pra saber
  // em quais contas publicar de verdade. Sem isso, o publicador assume todas
  // as contas conectadas do cliente como alvo.
  if (Array.isArray(networks) && networks.length > 0) {
    try {
      const base64Content = Buffer.from(JSON.stringify(networks, null, 2), 'utf-8').toString('base64');
      await putFileToGithub({
        owner,
        repo,
        token,
        path: `${basePath}/redes.json`,
        message: `app upload: ${subfolder}/redes.json`,
        base64Content,
      });
    } catch (error) {
      // Lista de redes é auxiliar — se falhar, o publicador cai no padrão
      // (todas as contas conectadas) em vez de travar o pedido do cliente.
    }
  }

  // Formato(s) escolhido(s) no composer (post/reels/carrossel/stories) — só
  // vale hoje pra Facebook/Instagram (ver lib/auto-publish.js). Pode marcar
  // mais de um (ex: Reels + Stories) — publica a mesma mídia em cada um dos
  // formatos marcados. Sem isso (pedidos antigos), cai no padrão: post normal.
  const validFormats = Array.isArray(format) ? format.filter((f) => ['post', 'reels', 'carrossel', 'stories'].includes(f)) : [];
  if (validFormats.length > 0) {
    try {
      const base64Content = Buffer.from(JSON.stringify({ formats: validFormats }, null, 2), 'utf-8').toString('base64');
      await putFileToGithub({
        owner,
        repo,
        token,
        path: `${basePath}/formato.json`,
        message: `app upload: ${subfolder}/formato.json`,
        base64Content,
      });
    } catch (error) {
      // Formato é auxiliar — se falhar, o publicador cai no padrão (post).
    }
  }

  // Voz/música escolhidas e texto de narração (opcionais) — usados na hora
  // de gerar o vídeo. Sem narrationText, quem for gerar escreve o texto.
  if (voice || music || narrationText) {
    try {
      const narracao = {};
      if (voice) narracao.voice = voice;
      if (music) narracao.music = music;
      if (narrationText) narracao.narrationText = narrationText;
      const base64Content = Buffer.from(JSON.stringify(narracao, null, 2), 'utf-8').toString('base64');
      await putFileToGithub({
        owner,
        repo,
        token,
        path: `${basePath}/narracao.json`,
        message: `app upload: ${subfolder}/narracao.json`,
        base64Content,
      });
    } catch (error) {
      // Auxiliar — se falhar, quem for gerar o vídeo usa voz/música padrão.
    }
  }

  let instructionsResult;
  try {
    const instructionsContent = `Enviado por: ${identifier}\n\n${instruction}`;
    const base64Content = Buffer.from(instructionsContent, 'utf-8').toString('base64');
    await putFileToGithub({
      owner,
      repo,
      token,
      path: `${basePath}/instrucoes.txt`,
      message: `app upload: ${subfolder}/instrucoes.txt`,
      base64Content,
    });
    instructionsResult = { status: 'ok' };
  } catch (error) {
    instructionsResult = { status: 'erro', error: error.message };
  }

  try {
    await recordUsage(identifier, imageCount, videoCount, instruction);
  } catch (error) {
    // Estatística é secundária - não deve derrubar o pedido do cliente se falhar.
  }

  // Varre o resto de _staging/ desse cliente (anexos staged em segundo
  // plano — ver routes/stage-attachment.js — que acabaram sendo publicados
  // pelo caminho normal, via multipart, em vez de via stagedFiles acima).
  // Sem isso, a cópia staged E a mensagem de anexo persistida em
  // user.chatHistory ficavam órfãs pra sempre, e um recarregamento futuro
  // (loadCreativeChatHistory) reencontraria esse anexo como "ainda
  // pendente" e o reenviaria de novo, duplicado, num pedido totalmente
  // diferente. Roda depois de qualquer publicação real (bem-sucedida ou
  // parcial) — nesse ponto, tudo que estava staged já foi resolvido de um
  // jeito ou de outro (usado aqui ou pertence a um anexo que o cliente
  // desistiu). Nunca derruba o pedido se falhar — é limpeza, não crítico.
  try {
    const stagingPath = `.claude/skills/${client}/_staging`;
    const staged = await listGithubFolder({ owner, repo, token, path: stagingPath });
    const stillStagedPaths = staged.filter((e) => e.type === 'file').map((e) => `${stagingPath}/${e.name}`);
    await Promise.all(
      stillStagedPaths.map((p) =>
        deleteFileFromGithub({ owner, repo, token, path: p, message: `staging: limpa ${p}` }).catch(() => {})
      )
    );
    const sweptPaths = [...resolvedStagedPaths, ...stillStagedPaths];
    // Sem isso, a MENSAGEM de anexo (não só o arquivo) continuaria aparecendo
    // pra sempre em user.chatHistory apontando pra uma URL já apagada —
    // imagem quebrada na tela, e getPendingStagedFiles() tentaria reenviar
    // de novo num pedido futuro (erro "não encontrado", inofensivo mas
    // confuso). Remove só os itens de media cujo stagedPath foi varrido
    // agora; se a mensagem ficar sem nenhum media, some a mensagem inteira.
    if (sweptPaths.length > 0) {
      const users = await loadUsers();
      const user = findUser(users, identifier);
      if (user && Array.isArray(user.chatHistory)) {
        user.chatHistory = user.chatHistory
          .map((m) => {
            if (m.type !== 'attachment' || !Array.isArray(m.media)) return m;
            const media = m.media.filter((item) => !item.stagedPath || !sweptPaths.includes(item.stagedPath));
            return media.length > 0 ? { ...m, media } : null;
          })
          .filter(Boolean);
        await saveUsers(users);
      }
    }
  } catch (error) {
    // Melhor esforço — não crítico.
  }

  // Dispara a geração automática (banner/vídeo, ver lib/auto-generate.js) em
  // segundo plano, sem bloquear a resposta HTTP do "Publicar" — roda dentro
  // deste mesmo processo do servidor, nunca via rotina de nuvem/webhook (ver
  // memória bug-automation-webhook-duplicate-runs-2026-09-15). Só dispara se
  // pelo menos um arquivo de mídia real subiu com sucesso — sem mídia nenhuma
  // não há o que gerar (ex: pedido que falhou 100% no upload).
  const hasMedia = results.some((r) => r.status === 'ok');
  if (hasMedia) {
    triggerAutoGenerate({ client, pasta: subfolder });
  }

  return {
    subfolder: basePath,
    files: results,
    instructions: instructionsResult,
    partial: anyMediaFailed || instructionsResult.status === 'erro',
  };
}

module.exports = { publishPedido, sanitizeFilename };
