# Ferramentas de pesquisa de produto (AliExpress)

- `busca.py "termo"` — lista anúncios do AliExpress (id, preço, nota, vendidos), ordenados por pedidos.
- `skus.py ID1 ID2 ...` — lê as variações (cor/tamanho), preço e imposto de cada uma + fotos da galeria → JSON.
- `spec.py` — monta `spec.json` (custos por variação, escalados pelo custo pago) para `../aplicar-variacoes.php`.
- `cotar.php` — cota frete por transportadora no Melhor Envio (rodar com `wploja eval-file`).

Precisam de `pip install playwright` e usam o Chrome instalado (`channel='chrome'`).
Atenção: preços sem login vêm com desconto de cliente novo; o AliExpress pode mostrar "não sou um robô" se usar muito.
