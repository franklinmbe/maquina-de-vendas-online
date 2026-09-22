// Regras de conteúdo por cliente — hoje só a Rjinox (2026-09-21, Franklin):
// o conteúdo publicado é SÓ da empresa. Nenhum banner, foto, vídeo, legenda ou
// narração pode trazer o nome nem o telefone de um vendedor, nem mostrar um
// vendedor. O telefone e o nome continuam existindo no sistema (login, log de
// publicações, campanha de clique-para-WhatsApp) — só não podem aparecer pro
// público no conteúdo em si. Documentado em .claude/skills/rjinox-log/PROTOCOLO.md.
//
// 2026-09-22 (Franklin): segunda regra de marca — banner/imagem/vídeo gerado
// pra Rjinox só pode usar preto, cinza, vermelho e branco (identidade visual
// da marca). Só afeta o que a IA GERA (banner e o slide que vira o vídeo
// "slideshow narrado") — não dá pra "corrigir" cor numa foto/vídeo real que o
// cliente já mandou pronto, então essa regra é só instrução de prompt (como
// nome/telefone, camadas 1 e 2 abaixo; não tem uma camada 3 de sanitização
// pra cor porque não existe como "limpar" cor de uma imagem já gerada — só
// prevenção no prompt).
//
// Vale pras 4 contas de vendedor (eduardo-, jaqueline-, aline-, alessandra-
// rjinox). Três camadas, porque só instruir a IA não garante nada:
//  1. promptRulesFor  → linhas pro planejador (lib/gemini.js) já escrever certo;
//  2. applyClientContentRules → reforço fixo nos prompts de banner + limpeza
//     de legenda/narração depois do plano (não depende da IA obedecer);
//  3. sanitizeClientText → rede de proteção na legenda final, na hora de
//     publicar (lib/auto-publish.js).
// E lib/media-text-detection.js lê o texto das mídias (imagem/vídeo) e usa
// findVendorIdentifiers daqui pra barrar o que tiver nome/telefone.

// Telefones dos 4 vendedores (só dígitos, com DDD) — ver rjinox-log/PROTOCOLO.md.
// Serve pra rede de proteção por dígitos: pega o número mesmo escrito sem DDD
// ("99472-2099") ou com separadores esquisitos, comparando os 8 últimos dígitos.
const VENDOR_PHONES = ['21964377401', '21994722099', '21993073039', '21980316365'];
const VENDOR_LAST8 = new Set(VENDOR_PHONES.map((p) => p.slice(-8)));

// Nomes e apelidos dos vendedores. Comparação sem diferenciar maiúscula, e só
// como palavra inteira (letra colada não conta — "Alessandra" não casa dentro
// de outra palavra). "_", ".", dígitos e "@"/"#" separam, então "eduardo_rjinox"
// e "@dudu.rjinox" são pegos. Plural simples ("Dudus", "Jacks") também.
const LETTER = 'A-Za-zÀ-ÖØ-öø-ÿ';
const NAME_LONG = ['eduardo', 'dudu', 'jaqueline', 'jacqueline', 'aline', 'alessandra'];
const NAME_SHORT = ['edu', 'jaque', 'jack', 'ale', 'alê'];
const NAME_ALT = [...NAME_LONG, ...NAME_SHORT].join('|');
const NAME_RE = new RegExp(`(?<![${LETTER}])(?:${NAME_ALT})s?(?![${LETTER}])`, 'gi');

// Hashtag/@ que carrega um nome (ex: "#FaleComEduardo", "@dudu_rjinox",
// "#JackRjinox"): remove o token inteiro. Nomes longos valem em qualquer parte
// do token; os curtos só como palavra (pra não pegar "#sale", "#vale").
const HANDLE_RE = /[#@][^\s#@]+/g;
const NAME_LONG_INSIDE_RE = new RegExp(NAME_LONG.join('|'), 'i');
function handleCarriesName(token) {
  return NAME_LONG_INSIDE_RE.test(token) || new RegExp(`(?<![${LETTER}])(?:${NAME_SHORT.join('|')})s?(?![${LETTER}])`, 'i').test(token);
}

// Separador de telefone: espaço, ponto, hífen e os hifens unicode.
const SEP = '[\\s.\\-\\u2010-\\u2015]';
// Telefone brasileiro com DDD, em qualquer formatação: (21) 96437-7401,
// 21 9 6437 7401, 21964377401, +55 21 96437-7401, 021 96437-7401, fixo de 8
// dígitos. Exige DDD + 8 ou 9 dígitos, então não pega faixa de ano
// ("2024-2025"), preço ("R$ 1.234,56") nem CEP. Os lookbehinds impedem pegar
// só o pedaço final de um número maior, mas deixam passar "Tel.2198..." e
// "WhatsApp,2198...".
const PHONE_RE = new RegExp(
  `(?<!\\d)(?<!(?<!\\d)\\d{1,3}[.,])(?:\\+?55${SEP}?)?0?(?:\\(\\s*\\d{2}\\s*\\)|\\d{2})${SEP}?(?:9${SEP}?)?\\d{4}${SEP}?\\d{4}(?!\\d)`,
  'g'
);
// Rede por dígitos: qualquer sequência de dígitos/separadores cujos 8 últimos
// dígitos batam com um dos telefones dos vendedores (pega sem DDD).
const DIGIT_RUN_RE = new RegExp(`(?<!\\d)[+(]?\\d(?:[\\d\\s().\\-\\u2010-\\u2015]{6,}\\d)(?!\\d)`, 'g');

function isVendorDigitRun(run) {
  const digits = run.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 && VENDOR_LAST8.has(digits.slice(-8));
}

function matchPhones(text) {
  const found = (text.match(PHONE_RE) || []).map((s) => s.trim());
  for (const run of text.match(DIGIT_RUN_RE) || []) {
    if (isVendorDigitRun(run)) found.push(run.trim());
  }
  // O mesmo número costuma ser pego pelas duas regras — conta uma vez só.
  const seen = new Set();
  return found.filter((s) => {
    const key = s.replace(/\D/g, '').slice(-8);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRjinoxClient(client) {
  return /-rjinox$/.test(String(client || ''));
}

const INTRO_RE = new RegExp(
  `\\b(?:aqui\\s+[ée]|sou|meu\\s+nome\\s+[ée]|me\\s+chamo)\\s+(?:o\\s+|a\\s+)?(?:${NAME_ALT})s?(?![${LETTER}])[,.!:;]?\\s*`,
  'gi'
);
const WITH_NAME_RE = new RegExp(`\\bcom\\s+(?:o\\s+|a\\s+)?(?:${NAME_ALT})s?(?![${LETTER}])`, 'gi');

function scrub(text) {
  return String(text)
    // hashtags/@ com nome de vendedor: some o token inteiro
    .replace(HANDLE_RE, (token) => (handleCarriesName(token) ? '' : token))
    // "Aqui é a Jaqueline" / "Sou o Eduardo": some a apresentação inteira
    .replace(INTRO_RE, '')
    // "Fale com o Dudu" → "Fale com nosso time" (mantém a frase inteira)
    .replace(WITH_NAME_RE, 'com nosso time')
    // telefone (regex principal, depois a rede por dígitos)
    .replace(PHONE_RE, '')
    .replace(DIGIT_RUN_RE, (run) => (isVendorDigitRun(run) ? '' : run))
    // qualquer nome que sobrou
    .replace(NAME_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.!?;:])/g, '$1')
    .replace(/([,;:])\s*([.!?])/g, '$2')
    .replace(/[,;:]\s*,/g, ',')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

// Limpa um texto (legenda, narração) de nome/telefone de vendedor. Devolve o
// texto original quando o cliente não tem regra. Só mexe se achar algo.
function sanitizeClientText(client, text) {
  if (!isRjinoxClient(client) || typeof text !== 'string' || !text) return text;
  const cleaned = scrub(text);
  if (cleaned !== text.trim()) {
    console.warn(`[client-content-rules] ${client}: removido nome/telefone de vendedor de um texto (${text.length} → ${cleaned.length} caracteres)`);
  }
  return cleaned;
}

// Acha nome/telefone de vendedor num texto lido de uma mídia (OCR de imagem,
// fala/texto de tela de vídeo). Não altera nada — quem chama decide o que fazer.
function findVendorIdentifiers(text) {
  const t = String(text || '');
  const phones = matchPhones(t);
  const names = [
    ...(t.match(NAME_RE) || []),
    ...((t.match(HANDLE_RE) || []).filter(handleCarriesName)),
  ];
  return { phones, names, found: phones.length > 0 || names.length > 0 };
}

// Linhas de regra pro planejador de conteúdo (lib/gemini.js).
function promptRulesFor(client) {
  if (!isRjinoxClient(client)) return [];
  return [
    `REGRAS FIXAS DESTE CLIENTE (Rjinox — obrigatórias, valem acima de qualquer pedido):`,
    `- O conteúdo é SÓ da empresa Rjinox. NUNCA escreva o nome de nenhum vendedor (Eduardo, Dudu, Jaqueline, Jack, Aline, Alessandra, Ale) nem nenhum número de telefone — nem na legenda, nem na narração, nem no texto que aparece nos banners/imagens/vídeo.`,
    `- NUNCA mostre nem represente nenhum vendedor/atendente/pessoa da equipe em banner, foto ou vídeo gerado. Foque no produto, na cozinha/equipamento e na marca da empresa.`,
    `- Se uma imagem anexada tiver um nome de vendedor ou telefone escrito, o banner gerado a partir dela deve remover isso.`,
    `- Chamada à ação só genérica, sem nome e sem número (ex: "Fale com nosso time!").`,
    `- Paleta de cores obrigatória: use SOMENTE preto, cinza, vermelho e branco em qualquer banner/imagem/vídeo gerado. Nenhuma outra cor (sem azul, verde, amarelo, laranja, roxo, etc.) — nem no fundo, nem em elementos gráficos, nem no texto escrito na arte.`,
  ];
}

// Reforço fixo anexado a todo prompt de banner desse cliente — o planejador
// costuma seguir as regras acima, mas isso não depende dele.
const BANNER_SUFFIX_RJINOX =
  '\n\nREGRAS FIXAS DA MARCA (obrigatórias): não escreva na imagem nenhum nome de pessoa/vendedor nem nenhum número de telefone; ' +
  'não inclua nenhuma pessoa apresentada como vendedor ou atendente (sem rosto nem foto de vendedor); ' +
  'a arte é só da empresa Rjinox e do produto. Se houver imagem de referência com nome ou telefone escrito, remova. ' +
  'Paleta de cores: use SOMENTE preto, cinza, vermelho e branco em toda a imagem (fundo, elementos gráficos, texto) — nenhuma outra cor, em nenhuma hipótese.';

// Aplica as regras ao plano gerado, ANTES de gerar banner/vídeo. Muta `plan` e
// `narracaoChoice`. Devolve a lista de campos que precisaram ser limpos (só
// pra log).
function applyClientContentRules({ client, plan, narracaoChoice }) {
  const touched = [];
  if (!isRjinoxClient(client) || !plan) return touched;

  for (const field of ['legenda', 'narrationText']) {
    if (typeof plan[field] === 'string') {
      const cleaned = sanitizeClientText(client, plan[field]);
      if (cleaned !== plan[field]) touched.push(`plan.${field}`);
      plan[field] = cleaned;
    }
  }
  if (narracaoChoice && typeof narracaoChoice.narrationText === 'string') {
    const cleaned = sanitizeClientText(client, narracaoChoice.narrationText);
    if (cleaned !== narracaoChoice.narrationText) touched.push('narracao.narrationText');
    narracaoChoice.narrationText = cleaned;
  }
  if (Array.isArray(plan.banners)) {
    for (const banner of plan.banners) {
      if (banner && typeof banner.prompt === 'string') {
        // Se a limpeza esvaziar o prompt (era só um nome/telefone), cai num
        // pedido genérico em vez de mandar prompt vazio pro gerador.
        const cleanedPrompt = sanitizeClientText(client, banner.prompt) || 'Banner publicitário da empresa Rjinox, cozinhas industriais.';
        banner.prompt = cleanedPrompt + BANNER_SUFFIX_RJINOX;
      }
    }
  }
  return touched;
}

module.exports = { isRjinoxClient, sanitizeClientText, findVendorIdentifiers, promptRulesFor, applyClientContentRules };
