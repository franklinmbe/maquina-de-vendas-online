// Recursos de verdade que cada plano já inclui hoje — usado em "Ajustes >
// O que você tem disponível", pra cliente ver o que já pode usar (às vezes
// sem saber). Lista curta e honesta: só o que está implementado e
// funcionando, nunca um benefício anunciado mas ainda não construído.
// Diferente do catálogo de agentes (lib/agentes-catalogo.js), que é a
// vitrine completa do time de IA usada na página de Planos — aqui é só o
// recorte que já é real por trás de cada plano.

const RECURSOS = {
  'geracao-ia': {
    nome: 'Gerador de Imagens e Vídeos por IA',
    emoji: '🎨',
    desc: 'Cria banners, fotos e vídeos (slideshow narrado, com a voz e a música que você escolher) a partir do seu pedido — sem precisar contratar designer.',
  },
  'suporte-ia': {
    nome: 'Suporte por IA na caixa de pedido',
    emoji: '💬',
    desc: 'Tira dúvida sobre sua conta, seu plano ou upgrade, na mesma caixa onde você pede conteúdo.',
  },
  'relatorio-desempenho': {
    nome: 'Relatório de desempenho das redes',
    emoji: '📊',
    desc: 'Mostra alcance, engajamento e crescimento reais das redes conectadas via Meta, atualizado toda vez que você abre.',
  },
  agendamento: {
    nome: 'Agendamento de posts',
    emoji: '🗓️',
    desc: 'Programa suas postagens pra saírem sozinhas no dia e horário certo.',
  },
  'gestor-trafego': {
    nome: 'Gestor de Tráfego (Meta Ads)',
    emoji: '📈',
    desc: 'Um especialista em anúncios pagos acompanha o desempenho da campanha e decide quando trocar o criativo de um anúncio parado.',
  },
  'clone-digital': {
    nome: 'Clone Digital em Vídeo',
    emoji: '🧬',
    desc: 'Clona seu rosto e voz pra gerar vídeos realistas com você falando, sem precisar gravar de novo toda semana.',
  },
  'multi-conta': {
    nome: 'Múltiplas contas da mesma rede social',
    emoji: '🔗',
    desc: 'Conecta mais de uma conta da mesma plataforma (ex: 2 perfis de TikTok).',
  },
  'time-agentes': {
    nome: 'Time completo de agentes especialistas de IA',
    emoji: '🧑‍💻',
    desc: 'Projeto sob medida com o time inteiro de especialistas (produto, design, engenharia, dados) — veja a vitrine completa na página de Planos.',
  },
};

// Cada plano lista as chaves de RECURSOS que já tem de verdade hoje.
const PLANO_RECURSOS = {
  teste7dias: ['geracao-ia', 'suporte-ia', 'relatorio-desempenho', 'agendamento'],
  iniciante: ['geracao-ia', 'suporte-ia', 'relatorio-desempenho'],
  profissional: ['geracao-ia', 'suporte-ia', 'relatorio-desempenho', 'agendamento'],
  especialista: ['geracao-ia', 'suporte-ia', 'relatorio-desempenho', 'agendamento', 'gestor-trafego'],
  personalizado: ['geracao-ia', 'suporte-ia', 'relatorio-desempenho', 'agendamento', 'gestor-trafego', 'clone-digital', 'multi-conta', 'time-agentes'],
  'aplicativo-saas': ['time-agentes', 'suporte-ia'],
};

function getRecursosDoPlano(plan) {
  const chaves = PLANO_RECURSOS[plan] || [];
  return chaves.map((chave) => ({ id: chave, ...RECURSOS[chave] }));
}

// Admin (frank) não é um "plano" — ele pode tudo, então vê a união de todos
// os recursos que existem, não um subconjunto.
function getTodosRecursos() {
  return Object.keys(RECURSOS).map((chave) => ({ id: chave, ...RECURSOS[chave] }));
}

module.exports = { getRecursosDoPlano, getTodosRecursos, PLANO_RECURSOS };
