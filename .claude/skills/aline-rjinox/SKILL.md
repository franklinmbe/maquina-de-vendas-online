---
name: aline-rjinox
description: Verifica se chegou algum arquivo novo (imagem ou vídeo) na pasta .claude/skills/aline-rjinox/ e, se sim, publica na página compartilhada da Rjinox (Facebook/Instagram/TikTok, via Postiz) — identificando sempre que o conteúdo é da vendedora Aline (telefone 21993073039, login dela no app), pra depois virar anúncio no grupo de anúncios dela no Meta Ads.
---

Esta skill cuida do conteúdo da Aline, uma das 4 vendedoras da Rjinox (não é marca própria do Franklin, nem um cliente único — a Rjinox tem 4 vendedores, cada um com pasta e telefone próprios: `eduardo-rjinox`, `jaqueline-rjinox`, `aline-rjinox`, `alessandra-rjinox`). Os arquivos ficam soltos direto nesta pasta (`.claude/skills/aline-rjinox/`), fora de `processados/`.

**Ver `.claude/skills/rjinox-log/PROTOCOLO.md` pro protocolo completo compartilhado entre os 4 vendedores** (por que a separação existe, formato do log, IDs de integração da Postiz, regra de troca de anúncio) — esta skill só cobre os passos específicos de processar o conteúdo da Aline.

## Passo 1 — Verificar se há arquivo novo

Liste os arquivos de imagem/vídeo (`.jpg`, `.jpeg`, `.png`, `.webp`, `.mp4`, `.mov`) direto dentro desta pasta (ignore o que já estiver em `processados/`). Se não houver nenhum, não faça nada.

## Passo 2 — Para cada arquivo novo encontrado

**Se for imagem**: leia/veja a imagem diretamente e escreva um título curto, uma legenda (tom de vendas — a Rjinox vende cozinhas industriais, ver contexto completo em `.claude/skills/rjinox-log/PROTOCOLO.md`; siga o que aparecer na própria imagem, não invente característica de produto que não apareça nela) e 3-5 hashtags relevantes.

**Se for vídeo**, você não consegue assistir — use, nesta ordem, o primeiro que der certo:

1. **Imagem pareada**: procure na pasta uma imagem com o **mesmo nome base** do vídeo (ex: `promocao.mp4` + `promocao.jpg`). Se existir, veja essa imagem e use ela como base pra escrever título/legenda/hashtags — publique só o vídeo.
2. **Nome do arquivo descritivo**: se o nome já descreve o assunto, transforme em frase natural — não publique o nome do arquivo literalmente.
3. **Nenhum dos dois**: pergunte à Aline (via Franklin) do que se trata antes de continuar — não invente a legenda do zero sem nenhuma pista.

## Passo 3 — Publicar (via Postiz, canal compartilhado da Rjinox)

Ver `.claude/skills/rjinox-log/PROTOCOLO.md` pros IDs de integração da Postiz e o passo a passo de upload/postagem (mesmo mecanismo já usado em `.claude/skills/kleber-construcao/SKILL.md`, Passo 3.2). **Se os canais da Rjinox ainda não estiverem conectados na Postiz, pare e avise o Franklin** — não há caminho alternativo de publicação pra esta pasta.

## Passo 3B — Registrar no log (obrigatório, não pule)

Depois de publicar com sucesso, adicione uma linha em `.claude/skills/rjinox-log/log-publicacoes.md`: data, **Aline**, telefone **21993073039**, nome do arquivo, redes publicadas, e o link/ID do post retornado pela Postiz. Sem essa linha, a publicação não está completa.

## Passo 4 — Depois de publicar

Mova o arquivo processado para dentro de `processados/` nesta mesma pasta (crie-a se não existir). Avise o Franklin (resumo curto: o que foi publicado, em quais redes, e o link).

## Observações

- Nunca publique sem ter visto a imagem ou recebido a descrição do vídeo — não invente conteúdo.
- **Nunca mova um arquivo de outra pasta de skill (nem das outras vendedoras da Rjinox) pra dentro de `aline-rjinox/`, nem publique aqui algo que não foi colocado originalmente nesta pasta como conteúdo da Aline.** Se algo parecer ser de outro vendedor, não mova nem publique — pare e reporte a dúvida pro Franklin decidir (mesma regra de sempre, ver incidente registrado em `.claude/skills/kleber-construcao/SKILL.md`).
