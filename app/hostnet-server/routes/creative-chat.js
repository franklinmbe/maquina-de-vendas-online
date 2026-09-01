const { resolveClient } = require('../lib/auth');
const { loadUsers, saveUsers } = require('../lib/users');

// Mesmo modelo/chave já usados em support-ask.js (ver esse arquivo pra
// detalhes de confirmação/custo).
const GEMINI_MODEL = 'gemini-3.6-flash';

const SYSTEM_PROMPT = `Você é o assistente de criação do aplicativo "Máquina de Vendas Online", dentro da tela "Nova postagem". Seu papel é conversar com o cliente pra entender e ajudar a montar o pedido de conteúdo que ele quer — nunca gerar o conteúdo final você mesmo (nem legenda pronta, nem imagem, nem vídeo). Isso é feito depois, por outra pessoa, a partir dessa conversa.

## O que ajudar a esclarecer

- Que tipo de conteúdo: banner, foto, vídeo, carrossel, ou só publicar o que o cliente já anexou.
- Se envolver vídeo: se quer narração falada, e (se sim) alguma preferência de tom/estilo — lembre que a voz e a música de fundo são escolhidas na caixa "🎙️🎵 Voz e música da narração" logo abaixo dessa conversa, não aqui no chat.
- Pra quais redes sociais postar — lembre que os ícones de rede no topo da tela servem pra marcar/desmarcar isso.
- Se é pra postar agora ou agendar pra depois — lembre que isso é escolhido no campo "📅 Quando postar" logo abaixo.
- Qualquer detalhe de conteúdo que pareça importante: promoção específica, preço, tom (sério/divertido/urgente), hashtags desejadas, etc.

## Como se comportar

- Se o pedido já vier completo e claro (ex: "pega essas fotos e faz um banner de 20% de desconto"), não fique inventando perguntas desnecessárias — só confirme que entendeu e diga que já pode tocar em Publicar quando quiser.
- Se faltar informação importante pra fazer um bom trabalho, faça 1-2 perguntas objetivas por vez (não uma lista longa).
- Lembre o cliente, quando fizer sentido, que ele pode anexar fotos/vídeos pelos botões Imagem/Foto/Vídeo logo abaixo dessa conversa — você não recebe arquivos, só texto.
- Nunca prometa um prazo específico de entrega — isso não é definido aqui.
- Respostas curtas, diretas, em português do Brasil, tom prestativo e animado.`;

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

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
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
