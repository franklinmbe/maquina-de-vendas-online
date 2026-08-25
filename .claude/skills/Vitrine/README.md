# 📊 Vitrine — seus dados viram um painel que impressiona o cliente

A **Vitrine** pega os numeros que voce **já tem** — uma planilha de vendas, uma exportacao de
Meta/Google Ads, os resultados de um projeto, ou numeros colados no chat — e devolve um
**painel/relatorio HTML lindo, com a SUA marca**, pronto para mandar pro cliente no WhatsApp ou
e-mail, ou salvar como PDF.

É a camada de **apresentacao de resultados**. Feita para quem precisa **mostrar numeros pra
alguem** de um jeito profissional: gestor de trafego, consultor, agencia, profissional liberal,
ou qualquer dono de negocio que entrega resultado e quer parecer impecavel.

> A Vitrine **nunca inventa numeros**. Ela só organiza e apresenta o que voce der. Faltou um
> dado? Ela pergunta — nao chuta.

## O que ela gera

- **Cabecalho com a sua marca** (logo ou selo + nome do negocio + cor de destaque)
- **Cards de KPI** com valor, variacao (verde/vermelho) e nota
- **Graficos interativos** (linha, barra, pizza/rosca, area) na sua cor
- **Destaques** e **secoes de texto** em portugues simples ("o que isso significa pra voce")
- Tudo em **um arquivo HTML só** — vira PDF imprimindo pelo navegador

## Como instalar

Copie a pasta `vitrine/` para a pasta de skills do seu Claude Code:

- No projeto: `.claude/skills/vitrine/`
- Ou global: `~/.claude/skills/vitrine/`

## Como usar

1. **Primeira vez:** diga "quero configurar a Vitrine" — ela pergunta o nome do seu negocio, sua
   cor, seu logo (opcional) e salva tudo. Você só faz isso uma vez.
2. **No dia a dia:** mande seus dados e peca o painel. Exemplos de gatilho:
   - "monta um relatorio de trafego desse mes pro cliente X" (e cole/aponte os numeros)
   - "transforma essa planilha de vendas num dashboard bonito"
   - "faz um relatorio de resultados com esses numeros"
3. A Vitrine lê os dados, monta o painel com a sua marca e te diz onde o arquivo ficou. Para PDF:
   **Imprimir → Salvar como PDF**.

## Pre-requisitos

- **Python 3** (só biblioteca padrao — nenhuma instalacao obrigatoria)
- **Internet** apenas para visualizar os graficos (Chart.js via CDN)
- Para ler `.xlsx` direto, `openpyxl` é opcional; sem ele, exporte a planilha como CSV

## Exemplo

Veja `exemplos/exemplo-trafego.json` — um relatorio de trafego pago completo. Gere com:

```bash
python3 scripts/montar_vitrine.py exemplos/exemplo-trafego.json saida.html
```

---

Licenca MIT — use, adapte e distribua livremente.
