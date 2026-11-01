const fs = require('fs');
const path = require('path');

// Trilhas próprias (Google Lyria, 2026-11-01): 50 músicas em 8 climas, testadas
// num vídeo privado no YouTube sem nenhuma reivindicação de direitos autorais.
// Os MP3 ficam no volume persistente (DATA_DIR/trilhas/<clima>/<nome>.mp3, fora
// do repositório por causa do tamanho). Quando o servidor sobe, cada um é
// copiado para public/audio/musicas/ com o nome "musica-<Clima>-<Nome>.mp3",
// e daí em diante funciona igual a qualquer música da biblioteca.
const CATALOGO = require('./trilhas-app.json');
const DESTINO = path.join(__dirname, '..', 'public', 'audio', 'musicas');

function instalarTrilhas() {
  const origem = process.env.DATA_DIR && path.join(process.env.DATA_DIR, 'trilhas');
  if (!origem || !fs.existsSync(origem)) return { instaladas: 0, motivo: 'sem DATA_DIR/trilhas' };
  let instaladas = 0;
  const faltando = [];
  for (const cat of CATALOGO) {
    for (const t of cat.itens) {
      const de = path.join(origem, t.origem);
      const para = path.join(DESTINO, t.arquivo);
      if (!fs.existsSync(de)) { faltando.push(t.origem); continue; }
      if (!fs.existsSync(para)) fs.copyFileSync(de, para);
      instaladas++;
    }
  }
  return { instaladas, faltando };
}

module.exports = { instalarTrilhas, CATALOGO };
