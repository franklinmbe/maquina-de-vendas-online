"""26/11/2026 — Balança de cozinha inox simples, Brasil (print do Franklin, R$30,66, frete grátis Do Brasil).
China do mesmo tipo: todas abaixo de R$99 têm 'frete grátis acima de R$99' → descartadas (regra só frete grátis)."""
import json
K = 'https://ae-pic-a1.aliexpress-media.com/kf/'
S = {'1005012857784740': {'nome': 'Balança de Cozinha Digital Inox – Alta Precisão até 10 kg', 'cats': ['Balanças Digitais', 'Balanças de Cozinha'],
     'desc': 'Balança digital de cozinha em aço inox, precisão de 1 g até 10 kg, função tara e unidades g, ml, oz e lb. Ideal para receitas, confeitaria e dieta. 274 vendidas, nota 4,8.',
     'aviso': 'Enviado do Brasil: entrega rápida.', 'peso': 0.6, 'origem': 'BR', 'attrs': [], 'vars': [], 'cost': 30.66, 'video': None,
     'gallery': [K + g for g in ['Ad3f82c787a564e81a5782d6c65bf01d3y.png', 'Af4f0897d277446e99660f87c9928491f3.png', 'Aced5d46511104089a7fa14a25cd7b193E.png', 'A116c63f4805e4ec98ec37d8e0ea556cbT.png', 'A205e620adba549c5ade2ef9af3d095e6c.png']]}}
json.dump(S, open('balanca_cozinha_br.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
