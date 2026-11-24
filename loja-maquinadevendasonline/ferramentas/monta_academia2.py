"""24/11/2026 — Academia, 2ª leva: resto da 1ª página da busca "acessorios academia" (filtro Do Brasil), itens novos,
no máximo 2 fornecedores por item + 2 pedidos diretos do Franklin (protetor de palma e tatame EVA, da China).
Brasil: preço final (sem imposto). China: preço + imposto estimado. Vídeo do fornecedor quando existe."""
import json
K = 'https://ae-pic-a1.aliexpress-media.com/kf/'
V = 'https://video.aliexpress-media.com/play/'
E, A = 'Esportes e Fitness', 'Academia'
AVB, AVC = 'Enviado do Brasil: entrega rápida.', ''
S = {}

def add(ali, nome, sub, desc, gal, attrs, linhas, origem='BR', tax=0.0, peso=0.4, vid=None):
    """linhas: [(valores, preço, img)] ; tax = imposto da 1ª linha (China), aplicado na mesma proporção"""
    r = (tax / linhas[0][1]) if tax else 0
    s = {'nome': nome, 'cats': [E, A, sub], 'desc': desc, 'aviso': AVB if origem == 'BR' else AVC, 'peso': peso, 'origem': origem,
         'gallery': [K + g for g in gal], 'attrs': attrs, 'video': (V + vid) if vid else None}
    if attrs:
        s['vars'] = [{'attrs': dict(zip(attrs, v)), 'cost': round(p * (1 + r), 2), 'img': (K + i) if i else None} for v, p, i in linhas]
    else:
        s['vars'] = []; s['cost'] = round(linhas[0][1] * (1 + r), 2)
    S[ali] = s

BT, LP, JS, BP, EL, AB = 'Bolas e Tapetes', 'Luvas e Protetores', 'Joelheiras e Suportes', 'Barras e Puxadores', 'Elásticos e Acessórios', 'Abdominal, Cardio e Postura'

add('1005011550795250', 'Bola de Pilates e Yoga 55 ou 65 cm – Fitness e Abdominal', BT,
    'Bola de pilates e yoga para abdominal, alongamento, equilíbrio e fisioterapia. Escolha 55 cm (para quem tem até ~1,70 m) ou 65 cm (acima de ~1,70 m). Cor sortida. Mais de 200 vendidas.',
    ['Sf87029660f9346f29987056e93f10704u.jpg', 'S76c5053acd994a02a82dbe9810220b6fv.jpg', 'S61c1328cc3624b669579ddd69609f815q.jpg', 'S3911d76455524dd9b17c4e0bc81dd8237.jpg', 'Sae06bdad5feb4719829a269020547b06A.jpg', 'S415feff94ccd4ac1af7116e01e08c808Y.jpg'],
    ['Tamanho'], [(('55 cm (cor sortida)',), 43.19, 'Sc6ad176172714372936a1bbf4822ea40Z.jpg'), (('65 cm (cor sortida)',), 47.69, 'S5c0919c65f8b43879785cfd2156795d92.jpg')], peso=1.2)
add('1005011697107181', 'Bola de Pilates e Yoga Profissional 55 ou 65 cm', BT,
    'Bola de pilates profissional para exercícios, alongamento e postura. Tamanhos 55 cm ou 65 cm. Cor sortida.',
    ['Sc9fa9cc753de40f6ba311cc979e8572de.jpg', 'S254c2a7bc9ff4612b97b01dee6090342x.jpg', 'S378ba45e32fb45438cb1494b99cda7eak.jpg', 'S264a3f405bf14392adc5b74ce62275abf.jpg', 'S310de43e1b5343fba313d6e7fc5d42adp.jpg', 'Sf4c4894fee98432dae60dbceaa8b54a4n.jpg'],
    ['Tamanho'], [(('55 cm (cor sortida)',), 43.19, 'S562dda4393b34d608d191646ea575eecC.jpg'), (('65 cm (cor sortida)',), 47.69, 'Sb7711b31f13f4f4993f63cf6a092a2c2A.jpg')], peso=1.2)
add('1005009401721553', 'Tatame EVA de Encaixe para Academia em Casa – Kit 16 Placas', BT,
    'Tatame de espuma EVA antiderrapante com encaixe tipo quebra-cabeça, 16 placas. Protege o piso e amortece exercícios, yoga e alongamento. Mais de 2 mil vendidos.',
    ['S2847b7549d2b45158e7f87faf11940f3l.jpg', 'S675b75165b7c4d28a2292d2e2d110d510.jpg', 'S754cbff98f2f41c7848f61f3315d70ebB.jpg', 'S9225434a725442e8bf6e531e2716dab2R.jpg', 'Se0cc20d363724fda89355930de5b5c24A.jpg', 'Sd8ff63f66fa64449983dd0fcd8c39012t.jpg'],
    ['Cor'], [(('Preto e Cinza',), 114.23 + 23.46, 'Sd8ff63f66fa64449983dd0fcd8c39012t.jpg'), (('Preto',), 107.55 + 22.06, 'S383c6617df7a470597fb0573a042b1eaL.jpg'), (('Cinza',), 112.18 + 23.02, None)],
    origem='CN', peso=3.0, vid='u/ae_sg_item/3000920690012/p/1/e/6/t/10301/5000268488433.mp4')
add('1005012255254139', 'Luva para Musculação Antiderrapante – Proteção da Palma', LP,
    'Luva para levantamento de peso e treino, antiderrapante, protege a palma contra calos. Para academia, barra fixa e crossfit. Mais de 160 vendidas.',
    ['Seeaa928a1b5f48e8a25f707e7acf2647D.jpg', 'Sa386b5da38f14baab95253c3199153f1y.jpg', 'S9a290c8ab5694692820a48732860a822Z.jpg', 'S5d216d5787dc42bd919f97835a6469ddJ.jpg', 'Sd65747abdefa4bfd97f1cfba85a9ea05G.jpg', 'S194ce854a7b84355bf72bf4c119ca041X.jpg'],
    [], [((), 21.72, None)], peso=0.15)
add('1005006741787383', 'Protetor de Palma em Couro (Grip) para Musculação e Barra', LP,
    'Protetor de palma em couro com esponja e pulseira, resistente e antiderrapante. Para levantamento terra, barra fixa e halterofilismo. Mais de mil vendidos.',
    ['Sd72e2cc3104c45249c251ea781396887l.jpg', 'Sec90261478354fca8e50a146a193279cD.jpg', 'S1c006ca3feaa4f34ace98dfae442d6a95.jpg', 'S57c6ed9063f341238b2c6002f55a182c2.jpg', 'S59ab7d9956ba4d2d84e7575ee144339cQ.jpg', 'S374c86e5c2f84a7b92bdaf493c1c8238n.jpg'],
    ['Cor'], [(('Cinza',), 49.09, 'S374c86e5c2f84a7b92bdaf493c1c8238n.jpg'), (('Marrom',), 49.89, 'Sb905c74d8363473085dbade99cb64af5n.jpg')],
    origem='CN', tax=10.11, peso=0.2, vid='u/ae_sg_item/2215946774768/p/1/e/6/t/10301/5000208618593.mp4')
add('1005010546355683', 'Par de Joelheiras de Esponja – Vôlei, Dança e Basquete', JS,
    'Par de joelheiras acolchoadas de esponja, respiráveis, para vôlei, dança, basquete e treino funcional.',
    ['S1632ae4054fd49168aeeb7ddb4ac4441S.png', 'S1283d978ddb8496fa4b5cc329c498796l.png', 'Se87b4f0d4e83458081ca8baeabb384beC.png', 'Sbaba76fabe29458686ab4e4bbc1576422.png', 'S22d5222d6dcf413ba278631d9cd0f73af.png', 'S8c721ec010304d14bcbe9a02d67029d3h.png'],
    ['Tamanho'], [(('M',), 40.71, None), (('G',), 40.71, None)], peso=0.3)
add('1005012465421702', 'Barra Fixa de Porta Ajustável 62 a 100 cm', BP,
    'Barra fixa de porta, ajustável de 62 a 100 cm, sem furar a parede. Para flexão de braço, costas e abdominal em casa.',
    ['Sbe5b6f2b1de64afb96930692dade33c1s.jpg', 'Seec34ee2930e4e52827de776b22c4a8ck.jpg', 'S3974bc4877dd4d51b39d15544966bffcP.jpg', 'Sa8d6012e290f4742a39088ab653c32d7S.jpg', 'Sdb1368f62b3b4e14a8d42f5f4c73e4e3G.jpg', 'S20f6b6d67bec421482584b8d24fd3e7ey.jpg'],
    [], [((), 59.39, None)], peso=1.5, vid='u/ae_sg_item/3001342678388/p/1/e/6/t/10301/5000528364499.mp4')
add('1005012476484041', 'Barra Fixa com Empunhadura de Espuma – 62 a 100 cm', BP,
    'Barra fixa de porta com empunhadura de espuma antiderrapante e confortável, ajustável de 62 a 100 cm. Para calistenia e treino em casa.',
    ['Sd684b55a59eb47258797665380807744y.jpg', 'S88b0948323774fdd87b6ecf2e3bb66e8M.jpg', 'S563f8a47e6a942a690a6f5205b0883f4h.jpg', 'S477847ee8d154d6ab70b400dfff3d12df.jpg', 'S4fd82cdb8991445e8961658d85e334eaJ.jpg', 'S930dc7d3882f45d291a34a8341a5c11dV.jpg'],
    [], [((), 59.39, None)], peso=1.5, vid='u/ae_sg_item/3001345798239/p/1/e/6/t/10301/5000529252840.mp4')
add('1005012599556985', 'Corda Puxador para Tríceps e Bíceps (Push Pull Down)', BP,
    'Corda puxador para polia e crossover: tríceps, bíceps, costas e ombros. Acessório de academia resistente.',
    ['S6455399b1f4e4d36882e7fb76796d52am.jpg', 'Sc18ffafca2b44478bd86e93cfc3c2c07A.jpg', 'S658eae34f9c04cbda20493618392243bM.jpg', 'S5218d3fe2db647c08371faad4eb0a6685.jpg', 'Seb89fba468a84a40afa67c5aa1f618985.jpg', 'S54693d453565448ab961d59fc03a75d0w.jpg'],
    [], [((), 66.87, None)], peso=0.6, vid='u/ae_sg_item/3000930699131/p/1/e/6/t/10301/5000545654553.mp4')
add('1005011669002748', 'Super Band Elástico Extensor – 5 Intensidades', EL,
    'Super band (elástico longo de resistência) para musculação, barra fixa assistida, alongamento e treino funcional. Escolha a intensidade pela cor.',
    ['S9f589a7062f6459fa466e073035771a6Y.jpg', 'S7a91c4b9c0d4459190d228bb4dab0f69c.jpg', 'Sdab26dd5809b4829be59c10e73e80cdfU.jpg', 'S120a387dcf35429ca5e3bcf0c6329f03g.jpg', 'S9d0ff3a3f2eb48c4a7dd6ccbe48ae638d.jpg', 'S06d46252f3c84e6b87e0e244c039db42N.jpg'],
    ['Cor'], [(('Roxa',), 52.71, 'Sd3a6cb0148ab47da80cec8bd2424af528.jpg'), (('Preta',), 52.71, 'S52ee3a6a9c1c48628f0ab108fc724995C.jpg'), (('Verde',), 52.71, 'S0f2776ae532c46c49c826bbc613ce028m.jpg'), (('Vermelha',), 52.71, 'Sb2005d4d6af645909dfbab0c487b0c5aC.jpg')], peso=0.4)
add('1005012309476249', 'Super Band Elástico para Treino de Força – Roxa', EL,
    'Super band de resistência para treino de força, barra fixa assistida e alongamento. Mais de 2 mil vendidas.',
    ['Aaa1c2d97baa745ae9b95642f4cf42a0fJ.jpg', 'Abd0d8ea208164aa39ef0dee003ce5b4b7.jpeg', 'Aa11f3724929a4a7c867c6ed276f9d182M.jpeg', 'A1e792257c0664ac2a814925e4a725477J.jpeg', 'A8d81d5658999492b8ae9c850b2de288ff.jpeg', 'A3b7a39aa5d2f46ef97481b959853ca70n.jpeg'],
    [], [((), 44.43, None)], peso=0.4)
add('1005012008407604', 'Kit 11 Peças Elásticos de Resistência com Alças e Tornozeleiras', EL,
    'Kit com 5 tubos elásticos, alças, tornozeleiras, âncora de porta e bolsa. Treino completo em casa. Mais de 50 mil vendidos.',
    ['S9af58746f130489cad2e5ab50786c35bK.jpg', 'S8ea4f7ae61ca4e11a3d0df976afa2b3e5.png', 'S02b8bae774c44c2592b644caa700ede6Q.png', 'S04c25126a0d144fea578fcfb697f6d32l.png', 'S64e552a5fcc74ecc8ee1a6d2eee9845dV.png', 'Sb69dcf8946ab436f964dd71d3f48e15fn.png'],
    [], [((), 44.22, None)], peso=0.6)
add('1005012435497224', 'Elástico Extensor Multifuncional para Braço e Perna', EL,
    'Elástico extensor com pegadores para exercícios de braço, perna, costas e glúteos em casa. Mais de 100 vendidos.',
    ['A21c9590cd6ad4f409b10cfcc30b70cbeD.png', 'A2fda0c537f0a4c59841e9a89605dfbc5P.png', 'A2b54d6d1d4884526a1ac984f049382beq.png', 'Af982319fe62e4b619c5a780a66b4a9a8n.png', 'A37ee6799504a4ebf875303cb38501ef0s.png', 'A343f6aab38764e7cb3e50981f60e8282C.png'],
    [], [((), 27.0, None)], peso=0.3)
add('1005013415530558', 'Aparelho Abdominal com Ventosa e Elásticos', AB,
    'Aparelho para abdominal com ventosa que prende no chão e elásticos para braços. Treino de abdômen em casa, sem precisar de ninguém segurando os pés. Mais de 10 mil vendidos.',
    ['A04366322ca274de796e18ba6ade380f8d.jpeg', 'A26609fcee2634964b5e0e3f5d78c07a9n.jpeg', 'Aca4f15dc3ad34bed8c84ab54b47abc60C.jpeg', 'A75cad75b3f994d419641a11f9eacef093.jpeg', 'Af6a861219f0a4e5dbbb78674dbf44179k.jpeg', 'Ac89553dc649e4aed8fe2462f4f0b924aE.jpeg'],
    [], [((), 55.79, None)], peso=0.8)
add('1005012069506673', 'Suporte de Pés para Abdominal em Aço – Uso Doméstico', AB,
    'Suporte de pés para abdominal em aço, com ventosas e espuma, firme no chão. Para treino de abdômen em casa.',
    ['Aeb8e98229efe4e8cb1e82bba5db67770C.jpeg', 'Acaa2db266a424483a3c6600361c6a4f5P.jpeg', 'A923d38eaf35a4d21b2b6ed682142fe675.jpeg', 'A26d09142b3ee41d0993c7b2b3cad02ceX.jpeg', 'Abfc5febcd710452d897a7391d6f7dbf0m.jpeg', 'Acdf1bf43ddb649fa885615f9fff8c09ep.jpeg'],
    ['Cor'], [(('Preto',), 100.0, 'A923d38eaf35a4d21b2b6ed682142fe675.jpeg'), (('Cinza',), 100.0, 'A0e0668fa2c9247609038e697c9adff95P.jpeg'), (('Rosa',), 100.0, 'A29d0749295bd4572a5811e07a5f090888.jpeg')], peso=1.5)
add('1005013473253583', 'Corda de Pular Fitness – Preta ou Rosa', AB,
    'Corda de pular leve para cardio, aquecimento e treino em casa. Vem 1 ou 2 cordas.',
    ['Sdc160a79e497429fa333c5624174736ca.png', 'S4821c87b4990488389a9546eba88f93e2.png', 'Sd7d96f76a3424ee9898f79f2db0e7ff46.png', 'S3683deda77c04cdfaf4e80d92dd3e1ffd.png', 'S98202e7fb3e94798906437a28610fb772.png', 'S5c8cbb0c430542e68185e22a34fed509y.png'],
    ['Modelo'], [(('Preta – 2 cordas',), 27.52, None), (('Rosa – 2 cordas',), 27.52, None), (('Preta – 1 corda',), 20.88, None), (('Rosa – 1 corda',), 20.88, None)], peso=0.3)
pi = ['S40e1fc05a0a644e293d62e1f177ab68fj.jpg', 'S3654458c8fe7412a98fa82180dab3e74T.jpg', 'Sfe0210b4cf934b2e9766ffc8205bf40bD.jpg', 'S0c4e302c0f7848a4a670943c688b89a1F.jpg', 'S5e7b76289d504e65a1507bb46bae9b06s.jpg',
      'Sfcb2cc04027b48a69ab819dcc38e135aK.jpg', 'S0cd6fef0f9434c3f8435f538a148bbabP.jpg', 'S14f6b9f3850c428fa5caddce5397a422g.jpg', 'S216a1a7357d64caf92f1b50154a7330cz.jpg', 'S00b92842c50142abab803a474d28d4996.jpg']
pn = [('Laranja – 1 unidade', 26.39), ('Preto – 1 unidade', 26.39), ('Cinza – 1 unidade', 26.39), ('Azul – 1 unidade', 26.39), ('Preto – 2 unidades', 35.19),
      ('Cor sortida – 1 unidade', 26.39), ('Cinza – 2 unidades', 35.19), ('Azul – 2 unidades', 35.19), ('Laranja – 2 unidades', 35.19), ('Cor sortida – 2 unidades', 35.19)]
add('1005010804223131', 'Corretor de Postura Ajustável – Costas e Ombros', AB,
    'Corretor de postura ajustável que puxa os ombros para trás e alinha as costas. Para quem trabalha sentado, atletas e reabilitação.',
    ['S257fbfe650cb494a8dee5331a1f1eb62Y.jpg', 'S58b28e5c28d44e1ba1a5a4c56b6c8b05T.jpg', 'S02253961cb4d4bdab4c6fae141a64e29Z.jpg', 'S9081467717f04f89b9fab802fe8e4428w.jpg', 'S14ae63d1f4f1432e8aaf0c5a9bbf7846Y.jpg', 'S1f49b0c00db04d7fae88309d62e388afG.jpg'],
    ['Modelo'], [((n,), p, i) for (n, p), i in zip(pn, pi)], peso=0.2)

def pv(c):
    p = c * (2 if c <= 50 else 1.6 if c <= 100 else 1.5) / 0.94
    q = int(p) + 0.9
    return q if q >= p - 1e-4 else q + 1
json.dump(S, open('lote.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for k, s in S.items():
    cs = [v['cost'] for v in s['vars']] or [s['cost']]
    print(f"{s['origem']} {s['nome'][:56]:56} | {len(s['vars']):2} var | custo até {max(cs):7.2f} | R$ {pv(min(cs)):.2f}–{pv(max(cs)):.2f} | {'vídeo' if s['video'] else ''}")
