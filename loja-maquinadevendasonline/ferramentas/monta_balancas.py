"""Foto com selo "Choice/Limited Promotion/24 hours fast shipping" removida (CDC).
26/11/2026 — Balanças digitais (Franklin): cozinha nutricional (China) + corporal bioimpedância com app (Brasil e China).
Custo = preço real da página + imposto estimado (China); Brasil sem imposto. Todos com frete grátis conferido na página."""
import json
K = 'https://ae-pic-a1.aliexpress-media.com/kf/'
CAT = 'Balanças Digitais'
CZ, BIO = 'Balanças de Cozinha', 'Balanças de Bioimpedância'
S = {}
def add(ali, origem, nome, sub, desc, gal, cost, peso):
    S[ali] = {'nome': nome, 'cats': [CAT, sub], 'desc': desc, 'aviso': 'Enviado do Brasil: entrega rápida.' if origem == 'BR' else '',
              'peso': peso, 'origem': origem, 'gallery': [K + g for g in gal], 'attrs': [], 'vars': [], 'cost': cost, 'video': None}
COZ = ['S4e76da3909634534a76693a8a23105861.jpg', 'S6584fd2e8966453ba27da4385e9789706.jpg',
       'S104331fea1c3421dabd22c3a4700e868D.jpg', 'S8ca4b6b5835744969d2778aec7d8ad3dL.jpg', 'Scb63aaf18fa84696987308647574c25fw.jpg', 'S4fa3d37c01b34fb593e5a003c020ce8ct.jpg']
add('1005009826905280', 'CN', 'Balança de Cozinha Inteligente com Calculadora Nutricional – Aço Inox 5 kg', CZ,
    'Balança de cozinha em aço inox que calcula calorias, proteínas, gorduras e carboidratos dos alimentos. Precisão de 1 g, até 5 kg, display LED. Ideal para dieta e alimentação saudável. Mais de 600 vendidas, nota 4,6.',
    COZ, 219.66, 0.8)
add('1005012095541915', 'CN', 'Balança Nutricional Digital de Cozinha – Calorias, Proteínas e Carboidratos (5 kg)', CZ,
    'Balança digital de cozinha com calculadora nutricional: mostra calorias, proteínas, gorduras e carboidratos. Aço inox, precisão de 1 g, até 5 kg. Mais de 800 vendidas, nota 4,9.',
    COZ[1:] + COZ[:1], 193.55, 0.8)
add('1005009412374311', 'BR', 'Balança de Bioimpedância Bluetooth 180 kg com App no Celular', BIO,
    'Balança corporal digital com bioimpedância: mede peso, gordura corporal, massa muscular, água e IMC e mostra tudo no aplicativo do celular (Bluetooth). Até 180 kg. Mais de 500 vendidas, nota 4,8.',
    ['Se1bf194627104d5dbdb92d64543b77c6q.jpg', 'A84847546505c407887f5927b69103d52I.jpg', 'S5d335894f6df4c0d85bf90a5ec30d6fa4.jpg', 'Sbd16db71996743599fa18c54933b7610m.jpg', 'Ac8f76cd2d2944d84bc864fac320612fcO.jpg', 'Sbdd4ad39e3de4cc096fd27dcc431e3e4h.jpg', 'Sdd29debd843a4d05956149ef74a645930.jpg'],
    43.68, 1.6)
add('1005007521063965', 'BR', 'Balança Corporal Bioimpedância Digital até 180 kg – Resultado pelo Celular', BIO,
    'Balança de bioimpedância com Bluetooth: peso, gordura corporal, massa muscular, IMC e mais, com acompanhamento pelo aplicativo no celular. Até 180 kg. Mais de 900 vendidas, nota 4,7.',
    ['Ac22021b43b5e41a8a979d4b35711bfedY.png', 'A84ec3445f9c543e494cf1afe81a3c741i.png', 'A4beea086759c4024bc9dabbb96ce8167W.png', 'Ac2eaabb05cb040ad8b98e96c185cb943k.png', 'Ab42c7ca015a04095aa02fcd35b111b05d.png', 'Af1e0fa84a4094092948d228968defddcd.png'],
    50.39, 1.6)
add('1005010332274824', 'CN', 'Balança de Gordura Corporal Inteligente Bluetooth com App – Branca', BIO,
    'Balança inteligente sem fio que analisa a composição corporal (peso, gordura, músculo, água, IMC) e envia para o aplicativo do celular por Bluetooth. Mais de 10.000 vendidas, nota 4,9.',
    ['H801c7de90ba342aeaeb09e9afec1cf01M.jpg', 'Sd12f9ff836fb4a769d833189f1ca94021.jpg', 'Ha05a5b4839cc4a8c8d42f61d5ea30142R.jpg', 'Ha37fb5bcd3604d359f0178a8401fe2f4G.jpg', 'Hf43a91a7f0d14a34af153ec9f618b014R.jpg', 'Scfd5e59a51964de29a6767eb0698fc187.jpg', 'Sa662c431622d4820aecc1f2c2d2b41acq.png'],
    142.92, 1.6)
add('1005005608077825', 'CN', 'Balança Digital Bluetooth com Visor Grande – Gordura Corporal, IMC e App', BIO,
    'Balança de banheiro com Bluetooth e visor grande colorido: peso, gordura corporal, IMC, frequência cardíaca e mais, com acompanhamento pelo aplicativo no celular. Vidro reforçado, até 150 kg. 218 vendidas, nota 4,8.',
    ['Sff0520d509f647ef80ac6d4f011838472.jpg', 'H668ed97bb5854a07a73ebde45d72b743u.jpg', 'S52348f2110154cf18f9ea94ca62fb3dbH.jpg', 'Sae4b924b7b824f428bc8cdfd39d396a25.jpg', 'S143ff859d1874eb1806199a22e05e2078.jpg', 'S0af95e574199430388bafef0ea3747001.jpg'],
    379.45, 2.0)
def pv(c):
    p = c * (2 if c <= 50 else 1.6 if c < 100 else 1.5) / 0.94
    q = int(p) + 0.9
    return q if q >= p - 1e-4 else q + 1
json.dump(S, open('balancas.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for k, s in S.items(): print(s['origem'], k, s['nome'][:60], '| custo', s['cost'], '| R$', f"{pv(s['cost']):.2f}")
