# Recado da sessão na nuvem (27/10/2026): voz e música no Cut Studio Pro

Franklin conversou com uma sessão do Claude na nuvem, que não alcança a VPS nem o notebook. Ela mexeu no código e mesclou na `main`, mas **nada foi pro ar**. Quem faz o deploy é a sessão do VS Code.

## O que mudou (já está na `main`)

| PR | O que faz |
|----|-----------|
| #744 | Volta a caixa "🎙️🎵 Voz e música" nos pedidos automáticos com vídeo. Ela tinha sumido na mudança pro Estúdio em 19/10. |
| #745 | A caixa aparece em **toda** tela do Cut Studio Pro que faz vídeo: Lab. de IA, Foto em movimento, Vídeo com fotos, Link do produto, todos os modelos e efeitos, todos os pedidos prontos e os automáticos que viram vídeo (inclusive o carrossel). A escolha é lida num lugar só, no envio (`estudio.html`). |
| #746 | Primeiro botão de cada fileira: **🔇 Sem narração** e **🔇 Sem música** (valor `nenhuma`). No servidor (`lib/auto-generate.js`): sem música, nada é mixado; sem narração, o vídeo montado usa um áudio mudo (`silentWavBuffer`) e não entra voz de IA por cima do vídeo do cliente. |

Regra do Franklin: **todo vídeo pode ter narração e música, e a pessoa sempre escolhe.** Se ela não marcar nada, o app escolhe (voz do mesmo tipo da pessoa, música sorteada). Se marcar "Sem narração" e "Sem música", o vídeo sai sem som.

## O que a sessão do VS Code precisa fazer

1. **Deploy na VPS:** `git pull` (ou `git reset --hard origin/main`) na VPS e reconstruir o container `mvo`, do jeito de sempre.
2. **Testar ao vivo** com a conta da Jaqueline (`jaqueline-rjinox`), no Cut Studio Pro:
   - Pedidos automáticos → "2º — Selecione um vídeo": a caixa de voz e música tem que aparecer embaixo do anexo.
   - Abrir um modelo, um pedido pronto e o Lab. de IA: a caixa tem que aparecer em todos.
   - Criar 1 vídeo escolhendo uma voz e uma música: o resultado sai com as duas.
   - Criar 1 vídeo com fotos marcando 🔇 Sem narração + 🔇 Sem música: o vídeo sai sem som e sem erro.
3. Se algo falhar, conferir o log do container (`docker logs mvo`) procurando `[auto-generate]`.

Foi testado só a checagem de sintaxe (`node --check`) e o comando ffmpeg do áudio mudo. Nada foi testado na tela nem com geração real.

## Decisão pendente do Franklin

Quando a pessoa manda **o próprio vídeo** e marca "Sem narração / Sem música", **o som original que ela gravou continua**. O app só não coloca nada por cima. Perguntar ao Franklin se nesse caso o som original também deve sair (vídeo mudo).
