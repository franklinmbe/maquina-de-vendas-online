// Créditos (fichas) do "🎬 Vídeo especial" do Cut Studio Pro (Franklin,
// 2026-10-26). Vídeo de alta qualidade é cobrado à parte, em créditos por
// segundo, comprados por fora do plano. 1 crédito = R$ 0,15 pro cliente; custa
// ~R$ 0,10 pra nós (ganhamos ~R$ 0,05 por crédito — "não quero ganhar muito").
// Quantos créditos cada plano ganha por mês ainda vai ser decidido: por
// enquanto todo plano vem com 0 (CREDITOS_DO_PLANO). Admin (frank) não paga.
// Saldo em user.creditos; extrato em user.creditosHist (mais novo primeiro).
const { loadUsers, saveUsers, findUser } = require('./users');

const PRECO_CREDITO = 0.15;
const CUSTO_CREDITO = 0.10;
const ADMIN_CLIENT = 'frank';

// Níveis de vídeo. pronto=false aparece na tela como "em breve" (ainda sem o
// motor ligado no servidor). Cinema é só sob encomenda (WhatsApp).
const NIVEIS = {
  economica: { nome: 'Econômica', motor: 'Google', creditosPorSegundo: 4, pronto: true },
  intermediaria: { nome: 'Intermediária', motor: 'Kling', creditosPorSegundo: 6, pronto: false },
  cinema: { nome: 'Cinema', motor: 'Seedance', creditosPorSegundo: 20, pronto: false, sobEncomenda: true },
};

// Cada cena tem 8 s (tamanho do clipe do motor). Até 4 cenas por vídeo.
const SEGUNDOS_POR_CENA = 8;
const DURACOES = [8, 16, 24, 32];

// Pacotes sem desconto: o preço do crédito é sempre o mesmo (R$ 0,15).
const PACOTES = [100, 300, 1000].map((creditos) => ({ id: `c${creditos}`, creditos, preco: +(creditos * PRECO_CREDITO).toFixed(2) }));

const CREDITOS_DO_PLANO = {};

function isAdmin(user) {
  return !!user && user.client === ADMIN_CLIENT;
}

function custoEmCreditos(nivel, segundos) {
  const n = NIVEIS[nivel];
  if (!n) throw new Error('Nível de vídeo inválido.');
  return n.creditosPorSegundo * segundos;
}

// Fila simples: as gravações em users.json passam uma de cada vez, pra duas
// gerações ao mesmo tempo não gastarem o mesmo saldo.
let fila = Promise.resolve();
function emFila(fn) {
  const run = fila.then(fn, fn);
  fila = run.catch(() => {});
  return run;
}

function registrar(user, mov) {
  user.creditosHist = [{ em: new Date().toISOString(), ...mov }, ...(user.creditosHist || [])].slice(0, 200);
}

// Tira créditos do saldo. Devolve { ok, saldo } ou { ok:false, falta }.
function debitar(identifier, creditos, motivo) {
  return emFila(async () => {
    const users = await loadUsers();
    const user = findUser(users, identifier);
    if (!user) throw new Error('Usuário não encontrado');
    if (isAdmin(user)) return { ok: true, saldo: null, admin: true };
    const saldo = user.creditos || 0;
    if (saldo < creditos) return { ok: false, saldo, falta: creditos - saldo };
    user.creditos = saldo - creditos;
    registrar(user, { tipo: 'uso', creditos: -creditos, motivo });
    await saveUsers(users);
    return { ok: true, saldo: user.creditos };
  });
}

// Põe créditos no saldo. pagamento = id do Mercado Pago: o mesmo pagamento
// nunca credita duas vezes (webhook e volta do checkout chegam os dois).
function creditar({ identifier, client }, creditos, motivo, pagamento) {
  return emFila(async () => {
    const users = await loadUsers();
    const user = client ? users.find((u) => u.client === client) : findUser(users, identifier);
    if (!user) throw new Error('Usuário não encontrado');
    if (pagamento && (user.creditosHist || []).some((h) => h.pagamento === String(pagamento))) {
      return { ok: true, repetido: true, saldo: user.creditos || 0 };
    }
    user.creditos = (user.creditos || 0) + creditos;
    registrar(user, { tipo: creditos >= 0 ? 'entrada' : 'ajuste', creditos, motivo, ...(pagamento ? { pagamento: String(pagamento) } : {}) });
    await saveUsers(users);
    return { ok: true, saldo: user.creditos, nome: user.name || user.client };
  });
}

module.exports = {
  PRECO_CREDITO, CUSTO_CREDITO, NIVEIS, PACOTES, DURACOES, SEGUNDOS_POR_CENA, CREDITOS_DO_PLANO,
  isAdmin, custoEmCreditos, debitar, creditar,
};
