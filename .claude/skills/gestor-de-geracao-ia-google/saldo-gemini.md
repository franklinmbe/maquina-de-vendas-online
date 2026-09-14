# Controle de saldo — Gemini API (estimado)

**Isso é uma estimativa, não o saldo real.** A Gemini API não tem endpoint pra consultar
crédito/billing — isso só existe na tela do AI Studio (aistudio.google.com → Billing →
"Available credits"). Esse arquivo simula o saldo com base no que as skills gastaram,
e precisa ser corrigido de vez em quando com o valor real que o Franklin vê na tela.

## Preços de referência (definidos em `gestor-de-geracao-ia-google/SKILL.md`)

- Imagem (Nano Banana): ~US$0,034/imagem
- Vídeo com movimento (Gemini Omni Flash): ~US$0,10/segundo (até 10s = US$1,00 máx)
- Narração TTS (`gemini-3.1-flash-tts-preview`): ~US$0,03/minuto de áudio
- **Entendimento de vídeo** (`understand_video`, `gemini-3.8-flash`, implementado 2026-09-14): US$0,75/milhão tokens de entrada + US$3,75/milhão de saída (tabela vigente até dez/2026). Vídeo de ~90s (teto do projeto) ≈ 12.000 tokens de entrada + até ~2.000 de saída ≈ **US$0,01-0,02/vídeo analisado** (~R$0,05-0,15) — bem mais barato que gerar uma imagem.
- Converter USD→BRL pela cotação do dia (aproximada — não é preciso ser exato aqui)

## Limite mínimo de aviso

**R$ 30** (definido por Franklin em 2026-08-24). Precisa subir conforme mais clientes
reais entrarem nos planos que usam esse caminho (Iniciante/Profissional/Especialista —
ver regra em `CLAUDE.md`). Quando o saldo estimado abaixo cair perto ou abaixo desse
valor, a skill que for gerar conteúdo deve avisar o Franklin explicitamente antes de
continuar, pra ele conferir o saldo real e recarregar se precisar.

**Solução de longo prazo pra nunca zerar:** o AI Studio tem uma opção de recarga
automática (com cartão cadastrado) que hoje está desligada — ativar isso resolve o
problema de forma definitiva, sem depender desse controle manual/estimado.

## Saldo confirmado mais recente

- Data da última confirmação: (ainda não confirmado — Franklin, me diga o valor que
  está aparecendo agora na tela de Billing do AI Studio pra eu preencher isso aqui)
- Valor confirmado: —

## Histórico de gastos estimados

- 2026-09-14: -US$~0,015 (~R$0,08) — primeiro teste ao vivo de `understand_video` (vídeo real de `alessandra-rjinox`, ~2,5MB/90s) + uso real pra resolver o pedido `app-20260914-131225` que estava travado em `failed_permanent`. Funciona pra todo cliente/plano (não é recurso gated por plano — roda dentro da rotina de geração automática, que já cobre todo cliente desde a ampliação do escopo no mesmo dia).
- 2026-08-30: -US$0,08 (~R$0,42) — teste das 18 vozes restantes do catálogo Gemini TTS (Callirrhoe, Autonoe, Enceladus, Iapetus, Algieba, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager) — todas com sucesso, completando as **30 vozes totais** do catálogo. Amostras em `_vozes-teste-tts/`.
- 2026-08-30: -US$0,05 (~R$0,27) — teste de 12 vozes do Gemini TTS (`gemini-3.1-flash-tts-preview`), ~8s cada, todas com sucesso (Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Sulafat, Achird, Despina, Umbriel) — amostras em `_vozes-teste-tts/` pro Franklin ouvir e escolher quais entram no app. Saldo estimado não calculável (nunca foi confirmado um valor inicial real).

<!-- Formato de cada linha nova, mais recente no topo:
- 2026-08-24: -R$X,XX (descrição do que foi gerado) — saldo estimado após: R$Y,YY
-->
