// Pedidos automáticos (Franklin, 2026-09-25): o cliente só anexa e o app
// faz tudo sozinho (autoMode em lib/auto-generate.js). Usado pela tela de
// postagem e pelo Cut Studio Pro (Modelos → ⚡ Pedidos automáticos).
// need = quantos arquivos cada dica pede: {img:[mín,máx], vid:[mín,máx]}.
window.PEDIDOS_AUTOMATICOS = [
  {
    need: { img: [1, 1], vid: [0, 0] },
    when: '📷 1º — Selecione uma imagem, sem escrever nada',
    steps: [
      'Eu leio a imagem: produto, textos escritos e ambiente.',
      'Escrevo uma descrição diferente pra cada rede social, com hashtags.',
      'Posto no Post do Instagram, no Post do Facebook e no Post do TikTok, com a música que o próprio TikTok escolhe automaticamente.',
      'Mostro tudo aqui embaixo, na aprovação. Só depois que você aprovar eu publico nas redes que você deixou marcadas. Imagem não vai pra Reels, porque Reels é só pra vídeo.',
    ],
    how: 'Como fazer: anexe a imagem e toque em "Publicar agora".',
  },
  {
    id: '1.1',
    need: { img: [1, 1], vid: [0, 0] },
    when: '📷✨ 1.1 — Selecione uma imagem, sem escrever nada, e ganhe um banner',
    steps: [
      'Igualzinho à dica 1, só que em vez de postar direto eu crio um banner.',
      'Eu leio a imagem: produto, textos escritos e ambiente.',
      'Crio um banner novo a partir dessa imagem.',
      'Escrevo uma descrição diferente pra cada rede social, com hashtags.',
      'Posto as duas, a sua imagem original e o banner novo, no Post do Instagram, do Facebook e do TikTok, só nas redes que você deixou marcadas, depois que você aprovar.',
    ],
    how: 'Como fazer: marque esta dica, anexe 1 imagem e toque em "Publicar agora".',
  },
  {
    // Franklin, 2026-10-19: o "vídeo barato" (sem o movimento pago) a
    // partir de uma foto só — ver autoVideo em lib/auto-generate.js.
    id: '1.2',
    need: { img: [1, 1], vid: [0, 0] },
    when: '📷🎬 1.2 — Selecione uma foto ou um banner, sem escrever nada, e ganhe um vídeo',
    steps: [
      'Eu leio a sua foto ou banner: produto, textos escritos e ambiente.',
      'Crio um banner novo a partir dela e escrevo a narração do vídeo.',
      'Monto um vídeo do tamanho da narração (até 90 segundos), com zoom, close no produto, transições, narração e música.',
      'A cada 8 segundos entra uma imagem diferente: primeiro a sua foto e o banner, e só o que faltar eu crio de novo, pra sair mais barato.',
      'Sem vídeo em movimento: esse vídeo não gasta o movimento do seu plano.',
      'Mostro tudo na aprovação e, depois que você aprovar, posto a sua foto, o banner e o vídeo nas redes marcadas, cada rede com uma descrição diferente.',
    ],
    how: 'Como fazer: marque esta dica, anexe 1 foto ou banner e toque em "Publicar agora".',
  },
  {
    need: { img: [0, 0], vid: [1, 1] },
    when: '🎬 2º — Selecione um vídeo, sem escrever nada',
    steps: [
      'Eu leio o vídeo: o que aparece, o que é falado e o que está escrito na tela.',
      'Monto descrições variadas, uma diferente pra cada rede. Nunca repito a mesma descrição em duas redes.',
      'Posto o vídeo como Reels no Instagram, vídeo no Facebook e vídeo no TikTok (e nos Stories, se estiver marcado).',
      'Mostro tudo na aprovação e só publico nas redes marcadas depois que você aprovar.',
    ],
    how: 'Como fazer: anexe o vídeo e toque em "Publicar agora".',
  },
  {
    need: { img: [1, 1], vid: [1, 1] },
    when: '🎬📷 3º — Selecione um vídeo + uma imagem, sem escrever nada',
    steps: [
      'Eu leio o vídeo e a imagem.',
      'Crio um banner novo a partir da imagem e um vídeo com esse banner, com narração e música escolhidas automaticamente.',
      'Mantenho o seu vídeo e a sua imagem originais, junto com o banner e o vídeo novos.',
      'Posto tudo em todas as redes marcadas: os 2 vídeos (o seu e o do banner) e as 2 imagens (a sua e o banner), cada rede com uma descrição diferente.',
      'No TikTok entram os 2 vídeos e também as fotos (com a música do TikTok).',
      'E ainda monto um carrossel com as imagens (a sua + o banner) no Instagram e no Facebook.',
    ],
    how: 'Como fazer: anexe 1 vídeo e 1 imagem e toque em "Publicar agora".',
  },
  {
    need: { img: [2, 2], vid: [1, 1] },
    when: '🎬📷📷 4º — Selecione um vídeo + duas imagens, sem escrever nada',
    steps: [
      'Igualzinho à dica 3, só que com uma imagem a mais.',
      'Eu leio o vídeo e as duas imagens.',
      'Crio um banner a partir da 1ª imagem e um vídeo a partir de outro banner, com visual diferente, feito da 2ª imagem, pra não ficarem iguais. Narração e música automáticas.',
      'Posto tudo em todas as redes marcadas: os 2 vídeos (o seu e o do banner), as suas 2 imagens e o banner, cada rede com uma descrição diferente.',
      'No TikTok entram os 2 vídeos e também as fotos (com a música do TikTok).',
      'E ainda monto um carrossel com as imagens (as suas 2 + o banner) no Instagram e no Facebook.',
    ],
    how: 'Como fazer: anexe 1 vídeo e 2 imagens e toque em "Publicar agora".',
  },
  {
    need: { img: [2, 5], vid: [0, 0] },
    when: '🖼️ 5º — Carrossel: selecione de 2 a 5 imagens, sem escrever nada',
    steps: [
      'Eu leio cada imagem pra tirar as ideias.',
      'Crio um banner diferente pra cada imagem: 3 imagens, 3 banners; 5 imagens, 5 banners.',
      'Monto o carrossel com as suas imagens e os banners.',
      'Crio um vídeo passando todos os slides alternados (sua imagem, banner, sua imagem, banner...) com transições e efeitos, narração e música automáticas.',
      'Esse vídeo vira Reels em todas as redes marcadas, cada uma com uma descrição diferente.',
    ],
    how: 'Como fazer: anexe de 2 a 5 imagens e toque em "Publicar agora".',
  },
];
