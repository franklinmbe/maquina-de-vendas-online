const { resolveClient } = require('../lib/auth');
const { loadUsers, saveUsers } = require('../lib/users');
const { analyzeAttachment } = require('../lib/attachment-analysis');
const { promptRulesFor } = require('../lib/client-content-rules');

const MAX_ANALYSIS_WAIT_MS = 90000;

// Mesmo modelo/chave já usados em support-ask.js (ver esse arquivo pra
// detalhes de confirmação/custo).
const GEMINI_MODEL = 'gemini-3.6-flash';

const SYSTEM_PROMPT = `Você é o assistente de criação do aplicativo "Máquina de Vendas Online", dentro da tela "Nova postagem". Seu papel é conversar com o cliente pra entender e ajudar a montar o pedido de conteúdo que ele quer — nunca gerar o conteúdo final você mesmo (nem legenda pronta, nem imagem, nem vídeo). Isso é feito depois, por outra pessoa, a partir dessa conversa.

## O que ajudar a esclarecer

- Que tipo de conteúdo: banner, foto, vídeo, carrossel, ou só publicar o que o cliente já anexou.
- Se envolver vídeo: se quer narração falada, e (se sim) alguma preferência de tom/estilo — lembre que a voz e a música de fundo são escolhidas na caixa "🎙️🎵 Voz e música da narração" logo abaixo dessa conversa, não aqui no chat.
- Pra quais redes sociais postar — lembre que os ícones de rede no topo da tela servem pra marcar/desmarcar isso.
- Se é pra postar agora ou agendar pra depois — lembre que isso é escolhido no campo "📅 Quando postar" logo abaixo.
- Qualquer detalhe de conteúdo que pareça importante: promoção específica, tom (sério/divertido/urgente), hashtags desejadas, etc.
- NUNCA escreva, sugira nem pergunte preço/valor (nada de "R$", "a partir de", "por apenas") em legenda, narração ou sugestão — regra fixa pra todo cliente, postagem com preço é derrubada nas redes. Mesmo que o vídeo/foto mostre preço, descreva o produto sem o valor.
- Se o cliente só anexou fotos/vídeos sem escrever nada, tudo bem: diga que já pode tocar em Publicar — o app lê as mídias, escreve uma descrição diferente pra cada rede e publica sozinho.

## Como se comportar

- Se o pedido já vier completo e claro (ex: "pega essas fotos e faz um banner de 20% de desconto"), não fique inventando perguntas desnecessárias — só confirme que entendeu e diga que já pode tocar em Publicar quando quiser.
- Se faltar informação importante pra fazer um bom trabalho, faça 1-2 perguntas objetivas por vez (não uma lista longa).
- Lembre o cliente, quando fizer sentido, que ele pode anexar fotos/vídeos pelos botões Imagem/Foto/Vídeo logo abaixo dessa conversa.
- Nunca prometa um prazo específico de entrega — isso não é definido aqui.
- Respostas curtas, diretas, em português do Brasil, tom prestativo e animado.

## Anexos (fotos e vídeos)

Você não vê o arquivo em si, mas o sistema lê cada anexo pra você (descrição do vídeo, fala/narração, textos e ofertas escritos na tela, textos escritos nas fotos) e passa essa leitura no fim destas instruções, em "CONTEÚDO DOS ANEXOS". Use essa leitura normalmente:
- NUNCA diga que não consegue ler/assistir o vídeo ou ver a foto quando houver leitura disponível.
- Se o vídeo só tem música, os textos escritos na tela são a fonte principal da mensagem do post.
- Quando o cliente pedir (ou quando ajudar a fechar o pedido), sugira a partir desse conteúdo: um TÍTULO, uma DESCRIÇÃO/legenda pronta pra postar e um texto de NARRAÇÃO (15-30s). Aqui essa sugestão É permitida — ela vai junto no pedido e orienta a legenda final.
- Se o cliente quiser narração em voz sobre um vídeo que ele mesmo gravou, avise que a voz é escolhida na caixa "🎙️🎵 Voz e música da narração".
- Se um anexo aparecer como "leitura ainda em andamento", diga que o arquivo ainda está sendo lido e peça pra ele mandar a mensagem de novo em alguns segundos.

## Contato do Franklin (dono da Máquina de Vendas Online)

Se o cliente pedir o WhatsApp/contato do Franklin, ou perguntar qualquer coisa que só ele mesmo pode resolver (negociar plano, dúvida que você não consegue responder, problema sério, etc.), passe o WhatsApp dele: **(21) 99905-9608**. Pode oferecer isso proativamente quando fizer sentido, sem inventar mais nenhuma outra forma de contato.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, message, history } = req.body || {};
  if (!message || !String(message).trim()) {
    res.status(400).json({ error: 'message é obrigatório' });
    return;
  }

  const resolvedClient = await resolveClient({ identifier, password });
  if (!resolvedClient) {
    res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: 'Chat de criação ainda não configurado neste servidor (falta GEMINI_API_KEY).' });
    return;
  }

  // Reaproveita o histórico da conversa (mandado pelo composer) como
  // "contents" alternando user/model, pro Gemini manter contexto do que já
  // foi dito — sem isso ele responderia cada mensagem sem lembrar da anterior.
  const contents = [];
  if (Array.isArray(history)) {
    for (const turn of history) {
      if (!turn || !turn.text) continue;
      contents.push({
        role: turn.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(turn.text) }],
      });
    }
  }
  contents.push({ role: 'user', parts: [{ text: String(message).trim() }] });

  // Anexos ainda pendentes deste pedido (os que já foram publicados somem do
  // chatHistory em lib/publish-pedido.js) — leitura já feita no staging ou,
  // se ainda não terminou, espera aqui até MAX_ANALYSIS_WAIT_MS.
  let systemText = SYSTEM_PROMPT;
  try {
    const users = await loadUsers();
    const user = users.find((u) => u.client === resolvedClient);
    const pending = ((user && user.chatHistory) || [])
      .flatMap((m) => (m.type === 'attachment' && Array.isArray(m.media) ? m.media : []))
      .filter((item) => item.stagedPath && item.url);
    if (pending.length > 0) {
      const readings = await Promise.all(
        pending.map(async (item, i) => {
          let reading = item.analysis;
          if (!reading) {
            reading = await Promise.race([
              analyzeAttachment(item),
              new Promise((resolve) => setTimeout(() => resolve(null), MAX_ANALYSIS_WAIT_MS)),
            ]).catch(() => null);
          }
          const label = `Anexo ${i + 1} (${item.type === 'video' ? 'vídeo' : 'foto'}, ${item.filename || 'arquivo'})`;
          return `### ${label}\n${reading || 'leitura ainda em andamento'}`;
        })
      );
      systemText += `\n\n## CONTEÚDO DOS ANEXOS\n\n${readings.join('\n\n')}`;
    }
    const rules = promptRulesFor(resolvedClient);
    if (rules.length) systemText += `\n\n${rules.join('\n')}`;
  } catch (e) {
    // Sem a leitura dos anexos o chat ainda responde, só sem esse contexto.
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents,
        }),
      }
    );
    const data = await geminiRes.json();
    if (!geminiRes.ok) {
      res.status(502).json({ error: (data.error && data.error.message) || 'Falha ao consultar o chat de criação' });
      return;
    }
    const answer =
      (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0].text) ||
      'Não consegui responder agora — tenta de novo.';

    // Persiste os dois lados da troca — é o que permite o cliente sair e
    // voltar depois (ou trocar de aparelho) e continuar vendo a mesma
    // conversa, incluindo prévias de conteúdo entregues nesse meio tempo.
    try {
      const users = await loadUsers();
      const user = users.find((u) => u.client === resolvedClient);
      if (user) {
        user.chatHistory = user.chatHistory || [];
        user.chatHistory.push({ role: 'user', text: String(message).trim() });
        user.chatHistory.push({ role: 'bot', text: answer });
        await saveUsers(users);
      }
    } catch (e) {
      // Falha ao persistir não deve derrubar a resposta já obtida do Gemini.
    }

    res.status(200).json({ ok: true, answer });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao consultar o chat de criação' });
  }
};
