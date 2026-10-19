// Efeitos do vídeo em movimento (Franklin, 2026-10-05/07): 12 efeitos de
// produto pra todos + até 5 por empresa (nicho). Usado pela antiga tela de
// postagem e pelo Cut Studio Pro (🎬 Vídeo promocional em movimento).
// Cada item: {when, foto, movimento}.
window.EFEITOS_PRODUTO = [
  {
    when: '🔀 Dois produtos viram um',
    foto: 'Uma imagem com 2 produtos.',
    movimento: 'Os dois produtos da imagem avançam rápido em direção à câmera com som de "whoosh", dão uma freada firme e soltam um reflexo de luz forte. No final, eles se juntam num único produto que combina os dois. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra. Não escreva nenhum texto novo na tela.',
  },
  {
    when: '🚀 Produto avançando com freada',
    foto: 'Foto do produto.',
    movimento: 'O produto avança rápido em direção à câmera com som de "whoosh", dá uma freada firme e um reflexo de luz forte passa por ele. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra. Não escreva nenhum texto novo na tela.',
  },
  {
    when: '🔄 Produto girando 360°',
    foto: 'Foto do produto em fundo limpo.',
    movimento: 'O produto gira 360 graus devagar no centro da tela, com um brilho de luz passando por ele e o fundo levemente desfocado, aparência de vitrine. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra. Não escreva nenhum texto novo na tela.',
  },
  {
    when: '📦 Unboxing: a caixa se abre',
    foto: 'Foto do produto (de preferência com a caixa ou embalagem).',
    movimento: 'A caixa se abre sozinha, a tampa sobe e o produto sai de dentro devagar, girando e brilhando, com um som de surpresa. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra. Não escreva nenhum texto novo na tela.',
  },
  {
    when: '🎁 Produto caindo com confetes',
    foto: 'Foto do produto.',
    movimento: 'O produto cai do alto e pousa no centro com um leve quique, enquanto confetes explodem em volta, com som de festa. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra. Não escreva nenhum texto novo na tela.',
  },
  {
    when: '⚡ Flash de revelação',
    foto: 'Foto ou banner do produto.',
    movimento: 'Começa com um flash de luz forte e um estalo, que se abre revelando o produto nítido e brilhando. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra. Não escreva nenhum texto novo na tela.',
  },
  {
    when: '✨ Brilho de vitrine',
    foto: 'Foto do produto.',
    movimento: 'A câmera se aproxima devagar enquanto um feixe de luz passa pelo produto, deixando ele brilhante, como numa vitrine. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra. Não escreva nenhum texto novo na tela.',
  },
  {
    when: '🧩 Produto se montando',
    foto: 'Foto do produto inteiro.',
    movimento: 'As partes do produto chegam voando de vários lados e se encaixam uma a uma até formar o produto completo. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra. Não escreva nenhum texto novo na tela.',
  },
  {
    when: '💨 Produto surgindo da fumaça',
    foto: 'Foto do produto.',
    movimento: 'Uma fumaça leve se abre devagar e revela o produto no centro, com a luz batendo nele. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra. Não escreva nenhum texto novo na tela.',
  },
  {
    when: '🔍 Zoom nos detalhes',
    foto: 'Foto do produto com boa qualidade.',
    movimento: 'A câmera passa bem perto mostrando os detalhes e o acabamento do produto, e depois se afasta devagar mostrando o produto inteiro. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra. Não escreva nenhum texto novo na tela.',
  },
  {
    when: '🏠 Produto em uso',
    foto: 'Foto do produto (ou dele já em uso).',
    movimento: 'O produto aparece sendo usado em um ambiente bonito e iluminado, mostrando o resultado de forma natural, com a câmera se aproximando devagar. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra. Não escreva nenhum texto novo na tela.',
  },
  {
    when: '🚚 Chegou rapidinho',
    foto: 'Foto do produto ou da embalagem.',
    movimento: 'Um pacote é deixado na porta com um "tum", a caixa se abre e o produto aparece brilhando, passando a ideia de entrega rápida. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra. Não escreva nenhum texto novo na tela.',
  },
];

window.EFEITOS_POR_NICHO = {
  construcao: [
    {
      when: '🚿 Chuveiro Maxi Ducha com água quente',
      foto: 'Foto do chuveiro (na caixa ou instalado).',
      movimento: 'Água quente caindo forte do chuveiro, vapor subindo devagar e gotas brilhando na luz do banheiro, com a câmera se aproximando suavemente.',
    },
    {
      when: '🧱 Parede subindo tijolo por tijolo',
      foto: 'Foto dos tijolos ou do pallet de tijolos.',
      movimento: 'Os tijolos vão se encaixando um a um com a massa, levantando a parede rapidinho, como num vídeo acelerado de obra, com a câmera parada mostrando tudo.',
    },
    {
      when: '🎨 Parede ganhando cor com a tinta acrílica',
      foto: 'Foto da lata de tinta (ex: Extracrill 18L).',
      movimento: 'Um rolo de pintura passa na parede deixando a cor nova brilhando, e a câmera abre devagar mostrando o ambiente renovado.',
    },
    {
      when: '🌧️ Fim da goteira com a fita Vedatudo',
      foto: 'Foto da fita Vedatudo Dryko ou do primer asfáltico.',
      movimento: 'Chuva caindo no telhado e pingando pela fresta; a fita é aplicada sobre a fresta e as gotas param de pingar, com a câmera se aproximando do telhado vedado.',
    },
    {
      when: '🚚 Entrega rápida saindo da loja',
      foto: 'Foto do caminhão de entrega ou da frente da loja.',
      movimento: 'O caminhão carregado de material sai da frente da loja e segue pela rua, com a câmera acompanhando de lado, passando a sensação de entrega rápida.',
    },
  ],
  // RJ Inox: o dono não gosta de vídeo de produto "em ação" — efeitos de
  // design sobre o banner pronto. Nada de telefone nem nome de vendedor.
  inox: [
    {
      when: '🔥 Bancada avançando e virando 2 cubas',
      foto: 'Um banner da RJ Inox com o tanque e a mesa com cuba.',
      movimento: 'A bancada de inox avança rápido em direção à câmera com som de "whoosh", dá uma freada firme e solta um reflexo de luz forte no aço. No final, o tanque e a mesa com cuba se juntam numa única bancada de inox com DUAS cubas QUADRADAS de cantos retos, lado a lado. Sem torneira. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra, e sem telefone ou nome de pessoa.',
    },
    {
      when: '🚀 Bancada chegando',
      foto: 'Um banner ou foto com a bancada, o fogão ou a chapa de inox.',
      movimento: 'A bancada de inox avança rápido em direção à câmera com som de "whoosh", dá uma freada firme e solta um reflexo de luz forte no aço. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra, e sem telefone ou nome de pessoa.',
    },
    {
      when: '💥 Título explodindo',
      foto: 'Um banner pronto com o título em destaque.',
      movimento: 'O título do banner explode em brilho com um impacto forte, soltando pedaços de luz para os lados, e fica pulsando na tela. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra, e sem telefone ou nome de pessoa.',
    },
    {
      when: '🎆 Faíscas de cozinha profissional',
      foto: 'Um banner pronto com fogão, chapa ou coifa.',
      movimento: 'Faíscas e um leve vapor saem das bocas do fogão do banner e passam pela tela, com um brilho correndo pelo inox e clima de cozinha profissional. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra, e sem telefone ou nome de pessoa.',
    },
    {
      when: '📣 Chamada final pulsando',
      foto: 'Um banner pronto com a chamada (ex: "Fale com nosso time!").',
      movimento: 'No final, a frase de chamada do banner pulsa com brilho e um pequeno estouro de luz, chamando para o WhatsApp, enquanto o resto fica parado. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra, e sem telefone ou nome de pessoa.',
    },
  ],
  // Franklin (frank): efeitos de banner de marketing digital da agência
  // (os de produto foram pra lista de todos).
  agencia: [
    {
      when: '📈 Gráfico de vendas subindo',
      foto: 'Um banner com gráfico, números ou resultados.',
      movimento: 'As barras e a linha do gráfico do banner sobem com brilho, setas apontando para cima aparecem e um som de "ding" marca cada subida, passando a ideia de vendas crescendo. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra.',
    },
    {
      when: '💥 Palavra-chave estourando',
      foto: 'Um banner com uma palavra forte em destaque (ex: "VENDAS", "RESULTADO").',
      movimento: 'A palavra de destaque do banner estoura em brilho com um impacto, soltando confetes e faíscas coloridas, e fica pulsando na tela. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra.',
    },
    {
      when: '🔔 Notificações chegando',
      foto: 'Um banner ou a foto de um celular.',
      movimento: 'Ícones de curtida, coração, comentário e mensagem pipocam um a um ao redor do banner com som de notificação, como se o perfil estivesse bombando. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra.',
    },
    {
      when: '🤖 Tecnologia ganhando vida',
      foto: 'Um banner com o robô, a IA ou elementos de tecnologia.',
      movimento: 'Linhas de circuito neon acendem e correm pelo banner, partículas digitais flutuam e os olhos do robô brilham, com um som eletrônico suave. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra.',
    },
    {
      when: '🚀 Banner chegando com tudo',
      foto: 'Um banner pronto com a chamada (ex: "Fale com a gente!").',
      movimento: 'O banner entra com um zoom rápido e som de "whoosh", os elementos dão um leve tranco no lugar e, no final, a chamada pulsa com brilho. Mantenha todas as palavras exatamente iguais, sem deformar nenhuma letra.',
    },
  ],
  geral: [],
};
