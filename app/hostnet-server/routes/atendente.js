const { resolveClient } = require('../lib/auth');
const A = require('../lib/atendente');

// Painel do Atendente de WhatsApp (ver lib/atendente.js). Por enquanto só o
// admin entra (Franklin, 2026-11-08): os clientes veem a demonstração até o
// serviço ser lançado. Para liberar uma conta, é só acrescentar aqui.
const LIBERADOS = ['frank'];

function isMaster(body) {
  return !!process.env.APP_PASSPHRASE && body.passphrase === process.env.APP_PASSPHRASE;
}

module.exports = async function handler(req, res) {
  const body = req.body || {};
  const action = String(body.action || 'carregar');
  try {
    if (action === 'conectar') {
      if (!isMaster(body)) { res.status(401).json({ error: 'Senha mestra incorreta' }); return; }
      await A.comEstado(body.empresa, body.nome, async (e) => {
        A.conectarWhatsapp(e, body.whatsapp);
        if (typeof body.ativo === 'boolean') e.ativo = body.ativo;
      });
      res.json({ ok: true });
      return;
    }

    const client = await resolveClient({ identifier: body.identifier, password: body.password });
    if (!client) { res.status(401).json({ error: 'E-mail/telefone ou senha incorretos' }); return; }
    if (!LIBERADOS.includes(client)) { res.status(403).json({ error: 'O Atendente de WhatsApp ainda não foi liberado para a sua conta.' }); return; }

    const empresas = await A.listaEmpresas();
    if (action === 'empresas') { res.json({ empresas }); return; }

    const empresa = A.slug(body.empresa);
    const item = empresas.find((x) => x.empresa === empresa);
    if (!item) { res.status(404).json({ error: 'Empresa não encontrada.' }); return; }

    const salvar = async (fn) => {
      const r = await A.comEstado(empresa, item.nome, async (e) => {
        const extra = await fn(e);
        return { extra, visao: A.visaoPublica(e) };
      });
      res.json({ ok: true, ...(r.extra && typeof r.extra === 'object' ? r.extra : {}), estado: r.visao });
    };

    switch (action) {
      case 'carregar': await salvar(() => undefined); return;
      case 'salvarFicha': await salvar((e) => A.aplicarFicha(e, body.ficha)); return;
      case 'salvarLinks': await salvar((e) => A.aplicarLinks(e, body.links)); return;
      case 'salvarRegras': await salvar((e) => A.aplicarRegras(e, body.regras || {})); return;
      case 'salvarEquipe': await salvar((e) => A.aplicarEquipe(e, body.equipe)); return;
      case 'ensinar':
        await salvar((e) => {
          const d = e.desconhecidas.find((x) => x.id === String(body.id));
          const r = String(body.resposta || '').trim();
          if (!d || !r) throw new Error('Escreva a resposta.');
          e.ficha.faq = `${e.ficha.faq ? `${e.ficha.faq}\n` : ''}${d.pergunta} ${r.slice(0, 1000)}`.slice(0, 6000);
          e.desconhecidas = e.desconhecidas.filter((x) => x.id !== d.id);
        });
        return;
      case 'assumir':
      case 'devolver':
        await salvar((e) => {
          const c = e.conversas[String(body.tel)];
          if (!c) throw new Error('Conversa não encontrada.');
          c.status = action === 'assumir' ? 'humano' : 'ia';
          c.etapa = action === 'assumir' ? 'Com vendedor' : 'Em atendimento';
        });
        return;
      case 'responder': await salvar((e) => A.responderComoHumano(e, String(body.tel), body.texto, 'Painel')); return;
      case 'testar': await salvar(async (e) => ({ teste: await A.testar(e, body.historico) })); return;
      case 'rascunho': {
        const r = await A.gerarRascunho(empresa, item.nome);
        await salvar((e) => {
          ['produtos', 'tom', 'faq'].forEach((k) => { if (r[k] && !String(e.ficha[k] || '').trim()) e.ficha[k] = r[k]; });
          if (!e.ficha.nome) e.ficha.nome = item.nome;
          e.aprendido = [`${r.totalPedidos} pedidos no aplicativo`, ...r.aprendizado];
          return { rascunho: { usados: r.usados, totalPedidos: r.totalPedidos } };
        });
        return;
      }
      case 'ativar':
        await salvar((e) => {
          if (!e.whatsapp) throw new Error('Conecte o número antes de ativar o atendente.');
          if (body.ativo && A.progresso(e).pct < 100) throw new Error('Complete o treinamento antes de colocar o atendente no ar.');
          e.ativo = !!body.ativo;
        });
        return;
      default:
        res.status(400).json({ error: 'Ação desconhecida.' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
