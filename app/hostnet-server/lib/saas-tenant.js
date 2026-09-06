// Configuração do "Aplicativo SaaS" (módulo administrativo + WhatsApp + Loja
// + domínio próprio) de um cliente — guardada em user.saasApp, ao lado do
// resto do cadastro em users.json. Ver CLAUDE.md, seção sobre o produto
// "Aplicativo" (modelo RN Cell) pro contexto completo dessa decisão.
const DEFAULT_STATUS_PIPELINE = [
  'Recebido',
  'Diagnóstico',
  'Orçamento aprovado',
  'Aguardando peça',
  'Em reparo',
  'Pronto',
  'Entregue',
];

function getSaasApp(user) {
  return (user && user.saasApp) || null;
}

function isModuleEnabled(user, moduleName) {
  const saas = getSaasApp(user);
  return !!(saas && saas.modules && saas.modules[moduleName]);
}

function statusPipelineFor(user) {
  const saas = getSaasApp(user);
  if (saas && Array.isArray(saas.statusPipeline) && saas.statusPipeline.length) {
    return saas.statusPipeline;
  }
  return DEFAULT_STATUS_PIPELINE;
}

// Domínio → cliente: a mesma aplicação atende domínio próprio do cliente
// (ex: app.rncell.com.br) e subdomínio da nossa estrutura
// (ex: rncell.maquinadevendasonline.com.br) — o Nginx do servidor encaminha
// os dois pro mesmo processo Node, e aqui a gente decide de qual tenant é a
// requisição pelo cabeçalho Host. Comparação sem porta e sem maiúsculas,
// igual o navegador manda.
function normalizeHost(hostname) {
  return String(hostname || '').toLowerCase().split(':')[0];
}

function findUserByDomain(users, hostname) {
  const host = normalizeHost(hostname);
  if (!host) return null;
  return (
    users.find((u) => {
      const domains = u.saasApp && Array.isArray(u.saasApp.domains) ? u.saasApp.domains : [];
      return domains.some((d) => normalizeHost(d) === host);
    }) || null
  );
}

// Uma requisição de webhook do WhatsApp chega com o phone_number_id de quem
// recebeu (não com um domínio) — cada tenant tem o próprio número, mas o
// endpoint de webhook é um só, compartilhado entre todos.
function findUserByPhoneNumberId(users, phoneNumberId) {
  return (
    users.find(
      (u) => u.saasApp && u.saasApp.whatsapp && u.saasApp.whatsapp.phoneNumberId === phoneNumberId
    ) || null
  );
}

module.exports = {
  DEFAULT_STATUS_PIPELINE,
  getSaasApp,
  isModuleEnabled,
  statusPipelineFor,
  normalizeHost,
  findUserByDomain,
  findUserByPhoneNumberId,
};
