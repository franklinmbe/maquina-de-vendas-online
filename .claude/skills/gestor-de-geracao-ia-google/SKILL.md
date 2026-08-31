---
name: gestor-de-geracao-ia-google
description: Gera imagens (Nano Banana) e vídeos (Gemini Omni Flash) do zero, a partir de um prompt de texto, via API do Google AI Studio (Gemini API). Diferente do Canva/CapCut, não precisa de nenhum material pronto — cria a partir do nada. Testado e funcionando (imagem confirmada em 2026-08-18).
---

Integração com a API Gemini do Google (aistudio.google.com), para geração de conteúdo visual novo via IA — complementa o Canva/CapCut (que editam material existente) e a geração de vídeo do Postiz (bloqueada até o plano pago ser ativado).

## Credencial

`GEMINI_API_KEY` em `.claude/settings.local.json`. Formato incomum (começa com `AQ.` em vez do `AIza...` tradicional), mas funciona normalmente.

**Cobrança**: pré-paga, sem assinatura. Exige um pré-pagamento mínimo de R$60 na primeira vez (crédito válido por 1 ano, usado só pela API Gemini). Preço por geração: ~US$0,034/imagem, ~US$0,10/segundo de vídeo (até 10s = US$1,00 máx). "Recarga automática" fica desligada — avisa quando precisar recarregar, não cobra sozinho.

**Controle de saldo**: a API não expõe endpoint de consulta de crédito — ver [[saldo-gemini]] pro controle estimado (baseado nos preços acima) e o limite mínimo de aviso pro Franklin. Depois de qualquer geração de imagem/vídeo/TTS por essa skill, registrar o gasto estimado em `saldo-gemini.md` e conferir se o saldo estimado já passou do limite mínimo — se sim, avisar o Franklin antes de continuar gerando mais conteúdo.

## Geração de imagem (Nano Banana) — testado e funcionando

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=<GEMINI_API_KEY>
Content-Type: application/json
Body: { "contents": [{ "parts": [{ "text": "<prompt descritivo da imagem>" }] }] }
```
Resposta vem em `candidates[0].content.parts[].inlineData.data` — base64 da imagem (PNG). Decodificar e salvar em arquivo.

Modelos disponíveis nessa chave: `gemini-2.5-flash-image` (Nano Banana original), `gemini-3.1-flash-image` (Nano Banana 2), `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite — mais barato/rápido, usado no teste), `gemini-3-pro-image` (Nano Banana Pro — melhor qualidade, mais caro).

**Importante**: sem faturamento ativado no projeto, dá erro 429 com `limit: 0` especificamente pros modelos de imagem/vídeo (texto funciona grátis, geração visual não tem tier grátis nenhum).

## Edição de imagem existente (image-to-image) — testado e funcionando (2026-08-18)

O Nano Banana também aceita uma imagem já existente como entrada, junto com um prompt de edição — não precisa gerar do zero pra fazer um ajuste pequeno (ex: só aumentar o tamanho de um texto, sem mudar o resto). Mesmo endpoint, muda só o corpo:

```
Body: { "contents": [{ "parts": [
  { "text": "<instrução de edição, pedindo explicitamente pra manter tudo igual exceto o que deve mudar>" },
  { "inlineData": { "mimeType": "image/png", "data": "<base64 da imagem existente>" } }
] }] }
```

Resposta vem no mesmo formato (`candidates[0].content.parts[].inlineData.data`).

**Não é 100% precisa** — mesmo pedindo explicitamente "mantenha tudo igual, só mude X", o modelo pode alterar outros detalhes sem querer (ex: mudou traços do rosto de um personagem numa tentativa). Se isso acontecer, tentar de novo geralmente resolve (o resultado varia por tentativa) — não é bug, é limitação normal do modelo pra edição guiada por imagem. Sempre salvar como arquivo novo (nunca sobrescrever o original) até o resultado ser aprovado.

## Geração de vídeo (Gemini Omni Flash) — ainda não testado

Modelo disponível: `gemini-omni-flash-preview`. Ainda não testada a chamada real (endpoint/formato exato do body) — verificar em `ai.google.dev` antes do primeiro uso real.

## Narração TTS (Gemini) — endpoint e vozes confirmados (2026-08-30)

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=<GEMINI_API_KEY>
Body: {
  "contents": [{ "parts": [{ "text": "<texto da narração>" }] }],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": { "voiceConfig": { "prebuiltVoiceConfig": { "voiceName": "<nome da voz>" } } }
  }
}
```
Resposta vem em `candidates[0].content.parts[0].inlineData.data` — base64 de PCM 16-bit 24kHz mono, precisa montar um cabeçalho WAV manualmente antes de usar (44 bytes, ver `pcmToWav` testado em 2026-08-30). (A referência antiga a um endpoint `/v1beta/interactions` estava errada — corrigido aqui depois de testar de verdade.)

**Todas as 30 vozes do catálogo testadas e confirmadas funcionando com esse modelo (2026-08-30)**: Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Sulafat, Achird, Despina, Umbriel, Callirrhoe, Autonoe, Enceladus, Iapetus, Algieba, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager — todas geraram áudio válido em português sem erro. **Qualidade/sotaque de cada uma ainda não avaliada por ouvido humano** (Claude não consegue ouvir áudio) — amostras de ~8s de cada ficaram em `_vozes-teste-tts/` (pasta local, não versionada) pro Franklin ouvir e escolher quais entram como opção no app. Custo do teste: ~US$0,13 total, registrado em `saldo-gemini.md`.

**Escolha de voz pelo cliente (pedido por Franklin em 2026-08-30)**: a ideia é o cliente escolher a voz da narração na hora de pedir o vídeo (composer do app), não na página de aprovação — o vídeo já sai pronto com a voz escolhida antes de chegar na aprovação. **Ainda não implementado no app** (falta Franklin terminar de ouvir as amostras e confirmar a lista final de vozes, e a UI de seleção no composer).

## Música de fundo — banco curado (2026-08-30)

Antes disso não existia nenhuma fonte de música configurada. **Pixabay não tem API pública pra música** (só imagem/vídeo, confirmado testando `pixabay.com/api/docs/`) — diferente do que se pensou inicialmente. A licença geral da Pixabay (`pixabay.com/service/license-summary/`) cobre "Content" de forma ampla (uso comercial livre, sem exigir crédito) e a navegação do site inclui Música dentro do mesmo guarda-chuva de licença, mas como não tem API, a curadoria foi manual via navegador (Playwright, autorizado por Franklin em 2026-08-30) na playlist oficial "Commercial, Tutorials and Vlogs" da própria Pixabay.

**30 faixas baixadas e aprovadas por Franklin (ouviu todas, "só música boa pra anúncios")**, em `.claude/skills/gestor-de-geracao-ia-google/musicas/` (prefixo `musica-`, arquivo `.mp3`): Corporate, Upbeat-Happy-Corporate, Business-Corporate-Music, Beautiful-Orchestral-Motivational-Corporate, Technology-Tech-Presentation, Real-Estate, Summer-Pop, Fun-Life-Commercial-HipHop, Vlog-HipHop, Instagram-Reels-Marketing-1, Marketing-Instagram-Reels-2, Background-Music-1, Luxury-Ambience, Ambient-Chill, Real-Estate-Construction-1, Fly-By-Dream, Corporate-Business-Background, The-Future-Beat, No-Copyright-Music, Summer-Fashion-EDM, Real-Estate-Luxury, Advertising-Music-1, Calming-In-The-Sun, Jazzy-Abstract-Beat, Mellow-Melodies, Real-Estate-Construction-2, Advertising-1, Advertising-2, Project-Precision, Background-Music-2.

**Atualizado no mesmo dia — cliente escolhe, não é mais automático**: Franklin revisou a decisão inicial ("automático, sem o cliente escolher") — a versão final é o cliente escolher a música (e a voz) numa caixa grande na tela de montar o pedido (composer), a mesma ideia da seleção de voz. Ver seção "Caixa de música/voz/narração no composer" no `CLAUDE.md` pro desenho da UI.

Mixagem com a narração (ainda não testada na prática): `-filter_complex "[1:a]volume=1.0[a1];[2:a]volume=0.25[a2];[a1][a2]amix=inputs=2:duration=first"` — baixar o volume da música bem abaixo da narração. **Ainda não implementado no pipeline de FFmpeg** — falta integrar essa mixagem no passo 6 do "slideshow narrado" abaixo.

## Pipeline de vídeo tipo "slideshow narrado" — testado e funcionando (2026-08-18)

Processo completo pra montar um vídeo curto (imagens geradas + narração falada + legenda), sem depender do Gemini Omni Flash (que gera vídeo de verdade mas ainda não foi testado):

1. Gerar as imagens (Nano Banana, endpoint acima), uma por "slide"
2. Padronizar todas pro mesmo tamanho de canvas com FFmpeg (`scale=...:force_original_aspect_ratio=decrease,pad=...`)
3. **Formato do canvas: SEMPRE vertical 1080x1920 (9:16), nunca quadrado** — decisão do Franklin em 2026-08-18 depois que o primeiro vídeo saiu quadrado (1080x1080) e ficou ruim no Reels/TikTok (barra preta, não preenche a tela). O formato vertical funciona bem em Reels, TikTok E YouTube Shorts ao mesmo tempo — não precisa de versão separada por rede.
4. Gerar a narração com Gemini TTS (ver seção "Narração TTS" acima pro endpoint/formato/vozes confirmados) — retorna PCM 16-bit 24kHz mono em base64, precisa montar um cabeçalho WAV manualmente antes de usar (não vem como arquivo WAV pronto)
5. Montar o vídeo mudo com FFmpeg (`-f concat`, duração de cada slide ajustada pra bater com a duração total da narração ÷ número de slides) — **atenção**: escrever a lista de concat sem BOM (`New-Object System.Text.UTF8Encoding $false`), senão o FFmpeg rejeita o arquivo
6. Juntar o vídeo mudo com o áudio da narração (`-c:v copy -c:a aac -shortest`)
7. Queimar a legenda no vídeo com o filtro `subtitles=` do FFmpeg, usando um `.srt` gerado a partir do mesmo texto da narração (divide em frases curtas, distribui o tempo proporcionalmente à duração total) — **atenção**: rodar o FFmpeg com o `.srt` no mesmo diretório de trabalho e referenciar só pelo nome do arquivo (sem caminho completo) pra evitar bug de escapamento de `:` do Windows no filtro `subtitles`
8. Antes de publicar: subir o vídeo pronto pra `revisao/` da pasta do pedido e mandar pro cliente aprovar (ver seção "Aprovação do cliente antes de publicar" abaixo) — só publicar depois de confirmar `revisao/APROVADO.txt`.
9. Publicar via Postiz: Facebook, Instagram (aparece como Reel automaticamente), TikTok (`content_posting_method: DIRECT_POST`), **e YouTube** — vídeo vertical curto (menos de 3 min) publicado lá é tratado automaticamente como YouTube Shorts pelo próprio YouTube, não existe flag separada de "Shorts" na API do Postiz pra isso, é só o formato/duração que decide

Sem música de fundo ainda — sem fonte de música livre de direitos configurada. Música/legenda nativa das redes (escolher som em alta do TikTok, por exemplo) **não é possível via API** — só dá pra publicar com o que já vier pronto no arquivo.

**Padrão fixo a partir de 2026-08-18: vertical 1080x1920 sempre, por padrão, sem perguntar.** Só se o conteúdo for explicitamente pra **YouTube tradicional/longo** (não Shorts) é que o formato vertical não serve — nesse caso específico, **avisar o Franklin antes de montar** que vai precisar de formato paisagem (16:9) em vez do vertical padrão, já que os dois formatos não são intercambiáveis.

## Pipeline variante: reaproveitar PDF como roteiro + áudio de vídeo existente (testado 2026-08-18)

Variação do pipeline "slideshow narrado" acima, usada quando já existe material pronto que serve de base — não precisa escrever roteiro nem gerar narração do zero:

1. **Roteiro/estrutura vem de um documento existente** (ex: um PDF de proposta/portfólio que o Franklin já tem) — cada página/seção do documento vira o prompt de uma imagem. Ler o PDF inteiro primeiro (título + texto de cada página) pra manter a sequência e o conteúdo corretos.
2. **Trilha sonora vem de um vídeo existente**, não de TTS gerado: extrair o áudio completo com FFmpeg (`-vn -acodec libmp3lame -q:a 2`) — sai música+fala juntas num único arquivo, já que separação de voz/música não está instalada (ver [[claude-capability-limits-content-creation]]). Rodar `ffprobe` primeiro pra pegar a duração exata do áudio e dividir igualmente entre o número de imagens (ex: vídeo de 40s ÷ 10 imagens = 4s por slide).
3. Gerar as imagens via Nano Banana (endpoint acima), sempre vertical 1080x1920, com um prompt de estilo consistente compartilhado entre todas (mesma paleta/tipografia/composição) + o conteúdo específico de cada uma.
4. Daí em diante segue igual ao pipeline "slideshow narrado": padronizar tamanho com FFmpeg, montar vídeo mudo com `-f concat` usando a duração calculada no passo 2, juntar com o áudio extraído (`-c:v copy -c:a aac -shortest`), legenda opcional.

**Por que isso importa:** é o caminho mais rápido quando o Franklin já tem conteúdo pronto (proposta comercial, portfólio, vídeo antigo) em vez de escrever tudo do zero — reaproveita o trabalho que já existe em vez de recriar. Repetir esse padrão sempre que aparecer situação parecida (documento de referência + vídeo modelo).

## Identidade visual / layout padrão dos banners (fixado 2026-08-18)

Sistema de design consolidado depois de fazer os 11 banners da proposta comercial ([[project-reels-banners-6-servicos]]). **Usar esse padrão por default em qualquer banner novo da agência, não só nesse projeto específico** — só desviar se o Franklin pedir algo diferente.

**Personagem:** o robô-avatar da marca (branco/prata, luzes vermelho/laranja, ver [[agency-services-scope]] pra spec completa). Sempre passar a imagem de referência canônica (`bener escolhidos/02-o-que-e-00000002.png`) como `inlineData` de entrada, nunca só descrição em texto — é o que garante o rosto/design do robô não variar entre gerações.

**Formato e paleta:** vertical 1080x1920 (9:16) sempre. Fundo escuro (charcoal/preto), luz ambiente quente (âmbar), tons de vidro/cidade quando fizer sentido pro cenário. Evitar neon roxo/rosa saturado — testado e rejeitado por não combinar com o resto do set (ver histórico em [[project-reels-banners-6-servicos]]).

**Bloco de texto — "efeito destaque":** todo texto (título + linhas de corpo) fica dentro de um painel escuro semi-transparente, cantos arredondados ("alto relevo"), com uma linha divisória fina entre cada linha/parágrafo distinto. Não é só uma linha por baixo do título — é o painel inteiro. Título em branco, negrito, maior; linhas de corpo um degrau menor. Se o robô/cena tiver elementos importantes perto da borda inferior da imagem (mãos, objetos), **especificar explicitamente que o painel de texto não deve invadir aquela região** — já aconteceu de um painel de texto duplicado cobrir a mão do robô numa edição.

**Fluxo de trabalho:** cena nova ou pose diferente → gerar do zero (texto + imagem de referência do robô). Ajuste pequeno isolado (aumentar fonte, trocar 1 palavra, redimensionar um elemento, adicionar/tirar um objeto específico) → editar a imagem já aprovada (image-to-image) em vez de gerar tudo de novo — mais barato, mais rápido, e preserva o resto da composição.

## Quando usar isso vs. Canva/CapCut vs. Postiz

- **Não tem nenhuma imagem/vídeo de base, quer que a IA invente do zero** → esta skill (Nano Banana / Omni Flash)
- **Já tem uma foto/vídeo e quer editar/dar identidade visual** → Canva ([[gestor-de-design-canva]]) ou CapCut ([[gestor-de-conteudo-capcut]])
- **Quer publicar o resultado final nas redes** → primeiro passa pela aprovação do cliente (ver seção abaixo) — a publicação em si, depois de aprovado, já é automática, não precisa mais chamar a API de cada rede manualmente

## Aprovação do cliente antes de publicar — e publicação automática depois (fixado 2026-08-30, atualizado na mesma tarde)

Todo pedido feito pelo app (pasta `.claude/skills/<client>/<pasta>/` com as fotos/vídeo originais + `instrucoes.txt` + `redes.json` opcional com as redes que o cliente marcou no composer) passa por uma aprovação do próprio cliente antes de publicar — não é mais gerar e publicar direto. **A partir de 2026-08-30 à tarde, a publicação em si também é automática**: assim que o cliente clica em Aprovar na página, o servidor já publica sozinho nas redes conectadas dele (ver `lib/auto-publish.js`) — não é mais preciso chamar `/api/meta/publish` (ou equivalente de cada rede) manualmente depois de ver o `APROVADO.txt`.

0. **Antes de gerar qualquer coisa**, checar o limite diário de chamadas do plano do cliente (ver CLAUDE.md, "Suporte pelo Claude na caixa de pedido + limite de chamadas por dia") — `POST https://app.franklinmorais.com/api/check-call-limit` com `{ "passphrase": "<APP_PASSPHRASE>", "client": "<client>" }`. Isso **só vale pra pedir geração de banner/vídeo ou responder dúvida de suporte** — nunca chamar isso só porque o cliente pediu pra postar uma foto/vídeo que ele já mandou (isso é ilimitado). Se vier `{ allowed: false, error }`, não gerar nada — avisar o Franklin que o cliente bateu o limite do dia e (se fizer sentido) sugerir upgrade de plano.
1. Gerar o conteúdo pedido (banners e/ou vídeo) normalmente, pelos pipelines acima. **Essa parte continua manual** — precisa de uma sessão do Claude com o Franklin, não roda sozinha.
2. Subir os arquivos finais (imagens e/ou vídeo) pra dentro de uma subpasta **`revisao/`** dentro da mesma pasta do pedido — ex: `.claude/skills/kleber-construcao/app-20260830-153000/revisao/banner1.png`. Mesmo mecanismo de upload já usado pro resto do pedido (GitHub Contents API).
3. Montar o link de aprovação: `https://app.franklinmorais.com/aprovacao.html?client=<client>&pasta=<nome-da-pasta>` (o `<client>` é o nome da pasta do cliente, ex: `kleber-construcao`; `<pasta>` é o nome da subpasta do pedido, ex: `app-20260830-153000` — sem o prefixo `.claude/skills/<client>/`).
4. Entregar esse link pro Franklin mandar pro cliente (WhatsApp, hoje não existe envio automático pro cliente) — a página mostra as fotos originais, os banners e o vídeo gerados, bem grandes, com um botão "Aprovar".
5. **Não precisa fazer mais nada depois disso** — quando o cliente aprovar, o próprio servidor publica sozinho (nas redes marcadas em `redes.json`, ou em todas as conectadas do cliente se esse arquivo não existir) e grava o resultado em `revisao/publicacao-resultado.json`. Só vale a pena checar esse arquivo (ou pedir pro Franklin olhar a página de novo) se o cliente avisar que achou que "não postou" — pode ter sido falha de token/rede específica, reportada por canal nesse JSON.

**Detalhes técnicos da página** (`app/hostnet-server/public/aprovacao.html`): não exige login — lê as fotos/vídeos direto da API pública do GitHub (`api.github.com/repos/franklinmbe/maquina-de-vendas-online/contents/...`, repositório é público, funciona sem token direto do navegador do cliente). O botão "Aprovar" chama `POST /api/approve-pedido` (`{client, pasta}`), que grava o `APROVADO.txt` e, na sequência, chama `publishApprovedPedido` (`lib/auto-publish.js`) — a resposta já inclui o resultado por rede, mostrado na hora na própria página. Se `revisao/` ainda não existir, a página mostra "ainda estamos preparando o conteúdo" em vez do botão. WordPress nunca entra nessa publicação automática (precisa de título/conteúdo de artigo, não de legenda de post) — fica manual, separado.
