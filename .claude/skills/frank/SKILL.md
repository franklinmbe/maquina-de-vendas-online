---
name: frank
description: Verifica se chegou algum arquivo novo (imagem ou vídeo) na pasta .claude/skills/frank/ e, se sim, publica em todas as redes pessoais do Franklin — Facebook/Instagram/YouTube direto via API do hostnet-server (app.franklinmorais.com), 2x TikTok ainda via API do Postiz até o app do TikTok passar por revisão.
---

Esta skill cuida do conteúdo pessoal do Franklin (marca própria, não é de nenhuma empresa cliente). Os arquivos ficam soltos dentro desta mesma pasta (`.claude/skills/frank/`), fora de `processados/`.

## Passo 1 — Verificar se há arquivo novo

Liste os arquivos de imagem/vídeo (`.jpg`, `.jpeg`, `.png`, `.webp`, `.mp4`, `.mov`) direto dentro desta pasta (ignore o que já estiver em `processados/`). Se não houver nenhum, não faça nada.

## Passo 1B — Tarefas em grupo (subpasta com `instrucoes.txt`)

Além de arquivos soltos, o Franklin também pode pedir tarefas mais complexas (carrossel com várias fotos, vídeo com música/narração, etc). Pra isso, ele cria uma **subpasta dentro de `frank/`** (nome livre, ex: `grupo1`, `grupo2`, `grupo3`... sempre subindo o número, nunca reaproveitando) contendo os arquivos de mídia **+ um arquivo `instrucoes.txt`** com o pedido em texto livre.

- **O sinal de que é uma tarefa pendente é a presença do `instrucoes.txt`** dentro da subpasta — não o nome dela. Pastas de projeto antigas (ex: `banners-reels-10-servicos/`) não têm esse arquivo e devem ser ignoradas.
- Leia o `instrucoes.txt` e siga o que ele pede (ex: "monte um carrossel com essas fotos", "faça um vídeo com essas imagens, música de fundo e essa narração").
- **Publicação de carrossel/imagem via Postiz**: sempre possível, siga o Passo 3 normalmente.
- **Montagem de vídeo (fotos + música/narração)**: use `ffmpeg` via Bash. **Se o comando `ffmpeg` não for encontrado, instale primeiro com `apt-get update && apt-get install -y ffmpeg`** (roda como root neste ambiente, não precisa de `sudo`; confirmado funcionando 2026-08-19). Receita testada e aprovada pelo Franklin (usada em produção):
  - Duração por imagem `D = (duração_do_áudio - fade) / N_imagens`; cada imagem entra no ffmpeg com `-loop 1 -t {D+fade} -i imagem.png` (fade = 0.3s funciona bem), mais `-i audio.mp3` por último.
  - `filter_complex`: primeiro `scale`+`setsar`+`fps` de cada `[i:v]` pra uma resolução comum, depois encadear `xfade=transition=dissolve:duration={fade}:offset={k*D}` par a par — **o offset é cumulativo `k*D` (não `k*(D+fade)`)**, errar isso desincroniza do áudio.
  - Mapear a saída final do xfade + a faixa de áudio: `-c:v libx264 -pix_fmt yuv420p -c:a aac -shortest`.
  - Verificar o resultado com `ffprobe` (duração/codec/resolução) — não confie só no exit code 0.
  - Se o pedido no `instrucoes.txt` incluir **narração falada** (texto pra virar voz), isso não tem solução automática hoje (não há text-to-speech configurado) — nesse caso específico, pule e reporte que precisa ser feito com o Franklin. Música de fundo (arquivo de áudio já pronto) funciona normalmente.
  - Se mesmo assim o pedido for complexo demais ou genuinamente ambíguo, **não tente publicar algo incompleto ou inventado** — pule essa subpasta, não mova pra `processados/`, e reporte no resumo final que precisa ser feito interativamente com o Franklin.
- Depois de concluir com sucesso (publicado e/ou vídeo montado conforme pedido), mova a **subpasta inteira** para dentro de `processados/` (ex: `frank/grupo1/` → `frank/processados/grupo1/`).

## Passo 2 — Para cada arquivo novo encontrado

**Se for imagem**: leia/veja a imagem diretamente e escreva um título curto, uma legenda (tom pessoal/influenciador, em português) e 3-5 hashtags relevantes com base no que aparece na imagem.

**Se for vídeo**, você não consegue assistir — use, nesta ordem, o primeiro que der certo:

1. **Imagem pareada**: procure na pasta uma imagem com o **mesmo nome base** do vídeo (ex: `promocao-verao.mp4` + `promocao-verao.jpg`). Se existir, veja essa imagem, entenda do que se trata, e use ela como base pra escrever título/legenda/hashtags — a mesma legenda serve pros dois, mas você publica só o vídeo (a imagem foi só de referência, a não ser que o Franklin queira as duas publicadas separadamente).
2. **Nome do arquivo descritivo**: se o nome do arquivo já descreve o assunto (ex: `dica-proteina-pos-treino.mp4`), use esse nome como base do título/legenda — transforme em uma frase natural, não publique o nome do arquivo literalmente.
3. **Nenhum dos dois**: como último recurso, pergunte ao Franklin do que se trata antes de continuar (não invente a legenda do zero sem nenhuma pista).

Pra **YouTube**, escreva também um título separado (mais curto, pensado pra busca/SEO) além da descrição.

**Conteúdo já postado nativo em algum canal**: às vezes o Franklin grava/posta direto pelo app da rede e depois baixa o arquivo pra eu postar nas outras. Pra eu saber qual canal pular, ele coloca um sufixo no nome do arquivo — pode combinar mais de um se já postou em várias redes nativamente:

| Sufixo no nome do arquivo | Canal a pular |
|---|---|
| `-jatiktok` | TikTok Empreendedor Digital |
| `-jatiktok2` | TikTok #2 / Franklin Empreendedor Digital |
| `-jainsta` | Instagram |
| `-jaface` | Facebook |
| `-jayoutube` | YouTube |

Exemplos: `dica proteina pos treino-jatiktok.mp4` (pula só o TikTok Empreendedor, posta nos outros 4) · `promocao verao-jainsta-jaface.mp4` (pula Instagram e Facebook, posta nos outros 3). Publique normalmente em todos os canais que **não** aparecem sinalizados no nome.

## Passo 3 — Publicar via API do hostnet-server (app.franklinmorais.com)

Desde 2026-08-27 a publicação não passa mais pela Postiz — cada rede é chamada direto pela própria API oficial dela, através do servidor da Máquina de Vendas Online (`app.franklinmorais.com`), usando o mesmo token que o Franklin já autorizou lá.

**3.0 — Antes de tudo: o arquivo precisa estar publicado no GitHub.** As rotas de publish pedem uma URL pública de mídia (`mediaUrl`), não um upload direto. Como este repositório é público, a URL é sempre:
```
https://raw.githubusercontent.com/franklinmbe/maquina-de-vendas-online/main/.claude/skills/frank/<caminho-do-arquivo>
```
Se o arquivo ainda não foi commitado/pushado pro `main` (ex: você acabou de gerar um vídeo com ffmpeg), faça isso primeiro (`git add`, `git commit`, `git push`) antes de montar a URL — senão o GitHub devolve 404 e a publicação falha.

**Autenticação**: todas as chamadas abaixo usam `identifier` (fixo: `franklinmbe@gmail.com`) e `password` — use a senha mestra guardada na variável de ambiente `MVO_APP_PASSPHRASE` (`.claude/settings.local.json`), **nunca** escreva a senha em texto puro num comando ou neste arquivo. Ela funciona como admin: publica em nome da conta sem precisar da senha real do cliente (esse mecanismo existe pra qualquer cliente, não só pro Franklin).

**3.1 — Facebook + Instagram** (pule os canais já marcados com sufixo `-jaface`/`-jainsta`):
```
POST https://app.franklinmorais.com/api/meta/publish
Body (JSON): {
  "identifier": "franklinmbe@gmail.com",
  "password": "<MVO_APP_PASSPHRASE>",
  "mediaUrl": "<url do raw.githubusercontent.com>",
  "mediaType": "image" | "video",
  "caption": "<legenda>",
  "targets": ["facebook", "instagram"]  // remova o que estiver marcado pra pular
}
```

**3.2 — YouTube** (só para vídeo; pule se tiver sufixo `-jayoutube`):
```
POST https://app.franklinmorais.com/api/youtube/publish
Body (JSON): {
  "identifier": "franklinmbe@gmail.com",
  "password": "<MVO_APP_PASSPHRASE>",
  "mediaUrl": "<url do raw.githubusercontent.com>",
  "title": "<título curto, pensado pra busca/SEO>",
  "description": "<legenda>",
  "privacyStatus": "public"
}
```

**3.3 — TikTok** (só para vídeo; pule os que tiverem sufixo `-jatiktok`/`-jatiktok2`):
```
POST https://app.franklinmorais.com/api/tiktok/publish
Body (JSON): {
  "identifier": "franklinmbe@gmail.com",
  "password": "<MVO_APP_PASSPHRASE>",
  "mediaUrl": "<url do raw.githubusercontent.com>",
  "caption": "<legenda>"
}
```
Sem `targets`, publica nas **duas** contas de TikTok conectadas de uma vez (é o comportamento padrão do Franklin — um vídeo pras duas). Se quiser só uma conta específica, adicione `"targets": ["<openId>"]` (ver `/data/users.json` na VPS pra saber o openId de cada uma, ou pergunte ao Franklin).

**⚠️ Enquanto o app do TikTok não passar pela revisão oficial (Content Posting API)**, todo vídeo publicado por essa rota sai como **privado (SELF_ONLY)** — só o Franklin logado naquela conta consegue ver, ninguém mais. Isso é uma limitação da própria TikTok, não um bug — publique normalmente (é melhor que nada), mas avise o Franklin no resumo final que esse vídeo específico está privado até a revisão ser aprovada.

Cada chamada acima devolve `results` (Meta/TikTok) com `status: "ok"` ou `"erro"` por canal — confira sempre antes de considerar publicado.

## Passo 4 — Depois de publicar

Mova o arquivo processado para uma subpasta `processados/` dentro desta mesma pasta (crie-a se não existir), pra não publicar de novo na próxima checagem. Avise o Franklin (resumo curto: o que foi publicado, em quais redes, e o link se disponível).

## Observações

- Nunca publique sem pelo menos ter visto a imagem ou recebido a descrição do vídeo — não invente conteúdo.
- Se a API retornar erro, não tente de novo sozinho mais de uma vez — reporte o erro ao Franklin.
- Se algum dia migrar de conta paga de novo, só atualizar a URL base e os IDs de canal nesta seção — o resto do processo não muda.
- **Nunca mova um arquivo de outra pasta de skill (ex: `kleber-construcao/`) pra dentro de `frank/`, nem publique arquivo que não foi colocado originalmente aqui por Franklin.** Só publique o que estiver solto direto nesta pasta. Se encontrar aqui um arquivo que pareça ser de outra marca/empresa (conteúdo, nome, endereço, telefone diferentes do Franklin), não mova nem publique — pare, deixe o arquivo onde está, e reporte a dúvida no resumo final pra Franklin decidir.
