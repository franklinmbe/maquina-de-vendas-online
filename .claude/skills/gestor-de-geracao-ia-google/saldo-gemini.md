# Controle de saldo — Gemini API (estimado)

**Isso é uma estimativa, não o saldo real.** A Gemini API não tem endpoint pra consultar
crédito/billing — isso só existe na tela do AI Studio (aistudio.google.com → Billing →
"Available credits"). Esse arquivo simula o saldo com base no que as skills gastaram,
e precisa ser corrigido de vez em quando com o valor real que o Franklin vê na tela.

## Preços de referência (definidos em `gestor-de-geracao-ia-google/SKILL.md`)

- Imagem (Nano Banana): ~US$0,034/imagem
- Vídeo com movimento (Gemini Omni Flash): ~US$0,10/segundo (até 10s = US$1,00 máx)
- Narração TTS (`gemini-3.1-flash-tts-preview`): ~US$0,03/minuto de áudio
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

(nenhum gasto registrado ainda por essa automação)

<!-- Formato de cada linha nova, mais recente no topo:
- 2026-08-24: -R$X,XX (descrição do que foi gerado) — saldo estimado após: R$Y,YY
-->
