---
name: postiz-cota
description: Calcula quanto da cota mensal do Postiz Ultimate (500 imagens / 60 vídeos, somando todos os clientes de uma conta) já está comprometida pelos planos dos clientes ativos, avisa Franklin com antecedência antes de estourar o teto, e documenta o que fazer quando a cota estourar de fato (segunda conta Postiz Ultimate).
---

Esta skill não publica nada — ela só faz a conta de capacidade e avisa Franklin. Rode ela sempre que:

- Franklin pedir "quanto da cota do Postiz já tá usada" ou similar;
- Franklin estiver prestes a autorizar um cliente novo (adicionar entrada em `SIGNUP_ALLOWLIST`) — rode **antes** de confirmar a liberação, pra ele decidir com a conta feita;
- Como checagem periódica de rotina, se Franklin configurar isso.

## Por que essa conta é feita "no papel" (planos), não com uso real do Postiz

O Postiz Ultimate tem teto fixo por conta: **500 imagens e 60 vídeos por mês, somando todos os clientes daquela conta** — não existe pacote de créditos avulsos extras dentro do mesmo plano. A API pública do Postiz não expõe um endpoint de "cota restante", então o controle é feito comparando **o que Franklin vendeu** (soma dos planos dos clientes ativos) contra o teto da conta — não o uso publicado dia a dia. Isso é proposital: o aviso tem que vir *antes* de estourar, calculado pela capacidade comprometida, não depois que já estourou.

## Passo 1 — Ler a config

Leia `.claude/postiz-planos.json`. Ela tem:

- `tetoPorConta`: limite fixo do Postiz Ultimate (500 imagens / 60 vídeos por mês) — não mude isso a menos que o próprio limite do plano Postiz mude.
- `avisoPreventivoPercentual`: a partir de quantos % do teto já comprometido a skill deve soar o alerta preventivo (padrão sugerido: 80%).
- `contas`: cada conta Postiz Ultimate que Franklin tem, com o nome da variável de ambiente da API key dela.
- `planos`: cada plano que Franklin vende pros clientes, com quantas imagens/vídeos por mês esse plano permite publicar.
- `clientesAtivos`: cada cliente autorizado hoje (deve bater com quem está em `SIGNUP_ALLOWLIST` e/ou tem uma pasta de skill ativa), qual plano ele contratou, e em qual conta Postiz ele publica.

**Se algum plano em `clientesAtivos` tiver `imagensPorMes`/`videosPorMes` como `null` em `planos`**: pare e avise Franklin que precisa preencher os números reais desse plano antes de a conta ser confiável — não invente um número.

## Passo 2 — Somar por conta

Para cada conta em `contas`, some `imagensPorMes` e `videosPorMes` de todos os clientes de `clientesAtivos` que apontam pra essa conta (usando o plano de cada um). Compare a soma contra `tetoPorConta`.

## Passo 3 — Avisar Franklin

- **Abaixo do limiar de aviso** (`avisoPreventivoPercentual`): não precisa avisar nada, a menos que Franklin tenha pedido o status.
- **Acima do limiar, mas abaixo de 100%**: avise proativamente, algo como: "Cota da conta principal do Postiz: X/500 imagens e Y/60 vídeos por mês já comprometidos pelos planos ativos (Z%). Ainda dá pra fechar mais alguns clientes pequenos, mas está perto do teto — vale já ir se planejando pra segunda conta."
- **Um cliente novo empurraria o total acima de 100%** (ex: Franklin está prestes a autorizar alguém em `SIGNUP_ALLOWLIST`): avise **antes** de ele confirmar a liberação — "Esse cliente novo estouraria o teto da conta principal (X+plano_novo/500 imagens ou Y+plano_novo/60 vídeos). Não dá pra autorizar nessa conta sem contratar a segunda conta Postiz Ultimate primeiro."

## Passo 4 — Quando a cota realmente estoura (ou está prestes a estourar)

Não existe pacote de créditos avulsos dentro do mesmo plano Postiz Ultimate — a única solução é uma **segunda conta Postiz Ultimate**. O processo, na ordem:

1. **Franklin contrata** a segunda conta Postiz Ultimate (isso é pagamento — Claude não faz essa parte, só avisa que é hora).
2. Franklin gera a API key da conta nova e guarda como uma segunda variável de ambiente, ex: `POSTIZ_API_KEY_2` (em `.claude/settings.local.json`, mesmo lugar da atual `POSTIZ_API_KEY`).
3. Adicionar em `.mcp.json` uma segunda entrada de servidor MCP pra essa conta, ao lado da existente `postiz`:
   ```json
   "postiz2": {
     "type": "http",
     "url": "https://api.postiz.com/mcp/${POSTIZ_API_KEY_2}"
   }
   ```
   Isso dá ao Claude Code acesso às ferramentas da segunda conta (ex: `mcp__postiz2__*`), do mesmo jeito que `postiz` dá acesso à primeira.
4. Clientes novos (ou os que Franklin decidir migrar) passam a ser publicados usando a API/MCP da segunda conta em vez da primeira — atualizar `conta` desse cliente em `.claude/postiz-planos.json` pra `"secundaria"` (ou o nome escolhido em `contas`), e adicionar a seção correspondente em `contas`.
5. **Cada skill de cliente por pasta** (`.claude/skills/<cliente>/SKILL.md`) precisa dizer explicitamente em qual conta ela publica — se um cliente for movido pra segunda conta, atualizar a URL base/API key referenciada na seção "Passo 3 — Publicar via API do Postiz" daquele SKILL.md específico. Clientes que ficam na conta original não mudam nada.

## Observações

- Essa skill lida com **capacidade planejada** (o que foi vendido), não com contagem exata de posts já publicados — se Franklin quiser precisão maior no futuro, seria necessário Postiz expor um endpoint de uso real (hoje não expõe via API pública).
- Nunca decida sozinho qual cliente muda de conta ou qual plano alguém tem — isso é decisão comercial do Franklin. Esta skill só soma, compara e avisa.
