# Filosofia de design da Vitrine

O painel precisa parecer feito por uma agencia premium — limpo, caro, confiavel. Princípios que
o montador ja segue (referencia para quem for ajustar o `montar_vitrine.py`):

- **Minimalismo com respiro.** Muito espaco em branco, cartoes com cantos arredondados (18px),
  sombra suave e difusa. Nada de poluicao visual.
- **UMA cor de destaque.** A cor da marca aparece nos KPIs, na primeira serie dos graficos e nos
  marcadores. O resto é tons de cinza/neutro. Cor demais parece amador.
- **Tipografia Inter**, pesos variados (de 400 a 730). Numeros grandes e marcantes nos KPIs.
- **Hierarquia clara:** cabecalho da marca &rarr; titulo/resumo &rarr; KPIs &rarr; graficos &rarr;
  destaques &rarr; textos &rarr; rodape.
- **Cores semanticas suaves:** verde para boa noticia, vermelho para queda, cinza para neutro —
  sempre em versao clara (fundo pastel), nunca berrante.
- **Pronto para PDF.** O CSS de impressao remove sombras e evita cortar cartoes no meio.
- **Autossuficiente.** Um arquivo HTML só. Logo embutido como data-URI. Unica dependencia externa:
  Chart.js e a fonte, ambos via CDN (necessario apenas para visualizar).

Paleta neutra de apoio (series secundarias dos graficos): azul `#5B8DEF`, teal `#22C7A9`,
ambar `#F4A93C`, rosa `#E0607E`, roxo `#8E7BEF`, ciano `#3FB9C9`.
