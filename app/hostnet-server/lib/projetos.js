// Projetos do Cut Estúdio (Franklin, 2026-10-19: criação separada da
// postagem). Tudo o que o cliente cria no Estúdio vira um projeto: a pasta do
// pedido no GitHub (com o conteúdo pronto em revisao/) + uma entrada em
// user.projetos com o estado. Aprovar só guarda ("pronto"); publicar é na
// tela Postar, onde ele escolhe o projeto e as redes.
//
// Estados: criando → aprovar → pronto → postado (ou falhou).
const { loadUsers, saveUsers } = require('./users');
const { listGithubFolder, putFileToGithub } = require('./github');

const LIMIT = 300;

function githubEnv() {
  return { owner: process.env.GITHUB_OWNER, repo: process.env.GITHUB_REPO, token: process.env.GITHUB_TOKEN };
}

async function addProjeto(client, projeto) {
  const users = await loadUsers();
  const user = users.find((u) => u.client === client);
  if (!user) return;
  const list = Array.isArray(user.projetos) ? user.projetos : [];
  user.projetos = [{ ...projeto, client, status: 'criando', at: Date.now() }, ...list].slice(0, LIMIT);
  await saveUsers(users);
}

async function markProjeto(client, pasta, fields) {
  const users = await loadUsers();
  const user = users.find((u) => u.client === client);
  const p = user && (user.projetos || []).find((x) => x.pasta === pasta);
  if (!p) return null;
  Object.assign(p, fields);
  await saveUsers(users);
  return p;
}

const MEDIA = /\.(jpe?g|png|webp|mp4|mov|webm|m4v)$/i;

// Confere no GitHub o estado dos projetos que ainda não estão prontos.
// Projeto "semAprovacao" (editado na hora no Estúdio, o cliente já viu o
// resultado) é aprovado sozinho assim que a legenda fica pronta.
async function refreshProjetos(client) {
  const users = await loadUsers();
  const user = users.find((u) => u.client === client);
  if (!user) return [];
  const list = Array.isArray(user.projetos) ? user.projetos : [];
  const { owner, repo, token } = githubEnv();
  let changed = false;
  await Promise.all(list.filter((p) => p.status === 'criando' || p.status === 'aprovar').slice(0, 20).map(async (p) => {
    try {
      const base = `.claude/skills/${p.client}/${p.pasta}`;
      const [root, rev] = await Promise.all([
        listGithubFolder({ owner, repo, token, path: base }),
        listGithubFolder({ owner, repo, token, path: `${base}/revisao` }),
      ]);
      let st = p.status;
      const statusEntry = root.find((e) => e.name === 'geracao-status.json');
      let genStatus = '';
      if (statusEntry) {
        try { genStatus = String((await (await fetch(statusEntry.download_url)).json()).status || ''); } catch (e) {}
      }
      if (rev.some((e) => e.name.toUpperCase() === 'APROVADO.TXT')) st = 'pronto';
      else if (/^done/.test(genStatus) && rev.some((e) => MEDIA.test(e.name))) st = 'aprovar';
      else if (/failed|blocked/.test(genStatus)) st = 'falhou';
      if (st === 'aprovar' && p.semAprovacao) {
        await putFileToGithub({ owner, repo, token, path: `${base}/revisao/APROVADO.txt`, message: `projeto pronto: ${p.client}/${p.pasta}`,
          base64Content: Buffer.from(`Salvo nos projetos em ${new Date().toISOString()}`).toString('base64') });
        st = 'pronto';
      }
      if (st !== p.status) { p.status = st; changed = true; }
      const thumb = rev.find((e) => MEDIA.test(e.name));
      if (thumb && !p.thumb) { p.thumb = thumb.download_url; p.video = /\.(mp4|mov|webm|m4v)$/i.test(thumb.name); changed = true; }
    } catch (e) {
      // GitHub fora do ar: tenta de novo na próxima abertura da lista.
    }
  }));
  if (changed) {
    // Relê e grava só os projetos, pra não pisar no que mudou enquanto isso.
    const fresh = await loadUsers();
    const fu = fresh.find((u) => u.client === client);
    if (fu) {
      const byPasta = new Map(list.map((p) => [p.pasta, p]));
      fu.projetos = (fu.projetos || []).map((p) => byPasta.get(p.pasta) || p);
      await saveUsers(fresh);
    }
  }
  return list;
}

// Conteúdo pronto de um projeto: as mídias de revisao/ e as legendas.
async function projetoItens(client, pasta) {
  const { owner, repo, token } = githubEnv();
  const base = `.claude/skills/${client}/${pasta}`;
  const [root, rev] = await Promise.all([
    listGithubFolder({ owner, repo, token, path: base }),
    listGithubFolder({ owner, repo, token, path: `${base}/revisao` }),
  ]);
  const itens = rev.filter((e) => e.type === 'file' && MEDIA.test(e.name))
    .map((e) => ({ name: e.name, url: e.download_url, video: /\.(mp4|mov|webm|m4v)$/i.test(e.name) }));
  let legendas = null;
  let legenda = '';
  const lj = root.find((e) => e.name === 'legendas.json');
  const lt = root.find((e) => e.name === 'legenda.txt');
  try { if (lj) legendas = await (await fetch(lj.download_url)).json(); } catch (e) {}
  try { if (lt) legenda = (await (await fetch(lt.download_url)).text()).trim(); } catch (e) {}
  return { itens, legendas, legenda };
}

module.exports = { addProjeto, markProjeto, refreshProjetos, projetoItens };
