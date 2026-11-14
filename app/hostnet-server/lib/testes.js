// Teste com prazo (Franklin, 2026-11-14): quando o Franklin libera alguém
// "pra testar X dias" (pelo chat com o Claude), a conta ganha
// { teste: true, testeDias, testeAte } no users.json, com o plano que a
// pessoa quer. Passou do testeAte sem pagar → a conta é cortada sozinha:
// a senha sai de passwordHash (guardada em passwordHashAntesDoCorte), então
// nenhuma rota aceita mais o login; o "Entrar como cliente" do admin continua
// funcionando. Pra reativar (pagou), é só liberar de novo em "Liberar
// usuário" — admin-set-account.js recria a conta sem os campos de teste.
const { loadUsers, saveUsers } = require('./users');
const { avisarAdmin } = require('./avisar-admin');

const MSG_TESTE_ACABOU = 'Seu período de teste acabou. Para continuar usando o aplicativo, fale com a gente no WhatsApp (21) 99905-9608.';

async function cortarTestesVencidos() {
  const users = await loadUsers();
  const agora = Date.now();
  const cortados = [];
  for (const u of users) {
    if (!u.teste || !u.testeAte || u.testeCortadoEm || !u.passwordHash) continue;
    if (new Date(u.testeAte).getTime() > agora) continue;
    u.passwordHashAntesDoCorte = u.passwordHash;
    delete u.passwordHash;
    u.testeCortadoEm = new Date().toISOString();
    cortados.push(u);
  }
  if (!cortados.length) return { cortados: 0 };
  await saveUsers(users);
  for (const u of cortados) {
    avisarAdmin(`⏰ Teste acabou e o acesso foi cortado:\n${u.name} · WhatsApp ${u.identifier}\nPlano do teste: ${u.plan}${u.testeDias ? ` (${u.testeDias} dias)` : ''}\nSe ela pagar, é só liberar de novo em "Liberar usuário".\nhttps://wa.me/55${u.identifier}`).catch(() => {});
  }
  return { cortados: cortados.length, quem: cortados.map((u) => u.client) };
}

function testeAcabou(user) {
  return !!(user && user.teste && user.testeCortadoEm && !user.passwordHash);
}

module.exports = { cortarTestesVencidos, testeAcabou, MSG_TESTE_ACABOU };
