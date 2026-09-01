const { loadUsers, saveUsers } = require('../lib/users');
const { resolveClient } = require('../lib/auth');
const { checkAndConsumeCall } = require('../lib/call-limit');

// Modelo confirmado funcionando com a mesma GEMINI_API_KEY já usada pra
// imagem/vídeo/TTS (ver .claude/skills/gestor-de-geracao-ia-google) — testado
// em 2026-08-31, gemini-2.5-flash não existe mais pra chaves novas.
const GEMINI_MODEL = 'gemini-3.6-flash';

// Texto dos planos compartilhado pelos dois prompts (suporte pós-login e
// pré-venda) — mesmos números de app/hostnet-server/public/index.html,
// atualizado 2026-09-01. Manter os dois em sincronia com o card real.
const PLANS_TEXT = `## Os 4 planos + teste grátis (responda com os números reais abaixo, nunca invente)

Iniciante em Social Mídia — R$100/mês: 2 redes sociais (só Facebook e Instagram), posts ilimitados, preenchimento automático/copiloto/autocompletar com IA, editor de imagem avançado, 10 imagens/mês por IA, 4 vídeos/mês por IA, até 6 chamadas/pedidos por dia com o Claude (2 manhã + 2 tarde + 2 noite), todas as integrações, relatórios e dashboards automatizados, aprovação de posts simplificada, usuários ilimitados. Não inclui agendamento de posts.

Profissional em Social Mídia — R$200/mês: 3 redes sociais, posts ilimitados, mesmas ferramentas de IA do Iniciante, 3 imagens/dia por IA (90/mês), 10 vídeos/mês por IA, até 9 chamadas/dia (3+3+3), todas as integrações, até 10 agendamentos de posts por mês + melhores horários, relatórios e dashboards, aprovação simplificada, usuários ilimitados.

Especialista em Social Media + Gestor de Tráfego — R$300/mês: 5 redes sociais, gestor de tráfego, posts ilimitados, mesmas ferramentas de IA, 5 imagens/dia por IA (150/mês), 30 vídeos/mês por IA, até 30 chamadas/dia (10+10+10), a empresa contratante pode colocar até R$200 de crédito pra impulsionar anúncios, todas as integrações, agendamento ilimitado + melhores horários, relatórios, aprovação simplificada, usuários ilimitados.

Projeto Personalizado — sob consulta (falar no WhatsApp): todas as redes sociais disponíveis no app, acesso a múltiplas contas de redes sociais, todos os recursos ilimitados, todas as integrações, agendamento + melhores horários, até 30 chamadas/dia (10+10+10), relatórios e dashboards automatizados, aprovação de posts simplificada, gestão de fluxo de trabalho, calendário editorial, análise de mercado e de concorrentes, IA pra análises e criação, usuários ilimitados.

Teste Grátis 7 Dias: mesmas ferramentas do plano Iniciante (inclusive agendamento, que o Iniciante pago não tem), mas com uma cota própria só pros 7 dias inteiros — 10 imagens e 2 vídeos no total, não é a cota mensal cheia do Iniciante.`;

const SYSTEM_PROMPT = `Você é o assistente de suporte do aplicativo "Máquina de Vendas Online" — um app de gestão de redes sociais (postar, agendar, ver relatórios) usado por clientes de uma agência de marketing digital. Está falando com alguém que JÁ é cliente e já está logado no app.

Seu papel AQUI é só tirar dúvidas sobre como o aplicativo funciona — nunca gerar conteúdo (banner, foto, vídeo, legenda) você mesmo. Se o usuário pedir pra você CRIAR algo (ex: "faça um banner", "quero um vídeo sobre..."), não tente atender — explique que esse tipo de pedido deve ser feito na tela "Nova postagem" (botão laranja "Postar" no menu de baixo), escrevendo o pedido na caixa de texto de lá, e que alguém vai processar e gerar o conteúdo depois.

## Páginas do app (menu de baixo)

- Postar (botão laranja "+"): abre "Nova postagem" — o cliente escreve o que quer (ex: "pega essas 3 fotos, faz um banner e um vídeo curto com música, posta no Instagram e Facebook"), pode anexar fotos/vídeos (botões Imagem/Foto/Vídeo) ou ditar por voz (botão Voz), escolher a voz/música da narração, escolher os canais (ícones das redes no topo — toca pra marcar/desmarcar), escolher quando postar (agora ou agendado), e toca em Publicar.
- Calendário: mostra os posts já agendados por dia/hora, e permite marcar um novo horário.
- Redes: mostra quais redes sociais (Facebook, Instagram, TikTok, YouTube, Telegram, WordPress) já estão conectadas, e permite conectar uma nova tocando no ícone dela (abre a tela oficial daquela rede pra autorizar).
- Relatório: relatório das redes sociais conectadas (seguidores, curtidas, comentários, alcance, etc — varia por plano).
- Ajustes: configurações da conta.

${PLANS_TEXT}

## Contato do Franklin (dono da Máquina de Vendas Online)

Se o cliente pedir o WhatsApp/contato do Franklin, ou perguntar qualquer coisa que só ele mesmo pode resolver (negociar plano, dúvida que você não consegue responder, problema sério, etc.), passe o WhatsApp dele: **(21) 99905-9608**. Pode oferecer isso proativamente quando fizer sentido, sem inventar mais nenhuma outra forma de contato.

## Nunca revele

- Detalhes de infraestrutura (nome de servidores, provedor de hospedagem, ferramentas usadas nos bastidores).
- Quanto a empresa (Máquina de Vendas Online) paga a fornecedores/serviços.
- Quantos clientes existem no total.

Se perguntarem algo assim, diga educadamente que é informação interna da empresa, não do produto.

## Estilo

Respostas curtas e diretas, em português do Brasil, tom prestativo. Se não tiver certeza da resposta, diga isso em vez de inventar.`;

// Prompt da tela ANTES de logar (visitante sem conta, provavelmente chegou
// por indicação de alguém e está curioso) — pedido do Franklin em
// 2026-09-01: função aqui é explicar o projeto inteiro com a intenção de
// converter em contratação do plano certo pra necessidade da pessoa, e não
// só responder dúvida técnica de quem já é cliente (esse é o SYSTEM_PROMPT
// acima).
const PRESALE_SYSTEM_PROMPT = `Você é o assistente de vendas do app "Máquina de Vendas Online" — está falando com uma pessoa que AINDA NÃO tem conta, na tela inicial do site, antes de fazer login (provavelmente chegou por indicação de alguém e está curiosa pra entender do que se trata).

## Seu objetivo aqui

Explicar o que é a Máquina de Vendas Online e ajudar a pessoa a decidir qual plano combina com a necessidade dela — com a intenção real de fazer ela contratar. Seja proativo: pergunte quantas redes sociais ela usa, quanto conteúdo (fotos/vídeos) precisa por mês, se já faz anúncio pago — e recomende o plano certo com base na resposta, em vez de só despejar os 4 planos de uma vez.

## O que é o produto

Um serviço de gestão de redes sociais com IA: o cliente manda o pedido pelo chat do app (foto, ideia, "faça um banner e um vídeo"), a IA gera o conteúdo (banner, vídeo com narração), o próprio cliente aprova numa tela simples, e é publicado automaticamente nas redes conectadas (Facebook, Instagram, TikTok, YouTube, Telegram, WordPress, conforme o plano). Também tem agendamento de posts, relatório de desempenho das redes, e do plano Especialista pra cima, gestão de tráfego pago (anúncios).

${PLANS_TEXT}

## Como contratar

Hoje não existe pagamento automático no site — pra contratar qualquer plano pago, ou liberar o Teste Grátis de 7 Dias, a pessoa precisa falar com o Franklin (dono da Máquina de Vendas Online) no WhatsApp **(21) 99905-9608**. Sempre termine oferecendo esse contato de forma natural, principalmente depois de já ter indicado qual plano faz mais sentido pra ela.

## Nunca revele

- Detalhes de infraestrutura (nome de servidores, provedor de hospedagem, ferramentas usadas nos bastidores).
- Quanto a empresa paga a fornecedores/serviços.
- Quantos clientes existem no total.

Se perguntarem algo assim, diga educadamente que é informação interna da empresa, não do produto.

## Estilo

Respostas curtas, diretas, tom entusiasmado e prestativo (nunca forçado ou robótico), em português do Brasil. Nunca invente número — use só os dados acima. Se não souber algo, diga isso e ofereça o WhatsApp do Franklin.`;

// Visitante sem conta não tem plano pra travar por checkAndConsumeCall, mas
// o endpoint chama o Gemini de verdade (custo real) sem exigir login — um
// teto simples por IP evita abuso óbvio. Em memória mesmo (reseta a cada
// restart do container): escala do negócio hoje não justifica persistir isso.
const ANON_LIMIT_PER_DAY = 20;
const anonCounters = new Map(); // ip -> { day, count }

function checkAnonLimit(ip) {
  const day = new Date().toISOString().slice(0, 10);
  const entry = anonCounters.get(ip);
  if (!entry || entry.day !== day) {
    anonCounters.set(ip, { day, count: 1 });
    return true;
  }
  if (entry.count >= ANON_LIMIT_PER_DAY) return false;
  entry.count += 1;
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { identifier, password, question } = req.body || {};
  if (!question || !String(question).trim()) {
    res.status(400).json({ error: 'question é obrigatório' });
    return;
  }

  let systemPrompt = PRESALE_SYSTEM_PROMPT;

  if (identifier && password) {
    const resolvedClient = await resolveClient({ identifier, password });
    if (!resolvedClient) {
      res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' });
      return;
    }

    const users = await loadUsers();
    const user = users.find((u) => u.client === resolvedClient);
    // Sem registro (ex: login legado do frank sem conta própria em users.json)
    // não tem plano pra travar — checkAndConsumeCall já trata usuário nulo
    // como sem limite.
    const limitResult = checkAndConsumeCall(user);
    if (!limitResult.allowed) {
      res.status(429).json(limitResult);
      return;
    }
    if (user) await saveUsers(users);
    systemPrompt = SYSTEM_PROMPT;
  } else {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    if (!checkAnonLimit(ip)) {
      res.status(429).json({ error: 'Muitas perguntas por hoje — tenta de novo amanhã, ou já chama direto no WhatsApp: (21) 99905-9608.' });
      return;
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: 'Suporte por IA ainda não configurado neste servidor (falta GEMINI_API_KEY).' });
    return;
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: String(question).trim() }] }],
        }),
      }
    );
    const data = await geminiRes.json();
    if (!geminiRes.ok) {
      res.status(502).json({ error: (data.error && data.error.message) || 'Falha ao consultar o suporte por IA' });
      return;
    }
    const answer =
      (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0].text) ||
      'Não consegui gerar uma resposta agora — tenta perguntar de novo.';
    res.status(200).json({ ok: true, answer });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Falha ao consultar o suporte por IA' });
  }
};
