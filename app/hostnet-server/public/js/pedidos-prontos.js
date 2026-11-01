// Pedidos prontos (Franklin, 2026-09-17; desde 2026-10-19 moram no Cut
// Estúdio, aba Modelos → "📝 Pedidos prontos"). Cada item: {title, text,
// cost (1 não gasta cota, 2 gasta imagens, 3 gasta 1 vídeo), format?, voice?, music?}.
window.PEDIDOS_PRONTOS = [
  // Montada em 2026-09-25 a partir dos pedidos que os clientes mais
  // escreveram de verdade (Kleber, RJ Inox) — fica no topo.
  {
    label: 'Mais pedidos pelos clientes',
    icon: '⭐',
    format: 'vendas',
    items: [
      {
        title: 'Só postar — ler a foto/vídeo e escrever as descrições',
        text: 'Só publique minhas fotos/vídeos do jeito que estão, sem criar nada novo. Leia o que aparece e o que é falado neles e escreva uma descrição diferente pra cada rede social, com hashtags.',
        cost: 1,
      },
      {
        title: 'Ler o vídeo e fazer as descrições de cada rede',
        text: 'Leia o vídeo que anexei, entenda o assunto e crie descrições diferentes e chamativas pra cada rede social, com hashtags e chamada pra falar no WhatsApp. Publique o vídeo como está.',
        cost: 1,
      },
      {
        title: 'Tirar o tremido do vídeo (mantém minha voz)',
        text: 'Tire o tremido desse vídeo. Mantenha a voz e o som originais, não troque a narração. Publique depois com uma descrição chamativa.',
        cost: 1,
        format: 'reels',
      },
      {
        title: 'Colocar voz e música no meu vídeo',
        text: 'Coloque narração e música de fundo no vídeo que anexei (vou escolher a voz e a música na caixa abaixo). A narração deve contar o que aparece no vídeo.',
        cost: 1,
        format: 'reels',
      },
      {
        title: '1 banner + 1 vídeo com o que está no meu vídeo',
        text: 'Leia o vídeo que anexei e, com as informações dele, crie 1 banner chamativo e 1 vídeo curto narrado. Faça as descrições das postagens também.',
        cost: 3,
      },
    ],
  },
  {
    label: 'Pedidos pra criar Posts',
    icon: '🖼️',
    format: 'post',
    items: [
      {
        title: 'Banner a partir das fotos que você já anexou',
        text: 'Pegue as fotos que eu anexei e crie um banner novo usando elas como referência — mantenha as cores, o estilo e a ideia que já aparecem nelas. Capriche na criatividade pra ficar um banner com potencial de viralizar nas redes sociais.',
        cost: 2,
      },
      {
        title: 'Publicar a foto/vídeo exatamente como está',
        text: 'Só publique essa foto/vídeo do jeito que já está, sem gerar nada novo — escreva uma legenda curta e chamativa baseada no que aparece nela.',
        cost: 1,
      },
      {
        title: 'Banner de oferta com prazo',
        text: 'Crie um banner de oferta a partir das fotos que anexei, destacando o benefício e o prazo da promoção, de um jeito que chame atenção na primeira olhada.',
        cost: 2,
      },
      {
        title: 'Banner com depoimento de cliente satisfeito',
        text: 'Anexei uma foto ou print de um cliente satisfeito — transforme isso num banner bonito, dando destaque ao que ele disse sobre o meu produto/serviço.',
        cost: 2,
      },
      {
        title: 'Banner estratégico pra captar clientes novos',
        text: 'Crie o banner mais estratégico possível pra atrair cliente novo: destaque o principal motivo de escolher meu negócio, uma oferta ou benefício forte, e termine com uma chamada pra ação bem clara convidando a pessoa a me chamar agora no WhatsApp/Direct. Use as fotos que anexei como base.',
        cost: 2,
      },
    ],
  },
  {
    label: 'Pedidos pra criar Reels',
    icon: '🎬',
    format: 'reels',
    items: [
      {
        title: 'Vídeo curto contando o que você está oferecendo',
        text: 'Pegue as fotos que eu anexei e monte um vídeo curto com narração explicando o que estou oferecendo, usando o que aparece nas fotos como base. Coloque uma música de fundo que combine.',
        cost: 3,
        voice: 'Kore',
        music: 'musica-Corporate.mp3',
      },
      {
        title: 'Antes e depois usando as fotos que você anexou',
        text: 'Pegue as fotos de antes e depois que eu anexei e monte um vídeo curto e dinâmico mostrando a transformação, com narração explicando o que mudou e uma música animada de fundo.',
        cost: 3,
        voice: 'Kore',
        music: 'musica-Corporate.mp3',
      },
      {
        title: 'Depoimento de cliente satisfeito, narrado',
        text: 'Pegue as fotos ou prints que anexei sobre um cliente satisfeito e monte um vídeo curto narrado contando esse depoimento, com uma música de fundo emocionante.',
        cost: 3,
        voice: 'Leda',
        music: 'musica-Business-Corporate-Music.mp3',
      },
      {
        title: 'Bastidores narrados do seu negócio',
        text: 'Pegue as fotos que anexei do dia a dia do negócio e monte um vídeo curto narrando os bastidores, de um jeito pessoal e próximo do cliente.',
        cost: 3,
        voice: 'Puck',
        music: 'musica-The-Future-Beat.mp3',
      },
      {
        title: 'Vídeo respondendo a maior dúvida dos seus clientes',
        text: 'Monte um vídeo curto e narrado respondendo a pergunta ou objeção mais comum que um cliente novo teria antes de comprar/contratar comigo — isso constrói confiança e traz mais gente pra falar comigo. Use as fotos que anexei como apoio visual, com uma narração clara e uma chamada pra ação no final.',
        cost: 3,
        voice: 'Orus',
        music: 'musica-Business-Corporate-Music.mp3',
      },
    ],
  },
  {
    label: 'Pedidos pra criar Carrossel',
    icon: '🔄',
    format: 'carrossel',
    items: [
      {
        title: 'Vários banners diferentes de uma vez',
        text: 'Crie 3 banners diferentes usando essas fotos como referência, cada um destacando uma vantagem ou diferencial diferente do que estou vendendo.',
        cost: 2,
      },
      {
        title: 'Carrossel de fotos pro Instagram',
        text: 'Transforme essas fotos em um carrossel pro Instagram, com uma legenda que amarre a sequência toda e desperte curiosidade pra passar pro próximo slide.',
        cost: 1,
      },
      {
        title: 'Carrossel apresentando vários produtos ou serviços',
        text: 'Crie um carrossel com um banner pra cada produto ou serviço que aparece nas fotos que anexei, cada slide destacando um item diferente.',
        cost: 2,
      },
      {
        title: 'Carrossel de dicas em sequência',
        text: 'Crie um carrossel de dicas relacionadas ao que eu ofereço, uma dica por slide, usando as fotos que anexei como referência visual.',
        cost: 2,
      },
      {
        title: 'Carrossel estratégico: por que escolher o meu negócio',
        text: 'Monte um carrossel estratégico com um slide pra cada motivo forte de escolher meu negócio (qualidade, atendimento, resultado, diferencial), usando as fotos que anexei, e termine com um último slide de chamada pra ação clara convidando a pessoa a entrar em contato agora.',
        cost: 2,
      },
    ],
  },
  {
    label: 'Pedidos pra criar Stories',
    icon: '⏱️',
    format: 'stories',
    items: [
      {
        title: 'Story rápido de novidade ou promoção',
        text: 'Transforme essa foto/vídeo numa Storie rápida e chamativa anunciando uma novidade ou promoção de hoje — texto curto, direto, com senso de urgência.',
        cost: 2,
      },
      {
        title: 'Story de bastidores do dia a dia',
        text: 'Peguem essa foto/vídeo e criem uma Storie estilo bastidores, mostrando o dia a dia do negócio de um jeito mais pessoal e espontâneo.',
        cost: 2,
      },
      {
        title: 'Story de agradecimento aos clientes',
        text: 'Transforme essa foto/vídeo numa Storie de agradecimento carinhoso aos seus clientes, com um texto caloroso e sincero.',
        cost: 2,
      },
      {
        title: 'Story de últimas unidades ou vagas',
        text: 'Crie uma Storie chamativa avisando que restam poucas unidades ou vagas, com senso de urgência pra gerar ação rápida.',
        cost: 2,
      },
      {
        title: 'Story estratégico com oferta exclusiva pra quem chamar no Direct',
        text: 'Crie uma Storie estratégica oferecendo um benefício exclusivo (desconto, brinde ou consultoria grátis) só pra quem me chamar no Direct/WhatsApp agora, com senso de urgência e uma chamada pra ação bem clara no final.',
        cost: 2,
      },
    ],
  },
  {
    label: 'Pedidos para Vendas',
    icon: '💰',
    format: 'vendas',
    items: [
      {
        title: 'Banner de oferta direta com chamada de compra',
        text: 'Crie um banner de vendas direto ao ponto: produto/serviço em destaque e uma chamada pra ação clara tipo "chame no WhatsApp"/"garanta o seu", usando as fotos que anexei.',
        cost: 2,
        format: 'post',
      },
      {
        title: 'Carrossel vitrine dos produtos/serviços mais vendidos',
        text: 'Monte um carrossel tipo vitrine com os produtos ou serviços que mais vendo, um por slide, terminando com um último slide de chamada pra ação convidando a comprar.',
        cost: 2,
        format: 'carrossel',
      },
      {
        title: 'Vídeo de vendas com gatilho de urgência/escassez',
        text: 'Monte um vídeo curto e narrado com gatilho de urgência (últimas unidades, promoção por tempo limitado) pra empurrar a decisão de compra agora, usando as fotos que anexei.',
        cost: 3,
        format: 'reels',
        voice: 'Fenrir',
        music: 'musica-The-Future-Beat.mp3',
      },
      {
        title: 'Story com cupom ou desconto exclusivo por tempo limitado',
        text: 'Crie uma Storie anunciando um cupom ou desconto exclusivo válido só por hoje ou essa semana, com senso de urgência forte pra converter em venda.',
        cost: 2,
        format: 'stories',
      },
      {
        title: 'Banner de combo/kit com mais vantagem pra quem levar mais',
        text: 'Crie um banner oferecendo um combo ou kit especial (juntando produtos/serviços) com uma condição melhor, mostrando claramente o ganho pra quem levar mais de um.',
        cost: 2,
        format: 'post',
      },
    ],
  },
  {
    label: 'Pedidos para Engajamento',
    icon: '🔥',
    format: 'engajamento',
    items: [
      {
        title: 'Carrossel "isso ou aquilo" pra gerar comentário',
        text: 'Monte um carrossel estilo "isso ou aquilo", comparando duas opções relacionadas ao meu negócio, incentivando quem ver a comentar qual prefere.',
        cost: 2,
        format: 'carrossel',
      },
      {
        title: 'Vídeo terminando com uma pergunta pro público',
        text: 'Monte um vídeo curto e narrado sobre o que eu ofereço, terminando com uma pergunta direta pro público, convidando a comentar a resposta.',
        cost: 3,
        format: 'reels',
        voice: 'Charon',
        music: 'musica-Summer-Fashion-EDM.mp3',
      },
      {
        title: 'Story convidando pergunta ou opinião do público',
        text: 'Crie uma Storie convidando o público a mandar uma pergunta ou opinião sobre o que eu ofereço, de um jeito leve e convidativo, incentivando resposta no Direct.',
        cost: 2,
        format: 'stories',
      },
      {
        title: 'Banner de curiosidade sobre o negócio',
        text: 'Crie um banner com uma curiosidade ou fato interessante sobre o meu produto, serviço ou negócio, pensado pra gerar comentário e compartilhamento.',
        cost: 2,
        format: 'post',
      },
      {
        title: 'Carrossel de mitos e verdades do seu nicho',
        text: 'Monte um carrossel de "mito ou verdade" sobre o meu produto, serviço ou área de atuação, um mito por slide, terminando com uma chamada pra comentar o que mais surpreendeu.',
        cost: 2,
        format: 'carrossel',
      },
    ],
  },
  {
    label: 'Pedidos para Reconhecimento da Marca',
    icon: '🏆',
    format: 'reconhecimento',
    items: [
      {
        title: 'Vídeo contando a história por trás do negócio',
        text: 'Monte um vídeo curto e narrado contando a história ou o motivo que me fez começar esse negócio, de um jeito pessoal e genuíno, usando as fotos que anexei.',
        cost: 3,
        format: 'reels',
        voice: 'Aoede',
        music: 'musica-Fly-By-Dream.mp3',
      },
      {
        title: 'Banner com a identidade e o diferencial da marca',
        text: 'Crie um banner focado em fortalecer a marca: destaque o nome, o slogan ou o principal diferencial do meu negócio de um jeito bonito e memorável, usando as fotos que anexei.',
        cost: 2,
        format: 'post',
      },
      {
        title: 'Carrossel apresentando quem está por trás do negócio',
        text: 'Monte um carrossel apresentando quem está por trás do negócio (eu e/ou a equipe), humanizando a marca, usando as fotos que anexei.',
        cost: 2,
        format: 'carrossel',
      },
      {
        title: 'Story destacando um valor importante da marca',
        text: 'Crie uma Storie destacando um valor ou compromisso importante da marca (qualidade, atendimento, compromisso com o cliente etc.), reforçando a identidade do negócio.',
        cost: 2,
        format: 'stories',
      },
      {
        title: 'Vídeo com números e conquistas do negócio',
        text: 'Monte um vídeo curto e narrado destacando números ou conquistas do negócio (tempo de mercado, clientes atendidos, resultados entregues), pra reforçar autoridade e reconhecimento.',
        cost: 3,
        format: 'reels',
        voice: 'Sulafat',
        music: 'musica-Business-Corporate-Music.mp3',
      },
    ],
  },
];
