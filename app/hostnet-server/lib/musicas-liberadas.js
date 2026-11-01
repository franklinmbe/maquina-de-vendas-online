const path = require('path');

// Músicas da biblioteca (Pixabay) que o YouTube reivindica por direitos
// autorais (Content ID): o dono fica com o dinheiro dos anúncios de quem usa.
// Descoberto em 2026-11-01 com um vídeo de teste privado no canal do Franklin
// (30 músicas, 20 s cada). Saem das listas do app; pedido antigo ou agendado
// que ainda peça uma delas recebe a substituta (mesmo clima, sem reivindicação).
const BLOQUEADAS = {
  'musica-Advertising-1.mp3': 'musica-Advertising-2.mp3',
  'musica-Advertising-Music-1.mp3': 'musica-Advertising-2.mp3',
  'musica-Background-Music-1.mp3': 'musica-Corporate-Business-Background.mp3',
  'musica-Background-Music-2.mp3': 'musica-Corporate-Business-Background.mp3',
  'musica-Beautiful-Orchestral-Motivational-Corporate.mp3': 'musica-Business-Corporate-Music.mp3',
  'musica-Calming-In-The-Sun.mp3': 'musica-Ambient-Chill.mp3',
  'musica-Fun-Life-Commercial-HipHop.mp3': 'musica-The-Future-Beat.mp3',
  'musica-Instagram-Reels-Marketing-1.mp3': 'musica-Summer-Fashion-EDM.mp3',
  'musica-Jazzy-Abstract-Beat.mp3': 'musica-Mellow-Melodies.mp3',
  'musica-Marketing-Instagram-Reels-2.mp3': 'musica-Summer-Fashion-EDM.mp3',
  'musica-No-Copyright-Music.mp3': 'musica-Project-Precision.mp3',
  'musica-Real-Estate.mp3': 'musica-Real-Estate-Luxury.mp3',
  'musica-Summer-Pop.mp3': 'musica-Summer-Fashion-EDM.mp3',
  'musica-Upbeat-Happy-Corporate.mp3': 'musica-Corporate.mp3',
  'musica-Vlog-HipHop.mp3': 'musica-The-Future-Beat.mp3',
};

function musicaSegura(nome) {
  const base = path.basename(String(nome || ''));
  return BLOQUEADAS[base] || base;
}

module.exports = { BLOQUEADAS, musicaSegura };
