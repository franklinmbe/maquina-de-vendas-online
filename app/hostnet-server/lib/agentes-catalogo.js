// Vitrine do time de agentes especialistas de IA usado no projeto — mostrada
// na página de Planos, embaixo do card "Aplicativos ou SaaS" (pra qualquer
// visitante, sem login) e reaproveitada em Ajustes. `instalado: true` = já
// registrado e em uso neste projeto hoje; `instalado: false` = existe no
// pacote open-source (agency-agents, MIT) e entra sob encomenda quando um
// projeto sob medida (Personalizado / Aplicativos ou SaaS) precisar dele.
// Manter esta lista atualizada é o único lugar que precisa mudar quando um
// agente novo for instalado — a contagem "instalados hoje" é calculada, não
// hardcoded, então nunca fica desatualizada sozinha.

const CATALOGO = [
  {
    area: 'Marketing e Redes Sociais',
    cor: '#ff5a36',
    itens: [
      { nome: 'Content Creator', emoji: '✍️', desc: 'Calendário editorial, copy e narrativa de marca pra campanha multi-plataforma.', instalado: true },
      { nome: 'Instagram Curator', emoji: '📸', desc: 'Estética de grid, Stories, Reels e crescimento de comunidade no Instagram.', instalado: true },
      { nome: 'TikTok Strategist', emoji: '🎵', desc: 'Conteúdo viral e domínio do algoritmo do TikTok.', instalado: true },
      { nome: 'Social Media Strategist', emoji: '📣', desc: 'Campanha cross-platform e construção de autoridade (LinkedIn, X).', instalado: true },
      { nome: 'LinkedIn Content Creator', emoji: '💼', desc: 'Thought leadership e marca pessoal no LinkedIn.', instalado: true },
      { nome: 'Video Optimization Specialist', emoji: '🎬', desc: 'Otimização de algoritmo e retenção de audiência no YouTube.', instalado: true },
      { nome: 'Short-Video Editing Coach', emoji: '🎞️', desc: 'Edição profissional de vídeo curto — corte, cor, áudio, legenda.', instalado: true },
      { nome: 'Carousel Growth Engine', emoji: '🎠', desc: 'Gera e publica carrossel viral pra TikTok/Instagram a partir de um site.', instalado: true },
      { nome: 'Livestream Commerce Coach', emoji: '🛍️', desc: 'Treina apresentador e operação de venda ao vivo.', instalado: true },
      { nome: 'Book Co-Author', emoji: '📘', desc: 'Transforma nota de voz e ideia solta em capítulo de livro de autoridade.', instalado: true },
      { nome: 'App Store Optimizer', emoji: '📱', desc: 'Ficha, conversão e capacidade de descoberta na loja de app.', instalado: true },
      { nome: 'Cross-Border E-Commerce Specialist', emoji: '🌏', desc: 'Operação em marketplace internacional (Amazon, Shopee, TikTok Shop).', instalado: true },
      { nome: 'AI Citation Strategist', emoji: '🔮', desc: 'Otimiza a marca pra ser citada por ChatGPT, Claude, Gemini e Perplexity.', instalado: true },
      { nome: 'Growth Hacker', emoji: '🚀', desc: 'Experimentação rápida pra achar o canal de crescimento que escala.', instalado: false },
      { nome: 'SEO Specialist', emoji: '🔍', desc: 'SEO técnico, conteúdo e autoridade de link pra tráfego orgânico.', instalado: false },
      { nome: 'Email Marketing Strategist', emoji: '📧', desc: 'Sequência de e-mail automatizada — boas-vindas, nutrição, recuperação.', instalado: false },
      { nome: 'PR & Communications Manager', emoji: '📰', desc: 'Assessoria de imprensa, gestão de crise e reputação de marca.', instalado: false },
      { nome: 'Reddit Community Builder', emoji: '💬', desc: 'Engajamento autêntico e construção de comunidade no Reddit.', instalado: false },
      { nome: 'Twitter/X Engager', emoji: '🐦', desc: 'Thought leadership e engajamento em tempo real no X.', instalado: false },
      { nome: 'Global Podcast Strategist', emoji: '🎙️', desc: 'Posicionamento e crescimento de podcast (Spotify, Apple, YouTube).', instalado: false },
    ],
  },
  {
    area: 'Tráfego Pago',
    cor: '#ffc400',
    itens: [
      { nome: 'Paid Social Strategist (Gestor de Tráfego)', emoji: '📈', desc: 'Decide estratégia de anúncio no Meta/TikTok/LinkedIn — o especialista por trás do Gestor de Tráfego do plano Especialista.', instalado: true },
      { nome: 'Ad Creative Strategist', emoji: '🖼️', desc: 'Copy e criativo de anúncio testável, com framework de teste A/B.', instalado: true },
      { nome: 'PPC Campaign Strategist', emoji: '💰', desc: 'Arquitetura de campanha de busca/shopping em grande escala.', instalado: true },
      { nome: 'Paid Media Auditor', emoji: '🧾', desc: 'Auditoria de conta de anúncio em 200+ pontos de checagem.', instalado: true },
      { nome: 'Tracking & Measurement Specialist', emoji: '📡', desc: 'Garante que toda conversão de anúncio seja contada certo.', instalado: true },
      { nome: 'Offer & Lead Gen Strategist', emoji: '🧲', desc: 'Desenha a oferta e a isca digital que atrai comprador qualificado.', instalado: true },
    ],
  },
  {
    area: 'Geração de Conteúdo por IA',
    cor: '#4d9eff',
    itens: [
      { nome: 'Gerador de Imagens e Vídeo (Nano Banana + Gemini)', emoji: '🎨', desc: 'Cria banner, foto e vídeo narrado a partir do seu pedido, sem contratar designer.', instalado: true },
      { nome: 'Clone Digital em Vídeo (HeyGen)', emoji: '🧬', desc: 'Clona seu rosto e voz pra gerar vídeo realista com você falando — exclusivo do Personalizado.', instalado: true },
      { nome: 'Image Prompt Engineer', emoji: '📷', desc: 'Escreve o prompt certo pra produzir fotografia de IA de qualidade profissional.', instalado: true },
      { nome: 'Inclusive Visuals Specialist', emoji: '🌈', desc: 'Garante imagem/vídeo culturalmente precisos e sem estereótipo.', instalado: true },
      { nome: 'Visual Storyteller', emoji: '🎬', desc: 'Transforma informação complexa em narrativa visual envolvente.', instalado: true },
      { nome: 'Whimsy Injector', emoji: '✨', desc: 'Adiciona personalidade e momentos de encanto na experiência de marca.', instalado: true },
      { nome: 'Voice AI Integration Engineer', emoji: '🎙️', desc: 'Pipeline de narração/transcrição por voz (usado no slideshow narrado).', instalado: true },
    ],
  },
  {
    area: 'Design',
    cor: '#ec4899',
    itens: [
      { nome: 'Brand Guardian', emoji: '🛡️', desc: 'Protege e evolui a identidade visual da marca com consistência.', instalado: true },
      { nome: 'UI Designer', emoji: '🎨', desc: 'Sistema de design e interface pixel-perfect, bonita e acessível.', instalado: true },
      { nome: 'Persona Walkthrough Specialist', emoji: '🎭', desc: 'Simula a reação de um cliente-tipo navegando pela sua página.', instalado: true },
      { nome: 'UX Researcher', emoji: '🔬', desc: 'Valida decisão de design com dado real de usuário.', instalado: false },
      { nome: 'UX Architect', emoji: '📐', desc: 'Fundação técnica e sistema de CSS pra implementação de interface.', instalado: false },
    ],
  },
  {
    area: 'Vendas',
    cor: '#10b981',
    itens: [
      { nome: 'Support Responder', emoji: '💬', desc: 'Atendimento e resolução de dúvida — o motor do Suporte por IA do app.', instalado: true },
      { nome: 'Sales Coach', emoji: '🏋️', desc: 'Treina time de venda em ligação, negociação e fechamento.', instalado: false },
      { nome: 'Outbound Strategist', emoji: '🎯', desc: 'Prospecção multi-canal orientada a sinal de compra.', instalado: false },
      { nome: 'Proposal Strategist', emoji: '🏹', desc: 'Transforma proposta comercial numa narrativa que convence.', instalado: false },
      { nome: 'Account Strategist', emoji: '🗺️', desc: 'Mapeia oportunidade de expansão dentro de uma conta já cliente.', instalado: false },
      { nome: 'Sales Engineer', emoji: '🛠️', desc: 'Demonstração técnica e prova de conceito pra fechar negócio.', instalado: false },
      { nome: 'Pipeline Analyst', emoji: '📊', desc: 'Diagnóstico de saúde do funil de vendas e previsão de fechamento.', instalado: false },
      { nome: 'Discovery Coach', emoji: '🔎', desc: 'Metodologia de pergunta que revela a real motivação de compra.', instalado: false },
    ],
  },
  {
    area: 'Financeiro e Administrativo',
    cor: '#22c55e',
    itens: [
      { nome: 'Analytics Reporter', emoji: '📊', desc: 'Transforma dado bruto em dashboard e insight — base do Relatório administrativo.', instalado: true },
      { nome: 'Finance Tracker', emoji: '💰', desc: 'Planejamento financeiro, orçamento e fluxo de caixa do negócio.', instalado: true },
      { nome: 'Financial Analyst', emoji: '📈', desc: 'Modelagem financeira e análise de cenário pra decisão de investimento.', instalado: true },
      { nome: 'FP&A Analyst', emoji: '📋', desc: 'Orçamento, forecast e análise de variação.', instalado: true },
      { nome: 'Bookkeeper & Controller', emoji: '📒', desc: 'Conciliação contábil e fechamento de mês.', instalado: true },
      { nome: 'Tax Strategist', emoji: '🏛️', desc: 'Otimização e compliance tributário multi-jurisdição.', instalado: true },
      { nome: 'Legal Compliance Checker', emoji: '⚖️', desc: 'Garante que operação e conteúdo cumpram lei e regulação (LGPD).', instalado: true },
      { nome: 'Executive Summary Generator', emoji: '📝', desc: 'Resumo executivo no padrão de consultoria (McKinsey/BCG).', instalado: true },
      { nome: 'Infrastructure Maintainer', emoji: '🏢', desc: 'Confiabilidade, custo e segurança da infraestrutura do servidor.', instalado: true },
    ],
  },
  {
    area: 'Desenvolvimento de App e SaaS',
    cor: '#8b7cf6',
    itens: [
      { nome: 'Mobile App Builder', emoji: '📲', desc: 'Desenvolve app nativo iOS/Android ou cross-platform.', instalado: true },
      { nome: 'Mobile Release Engineer', emoji: '🚀', desc: 'Publicação e rollout seguro na App Store e Play Store.', instalado: true },
      { nome: 'CMS Developer', emoji: '🧱', desc: 'WordPress/Drupal sob medida — tema, plugin, arquitetura de conteúdo.', instalado: true },
      { nome: 'WordPress Performance Engineer', emoji: '⚡', desc: 'Velocidade e Core Web Vitals de site WordPress.', instalado: true },
      { nome: 'WordPress Shopping Cart Engineer', emoji: '🛒', desc: 'Loja WooCommerce — catálogo, pagamento, checkout.', instalado: true },
      { nome: 'Payments & Billing Engineer', emoji: '💳', desc: 'Integração de pagamento, assinatura recorrente e cobrança.', instalado: true },
      { nome: 'Multi-Agent Systems Architect', emoji: '🕸️', desc: 'Arquitetura de vários agentes de IA trabalhando juntos com segurança.', instalado: true },
      { nome: 'Video Streaming Engineer', emoji: '📡', desc: 'Entrega de vídeo em streaming adaptativo (HLS/DASH).', instalado: true },
      { nome: 'WeChat Mini Program Developer', emoji: '🇨🇳', desc: 'Mini-programa dentro do WeChat, com pagamento integrado.', instalado: true },
      { nome: 'Product Manager', emoji: '🧭', desc: 'Lidera o ciclo de vida do produto — do discovery ao roadmap.', instalado: false },
      { nome: 'Trend Researcher', emoji: '🔭', desc: 'Identifica tendência emergente e oportunidade de mercado.', instalado: false },
      { nome: 'Feedback Synthesizer', emoji: '🔍', desc: 'Sintetiza feedback de usuário em prioridade de produto.', instalado: false },
      { nome: 'Project Shepherd', emoji: '🐑', desc: 'Coordenação de projeto e alinhamento entre times.', instalado: false },
      { nome: 'Senior Project Manager', emoji: '📝', desc: 'Converte especificação em tarefa com escopo realista.', instalado: false },
      { nome: 'AI Engineer', emoji: '🤖', desc: 'Desenvolve e integra modelo de IA em sistema de produção.', instalado: false },
      { nome: 'AI Data Remediation Engineer', emoji: '🧬', desc: 'Detecta e corrige anomalia de dado em pipeline automatizado.', instalado: false },
      { nome: 'API Platform Engineer', emoji: '🔌', desc: 'Desenho de API pública/parceira, versionamento e SDK.', instalado: false },
    ],
  },
];

function contarTotais() {
  let total = 0;
  let instalados = 0;
  for (const grupo of CATALOGO) {
    for (const item of grupo.itens) {
      total += 1;
      if (item.instalado) instalados += 1;
    }
  }
  return { total, instalados };
}

module.exports = { CATALOGO, contarTotais };
