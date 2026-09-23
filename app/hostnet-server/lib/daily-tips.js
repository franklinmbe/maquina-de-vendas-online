const fs = require('fs');
const path = require('path');
const { loadUsers } = require('./users');
const { buildUserPanel } = require('./painel-usuario');
const { addTips, loadTips, CATEGORIES } = require('./fluxo2-tips');
const { generateJson } = require('./gemini');

// Dicas do dia automáticas pra TODO usuário do app (pedido do Franklin,
// 2026-09-23): "quero que dê dicas todos os dias para todos os usuários do app
// com seu relatório, respectivas redes". Foco principal: mais pessoas
// interessadas chamando o vendedor/cliente no WhatsApp (lead = conversa
// iniciada). Roda 1x por dia (cron em server.js) e grava 3 dicas por cliente
// no mesmo lugar das dicas do Fluxo 2 (Ajustes → Meu fluxo de tráfego; o Meu
// painel avisa quando há dica nova). Idempotente: key `auto-<data>-<n>`, então
// rodar de novo no mesmo dia não duplica.
//
// As dicas só SUGEREM. Marcar a caixinha vira tarefa pra equipe; nada que
// mexa em anúncio ou verba acontece sem o OK do Franklin (needsApproval).

const CAMPANHAS_RJ = path.join(__dirname, 'relatorios', 'campanhas-rjinox.json');
const VENDOR_BY_CLIENT = { 'eduardo-rjinox': 'dudu', 'jaqueline-rjinox': 'jack', 'alessandra-rjinox': 'ale', 'aline-rjinox': 'aline' };

function todayInBrazil() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function rjinoxAdsContext(client) {
  const id = VENDOR_BY_CLIENT[client];
  if (!id) return null;
  try {
    const data = JSON.parse(fs.readFileSync(CAMPANHAS_RJ, 'utf-8'));
    const lines = [];
    for (const k of ['7', '30']) {
      const p = data.periodos[k];
      const mine = p.campanhas.filter((c) => c.vendedor === id);
      const conv = mine.reduce((s, c) => s + c.conversas, 0);
      const gasto = mine.reduce((s, c) => s + c.gasto, 0);
      lines.push(`${p.rotulo}: ${conv} conversas no WhatsApp, R$ ${(gasto / (conv || 1)).toFixed(2)} por conversa (média da equipe R$ ${p.total.custo.toFixed(2)}). Campanhas: ${mine.map((c) => `${c.curto} ${c.conversas} conversas a R$ ${c.custo.toFixed(2)}`).join('; ')}.`);
    }
    return `Anúncios no Meta (retrato de ${data.atualizadoEm}, lido do Gerenciador de Anúncios): ${lines.join(' ')} Regras da empresa: cada vendedor tem sempre 2 campanhas (Vendas e Engajamento) com 1 grupo de anúncios cada e a mesma verba; campanhas e grupos nunca são pausados, só anúncios são trocados.`;
  } catch {
    return null;
  }
}

function summarizePanel(panel) {
  const redes = panel.redes
    .filter((r) => r.conexao === 'direta' || r.conexao === 'equipe')
    .map((r) => `${r.nome}${r.detalhe ? ` (${r.detalhe})` : ''}${r.seguidores != null ? `, ${r.seguidores} seguidores` : ''}${r.metricas ? `, métricas: ${JSON.stringify(r.metricas)}` : ''}${r.topPosts && r.topPosts.length ? `, posts recentes com ${r.topPosts.slice(0, 3).map((p) => `${p.curtidas || 0} curtidas/${p.comentarios || 0} comentários`).join(', ')}` : ''}`);
  const u = panel.uso;
  return [
    `Plano: ${panel.plano.nome || panel.plano.id || 'não informado'}.`,
    `Redes conectadas: ${redes.length ? redes.join(' | ') : 'nenhuma ainda'}.`,
    panel.numbers.seguidores ? `Seguidores somados: ${panel.numbers.seguidores.valor}${panel.numbers.seguidores.delta7d != null ? ` (variação em 7 dias: ${panel.numbers.seguidores.delta7d})` : ''}.` : '',
    `Uso do app: ${u.pedidos.enviados} pedidos enviados (${u.pedidos.fotos} fotos, ${u.pedidos.videos} vídeos), último pedido em ${u.pedidos.ultimo || 'nunca'}; ${u.agendados} posts agendados.`,
    panel.meta.estado !== 'ok' ? 'Observação: as métricas detalhadas do Meta (alcance, visualizações) ainda não estão liberadas para o app; não invente números.' : '',
  ].filter(Boolean).join('\n');
}

function buildPrompt({ user, panelSummary, adsContext, date }) {
  const isRj = String(user.client || '').endsWith('-rjinox');
  return [
    `Você é o estrategista de marketing da "Máquina de Vendas Online", que ajuda pequenos negócios a vender mais pelas redes sociais.`,
    `Hoje é ${date}. Escreva 3 dicas práticas do dia para este usuário do app. OBJETIVO PRINCIPAL: fazer mais pessoas interessadas chamarem no WhatsApp (cada conversa iniciada é um lead).`,
    `Usuário: ${user.name || user.client}. ${isRj ? 'É vendedor(a) da RJ Inox (fábrica de móveis e equipamentos em aço inox para cozinha industrial, Rio de Janeiro). Regras da RJ Inox: o conteúdo é da empresa, nunca mostra telefone de vendedor; chamada sempre para o WhatsApp, nunca para site; cores preto/cinza/vermelho/branco; sem preço no criativo ("peça o preço de hoje no WhatsApp").' : ''}`,
    `Dados reais dele (use só estes, nunca invente número):\n${panelSummary}${adsContext ? `\n${adsContext}` : ''}`,
    `Regras das dicas:`,
    `- Cada dica é uma ação concreta que ele consegue fazer HOJE pelo app (mandar foto/vídeo real de produto, pedir banner ou Reels, usar um "pedido pronto", responder rápido quem chamar, legenda com convite claro para o WhatsApp, horário de postar, Stories com enquete etc.).`,
    `- Ligue a dica aos dados dele quando houver (ex: custo por conversa acima da média, dias sem postar, rede sem conexão).`,
    `- Português simples, direto, sem jargão. Título curto (até 80 caracteres). Detalhe com 2 a 4 frases, dizendo o que fazer e por que ajuda a trazer conversas no WhatsApp.`,
    `- Não prometa resultado garantido. Não sugira pausar campanha nem grupo de anúncios, nem mudar verba — isso só o Franklin decide.`,
    `- Categoria: uma de ${JSON.stringify(CATEGORIES)}.`,
    `- "mexeEmAnuncio": true só se a dica envolver criar/trocar anúncio pago.`,
    `Responda SOMENTE em JSON: {"dicas":[{"category":string,"title":string,"detail":string,"mexeEmAnuncio":boolean}]}`,
  ].join('\n\n');
}

let running = false;

// Gera as dicas do dia pra todo usuário (ou só `onlyClient`). Um usuário que
// falhar não impede os outros. Retorna um resumo por cliente.
async function runDailyTips({ onlyClient = null, date = todayInBrazil() } = {}) {
  if (running) return { skipped: 'já está rodando' };
  running = true;
  const summary = [];
  try {
    const users = (await loadUsers()).filter((u) => u.client && (!onlyClient || u.client === onlyClient));
    const seen = new Set();
    const existing = loadTips();
    for (const user of users) {
      if (seen.has(user.client)) continue; // um lote por cliente, mesmo com 2 logins
      seen.add(user.client);
      if (existing.some((t) => t.client === user.client && t.key && t.key.startsWith(`auto-${date}-`))) {
        summary.push({ client: user.client, status: 'já tinha dicas hoje' });
        continue;
      }
      try {
        const panel = await buildUserPanel(user);
        const prompt = buildPrompt({ user, panelSummary: summarizePanel(panel), adsContext: rjinoxAdsContext(user.client), date });
        const out = await generateJson(prompt);
        const dicas = (Array.isArray(out && out.dicas) ? out.dicas : []).slice(0, 3);
        const { added } = addTips(user.client, dicas.map((d, i) => ({
          key: `auto-${date}-${i + 1}`,
          date,
          category: d.category,
          title: d.title,
          detail: d.detail,
          agent: 'Equipe Máquina de Vendas Online',
          needsApproval: !!d.mexeEmAnuncio,
        })));
        summary.push({ client: user.client, status: 'ok', dicas: added.length });
      } catch (error) {
        summary.push({ client: user.client, status: 'erro', error: error.message });
      }
    }
  } finally {
    running = false;
  }
  return { date, summary };
}

module.exports = { runDailyTips };
