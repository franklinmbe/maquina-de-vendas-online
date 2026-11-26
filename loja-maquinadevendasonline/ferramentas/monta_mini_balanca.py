"""26/11/2026 — Mini balança 3 kg (print do Franklin): 2 fornecedores do Brasil do MESMO modelo, frete grátis.
A = mais barato (R$30,97, 39 vendidas, 5,0); B = reserva (R$37,70, 830 vendidas, 4,8). Mesmas fotos → capas diferentes.
China do mesmo tipo: só 'frete grátis acima de R$99' → fora."""
import json
K = 'https://ae-pic-a1.aliexpress-media.com/kf/'
G = ['A38eace4b1a4e40fbb809bba0dd145729e.png', 'Af854a5e2eda9483580f55c5a5a4a5347v.jpg', 'A59efd018c23f4c869f46a016a98b3ba4g.jpg', 'A8f6f9f4b8aeb4ab59264fe11e754b4d3Y.jpg', 'A870f48659b324cd2b872a556b070e463D.jpg', 'A4a818b8455764a83a697619a2ec2e3c93.jpg']
D = 'Mini balança digital de alta precisão (0,1 g) até 3 kg, em aço inox, com bandeja, função tara e contagem de peças. Para cozinha, confeitaria, café e laboratório.'
def item(nome, extra, gal, cost):
    return {'nome': nome, 'cats': ['Balanças Digitais', 'Balanças de Cozinha'], 'desc': D + ' ' + extra, 'aviso': 'Enviado do Brasil: entrega rápida.',
            'peso': 0.5, 'origem': 'BR', 'attrs': [], 'vars': [], 'cost': cost, 'video': None, 'gallery': [K + g for g in gal]}
S = {'1005012857660924': item('Mini Balança Digital de Precisão 0,1 g até 3 kg – Inox', 'Nota 5,0.', G, 30.97),
     '1005005877633409': item('Balança de Precisão Inox 3 kg com Bandeja – Cozinha e Laboratório', 'Mais de 800 vendidas, nota 4,8.', G[2:] + G[:2], 37.70)}
json.dump(S, open('mini_balanca.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
