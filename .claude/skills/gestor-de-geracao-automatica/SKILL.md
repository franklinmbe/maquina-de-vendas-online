---
name: gestor-de-geracao-automatica
description: Roda em ciclo (rotina de nuvem agendada) e varre pastas de cliente liberadas procurando pedidos (app-YYYYMMDD-HHMMSS/) que ainda não têm revisao/ — decide se cada um precisa de geração por IA, reivindica o pedido, checa os limites de cota, gera (delegando pro pipeline de gestor-de-geracao-ia-google) ou só copia a mídia original, e sobe o resultado pra revisao/ pronto pra aprovação do cliente. Idempotente: nunca reprocessa nem recobra cota de um pedido já reivindicado/bloqueado/concluído.
---

Orquestrador da automação pela nuvem da geração de conteúdo (decisão de Franklin, 2026-09-07/08, ver `CLAUDE.md`) — substitui a etapa que hoje só acontece quando alguém abre uma sessão de chat comigo e processa um pedido à mão. **Não duplica o pipeline de geração** — delega pra `.claude/skills/gestor-de-geracao-ia-google/SKILL.md`, do mesmo jeito que `kleber-construcao/SKILL.md` já delega detalhes de FFmpeg pra `frank/SKILL.md`.

**O que já funciona sozinho e esta skill NUNCA deve tocar**: assim que existe conteúdo em `revisao/`, a aprovação (`aprovacao.html` + `approve-pedido.js`) e a publicação (`auto-publish.js`) já são 100% automáticas desde 2026-08-30. O trabalho desta skill termina no momento em que `revisao/` fica pronto.

## Constantes (ajustar aqui, não espalhar pelo resto do arquivo)

```
ALLOWED_CLIENTS = ["frank", "kleber-construcao"]   # ampliado em 2026-09-08 pra Franklin testar com o Kleber. Ver "Como ampliar depois".
MAX_GENERATION_ATTEMPTS = 2   # tentativa inicial + 1 retry, depois vira failed_permanent
STALE_CLAIM_MINUTES = 20      # claim mais velho que isso e sem revisao/ = execução anterior travou/caiu
```

## Passo 0 — Sincronizar

`git pull origin main` no checkout local da rotina.

## Passo 1 — Descobrir candidatos

Para cada nome em `ALLOWED_CLIENTS` (nunca variar isso sozinho — não processar `kleber-construcao/` nem as pastas `*-rjinox/` nesta versão, mesmo que existam pedidos parados lá; isso é decisão de negócio do Franklin, não técnica):

- Listar subpastas de `.claude/skills/<client>/` que casem com o padrão `app-\d{8}-\d{6}` (ignorar `processados/`, `grupo*/`, arquivos soltos na raiz — território das skills de publicação já existentes, como `frank/SKILL.md`, não mexer nelas).
- Para cada uma **sem** subpasta `revisao/`: essa é a condição de "pendente" (confirmado empiricamente em 2026-09-08 processando os 3 pedidos que ficaram parados — nenhum tinha `revisao/`).
- Ler `geracao-status.json` na raiz dessa pasta, se existir, e seguir a árvore de decisão do Passo 2. Se não existir, é pedido novo — ir direto pro Passo 3.

## Passo 2 — Árvore de decisão por pedido candidato

- **Sem `geracao-status.json`** → novo, ir pro Passo 3 (triagem).
- **`status: "failed_permanent"`** → pular, não tocar. Precisa de intervenção manual do Franklin (processar como hoje, à mão, ou apagar o arquivo de status pra resetar e deixar a rotina tentar de novo).
- **`status: "quota_blocked_call_limit"` ou `"quota_blocked_media_limit"`** → tentar de novo só o(s) check-*-limit que faltou (checagem bloqueada não tem custo, não precisa de backoff). Ir pro Passo 4/5.
- **`status: "claimed"` ou `"generating"`**:
  - Se `(agora - claimedAt) < STALE_CLAIM_MINUTES`: pular — pode estar em andamento numa execução concorrente ou anterior ainda viva.
  - Se `>= STALE_CLAIM_MINUTES`: execução anterior travou/caiu. Ir direto pro Passo 6 **sem rechamar** `check-call-limit`/`check-media-limit` se `callLimitOk`/`mediaLimit` já estiverem gravados no status (nunca cobrar de novo pelo mesmo pedido).
- **`status: "done"` ou `"done_passthrough"` mas `revisao/` não existe** (push parcial, caso raro) → tratar como falha de geração, ir pro Passo 6.

## Passo 3 — Triagem (só pedidos novos)

Ler `instrucoes.txt` (formato `Enviado por: <email>\n\n<texto>`) e julgar — **julgamento de IA, não regra fixa**, mesma responsabilidade que já existe hoje numa sessão manual: o texto pede geração de conteúdo por IA (banner/imagem/vídeo criado do zero) ou só pede pra publicar a mídia que o cliente já enviou?

- Exemplo "precisa gerar": "faça 3 banners e um vídeo sobre X".
- Exemplo "não precisa": "posta essa foto que mandei", ou qualquer pedido cuja mídia já enviada seja o produto final (ex: um vídeo já editado, como aconteceu nos pedidos `app-20260908-013800`/`015400`).

**Se NÃO precisa gerar**:
1. Copiar os arquivos de mídia originais (tudo solto na raiz da pasta, exceto `instrucoes.txt`/`redes.json`/`formato.json`/`narracao.json`/`geracao-status.json`) pra dentro de `<pasta>/revisao/`, sem subpastas.
2. Escrever `geracao-status.json` com `status: "done_passthrough"`.
3. Um único commit (arquivos de `revisao/` + `geracao-status.json`), push. **Nenhuma chamada de cota** — publicar mídia já enviada é ilimitado (regra já existente, ver `CLAUDE.md`).
4. Terminar este pedido, seguir pro próximo candidato.

**Se precisa gerar**:
1. Escrever `geracao-status.json` com `status: "claimed"`, `claimedAt: <agora, ISO>`, `attempts: 1`.
2. Commit/push **imediatamente** — antes de chamar qualquer endpoint de cota. Esse commit é o que protege contra reprocessar/cobrar duas vezes o mesmo pedido num ciclo seguinte.
3. Ir pro Passo 4.

## Credenciais — ferramentas MCP, não a senha mestra direto

Rotinas de nuvem não têm acesso a `.claude/settings.local.json` (fica só na máquina local, nunca vai pro GitHub) nem a variáveis de ambiente configuráveis — por isso `check-call-limit`/`check-media-limit`/geração via Gemini **não são chamados como HTTP cru com a senha mestra**. Em vez disso, essa skill usa um conector MCP próprio, hospedado no mesmo servidor do app (`app.franklinmorais.com/mcp/<token>`, ver `app/hostnet-server/lib/mcp-automation-server.js`), anexado à rotina no claude.ai. As ferramentas aparecem com o prefixo do conector, ex: `mcp__automacao-mvo__check_call_limit` (o nome exato do conector pode variar — usar a ferramenta que corresponder pelo sufixo, ex: `*check_call_limit`, `*check_media_limit`, `*generate_image`, `*generate_tts`).

## Passo 4 — Checar limite de chamadas (uma vez por pedido)

Chamar a ferramenta MCP `check_call_limit` com `{ client: "<client>" }` (`client` = nome exato da pasta, ex: `frank`).

- **Bloqueado** (`{allowed:false}`): gravar `status: "quota_blocked_call_limit"`, `lastError`, `blockedAt`. Commit/push. Parar este pedido (sem `revisao/` ainda) — próximo ciclo tenta de novo, sem custo.
- **Permitido** (`{allowed:true}` — **já consumido no servidor nesta chamada**): gravar `callLimitOk: true`. **Nunca mais chamar essa ferramenta pra este pedido**, mesmo que a geração falhe depois e seja retomada.

## Passo 5 — Checar limite de mídia (uma vez por pedido/tipo)

A partir do julgamento do texto livre, decidir quantas imagens finais e quantos vídeos finais o pedido pede (contar só o resultado final, não slides internos de um vídeo).

Para cada tipo necessário, chamar `check_media_limit` com `{ client, type: "images"|"videos", count: <N> }`.

Gravar cada resultado em `geracao-status.json` (`mediaLimit.images`/`mediaLimit.videos`: `{requested, allowed, error?}`). Commit/push.

- Se **todos** os tipos necessários vierem bloqueados: `status: "quota_blocked_media_limit"`, parar (sem `revisao/`), próximo ciclo tenta de novo.
- Se **algum** tipo for permitido (mesmo que outro não): gerar só o(s) tipo(s) permitido(s) — cumprimento parcial, registrar no status qual ficou de fora e por quê. `status: "generating"`, ir pro Passo 6.

## Passo 6 — Gerar

**Rota de geração depende do cliente (regra fixa, ver `CLAUDE.md` "roteamento de produção de vídeo")**:
- **Regra permanente (quando o conector Postiz estiver funcionando de novo)**: `client === "frank"` gera via **Postiz (Veo3)**, reaproveitando os créditos que o Franklin já tem lá — ver `mcp__postiz__generateImageTool`/`generateVideoTool`.
- **Temporário, desde 2026-09-08**: o conector claude.ai do Postiz está quebrado (erro de registro OAuth do lado da Postiz, não é algo que dá pra consertar clicando em "Reconectar" — mensagem de erro pedia Client ID OAuth novo). **Enquanto isso não for resolvido, TODOS os clientes (inclusive `frank`) usam o caminho barato**: ferramentas `generate_image`/`generate_tts` do conector `automacao-mvo` (Nano Banana + Gemini TTS), seguindo o pipeline "slideshow narrado" de `.claude/skills/gestor-de-geracao-ia-google/SKILL.md` — montagem final do vídeo (FFmpeg: crossfade, legenda, mixagem) roda no próprio sandbox da rotina (instalar ffmpeg on-demand: `apt-get update && apt-get install -y ffmpeg`, ~30-40s, root). As ferramentas MCP só cobrem as chamadas que precisam de credencial (Gemini); a montagem em si (que não precisa de segredo) continua no sandbox da rotina. **Reverter essa exceção assim que o conector Postiz voltar a funcionar** — não é a regra definitiva, é só pra destravar o teste de hoje.

Em ambos os casos: respeitar `narracao.json` (voice/music/narrationText) e `formato.json` se existirem. Gerar só os tipos permitidos no Passo 5.

**Se falhar** (erro de API, ffmpeg travou, etc.):
- `attempts += 1`, `lastError`, `lastAttemptAt`.
- Se `attempts < MAX_GENERATION_ATTEMPTS`: `status` volta pra `"claimed"` (preservando `callLimitOk`/`mediaLimit` já gravados). Commit/push. Próximo ciclo tenta a geração de novo — **nunca** rechama os endpoints de cota.
- Se `attempts >= MAX_GENERATION_ATTEMPTS`: `status: "failed_permanent"`. Commit/push. Parar definitivamente — cai pro fluxo manual de hoje (nada foi removido, só deixou de ser o caminho padrão pra esse pedido específico).

**Se der certo**:
- Subir todos os arquivos finais pra `<pasta>/revisao/` — só arquivos soltos, nunca subpasta (confirmado: `aprovacao.html` e `auto-publish.js` só leem um nível de pasta, conteúdo dentro de uma subpasta fica invisível pros dois).
- `status: "done"`, `completedAt`.
- **Um único commit** com os arquivos de mídia + `geracao-status.json` juntos — evita `revisao/` aparecer pela metade pra quem estiver com a `aprovacao.html` aberta nesse meio-tempo.
- `git push origin main`. Se rejeitado por divergência: `git pull --rebase origin main`, tentar de novo uma vez; se falhar de novo, abortar este pedido sem deixar estado quebrado — o próximo ciclo retoma a partir do status salvo.

## Passo 7 — Resumo

Ao final da execução, resumir em poucas linhas: quantos pedidos processados, quantos `done`/`done_passthrough`, quantos `quota_blocked_*` (e de qual tipo), quantos `failed_permanent` (destacar — precisam de atenção manual do Franklin). Se nada foi encontrado, não fazer nada e não reportar ruído.

## Formato de `geracao-status.json` (raiz do pedido, ao lado de `instrucoes.txt` — nunca dentro de `revisao/`)

```json
{
  "status": "claimed | generating | quota_blocked_call_limit | quota_blocked_media_limit | done | done_passthrough | failed_permanent",
  "claimedAt": "2026-09-08T14:32:10Z",
  "attempts": 1,
  "lastAttemptAt": "2026-09-08T14:33:40Z",
  "lastError": "string opcional",
  "callLimitOk": true,
  "mediaLimit": {
    "images": { "requested": 3, "allowed": true },
    "videos": { "requested": 1, "allowed": false, "error": "Limite de 10 vídeos por IA/mês atingido..." }
  },
  "completedAt": "2026-09-08T14:38:02Z"
}
```

## Como ampliar depois pra outros clientes

Só depois do Franklin validar o fluxo completo na própria conta. Duas formas, nenhuma exige redesenho:
- Adicionar nomes em `ALLOWED_CLIENTS` (ex: `["frank", "kleber-construcao"]`), ou
- Trocar pra modelo de denylist, enumerando `.claude/skills/*` e excluindo pastas de ferramentas/infra (não são clientes): `gestor-de-*`, `prompt-master`, `Vitrine`, `open-design`, `_vozes-teste-tts`, `rjinox-log`, `_vitrine_tmp`.

## Fora de escopo nesta versão (proposital)

- Contador visível de "montando seu pedido X%" no app — precisa de endpoint de status novo + polling no front-end, não existe nada parecido hoje (a barra "Publicando..." do composer é só animação client-side de um único fetch, não é status real de servidor). Fica pra uma iteração futura.
- Notificação ativa (WhatsApp/e-mail) em `failed_permanent` — não existe canal pra isso hoje; o resumo do Passo 7 + conferência do Franklin é o suficiente por ora.
- Backoff inteligente pra `quota_blocked_*` — tentar de novo a cada ciclo é barato (sem gasto de IA) e simples o bastante pra essa versão.
