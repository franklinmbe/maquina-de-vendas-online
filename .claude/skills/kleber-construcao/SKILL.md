---
name: kleber-construcao
description: Verifica se chegou algum arquivo novo (imagem ou vídeo) na pasta .claude/skills/kleber-construcao/ e, se sim, publica nas redes sociais do Kleber (material de construção, cliente) — Facebook/Instagram direto via API do hostnet-server (app.franklinmorais.com), TikTok ainda via API do Postiz até o app do TikTok passar por revisão.
---

Esta skill cuida do conteúdo do Kleber (empresa cliente de material de construção, não é marca própria do Franklin). Os arquivos ficam soltos dentro desta mesma pasta (`.claude/skills/kleber-construcao/`), fora de `processados/`.

## Passo 1 — Verificar se há arquivo novo

Liste os arquivos de imagem/vídeo (`.jpg`, `.jpeg`, `.png`, `.webp`, `.mp4`, `.mov`) direto dentro desta pasta (ignore o que já estiver em `processados/`). Se não houver nenhum, não faça nada.

## Passo 1B — Tarefas em grupo (subpasta com `instrucoes.txt`)

Além de arquivos soltos, o Franklin também pode pedir tarefas mais complexas pro Kleber (carrossel com várias fotos, vídeo com música/narração, etc). Pra isso, ele cria uma **subpasta dentro de `kleber-construcao/`** (nome livre, ex: `grupo1`, `grupo2`... sempre subindo o número, nunca reaproveitando) contendo os arquivos de mídia **+ um arquivo `instrucoes.txt`** com o pedido em texto livre.

- **O sinal de que é uma tarefa pendente é a presença do `instrucoes.txt`** dentro da subpasta — não o nome dela.
- Leia o `instrucoes.txt` e siga o que ele pede.
- **Publicação de carrossel/imagem via Postiz**: sempre possível, siga o Passo 3 normalmente.
- **Montagem de vídeo (fotos + música/narração)**: use `ffmpeg` via Bash, mesma receita testada e aprovada do Franklin (ver `.claude/skills/frank/SKILL.md`, seção Passo 1B, pra detalhes técnicos da montagem — duração por imagem, transições, mapeamento de áudio).
  - Narração falada (texto pra virar voz) não tem solução automática hoje — pule e reporte que precisa ser feito com o Franklin.
  - Se o pedido for complexo demais ou ambíguo, não invente conteúdo — pule a subpasta, não mova pra `processados/`, e reporte no resumo final.
- Depois de concluir com sucesso, mova a **subpasta inteira** para dentro de `processados/` (ex: `kleber-construcao/grupo1/` → `kleber-construcao/processados/grupo1/`).

## Passo 2 — Para cada arquivo novo encontrado

**Se for imagem**: leia/veja a imagem diretamente e escreva um título curto, uma legenda (tom profissional de negócio local — material de construção, confiança, qualidade, preço/condições se aparecer na peça — em português) e 3-5 hashtags relevantes com base no que aparece na imagem.

**Se for vídeo**, você não consegue assistir — use, nesta ordem, o primeiro que der certo:

1. **Imagem pareada**: procure na pasta uma imagem com o **mesmo nome base** do vídeo (ex: `promocao-cimento.mp4` + `promocao-cimento.jpg`). Se existir, veja essa imagem, entenda do que se trata, e use ela como base pra escrever título/legenda/hashtags — você publica só o vídeo (a imagem foi só de referência).
2. **Nome do arquivo descritivo**: se o nome do arquivo já descreve o assunto (ex: `promocao-telha-agosto.mp4`), use esse nome como base do título/legenda — transforme em uma frase natural, não publique o nome do arquivo literalmente.
3. **Nenhum dos dois**: como último recurso, pergunte ao Franklin do que se trata antes de continuar (não invente a legenda do zero sem nenhuma pista).

**Conteúdo já postado nativo em algum canal**: se o Kleber (ou o Franklin em nome dele) já postou direto pelo app da rede e depois baixou o arquivo pra postar nas outras, use o mesmo sistema de sufixo no nome do arquivo pra pular esse canal (`-jainsta`, `-jaface`, etc. — mesma convenção de `.claude/skills/frank/SKILL.md`), ajustando pros canais que existirem aqui.

## Passo 3 — Publicar

**⚠️ Situação provisória (definida por Franklin em 2026-08-30, revisar depois que a migração abaixo terminar)**: o Kleber ainda não conectou Facebook/Instagram pelo app novo — isso depende de um pedido de acesso via Business Manager que só pode ser aprovado quando o telefone da loja física estiver disponível (esperado 2026-08-31, ver memória `urgent-kleber-facebook-approval-2026-08-31`). Enquanto isso não sai, **Facebook e Instagram do Kleber publicam pela Postiz** (mesma conta paga do TikTok) — as duas contas já estão conectadas lá de antes da migração original. **Assim que o Franklin confirmar que a conexão direta via app foi concluída, volte a usar a API do hostnet-server (3.1 abaixo) e pare de usar a Postiz pra Facebook/Instagram.**

**3.0 — O arquivo precisa estar publicado no GitHub** (mesma lógica de `.claude/skills/frank/SKILL.md`, Passo 3.0): construa a URL pública como
```
https://raw.githubusercontent.com/franklinmbe/maquina-de-vendas-online/main/.claude/skills/kleber-construcao/<caminho-do-arquivo>
```
commitando/pushando pro `main` antes se ainda não estiver lá. **Isso só é necessário pro caminho 3.1 (API direta)** — o caminho 3.2 (Postiz) faz upload direto do arquivo, não depende do GitHub.

**3.1 — Facebook + Instagram via API direta (hostnet-server)** — **pausado por enquanto, ver aviso acima**. Identificador do Kleber: `klebernascimentodarocha@gmail.com`. Autenticação: senha mestra (`MVO_APP_PASSPHRASE`, em `.claude/settings.local.json`) como `password` — nunca escreva em texto puro neste arquivo ou num comando.
```
POST https://app.franklinmorais.com/api/meta/publish
Body (JSON): {
  "identifier": "klebernascimentodarocha@gmail.com",
  "password": "<MVO_APP_PASSPHRASE>",
  "mediaUrl": "<url do raw.githubusercontent.com>",
  "mediaType": "image" | "video",
  "caption": "<legenda>",
  "targets": ["facebook", "instagram"]
}
```
A chamada devolve `results` com `status: "ok"` ou `"erro"` por canal — confira sempre antes de considerar publicado. Se retornar "Nenhuma conta do Facebook/Instagram conectada", é porque a conexão direta ainda não foi feita — não é bug, use o caminho 3.2 abaixo enquanto isso.

**3.2 — Facebook, Instagram e TikTok via Postiz (caminho ativo agora pras 3 redes)**: pule qualquer canal já marcado com sufixo `-jaface`/`-jainsta`/`-jatiktok` no nome do arquivo. Chave em `.claude/settings.local.json` (`env.POSTIZ_API_KEY`) — confirmada funcionando em 2026-08-30 (a antiga estava com a chave errada/rotacionada, corrigida nessa data).
```
POST https://api.postiz.com/public/v1/upload   (Authorization: <POSTIZ_API_KEY>, multipart/form-data, campo "file")
POST https://api.postiz.com/public/v1/posts    (Authorization: <POSTIZ_API_KEY>)
Body: { "type": "now", "shortLink": false, "date": "<ISO 8601>", "tags": [],
  "posts": [{ "integration": { "id": "<id abaixo>" }, "value": [{ "content": "<legenda>", "image": [<objeto do upload>] }] }] }
```
IDs de integração do Kleber na Postiz (confirmados 2026-08-30 via `GET /public/v1/integrations`):
- Instagram (`kleber_materiais_de_construcao`): `cmt1l09d50fi1ow0y80kzbqb9`
- Facebook ("Kleber Materiais de Construção"): `cmt1l1ptt0fimow0yu7rj049x`
- TikTok Business (`kleber_construcao`): `cmt1l3c1h0d8ipg0yj05dosf3`

Pra postar nas três de uma vez, inclua os três objetos `integration` no array `posts`, um por rede — Facebook/Instagram aceitam foto ou vídeo, TikTok só vídeo (pule o TikTok se o conteúdo for só imagem).

## Passo 4 — Depois de publicar

Mova o arquivo processado para uma subpasta `processados/` dentro desta mesma pasta (crie-a se não existir), pra não publicar de novo na próxima checagem. Avise o Franklin (resumo curto: o que foi publicado, em quais redes, e o link se disponível).

## Observações

- Nunca publique sem pelo menos ter visto a imagem ou recebido a descrição do vídeo — não invente conteúdo.
- Se a API retornar erro, não tente de novo sozinho mais de uma vez — reporte o erro ao Franklin.
- Se algum dia o Kleber conectar/desconectar canais no Postiz, atualize os IDs na seção Passo 3 — o resto do processo não muda.
- **Nunca mova um arquivo de outra pasta de skill (ex: `frank/`) pra dentro de `kleber-construcao/`, nem publique arquivo que não foi colocado originalmente aqui por Franklin como conteúdo do Kleber.** Só publique o que estiver solto direto nesta pasta. Se encontrar aqui um arquivo que pareça ser de outra marca/empresa (nome, endereço, telefone diferentes de "Kleber Materiais de Construção"), não mova nem publique — pare, deixe o arquivo onde está, e reporte a dúvida no resumo final pra Franklin decidir. **Incidente real (2026-08-20)**: um flyer de outra loja ("Materiais de Construção João Pinheiro") tinha sido movido pra esta pasta por engano numa limpeza anterior, e foi publicado nas redes do Kleber por essa skill sem checar se o conteúdo batia com o nome do cliente — não repita esse erro.
