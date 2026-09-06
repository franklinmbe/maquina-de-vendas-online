# Protocolo de conteúdo dos vendedores da Rjinox

A Rjinox tem 4 vendedores, cada um com telefone próprio (login dele no app) e uma pasta de skill própria em `.claude/skills/`:

| Vendedor | Telefone (login) | Pasta |
|---|---|---|
| Eduardo (Dudu) | 21970680243 | `eduardo-rjinox` |
| Jaqueline (Jack) | 21994722099 | `jaqueline-rjinox` |
| Aline | 21993073039 | `aline-rjinox` |
| Alessandra (Ale) | 21980316365 | `alessandra-rjinox` |

Todos os 4 já têm conta liberada no app (`app.franklinmorais.com`), plano especialista, senha `@rjinox` (diferente da senha mestra do Franklin — nunca reusar a senha mestra numa conta de vendedor, ver incidente evitado em 2026-09-06/07: a primeira tentativa usou a senha mestra por engano, o que faria qualquer vendedor logar como admin).

Cada vendedor manda o próprio criativo (foto/vídeo) direto na pasta dele, via o app (login com o telefone dele). **Nunca misturar conteúdo de um vendedor pra pasta de outro** — mesma regra de sempre usada em qualquer skill de cliente (ver aviso no SKILL.md de cada pasta).

## Por que existe esse protocolo

Todos os 4 vendedores publicam na MESMA página da Rjinox (Facebook/Instagram/TikTok) — mas cada criativo publicado depois é reaproveitado como anúncio no Meta Ads Manager, no grupo de anúncios do vendedor específico que o criou (o telefone dele é o diferencial usado no anúncio, ex: clique-para-WhatsApp). Pra isso nunca misturar o telefone errado com o criativo errado, toda publicação feita nessa página precisa ficar registrada: de qual vendedor é, e o link/ID do post resultante.

## Passo obrigatório depois de publicar: registrar no log

Depois de publicar qualquer conteúdo de um vendedor na página compartilhada da Rjinox (via Postiz), adicione uma linha em `.claude/skills/rjinox-log/log-publicacoes.md` com: data, nome do vendedor, telefone dele, nome do arquivo, redes publicadas, e o link/ID do post que a Postiz retornou. Sem essa linha, a publicação não está completa — sempre registre antes de mover o arquivo original pra `processados/` na pasta do vendedor.

## Regra de troca de anúncio (executada manualmente por Franklin no Meta Ads Manager)

Quando um anúncio de um vendedor completar **30 dias sem performar** (critério e avaliação de Franklin, direto no Gerenciador de Anúncios):
1. Franklin identifica de qual vendedor é o anúncio antigo (pelo grupo de anúncios/campanha).
2. Consulta `log-publicacoes.md` e pega o post **mais recente registrado com o telefone daquele vendedor**.
3. Usa esse post como novo criativo do anúncio ("usar publicação existente" no Gerenciador de Anúncios do Meta), no grupo de anúncios — de venda ou de engajamento, o que estiver precisando mais no momento.
4. Substitui o anúncio antigo por esse criativo novo.

Os passos 3 e 4 são manuais, feitos pelo próprio Franklin — o log garante que ele nunca precisa adivinhar de quem é um post. Automatizar essa troca via API de anúncios do Meta é um projeto separado, ainda não iniciado (esta sessão não tem acesso a nenhuma ferramenta de Gerenciador de Anúncios).

## Sobre o negócio (contexto pra legenda/tom de venda)

A Rjinox (nome completo nos canais: "RJ Inox Cozinhas Industriais") vende **cozinhas industriais** — equipamentos e instalações pra cozinha profissional (restaurantes, refeitórios, indústria alimentícia). Use esse segmento como base do tom de venda ao escrever legenda (confiança, robustez, qualidade profissional, inox), mas sempre confirme pelo que aparece na própria imagem/vídeo do vendedor — não generalize demais nem invente características do produto específico que não apareçam no material.

## Canais Postiz da Rjinox (conectados em 2026-09-06/07)

| Rede | Nome do canal | ID de integração |
|---|---|---|
| Facebook | RJ INOX Cozinhas Industriais | `cmtqf1f5a03hvlm0yju1ib927` |
| Instagram | RJ INOX | `cmtqf0bcr0alfqk0ytejff3sn` |
| TikTok Business | Rjinox Cozinhas Industriais | `cmtqf25vo0an5qk0y6ev8gm9b` |

Pra postar nas três de uma vez, inclua os três objetos `integration` no array `posts` da chamada `POST /public/v1/posts` (ver `.claude/skills/kleber-construcao/SKILL.md`, Passo 3.2, pro formato exato de upload + post) — Facebook/Instagram aceitam foto ou vídeo, TikTok só vídeo (pule o TikTok se o conteúdo for só imagem). Confirmado: a conta Postiz tinha 5/10 canais antes da Rjinox (3 do Kleber, 2 TikTok do Franklin) — com esses 3 da Rjinox, fica em 8/10.
