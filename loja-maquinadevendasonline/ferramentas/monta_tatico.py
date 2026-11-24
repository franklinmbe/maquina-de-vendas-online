import json
K = 'https://ae-pic-a1.aliexpress-media.com/kf/'
AV_COL = 'Não é colete balístico: não protege contra disparos. Uso em airsoft, paintball e recreação.'
AV_LUV = 'Não é EPI (não tem CA): não use como equipamento de proteção para trabalho. Uso em airsoft, paintball, moto e atividades ao ar livre.'
AV_GER = 'Produto para airsoft, paintball e recreação. Não acompanha armas nem carregadores.'

def prod(nome, cat, desc, aviso, gal, attrs, linhas, imgs, peso=0.4, tx=0):
    """linhas: (valores dos atributos, preço, imposto da 1ª linha p/ proporção); imgs: chave->kf"""
    r = tx / linhas[0][1]
    vars_ = []
    for vals, price, chave in linhas:
        vars_.append({'attrs': dict(zip(attrs, vals)), 'cost': round(price * (1 + r), 2), 'img': (K + imgs[chave]) if imgs.get(chave) else None})
    return {'nome': nome, 'cat': cat, 'desc': desc, 'aviso': aviso, 'peso': peso, 'gallery': [K + g for g in gal], 'attrs': attrs, 'vars': vars_}

S = {}
# ---------- 1. Cinto VULPO ----------
im = {'Black No Sling': None, 'Green NO Sling': 'HTB1tJ6RiYsTMeJjy1zeq6AOCVXau.jpg', 'Black With Sling': 'HTB1bpS0rFmWBuNjSspdq6zugXXaU.jpg',
      'MC With Sling': 'HTB14WD7rKuSBuNjy1Xcq6AYjFXau.jpg', 'Khaki No Sling': 'HTB1dkZai3oQMeJjy0Fpq6ATxpXax.jpg', 'MC No Sling': 'HTB13jaLeWagSKJjy0Fcq6AZeVXaO.jpg',
      'Green With Sling': None, 'Khaki With Sling': 'HTB1MRcqfHwrBKNjSZPcq6xpapXaz.jpg'}
L = [(('Preto', 'Sem alça'), 65.79, 'Black No Sling'), (('Verde', 'Sem alça'), 65.79, 'Green NO Sling'), (('Preto', 'Com alça de ombro'), 71.29, 'Black With Sling'),
     (('Multicam', 'Com alça de ombro'), 71.29, 'MC With Sling'), (('Cáqui', 'Sem alça'), 65.79, 'Khaki No Sling'), (('Multicam', 'Sem alça'), 65.79, 'MC No Sling'),
     (('Verde', 'Com alça de ombro'), 71.29, 'Green With Sling'), (('Cáqui', 'Com alça de ombro'), 71.29, 'Khaki With Sling')]
S['32834618241'] = prod('Cinto Tático Acolchoado MOLLE Ajustável – com ou sem Alça de Ombro', 'Cintos Táticos',
    'Cinto tático acolchoado com sistema MOLLE para prender bolsas e acessórios. Ajustável, confortável no uso prolongado. Opção com alça de ombro. Ideal para airsoft, paintball, trilhas e camping.',
    AV_GER, ['H5e5ba16127ba4b1f8a523e4cfe3d9888U.jpg', 'HTB1QLvUdoRIWKJjSZFgq6zoxXXaY.jpg', 'HTB1F1sti3oQMeJjy0Foq6AShVXa4.jpg', 'HTB1xanMefNNTKJjSspfq6zXIFXa3.jpg'],
    ['Cor', 'Modelo'], [(v, p, k) for v, p, k in L], im, 0.6, tx=13.48)
# ---------- 2. Cinto acolchoado com suspensórios ----------
im = {'Ruin': 'Se155feb743fb4b21997c81bb98574e5dB.jpg', 'verde': 'S4fbdcfcd3bd045e9b9adf7761c11275au.jpg', 'Preto': 'S11c5b208adbb48fc8441ea5a0c75822a6.jpg',
      'caqui': 'Sa47d37cb87c7433bb79e61864ece14ffa.jpg', 'CP': 'Sf22e2b9c2cfc4c8785a4ef5f2cd80b4dX.jpg'}
S['1005005809029407'] = prod('Cinto Tático Acolchoado MOLLE com Suspensórios Ajustáveis', 'Cintos Táticos',
    'Cinto tático acolchoado e macio com suspensórios ajustáveis, que distribuem o peso nos ombros. Sistema MOLLE para prender bolsas e acessórios. Comprimento do cinto: 125 cm. Para airsoft, paintball e atividades ao ar livre.',
    AV_GER, ['Sba2855cadc69435c904c0bd62ba860fcL.jpg', 'S55ff78f73eb044c29b4460298aca6ef2m.jpg', 'Sf13d695e7eac4040b07888d8b542413bY.jpg', 'S2867979d6d1e433f80d995e27ec4c9daF.jpg', 'See41ca5785944faea0ca7b06dcd4208cm.jpg', 'Sdfdc813b2a0b41189254d8861665a7444.jpg'],
    ['Cor'], [(('Verde Ruína',), 111.07, 'Ruin'), (('Verde',), 118.54, 'verde'), (('Preto',), 162.43, 'Preto'), (('Cáqui',), 119.27, 'caqui'), (('Multicam',), 118.94, 'CP')], im, 0.9, tx=22.76)
# ---------- 3. Luva tática (5.000+ vendidas) ----------
im = {'bk': 'S72c51a731a5144c79f76d0c54ef328d4Y.jpg', 'gn': 'Sbcb2c45354ac418a9c1809c91a0bc1083.jpg', 'fbk': 'Sf25c7dc09bc24efaa3dacd56b525523fJ.jpg',
      'ye': 'S293e8684e26145a48089ba4eb746f498V.jpg', 'fye': 'Sa162e50f5583418b99cb16b94342845fu.jpg'}
T = {'M': 'M', 'L': 'G', 'XL': 'GG'}
L = [(('Preto – meio dedo', T[t]), 21.8, 'bk') for t in ['M', 'L', 'XL']] + [(('Verde – meio dedo', T[t]), 21.88, 'gn') for t in ['M', 'L']] + \
    [(('Preto – dedo inteiro', T[t]), 25.35, 'fbk') for t in ['M', 'L', 'XL']] + [(('Areia – meio dedo', T[t]), 22.41, 'ye') for t in ['M', 'L', 'XL']] + \
    [(('Areia – dedo inteiro', T[t]), 25.17, 'fye') for t in ['M', 'L', 'XL']]
S['1005004433832803'] = prod('Luva Tática com Proteção Rígida nos Dedos – Meio Dedo ou Dedo Inteiro', 'Luvas Táticas',
    'Luva tática com proteção rígida nos nós dos dedos e palma reforçada. Modelos meio dedo ou dedo inteiro. Boa pegada e ventilação. Para airsoft, paintball, moto, trilha e academia. Mais de 5 mil vendidas.',
    AV_LUV, ['Sd67858e0403f4edca2d252f3ab6544c1H.jpg', 'S83e47ff096c945eb922b99d6658cf097w.jpg', 'S4755e1bd65a64ec4a782886a83787fd8J.jpg', 'S28e362c22f33421ab3b931d21e0e81cej.jpg', 'S4d86120d4c8440c0b7792825517d6b09A.jpg', 'Se858c9527a6043819fe02a3c5fb8d1401.jpg'],
    ['Modelo', 'Tamanho'], L, im, 0.15, tx=4.52)
# ---------- 4. Luva tática meio dedo ----------
im = {'bk': 'S6ccf6f395c184837a3d1d6e182d41033Y.jpg', 'gn': 'Sc99fbfe5111848c0a31038fbe979deb5c.jpg', 'sd': 'S85aba3adecf842ed98d6fd29f3bf914av.jpg'}
L = [((c, T[t]), p, k) for c, p, k in [('Preto', 27.49, 'bk'), ('Verde Militar', 28.69, 'gn'), ('Areia', 27.79, 'sd')] for t in ['M', 'L', 'XL']]
S['1005012200423158'] = prod('Luva Tática Meio Dedo com Proteção Rígida – Airsoft e Paintball', 'Luvas Táticas',
    'Luva tática meio dedo com proteção rígida nos nós dos dedos. Leve, ventilada e com boa pegada. Para airsoft, paintball, moto, caminhada e escalada.',
    AV_LUV, ['S791031895ae44d89a1df51d0ec0386414.jpg', 'S72f35b4e6be2438ba4062af2059eedbbL.jpg', 'Sbc777a73c1304e37b1bcc46fc8613f0f3.jpg', 'S187604bdd2a74e01b079c365a96fda4ec.jpg', 'Sabe403f6c75a47018cf813847f67b5f3t.jpg', 'S6b711cd125c943d8b865d5cd3822c0dbI.jpg'],
    ['Cor', 'Tamanho'], L, im, 0.15, tx=5.66)
# ---------- 5. Porta-carregador triplo 1+2 ----------
im = {'cb': 'S2488ba49e3f246d9883ccebfc82fd1eeT.jpg', 'mc': 'S8f31a71b065e4f1f82381fe51f076d89T.jpg', 'rg': 'S2b1a73eab9034801a1e7d516d7cdf0e72.jpg',
      'bk': 'S8379841806f0420cb8a601569aa70f82X.jpg', 'mcbk': 'Sc376ec700d90441884696ad95ece2730j.jpg'}
S['1005005251223150'] = prod('Porta-Carregador Triplo MOLLE (1 grande + 2 pequenos) para Airsoft', 'Porta-Carregadores e Bolsas',
    'Porta-carregador triplo com encaixe rápido: 1 compartimento grande e 2 pequenos lado a lado. Prende em cinto ou colete com sistema MOLLE e clipe. Para airsoft e paintball.',
    AV_GER, ['Se638125bded54850a9f3d2f97b2331721.jpg', 'S48aa03d08e25460b9495e73fa72ab48bn.jpg', 'Sf9660b18f4dd4fc18eb8682531cba867q.jpg', 'Sf60e105f88d34185acea0375a1ac894db.jpg', 'S2b66f9e9d2084df09396cdbb372eff77X.jpg', 'S15fa1d86565b4dacaae602dfd15d06d09.jpg'],
    ['Cor'], [(('Marrom Coyote',), 40.49, 'cb'), (('Multicam',), 46.19, 'mc'), (('Verde Ranger',), 40.49, 'rg'), (('Preto',), 40.49, 'bk'), (('Multicam Preto',), 46.19, 'mcbk')], im, 0.25, tx=8.33)
# ---------- 6. Bolsa porta-carregador 1000D simples/dupla/tripla ----------
C = {'TN': 'Areia', 'GN': 'Verde', 'BK': 'Preto', 'CP': 'Multicam'}
M = {'Single': 'Simples', 'Double': 'Dupla', 'Triple': 'Tripla'}
raw = [('Single-TN', 15.64, 'Sad961f2a761c4c5092537f5c8fcf6029K.jpg'), ('Triple-GN', 29.95, 'S96d9ef53da0548968c06246a6381817fB.jpg'), ('Triple-BK', 30.79, 'S773df902b1ef4dd1a9757274bdd56123B.jpg'),
       ('Double-GN', 26.49, 'S99a340caa6554c33a033dd42cd6048ab3.jpg'), ('Triple-TN', 30.79, 'Sb3f02a2c7de343f7b12de108c2e23ba9n.jpg'), ('Double-BK', 26.07, 'Sa31a22d97ad44b3588d9897ca2b7db319.jpg'),
       ('Single-GN', 15.64, 'Sc297e4cc063e42ee9be9c698a8998004U.jpg'), ('Triple-CP', 30.0, 'S86a6325baa2345bba76f782366ceaf5cF.jpg'), ('Single-BK', 15.9, 'Sc7cea719a5784361ab3cc71f6d5fe828c.jpg'),
       ('Double-CP', 26.85, 'S9b9de36219ff42d293a2d549d5d5368dO.jpg'), ('Double-TN', 27.07, 'S97ef0e2beecc4e69a2e2d676dcd187601.jpg'), ('Single-CP', 16.11, 'S06804968bab0401fa662fb7e26c59d3dn.jpg')]
S['1005012871154256'] = prod('Bolsa Porta-Carregador MOLLE 1000D – Simples, Dupla ou Tripla', 'Porta-Carregadores e Bolsas',
    'Bolsa porta-carregador em nylon 1000D resistente, com aba e fecho. Escolha simples, dupla ou tripla. Prende em cinto ou colete com sistema MOLLE. Para airsoft e paintball.',
    AV_GER, ['S363c4f3399394480a1103fb02032ae7cU.jpg', 'Sba8627c32a12418f933d3c2a88e410440.jpg', 'Sb98c48c96efa451682a4245cc6c97e62O.jpg', 'S4f5b5d5f581d49c78d6b54430c4c99a2Y.jpg', 'Sd25a38b415dc42deaff1c1005916991cg.jpg'],
    ['Modelo', 'Cor'], [((M[n.split('-')[0]], C[n.split('-')[1]]), p, n) for n, p, _ in raw], {n: i for n, _, i in raw}, 0.25, tx=3.25)
# ---------- 7. Colete chest rig multicam ----------
im = {'BK': 'Sd0d1c3dc9d1d47bfaca7da5cd6eb1c3eJ.jpg', 'OD': 'S93d236c2a7af49b8904bc0a4c3a2430b5.jpg', 'TAN': 'S0d8e941dbf074c8e99ff2e0a0c2f9679x.jpg', 'CP': 'Scb2fce6db723492e8b3d25fee713cfbfJ.jpg'}
S['1005007797533081'] = prod('Colete Tático Chest Rig com Porta-Carregadores – Airsoft', 'Coletes Táticos',
    'Colete tático tipo chest rig (peitoral) com bolsos para carregadores e acessórios, alças cruzadas ajustáveis e fecho rápido. Leve e confortável. Para airsoft, paintball e recreação.',
    AV_COL, ['S554c6a0c212f4059a6b9c4d35b6e84a5z.jpg', 'Sf1ea3c3a89ff49a7acc6763e74d53441J.jpg', 'S2edaf1bd62fb4edda535fdc83298dd41i.jpg', 'Sa26b6dae23b640098becda834c7b619e7.jpg', 'S9b6815298c3a483a9a834239acd969c6u.jpg', 'S9a749e82699d4c878d43958dc4c357d86.jpg'],
    ['Cor'], [(('Preto',), 114.74, 'BK'), (('Verde Oliva',), 115.03, 'OD'), (('Areia',), 116.54, 'TAN'), (('Multicam',), 153.5, 'CP')], im, 0.9, tx=23.53)
# ---------- 8. Colete MOLLE ajustável ----------
im = {'bk': 'Se68edf76862949c3bac54fc1ab1d2e91E.jpg', 'acu': 'Sfa846a6151334e81a8f8881196acfd13P.jpg', 'gn': 'S66a3970231c24e70ad7e707bdb29f26dm.jpg'}
S['1005010109555870'] = prod('Colete Tático MOLLE Ajustável – Airsoft e Paintball', 'Coletes Táticos',
    'Colete tático com sistema MOLLE em toda a frente e as costas para prender bolsas e acessórios. Ajustável no tronco e nos ombros. Mais de mil vendidos. Para airsoft, paintball, cosplay e recreação.',
    AV_COL, ['S844eee2a1eed473f89edfca81e43e1abc.jpg', 'S98da2352da8b4ffe89de88d790273a73M.jpg', 'S40036cebc7e841ad87d4cf92a3f98388q.jpg', 'Sc9a1a6d2dd3042f590ba01f97b18e918I.jpg', 'S4613f629e47c4ce68baf1ddc9e0931a9b.jpg', 'S8fbf8324adce49298ef368744b09fb8fr.jpg'],
    ['Cor'], [(('Preto',), 149.99, 'bk'), (('Camuflado ACU',), 173.59, 'acu'), (('Verde',), 187.99, 'gn')], im, 1.0, tx=30.77)
# ---------- 9. Ghillie 3D floresta ----------
im = {'Camo': 'S9a4ec1949f07460496f58e36a8b62ccd2.jpg', 'Ruins': 'S5e135ae7960e4584aba3b02522bf31cc5.jpg', 'Camo leaves': 'S324e251665a4409ca17b1dbdadf4407dD.jpg',
      'Dead grass': 'Sfa52bf47ad4a485e99de8d8cde671c5f7.jpg', 'Snow': 'S545a6471ec7a4a9098cb9cd5b9cb07b7I.jpg'}
CN = {'Camo': 'Camuflado Floresta', 'Ruins': 'Ruína', 'Camo leaves': 'Folhas', 'Dead grass': 'Capim Seco', 'Snow': 'Neve'}
L = [((CN[c], t), 128.59, c) for c in CN for t in ['M/G (M-L)', 'GG/XG (XL-XXL)']]
S['1005008981971634'] = prod('Roupa Ghillie 3D Camuflada com Folhas – Jaqueta com Capuz + Calça', 'Roupas Camufladas',
    'Roupa camuflada ghillie 3D com folhas, leve e respirável: jaqueta com capuz e calça. Ideal para airsoft, paintball, caça fotográfica e observação de pássaros. Mais de 800 vendidas.',
    AV_GER, ['S2307b88f85a54c7cb29115535b9e44abZ.jpg', 'S459744456be940cb9ba0241a093ac80dC.jpg', 'S8db228774ceb40e3b0ea504ce6edf9037.jpg', 'S3533061633fb49c6ab53a99c7424ec94F.jpg', 'Se29baacb5a7c439288800b90e7b1589fy.jpg', 'Sec4709d8e2944f2295a166085ef43646o.jpg'],
    ['Cor', 'Tamanho'], L, im, 0.8, tx=26.39)
# ---------- 10. Ghillie 3D grama (5 peças, adulto e infantil) ----------
im = {'WT': 'S59c19f8fa6ac4f1ab54072347ed3e5bfS.jpg', 'GR': 'Sc3975914232e4f95ac165fdcc72c5056P.jpg', 'TN': 'S2d0ce1e36b62449086b9c581265a7a7c7.jpg'}
AL = {'110-140': '1,10 a 1,40 m', '140-160': '1,40 a 1,60 m', '160-165': '1,60 a 1,65 m', '165-185': '1,65 a 1,85 m', '185-200': '1,85 a 2,00 m'}
L = [(('Floresta', AL[a]), 196.59, 'WT') for a in AL] + [(('Verde', AL[a]), 196.59, 'GR') for a in AL] + [(('Areia', AL[a]), 203.99, 'TN') for a in ['110-140', '140-160', '160-165', '185-200']]
S['1005007644420108'] = prod('Roupa Ghillie 3D de Grama – 5 Peças, Adulto e Infantil', 'Roupas Camufladas',
    'Kit ghillie 3D com aparência de grama, 5 peças (jaqueta, calça, capuz, capa para o equipamento e bolsa). Tamanhos de 1,10 m a 2,00 m de altura, para adultos e crianças. Para airsoft, paintball, caça fotográfica e fantasia.',
    AV_GER, ['S9941716a21a4476195d045f623299585v.jpg', 'S3d4bb9725b1f4b61b0002c9a9d96ad2c2.jpg', 'Sb0052cb2b4e8456d9daca6a8ea4a7ffdE.jpg', 'Se18a8f860d0c41048f36c08efbed734ei.jpg', 'Sdb1efd112f6b446f831fa6a9fa8203eam.jpg', 'S780a08ab07e54c92946645f2a8ca5eb4s.jpg'],
    ['Cor', 'Altura'], L, im, 1.2, tx=40.31)
# ---------- 11. Porta-carregador duplo de pistola (elástico) ----------
im = {'CB': 'S2b403529a24e4fdbac7c33a12ca4c393K.jpg', 'BK': 'S1bee5cffcf6b4e3890255806380e9bf3c.jpg', 'MC': 'S720cd6f91a664516be636410c02431e55.jpg',
      'RG': 'S3c7dd59a2a5f4e399640034ab56fce339.jpg', 'MCBK': 'Sd8aa9858379f49849dd8fd02a696952eX.jpg'}
S['1005007217441812'] = prod('Porta-Carregador Duplo de Pistola MOLLE em Nylon com Elástico', 'Coldres e Porta-Carregadores',
    'Porta-carregador duplo para pistola de airsoft, em nylon com elástico que segura firme e cordão de retenção. Prende no cinto ou no colete (MOLLE).',
    AV_GER, ['S63cfe83454a54271b34822da2fa299f16.jpg', 'S3789f7ccf3224db9ae3d688318915a64f.jpg', 'S633ca26c5b8f423d8556010813a44d44E.jpg', 'S6f5519ce301a477abf62a9baa05a0a11W.jpg', 'S4152a2ef932347c8a7ed3851d137236d3.jpg', 'S64ca2896286447d4b2ba5d560e4c5baf9.jpg'],
    ['Cor'], [(('Marrom Coyote',), 45.34, 'CB'), (('Preto',), 47.91, 'BK'), (('Multicam',), 48.33, 'MC'), (('Verde Ranger',), 47.48, 'RG'), (('Multicam Preto',), 45.76, 'MCBK')], im, 0.15, tx=9.35)
# ---------- 12. Porta-carregador duplo de pistola (fileira dupla) ----------
im = {'TN': 'S536660d4840842a8a5ab39aac067684fD.jpg', 'BK': 'A1c7ffd77509447a4b8a5e26ee52ef3cbN.jpg'}
S['1005007567262011'] = prod('Porta-Carregador Duplo de Pistola MOLLE – Fileira Dupla', 'Coldres e Porta-Carregadores',
    'Porta-carregador duplo para pistola de airsoft (fileira dupla), com abas e prendedor MOLLE. Também serve como porta-lanterna. Prende no cinto ou colete.',
    AV_GER, ['Sda89ec88b5d846f686bff0de3979012bo.jpg', 'S3bde3abf1535434bbf76b8d2d1365aacv.jpg', 'S5af69a69c80a4250b5b3cc978bd156ffI.jpg', 'A9f4dd972b2b345c699ad0cfe45fb5649g.jpg', 'Afb00fd191df140cba53ea8a869167aecj.jpg', 'S408d831de1e246dc835850bab7b6e0e5b.jpg'],
    ['Cor'], [(('Areia',), 39.89, 'TN'), (('Preto',), 40.29, 'BK')], im, 0.15, tx=8.21)

def pv(c):
    p = c * (2 if c <= 50 else 1.6 if c <= 100 else 1.5) / 0.94
    q = int(p) + 0.9
    return q if q >= p - 1e-4 else q + 1
json.dump(S, open('tatico.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for k, s in S.items():
    ps = [pv(v['cost']) for v in s['vars']]
    print(f"{s['nome'][:60]:60} | {len(s['vars']):2} var | custo até {max(v['cost'] for v in s['vars']):7.2f} | R$ {min(ps):.2f}–{max(ps):.2f}")
