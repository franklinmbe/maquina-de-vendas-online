"""Monta a especificação das variações de cada produto (spec.json) a partir de sku_all.json.
Custo de cada variação = custo que o Franklin pagou na variação comprada × (preço+imposto da variação ÷ preço+imposto da comprada)."""
import json
d = json.load(open('sku_all.json', encoding='utf8'))

def tot(c): return (c.get('price') or 0) + (c.get('tax') or 0)

# id: (custo pago, nomes da variação comprada, novo nome, [(atributo, função que traduz a combinação em valor)])
TR_LIGE = {'Black': 'Preto', 'Steel Gold': 'Aço Dourado', 'Mesh Gold': 'Malha Dourada', 'Black-Gold': 'Preto e Dourado',
           'Steel Rose Gold': 'Aço Rosé', 'Steel Black': 'Aço Preto', 'Gray': 'Cinza', 'Mesh Silver': 'Malha Prateada',
           'Steel Silver': 'Aço Prateado', 'Pink': 'Rosa', 'Mesh Black': 'Malha Preta', 'Mesh Rose Gold': 'Malha Rosé'}
TR_MIL = {'Preto': 'Preto', 'BRANCO': 'Branco', 'black steel': 'Pulseira de Aço Preta', 'mesh belt black': 'Pulseira de Malha Preta',
          'silver steel': 'Pulseira de Aço Prateada', 'mesh belt silver': 'Pulseira de Malha Prateada'}
TR_LUZ = {'RGB': 'Colorida (RGB)', 'white': 'Branca', 'Warm': 'Amarela (quente)'}

P = {
 '1005012993555792': (23.72, ['Christmas-4Pack', 'USB Type-C'], 'Projetor de Luz LED USB de Natal – Kits de 4 a 24 Desenhos',
     [('Kit', lambda n: n[0].replace('Christmas-', '').replace('Pack', '') + ' desenhos')]),
 '1005013034403258': (21.37, ['Black 15-Patterns'], 'Mini Projetor Galáxia USB 360° – 5, 10 ou 15 Desenhos',
     [('Cor', lambda n: 'Preto' if n[0].startswith('Black') else 'Branco'),
      ('Desenhos', lambda n: n[0].split()[-1].replace('-Patterns', '') + ' desenhos')]),
 '1005009896873428': (144.61, ['Steel Gold', 'with LED Flashlight'], 'Relógio Inteligente LIGE Esportivo 2.01" HD com Lanterna',
     [('Cor', lambda n: TR_LIGE.get(n[0], n[0]))]),
 '1005009831396471': (33.38, ['RGB', '33M 300led', '1pcs'], 'Cordão de Luz Solar de LED – 7 a 33 m – Uso Externo',
     [('Cor da luz', lambda n: TR_LUZ.get(n[0], n[0])),
      ('Tamanho', lambda n: n[1].replace('M ', ' m (').replace('led', ' LEDs)'))]),
 '1005009663699684': (37.74, ['Preto'], 'Smartwatch Militar Masculino à Prova d\'Água IP67',
     [('Modelo', lambda n: TR_MIL.get(n[0], n[0]))]),
}
spec = {}
for pid, (paid, bought, nome, attrs) in P.items():
    combos = [c for c in d[pid]['combos'] if not c.get('soldout') and c.get('price')]
    base = next(c for c in combos if c['names'] == bought)
    vars_ = []
    for c in combos:
        cost = round(paid * tot(c) / tot(base), 2)
        vars_.append({'attrs': {a: f(c['names']) for a, f in attrs}, 'cost': cost, 'img': c.get('img')})
    spec[pid] = {'nome': nome, 'gallery': d[pid]['gallery'], 'attrs': [a for a, _ in attrs], 'vars': vars_}
# produtos sem variação: só galeria
for pid in ['1005008647127673', '1005007219248618', '1005010272750467', '1005005307917892', '1005010661063682', '1005010739044059']:
    spec[pid] = {'gallery': d[pid]['gallery'], 'vars': []}
json.dump(spec, open('spec.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for pid, s in spec.items():
    print(pid, s.get('nome', ''), len(s['gallery']), 'fotos')
    for v in s['vars']: print('   ', v['attrs'], v['cost'])
