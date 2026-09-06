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

## Canais Postiz da Rjinox

- Facebook: *pendente — Franklin ainda precisa conectar no painel da Postiz*
- Instagram: *pendente*
- TikTok: *pendente*

Atualizar essa lista com os IDs reais (via `mcp__postiz__integrationList`) assim que forem conectados — mesmo padrão já usado em `.claude/skills/kleber-construcao/SKILL.md`. Confirmado em 2026-09-06: a conta Postiz tinha 5/10 canais ocupados antes da Rjinox (3 do Kleber, 2 TikTok do Franklin) — cabem os 3 canais da Rjinox sem estourar o teto de 10.
