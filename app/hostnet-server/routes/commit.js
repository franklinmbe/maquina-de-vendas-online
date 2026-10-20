const { resolveClient } = require('../lib/auth');
const { publishPedido } = require('../lib/publish-pedido');
const { putFileToGithub } = require('../lib/github');
const { addProjeto } = require('../lib/projetos');
const { getCached, storeResult } = require('../lib/request-dedup');
const { findDuplicatePedido, duplicateMessage } = require('../lib/duplicate-pedido');

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

  const { identifier, password, instruction: rawInstruction, targetClient, networks, voice, music, narrationText, motionVideo, motionExtend, motionVideoVoice, format, formatNetworks, stagedFiles, requestId, autoTip } = req.body || {};
  const uploadedFiles = req.files || [];

  // Reenvio automático do mesmo pedido (o front retenta sozinho depois de
  // "Failed to fetch", com o mesmo requestId) — se já processamos esse id
  // com sucesso, devolve o resultado salvo em vez de subir tudo de novo.
  const cached = requestId ? getCached(requestId) : null;
  if (cached) {
    res.status(cached.status).json(cached.body);
    return;
  }

  let parsedStagedFiles = null;
  if (stagedFiles) {
    try {
      const parsed = JSON.parse(stagedFiles);
      if (Array.isArray(parsed)) parsedStagedFiles = parsed;
    } catch {
      // Lista malformada — ignora, o pedido segue só com os arquivos normais.
    }
  }

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

  // Mapa formato → redes (pedido do Franklin, 2026-09-22) — permite "Reels
  // só no Facebook" em vez de todo formato marcado ir pra todas as redes
  // marcadas. Validação de verdade (chaves/valores aceitos) fica em
  // lib/publish-pedido.js, aqui só confere que é um objeto de verdade.
  let parsedFormatNetworks = null;
  if (formatNetworks) {
    try {
      const parsed = JSON.parse(formatNetworks);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) parsedFormatNetworks = parsed;
    } catch {
      // Malformado — ignora e segue sem ele (publicador cai no padrão: todo formato pra toda rede marcada).
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

  // Só anexou mídia, sem escrever nada (Franklin, 2026-09-25): vale como
  // pedido de postagem automática — ver autoMode em lib/auto-generate.js.
  const mediaCount = uploadedFiles.length + (parsedStagedFiles ? parsedStagedFiles.length : 0);
  let instruction = rawInstruction;
  if ((!instruction || !String(instruction).trim()) && mediaCount > 0) {
    instruction = mediaCount === 1 ? 'Cliente: Anexei 1 arquivo:' : `Cliente: Anexei ${mediaCount} arquivos:`;
  }
  if (!instruction || !String(instruction).trim()) {
    res.status(400).json({ error: 'Anexe uma foto ou vídeo, ou escreva o que você quer.' });
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

  // Trava de pedido repetido (Franklin, 2026-09-23; 2026-10-13: só o MESMO
  // pedido inteiro — mesma mídia com outro pedido, ex: vídeo em movimento
  // com narração, passa).
  const duplicate = await findDuplicatePedido({
    client,
    files: uploadedFiles,
    stagedFiles: parsedStagedFiles,
    instruction,
    narracao: { voice, music, narrationText, motionVideo, motionExtend, motionVideoVoice },
  });
  if (duplicate) {
    res.status(409).json({ error: duplicateMessage(duplicate), duplicate: true });
    return;
  }

  try {
    const result = await publishPedido({
      identifier,
      client,
      instruction,
      files: uploadedFiles,
      stagedFiles: parsedStagedFiles,
      networks: parsedNetworks,
      voice,
      music,
      narrationText,
      motionVideo: motionVideo === 'true' || motionVideo === true,
      motionExtend: motionExtend === 'true' || motionExtend === true,
      motionVideoVoice: motionVideoVoice === 'true' || motionVideoVoice === true,
      format: parsedFormat,
      formatNetworks: parsedFormatNetworks,
      autoTip: autoTip ? String(autoTip) : null,
    });
    // Criado no Cut Estúdio: vira projeto (aprovar só guarda; postar é na
    // tela Postar). semAprovacao = já editado na hora, o cliente já viu.
    if (req.body.projeto === 'true' || req.body.projeto === true) {
      const pasta = String(result.subfolder).split('/').pop();
      const titulo = String(req.body.projetoTitulo || '').slice(0, 80) || 'Projeto';
      const semAprovacao = req.body.semAprovacao === 'true' || req.body.semAprovacao === true;
      try {
        await putFileToGithub({ owner: process.env.GITHUB_OWNER, repo: process.env.GITHUB_REPO, token: process.env.GITHUB_TOKEN,
          path: `${result.subfolder}/projeto.json`, message: `projeto: ${client}/${pasta}`,
          base64Content: Buffer.from(JSON.stringify({ origem: 'estudio', titulo, semAprovacao }, null, 2)).toString('base64') });
        // Primeira linha do histórico: o que foi pedido.
        const pedido = String(instruction || '').replace(/^Cliente:\s*/i, '').trim().slice(0, 300);
        const extras = [
          mediaCount > 0 && `${mediaCount} arquivo(s) anexado(s)`,
          (motionVideo === 'true' || motionVideo === true) && 'vídeo em movimento',
          (motionVideoVoice === 'true' || motionVideoVoice === true) && 'voz do vídeo como narração',
          narrationText && 'narração escrita',
          voice && `voz ${voice}`,
          music && `música ${String(music).replace(/^musica-|\.mp3$/g, '').replace(/-/g, ' ')}`,
        ].filter(Boolean).join(' · ');
        await addProjeto(client, { pasta, titulo, semAprovacao }, { tipo: 'pedido', texto: `📝 Pedido: ${pedido || titulo}${extras ? ` (${extras})` : ''}` });
      } catch (error) {
        console.error('[commit] projeto não registrado:', error.message);
      }
    }
    const status = result.partial ? 207 : 200;
    const body = {
      client,
      subfolder: result.subfolder,
      files: result.files,
      instructions: result.instructions,
    };
    if (requestId) storeResult(requestId, { status, body });
    res.status(status).json(body);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao processar o pedido' });
  }
};
