"""24/11/2026 — Reposição dos produtos que saíram por ter menos de 10 vendas: mesmo item, outro fornecedor
(Brasil primeiro; sem Brasil com 10+ vendas, China). Nota ≥ 4. Capa diferente quando a foto é igual à de outro anúncio."""
import json, urllib.request
K = 'https://ae-pic-a1.aliexpress-media.com/kf/'
V = 'https://video.aliexpress-media.com/play/'
E, A = 'Esportes e Fitness', 'Academia'
_c = {}
def img(i):
    if not i: return None
    if '.' in i: return K + i
    if i in _c: return _c[i]
    for ext in ('.jpg', '.png', '.jpeg', '.webp'):
        try:
            if urllib.request.urlopen(urllib.request.Request(K + i + ext, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'}), timeout=20).status == 200:
                _c[i] = K + i + ext; return _c[i]
        except Exception: pass
    _c[i] = None; return None
def custo(p, origem): return round(p, 2) if origem == 'BR' else round(p * 1.205 + (12 if p < 99 else 0), 2)
S = {}
def add(ali, origem, nome, sub, desc, gal, attrs, linhas, vid=None, peso=0.4):
    s = {'nome': nome, 'cats': [E, A, sub], 'desc': desc, 'aviso': 'Enviado do Brasil: entrega rápida.' if origem == 'BR' else '', 'peso': peso, 'origem': origem,
         'gallery': [x for x in (img(g) for g in gal) if x], 'attrs': attrs, 'video': (V + vid) if vid else None}
    if attrs: s['vars'] = [{'attrs': dict(zip(attrs, v)), 'cost': custo(p, origem), 'img': img(i)} for v, p, i in linhas]
    else: s['vars'] = []; s['cost'] = custo(linhas[0][1], origem)
    S[ali] = s

add('1005008068766012', 'BR', 'Kit 3 Hip Bands de Tecido – Leve, Média e Forte', 'Elásticos e Acessórios',
    'Kit com 3 faixas de tecido antiderrapantes (leve, média e forte) para glúteos, coxas e pernas. Treino em casa ou na academia. Mais de 240 vendidos, nota 4,8.',
    ['A09d84997cfa545368218817f0b126ab1G.jpeg', 'Ad589970dc003418d988b669c282ca372I.jpeg', 'A4e758dc288724ae4ad9ab22f3dba07e1o.jpeg', 'A90fb5ca8744947df83050fa97ea8e097C.jpeg', 'Ad50c1d40414e4d1c8574ea80f1d11bddz.jpeg', 'A5d1d8bd739254f228a7a85f836a24df7m.jpeg'],
    [], [((), 25.33, None)], peso=0.3)
add('1005012471635031', 'BR', 'Barra Fixa de Porta Reforçada 62 a 100 cm – Garantia de 5 Anos', 'Barras e Puxadores',
    'Barra fixa de porta reforçada, ajustável de 62 a 100 cm, sem furar a parede. Para barra, flexões e abdominal. Mais de 220 vendidas, nota 4,9.',
    ['S75be9b29b0a54e0c97fbf43c4990e3ae3.jpg', 'S23520f69210748eebaabda60ae5e3d79T.jpg', 'Se9c020686141485a9fc9ade891358294o.jpg', 'S06ec068a61d941b39c8f38257879b48c9.jpg', 'Sc3de1d0d21a1495082a677f58f9ed70fv.jpg', 'S67438c32313b42c08b9b5a9dc04524dcs.jpg'],
    [], [((), 59.29, None)], vid='u/ae_sg_item/3001350718098/p/1/e/6/t/10301/5000529256046.mp4', peso=1.5)
add('1005010180923740', 'CN', 'Corda de Tríceps com Alças Ergonômicas (Push Pull Down)', 'Barras e Puxadores',
    'Corda para tríceps e bíceps na polia, com alças ergonômicas que não machucam a mão. Mais de 500 vendidas, nota 4,9.',
    ['Sfad0bfb96f4b402e804a9a35a12d92c8L.jpg', 'S170c1359456a489cbb7874736c5a8199Y.jpg', 'S59be40fa3c4d4095a0b8dfbce03079d8Z.png', 'S4c0dff8eef6f43b9b54d059a51496f6ch.jpg', 'Sae57df7ed00f4d3fb9499932f0f36b28u.jpg', 'S5cce4085041645f0acdea77bd0ecd91fm.jpg'],
    [], [((), 72.69, None)], vid='u/ae_sg_item/2212845479307/p/1/e/6/t/10301/5000356650919.mp4', peso=0.6)
add('1005012141608214', 'BR', 'Aparelho Abdominal com Ventosas – Multifuncional', 'Abdominal, Cardio e Postura',
    'Aparelho para abdominal com ventosas que prendem no chão, para treinar abdômen e lombar em casa sem ninguém segurando os pés. Nota 4,7.',
    ['S119bcf11e19e46e4a40ab05b73380e6cE.jpg', 'S7c8333f95a354a4db0ce1ef347d624b3b.jpg', 'S9ceceb35e6e84bcda3634a70bebd6267y.jpg', 'Se6fe681605ab4e16b878d82049257dae6.jpg', 'S3a7241e4c6e845cca18fa687e9a381aaf.jpg', 'S1171ce8c229b4a99b487a7c81cad62caF.jpg'],
    [], [((), 73.69, None)], vid='u/ae_sg_item/3001345798239/p/1/e/6/t/10301/5000485642757.mp4', peso=1.2)
add('1005007344926975', 'CN', 'Corda de Pular Speed 2,8 m Ajustável – 1, 2 ou 3 Unidades', 'Abdominal, Cardio e Postura',
    'Corda de pular de velocidade, 2,8 m ajustável, para adultos e crianças. Para cardio, crossfit e boxe. Mais de 400 vendidas, nota 4,9.',
    ['Sb094c647973842ec91bb4e77b8c6e4d1Z.jpg', 'S5855bd3134ef422485e9ac143ac96c1do.jpg', 'S6f8eabd65d5e4b5ca3285c6ed85a40574.jpg', 'S3096beb17b7741948668bc1825da0b054.jpg', 'S868aef1d52c24b5b8e63285e8eb36b8fa.jpg', 'Seeb537f188a34ae29a7859ec00bd596cd.jpg'],
    ['Quantidade'], [(('1 corda',), 11.79, 'S5855bd3134ef422485e9ac143ac96c1do'), (('2 cordas',), 19.69, 'S6f8eabd65d5e4b5ca3285c6ed85a40574'), (('3 cordas',), 26.61, 'S03dfadf5648645729e152c07f289744cb')], peso=0.3)

def pv(c):
    p = c * (2 if c <= 50 else 1.6 if c <= 100 else 1.5) / 0.94
    q = int(p) + 0.9
    return q if q >= p - 1e-4 else q + 1
json.dump(S, open('lote.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for k, s in S.items():
    cs = [v['cost'] for v in s['vars']] or [s['cost']]
    print(f"{s['origem']} {s['nome'][:55]:55} | R$ {pv(min(cs)):.2f}–{pv(max(cs)):.2f} | fotos {len(s['gallery'])} | {'vídeo' if s['video'] else ''}")
