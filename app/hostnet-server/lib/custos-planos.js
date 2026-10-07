// Custo por plano (Franklin, 2026-10-07): quanto cada plano gasta de IA no
// mês se o cliente usar a cota inteira, item por item, mais os custos fixos
// do app. Mostrado em Fluxos operacionais (seção "Custos dos planos"). As
// cotas vêm do código (media-quota, call-limit), então o custo acompanha
// qualquer mudança de cota. Os valores unitários são aproximados (dólar
// convertido) — atualizar aqui se o preço de algum serviço mudar.
const { PLAN_MEDIA_LIMITS, PLAN_MOTION_LIMITS, TRIAL_MEDIA_LIMITS } = require('./media-quota');
const { PLAN_CALL_LIMITS } = require('./call-limit');
const { PLAN_PRICES } = require('./faturamento');
const { RECORRENTES_MENSAIS } = require('./custos-operacao');

// Custo médio e máximo de cada coisa que a IA faz, em reais.
const UNITARIOS = [
  {
    id: 'imagem',
    nome: '🖼️ Imagem / banner criado pela IA',
    medio: 0.2,
    maximo: 0.2,
    explica: 'Cada banner ou imagem nova que a IA desenha (Nano Banana, do Google). Foto que o cliente manda e é só publicada não custa nada.',
  },
  {
    id: 'video-comum',
    nome: '🎞️ Vídeo comum (sem movimento)',
    medio: 1.2,
    maximo: 3,
    explica: 'Vídeo montado com as fotos e banners do pedido passando, com zoom, transições, narração e música. Custo real medido ≈ R$ 1,20 (voz + texto + 1 a 3 banners); R$ 3,00 é o valor de referência com margem de segurança que você definiu pra orçamento.',
  },
  {
    id: 'video-movimento',
    nome: '🎬 Vídeo em movimento (longo)',
    medio: 3.3,
    maximo: 4.3,
    explica: 'Abre com 8 s de efeito em movimento real (Veo, do Google, R$ 2,20) e continua com o material do cliente trocando a cada 8 s, com narração e música, até 90 s. Média: vídeo de 60 s com 7 imagens, cliente mandou 2 e a IA cria 5 banners (R$ 1,00) + voz (R$ 0,10). Máximo: 90 s com só 1 imagem do cliente (10 banners).',
  },
  {
    id: 'chamada',
    nome: '💬 Textos e conversas com a IA',
    medio: 0.02,
    maximo: 0.03,
    explica: 'Cada pedido ou pergunta passa pela IA de texto: planejar o pedido, ler fotos e vídeos, escrever a descrição de cada rede, conversar no chat. Muito barato — conta pelo limite de chamadas por dia do plano.',
  },
  {
    id: 'publicacao',
    nome: '📤 Publicar nas redes',
    medio: 0,
    maximo: 0,
    explica: 'Publicar no Facebook, Instagram, YouTube e Telegram não custa nada (vai direto pela API de cada rede). TikTok sai pela Postiz, que é custo fixo (abaixo).',
  },
];

const NOMES = { teste7dias: 'Teste Grátis 7 Dias', iniciante: 'Iniciante', profissional: 'Profissional', especialista: 'Especialista' };
const unit = Object.fromEntries(UNITARIOS.map((u) => [u.id, u]));
const r2 = (v) => Math.round(v * 100) / 100;

function custoPlano(plano) {
  const trial = plano === 'teste7dias';
  const media = trial ? TRIAL_MEDIA_LIMITS : PLAN_MEDIA_LIMITS[plano];
  const movimento = trial ? TRIAL_MEDIA_LIMITS.videos : PLAN_MOTION_LIMITS[plano] || 0;
  const comuns = Math.max(0, media.videos - movimento);
  const chamadas = (PLAN_CALL_LIMITS[plano] || 0) * 3 * (trial ? 7 : 30);
  const itens = [
    { item: unit.imagem.nome, qtd: `${media.images} imagens`, medio: media.images * unit.imagem.medio, maximo: media.images * unit.imagem.maximo },
    { item: unit['video-movimento'].nome, qtd: `${movimento} vídeos`, medio: movimento * unit['video-movimento'].medio, maximo: movimento * unit['video-movimento'].maximo },
    { item: unit['video-comum'].nome, qtd: `${comuns} vídeos`, medio: comuns * unit['video-comum'].medio, maximo: comuns * unit['video-comum'].maximo },
    { item: unit.chamada.nome, qtd: `até ${chamadas} chamadas`, medio: chamadas * unit.chamada.medio, maximo: chamadas * unit.chamada.maximo },
  ].map((i) => ({ ...i, medio: r2(i.medio), maximo: r2(i.maximo) }));
  const medio = r2(itens.reduce((s, i) => s + i.medio, 0));
  const maximo = r2(itens.reduce((s, i) => s + i.maximo, 0));
  const preco = PLAN_PRICES[plano] || 0;
  return {
    plano: NOMES[plano],
    preco,
    periodo: trial ? 'nos 7 dias' : 'por mês',
    itens,
    medio,
    maximo,
    sobraMedio: preco ? r2(preco - medio) : null,
    sobraMaximo: preco ? r2(preco - maximo) : null,
  };
}

// Custos fixos do app (pagos uma vez por mês, valem pra todos os clientes
// juntos), lidos do Extrato da operação.
const FIXOS_IDS = ['hostinger-vps', 'postiz', 'hostnet', 'claude'];

function buildCustosPlanos() {
  const fixos = RECORRENTES_MENSAIS.filter((c) => FIXOS_IDS.includes(c.id)).map((c) => ({
    nome: c.nome,
    valor: c.moeda === 'BRL' ? c.valor : c.valorAproxBRL,
    aprox: c.moeda !== 'BRL',
    explica: c.oQueE,
  }));
  return {
    unitarios: UNITARIOS,
    planos: ['iniciante', 'profissional', 'especialista', 'teste7dias'].map(custoPlano),
    fixos,
    fixosTotal: r2(fixos.reduce((s, f) => s + (f.valor || 0), 0)),
  };
}

module.exports = { buildCustosPlanos, UNITARIOS };
