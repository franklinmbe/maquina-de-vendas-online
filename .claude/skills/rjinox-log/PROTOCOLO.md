# Protocolo de conteúdo dos vendedores da Rjinox

A Rjinox tem 4 vendedores, cada um com telefone próprio (login dele no app) e uma pasta de skill própria em `.claude/skills/`:

| Vendedor | Telefone (login) | Pasta |
|---|---|---|
| Eduardo (Dudu) | 21964377401 | `eduardo-rjinox` |
| Jaqueline (Jack) | 21994722099 | `jaqueline-rjinox` |
| Aline | 21993073039 | `aline-rjinox` |
| Alessandra (Ale) | 21980316365 | `alessandra-rjinox` |

Todos os 4 já têm conta liberada no app (`app.franklinmorais.com`), plano especialista, senha `@rjinox` (diferente da senha mestra do Franklin — nunca reusar a senha mestra numa conta de vendedor, ver incidente evitado em 2026-09-06/07: a primeira tentativa usou a senha mestra por engano, o que faria qualquer vendedor logar como admin).

Cada vendedor manda o próprio criativo (foto/vídeo) direto na pasta dele, via o app (login com o telefone dele). **Nunca misturar conteúdo de um vendedor pra pasta de outro** — mesma regra de sempre usada em qualquer skill de cliente (ver aviso no SKILL.md de cada pasta).

## Por que existe esse protocolo

Todos os 4 vendedores publicam na MESMA página da Rjinox (Facebook/Instagram/TikTok) — mas cada criativo publicado depois é reaproveitado como anúncio no Meta Ads Manager, no grupo de anúncios do vendedor específico que o criou (o telefone dele é o diferencial usado no anúncio, ex: clique-para-WhatsApp). Pra isso nunca misturar o telefone errado com o criativo errado, toda publicação feita nessa página precisa ficar registrada: de qual vendedor é, e o link/ID do post resultante.

## Regra fixa: o conteúdo é SÓ da Rjinox — nunca telefone nem imagem de vendedor (definida por Franklin em 2026-09-17, ampliada em 2026-09-21, **nome relaxado em 2026-09-22**)

**Nenhum banner, foto, vídeo, legenda ou narração publicado pode trazer o telefone do vendedor, nem mostrar um vendedor** — nem falado na narração, nem como pessoa/rosto de vendedor numa foto ou banner. Vale pros 4 vendedores. Foco: o produto, a cozinha/equipamento e a marca da empresa. Pra chamada à ação, frase genérica ("Fale com nosso time!"), nunca número de telefone.

**Nome do vendedor — revisado em 2026-09-22**: nome sozinho (sem telefone junto) **deixou de bloquear mídia** — se um banner gerado ou uma foto/vídeo real que o cliente anexou já vier com o nome do vendedor escrito, mas sem telefone, pode publicar normalmente (Franklin: "se o banner vier já com o nome do vendedor, só nome sem telefone, pode postar só com o nome"). Isso vale só pra **mídia** (banner/foto/vídeo) — a legenda e a narração escritas pela IA continuam sem mencionar nome de vendedor por padrão (o planejador não foi instruído a inventar nome à toa, só parou de ser bloqueante quando o nome já vem pronto na mídia).

O telefone continua existindo e sendo usado por dentro (login no app, `log-publicacoes.md`, campanha de clique-para-WhatsApp no Meta Ads Manager — ver seções acima) — só não pode aparecer pro público no conteúdo em si.

**Aplicação no código (desde 2026-09-21, relaxamento do nome em 2026-09-22)**: `app/hostnet-server/lib/client-content-rules.js`, pra qualquer cliente cujo slug termina em `-rjinox` — (1) o planejador da geração automática recebe a regra; (2) todo prompt de banner ganha um reforço fixo e a legenda/narração são limpas de telefone (e de nome, por padrão de escrita — mas isso não bloqueia nada) antes de gerar; (3) a legenda final é limpa de novo na hora de publicar (aprovação e agendamento). **Leitura de tudo que está escrito/falado nas mídias (desde 2026-09-21, pedido do Franklin)**: `app/hostnet-server/lib/media-text-detection.js`. Em todo pedido de todo cliente o servidor lê o texto de cada imagem (OCR por visão) e usa a fala + texto de tela que a análise do vídeo já traz, e grava em `texto-detectado.json` na pasta do pedido. **Só pra Rjinox isso bloqueia, e só por TELEFONE (não mais por nome sozinho)**: foto/vídeo com telefone de vendedor **não vai pra revisão/publicação** (nem como está, nem como slide de vídeo); banner gerado pela IA é lido depois de pronto e refeito 1 vez se sair com telefone (se persistir, é descartado); mídia que não deu pra ler também é barrada (falha fechada). O agendador (que publica sem passar pela geração) confere cada imagem/vídeo antes de publicar. O motivo aparece pro vendedor no acompanhamento do pedido (`vendorBlocks` / status `blocked_vendor_identifier` em `geracao-status.json`); se nada sobrar pra publicar, o pedido para com a explicação.

**Limite conhecido**: a leitura pega **texto** (telefone escrito ou falado), não **pessoas** — um vendedor aparecendo no rosto de uma foto ou vídeo, sem telefone escrito, não é detectado (a IA não sabe quem é vendedor). Isso segue dependendo de revisão humana (sessão manual, ou o cliente na página de aprovação). Sessões manuais que publicam pra Rjinox seguem esta mesma regra à risca.

## Regra fixa: paleta de cores da marca — só preto, cinza, vermelho e branco (definida por Franklin em 2026-09-22)

**Todo banner/imagem/vídeo gerado por IA pra qualquer um dos 4 vendedores da Rjinox só pode usar preto, cinza, vermelho e branco** — nenhuma outra cor (sem azul, verde, amarelo, laranja, roxo, etc.), nem no fundo, nem em elementos gráficos, nem no texto escrito na arte. Vale pro pedido de qualquer vendedor, qualquer formato (post, reels, carrossel, stories).

**Limite conhecido**: essa regra só se aplica ao que a IA **gera** do zero (banner, e o banner que vira slide do vídeo "slideshow narrado") — não dá pra "recolorir" uma foto/vídeo real que o vendedor já mandou pronto, então nesse caso a regra não se aplica (publica como está, igual a qualquer outro conteúdo passthrough).

**Aplicação no código (desde 2026-09-22)**: `app/hostnet-server/lib/client-content-rules.js` — (1) o planejador recebe a regra (`promptRulesFor`); (2) todo prompt de banner ganha o reforço fixo de paleta (`BANNER_SUFFIX_RJINOX`), mesmo ponto de aplicação da regra de nome/telefone acima. Não existe uma camada de verificação pós-geração pra cor (diferente do nome/telefone, que é lido de volta e refeito se falhar) — é só prevenção via prompt.

## Regra fixa: nunca citar o site da Rjinox — a chamada à ação é sempre pro WhatsApp (definida por Franklin em 2026-09-22)

**Nenhum banner, legenda ou narração gerado por IA pode citar o site/URL da Rjinox** — motivo: a chamada à ação é sempre pro WhatsApp, nunca pro site. Vale pro pedido de qualquer um dos 4 vendedores.

**Diferença importante em relação à regra de nome/telefone acima**: aquela vale pra "postagens e banners" (mídia real que o vendedor manda também é conferida). Essa de site foi pedida só pra "banners" — então só afeta o que a IA **escreve/gera** (planejador, prompt de banner, legenda, narração, e a verificação do banner pronto), **não** a leitura de foto/vídeo real que o vendedor anexa. Uma foto real que por acaso mostre o site da empresa (ex: foto de uma placa, cartão de visita) não é bloqueada por essa regra.

**Aplicação no código (desde 2026-09-22)**: `app/hostnet-server/lib/client-content-rules.js` — (1) o planejador recebe a regra; (2) prompt de banner ganha reforço fixo; (3) legenda/narração são limpas de URL (`sanitizeClientText`, mesma função que já limpa nome/telefone). **Verificação extra só pra banner gerado** (mesmo padrão da checagem de nome/telefone): `checkGeneratedImage` (`lib/media-text-detection.js`) lê o banner pronto e, se achar site/URL, refaz uma vez com instrução reforçada; se persistir, descarta o banner.

## Regra fixa: chamada à ação genérica por padrão, sem citar canal (definida por Franklin em 2026-09-17, refinada no mesmo dia)

**Padrão: chamada à ação genérica, sem citar nenhum canal** (ex: "Fale com nosso vendedor!" — sem dizer WhatsApp, Direct ou Messenger). **Nunca escrever "chama no Direct" / "manda mensagem no Direct" / "fale pelo Messenger" (ou qualquer variação) em banner ou legenda dos 4 vendedores da Rjinox — eles só atendem por WhatsApp, isso não muda nunca.**

**Exceção: só citar "WhatsApp" explicitamente se o próprio vendedor pedir isso no pedido dele** (ex: escreveu algo como "coloca que é pelo WhatsApp" nas instruções). Se ele não pedir, não cita nenhum canal — nem WhatsApp, nem Direct, nem Messenger. Direct/Messenger continuam banidos mesmo nesse caso excepcional (nunca é opção, pedido ou não).

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

## Como a Rjinox publica hoje (atualizado em 2026-09-21)

**Facebook e Instagram saem DIRETO pela API do app (`hostnet-server`), sem Postiz.** Conexão feita em 2026-09-21 pela conta pessoal do Franklin, com acesso de tarefas (Conteúdo + Insights) à Página dada pelo dono da Página (perfil "Anderson Pujol"): só a Página "RJ INOX Cozinhas industriais" (`193486100512300`) e o Instagram `@rj.inox` (`17841411376444190`), gravados em `connections.meta` dos 4 vendedores (mesma conexão copiada pras 4 contas — as 4 usam a mesma Página). **`postizConnections` dos 4 ficou só com o TikTok — não recolocar Facebook/Instagram lá, senão o app publica duas vezes.** Com a conexão direta, os relatórios de redes sociais de cada vendedor passam a funcionar (métricas avançadas dependem da aprovação do Meta, ver roteiro). **Só o TikTok continua na Postiz** (app do TikTok em revisão).

Os canais de Facebook e Instagram abaixo são da fase antiga (Postiz) e já foram removidos de lá — ficam só como histórico.

## Canais Postiz da Rjinox (conectados em 2026-09-06/07; só o TikTok segue em uso)

| Rede | Nome do canal | ID de integração |
|---|---|---|
| Facebook | RJ INOX Cozinhas Industriais | `cmtqf1f5a03hvlm0yju1ib927` |
| Instagram | RJ INOX | `cmtqf0bcr0alfqk0ytejff3sn` |
| TikTok Business | Rjinox Cozinhas Industriais | `cmtqf25vo0an5qk0y6ev8gm9b` |

Pra postar nas três de uma vez, inclua os três objetos `integration` no array `posts` da chamada `POST /public/v1/posts` (ver `.claude/skills/kleber-construcao/SKILL.md`, Passo 3.2, pro formato exato de upload + post) — Facebook/Instagram aceitam foto ou vídeo, TikTok só vídeo (pule o TikTok se o conteúdo for só imagem). Confirmado: a conta Postiz tinha 5/10 canais antes da Rjinox (3 do Kleber, 2 TikTok do Franklin) — com esses 3 da Rjinox, fica em 8/10.
