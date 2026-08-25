# Formato do `dados.json`

O montador (`scripts/montar_vitrine.py`) lê um JSON com esta estrutura. Todos os campos sao
opcionais exceto `titulo` — inclua só o que fizer sentido pro relatorio. **Nunca preencha um
numero que voce nao recebeu.**

```json
{
  "tipo_relatorio": "Relatorio de Trafego Pago",
  "titulo": "Resultados de Maio 2026",
  "cliente": "Clinica Sorriso",
  "periodo": "Maio 2026",
  "resumo": "Paragrafo curto em PT-BR resumindo o mes para o cliente.",

  "kpis": [
    {
      "rotulo": "Leads gerados",
      "valor": "182",
      "variacao": "+34%",
      "tendencia": "up",
      "nota": "vs. abril"
    }
  ],

  "graficos": [
    {
      "tipo": "linha",
      "titulo": "Leads por semana",
      "labels": ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
      "series": [
        { "nome": "Leads", "dados": [32, 41, 48, 61] }
      ]
    }
  ],

  "destaques": [
    "Uma frase curta com a melhor noticia do periodo."
  ],

  "secoes": [
    { "titulo": "O que isso significa para voce", "texto": "Explicacao simples, sem jargao." }
  ]
}
```

## Campos

### Topo
| Campo | O que é |
|-------|---------|
| `tipo_relatorio` | Rotulo pequeno acima do titulo (ex.: "Relatorio Mensal", "Dashboard de Vendas"). |
| `titulo` | Titulo grande do relatorio. **Unico campo realmente recomendado.** |
| `cliente` | Nome do cliente/destinatario (aparece como "Cliente: ..."). |
| `periodo` | Periodo coberto (ex.: "Maio 2026", "01-15/06"). Vira uma "pilula" no cabecalho. |
| `resumo` | Paragrafo de abertura, em linguagem de cliente. |

### `kpis` (cards de numero) — ideal 3 a 6
| Campo | O que é |
|-------|---------|
| `rotulo` | Nome do indicador (ex.: "Custo por lead"). |
| `valor` | O numero, ja formatado como texto (ex.: "R$ 18,40", "182", "26%"). |
| `variacao` | Variacao vs. periodo anterior (ex.: "+34%", "-28%"). Opcional. |
| `tendencia` | `up` (verde), `down` (vermelho) ou `flat` (cinza). **Use `up` quando a mudanca é BOA**, mesmo que o numero caia (ex.: custo por lead caindo = `up`). |
| `nota` | Texto pequeno embaixo (ex.: "vs. abril", "recorde"). Opcional. |

### `graficos` — ideal 2 a 4
| Campo | O que é |
|-------|---------|
| `tipo` | `linha` (tendencia no tempo), `barra` (comparar categorias), `pizza`/`rosca` (composicao), `area` (volume no tempo). |
| `titulo` | Titulo do grafico. |
| `labels` | Lista de rotulos do eixo X / fatias. |
| `series` | Lista de series: cada uma `{ "nome": "...", "dados": [numeros] }`. Para um unico conjunto, use uma serie só (ou o atalho `"dados": [...]` direto no grafico). |

A primeira serie sempre usa a **cor de destaque da marca**; as demais usam uma paleta neutra.

### `destaques`
Lista de frases curtas (strings). Cada uma vira um item com marcador colorido. Ideal 2 a 4.

### `secoes`
Lista de blocos de texto: `{ "titulo": "...", "texto": "..." }`. Use para "O que isso significa
para voce" e "Proximos passos". Quebras de linha (`\n`) viram quebras visuais.

## Dicas
- **Menos é mais.** 4 KPIs fortes batem 10 fracos.
- **Marque a tendencia certa.** Verde = boa noticia pro cliente, independente do numero subir ou cair.
- **Escreva os textos como um humano falando com o cliente**, nao como um relatorio tecnico.
- Veja `exemplos/exemplo-trafego.json` para um exemplo completo e real.
