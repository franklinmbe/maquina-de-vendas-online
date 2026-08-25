---
name: vitrine
description: "Transforma dados crus (planilha de vendas, exportacao de Meta/Google Ads, metricas de projeto, numeros colados no chat) num painel/relatorio HTML lindo, interativo e com a SUA marca, pronto para enviar ao cliente ou virar PDF. Use quando alguem disser 'montar um relatorio pro cliente', 'fazer um dashboard', 'apresentar os resultados', 'transformar essa planilha num relatorio bonito', 'relatorio de trafego', 'relatorio mensal', 'dashboard de vendas', 'mostrar resultado pro cliente', 'relatorio de campanha' ou colar dados pedindo um painel. Gera um arquivo HTML autossuficiente com cards de KPI, graficos e textos em portugues. Nao inventa numeros."
---

# Vitrine — seus dados viram um painel que impressiona o cliente

A Vitrine pega os numeros que voce **já tem** (uma planilha, uma exportacao de anuncios,
resultados de um projeto) e devolve um **painel/relatorio HTML lindo, com a sua marca**,
pronto para mandar pro cliente no WhatsApp/e-mail ou salvar como PDF.

É a camada de **apresentacao de resultados**: ideal para gestor de trafego, consultor,
agencia, profissional liberal ou qualquer pessoa que precisa **mostrar numeros pra alguem**
(um cliente, um chefe, um socio) de um jeito profissional.

> Esta skill **nunca inventa dados**. Ela so organiza e apresenta o que voce fornecer. Se
> faltar um numero, ela pergunta ou deixa em branco — jamais preenche com estimativa.

---

## Primeira execucao (configurar a sua marca)

Se existir o arquivo `setup/primeira-execucao.md` dentro desta skill, **a marca ainda nao foi
configurada**. Antes de gerar qualquer painel, abra esse arquivo e siga o passo a passo: ele
coleta nome do negocio, cor de destaque, logo (opcional) e nome do profissional, grava tudo em
`.vitrine/config.md` e depois se autodestroi. Faca isso UMA vez. Nas proximas vezes a marca ja
estara salva e voce vai direto para "Como funciona".

---

## Como funciona (fluxo principal)

### 1. Entenda o pedido e os dados
Pergunte (ou descubra do contexto): **para quem é** (nome do cliente), **de que periodo**
(ex.: "Maio 2026") e **onde estao os dados**. Os dados podem vir de:
- uma planilha **CSV** (leia direto com a ferramenta de leitura de arquivos),
- uma planilha **Excel (.xlsx)** — peca para exportar como CSV, ou leia com a biblioteca
  `openpyxl` se estiver disponivel,
- uma **exportacao de Meta Ads / Google Ads** (CSV),
- ou **numeros colados** direto na conversa.

Leia os dados de verdade antes de montar nada. **Nunca invente, arredonde sem avisar, ou
preencha lacunas com estimativa.** Se um numero estiver faltando, pergunte.

### 2. Decida a historia (o que esses numeros dizem)
Voce nao é uma planilha — é um consultor. Olhe os dados e identifique:
- os **4 a 6 KPIs** que mais importam pra esse cliente (ex.: leads, custo por lead, vendas, ROI),
- a **variacao** vs. periodo anterior quando houver (e marque se subir é bom ou ruim),
- 2 a 4 **graficos** que contam a evolucao (linha = tendencia no tempo, barra = comparacao,
  pizza/rosca = composicao),
- 2 a 4 **destaques** (as melhores noticias, em uma frase cada),
- 1 a 3 **secoes de texto** em linguagem simples: "o que isso significa pra voce" e
  "proximos passos". Escreva como quem explica pra um cliente leigo, sem jargao.

### 3. Monte o arquivo de dados (JSON)
Crie um arquivo `dados.json` seguindo o formato em `references/spec-dados.md`. Esse arquivo é a
"receita" do painel: titulo, cliente, periodo, resumo, kpis, graficos, destaques, secoes.
Leia a spec — ela tem todos os campos e exemplos.

### 4. Gere a Vitrine
Rode o montador (sem dependencias externas, so Python 3):

```bash
python3 scripts/montar_vitrine.py dados.json saida.html
```

O script lê automaticamente a marca em `.vitrine/config.md` (subindo as pastas) e produz um
**HTML unico e autossuficiente** com a identidade do usuario. Para apontar uma config
especifica: `--config caminho/config.md`.

### 5. Entregue
- Abra o HTML no navegador e confira (cabecalho com a marca, KPIs, graficos, textos).
- Diga ao usuario onde o arquivo ficou e como transformar em PDF: **Imprimir &rarr; Salvar como PDF**
  (o CSS ja é otimizado para impressao).
- O arquivo é unico — dá pra mandar por WhatsApp/e-mail ou hospedar em qualquer lugar.

---

## Modos

A Vitrine cobre dois usos com o mesmo motor — a diferenca esta no conteudo que voce monta:

- **Painel (dashboard):** foco em KPIs + graficos, resumo curto. Para acompanhamento rapido.
- **Relatorio de resultados:** KPIs + graficos + destaques + secoes narrativas ("o que isso
  significa", "proximos passos"). Para a entrega mensal que justifica o seu honorario.

Escolha pelo que o cliente precisa ver. Na duvida, faca o relatorio completo — impressiona mais.

---

## Entradas / Saidas
- **Entrada:** dados que o usuario fornece (CSV, XLSX, exportacao de ads, ou numeros colados) +
  a marca em `.vitrine/config.md`.
- **Saida:** um arquivo `.html` autossuficiente (graficos via Chart.js por CDN — precisa de
  internet so na hora de visualizar). Vira PDF imprimindo pelo navegador.

## Dependencias
- **Python 3** (so biblioteca padrao — nenhum `pip install` obrigatorio).
- Para ler `.xlsx` direto, `openpyxl` é opcional; sem ele, peca o CSV.
- Internet apenas para renderizar os graficos (Chart.js e a fonte vem de CDN).

## Regras de ouro
1. **Nunca invente numeros.** So apresenta o que foi dado. Faltou? Pergunte.
2. **Linguagem de cliente, nao de planilha.** Textos em PT-BR simples, sem jargao.
3. **A marca é do usuario.** Sempre puxe nome/cor/logo da config; nunca chute.
4. **Confira antes de entregar.** Abra o HTML e valide que os graficos aparecem.
