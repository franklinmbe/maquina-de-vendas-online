"""24/11/2026 — 3ª leva: busca "equipamentos academia" (Brasil + China misturados). Só CHINA nova, com nota ≥ 4 e ≥ 100 vendas,
até 2 fornecedores da China por item (os do Brasil desta página já estavam cadastrados).
Custo China = preço × 1,205 (imposto estimado) + R$ 12 de frete estimado quando o item custa menos de R$ 99 (Choice só dá frete grátis acima de R$ 99)."""
import json, urllib.request
K = 'https://ae-pic-a1.aliexpress-media.com/kf/'
V = 'https://video.aliexpress-media.com/play/'
E, A, L = 'Esportes e Fitness', 'Academia', 'Lutas'
_cache = {}
def img(i):
    if not i: return None
    if '.' in i: return K + i
    if i in _cache: return _cache[i]
    for ext in ('.jpg', '.png', '.jpeg', '.webp'):
        try:
            r = urllib.request.urlopen(urllib.request.Request(K + i + ext, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'}), timeout=20)
            if r.status == 200: _cache[i] = K + i + ext; return _cache[i]
        except Exception: pass
    _cache[i] = None; return None
def custo(p): return round(p * 1.205 + (12 if p < 99 else 0), 2)
S = {}
def add(ali, nome, cats, desc, gal, attrs, linhas, vid=None, peso=0.4):
    s = {'nome': nome, 'cats': cats, 'desc': desc, 'aviso': '', 'peso': peso, 'origem': 'CN', 'gallery': [x for x in (img(g) for g in gal) if x], 'attrs': attrs, 'video': (V + vid) if vid else None}
    if attrs: s['vars'] = [{'attrs': dict(zip(attrs, v)), 'cost': custo(p), 'img': img(i)} for v, p, i in linhas]
    else: s['vars'] = []; s['cost'] = custo(linhas[0][1])
    S[ali] = s

EL, BT, LP, FM, BP, CM, AB = 'Elásticos e Acessórios', 'Bolas e Tapetes', 'Luvas e Protetores', 'Fortalecedores de Mão', 'Barras e Puxadores', 'Cintos de Musculação', 'Abdominal, Cardio e Postura'

add('1005010565368802', 'Super Band Faixa de Resistência Longa – 7 Níveis', [E, A, EL],
    'Super band (faixa elástica longa) para musculação, barra fixa assistida, agilidade e alongamento. Escolha a intensidade pela cor, ou o kit com 4 e bolsa. Mais de 5 mil vendidas.',
    ['Sda5381cec3034cc291ce89f2a2a858c8e.png', 'S83f5c7dc10004497a1e1a1b0dc2e9ecdq.png', 'Se9dfdaaf0a3543479ca8e7fb6b198c86R.png', 'Sfc7963a4070e4b5eb3e6e60db7ceb735Q.png', 'S2ec0ba667ace4a5d9a2aa7390e16e7f9s.png', 'S5e66750243544d15931d64d2ec37dd64l.png'],
    ['Intensidade'], [(('Amarela – 2 a 7 kg',), 14.54, 'S5f2477c7583f48bd960bc575aae14f82Z'), (('Vermelha – 7 a 11 kg',), 20.1, 'S6421d4b3de75452380207784f6c05159L'),
                      (('Preta – 11 a 23 kg',), 27.97, 'Sea9d4973e113486fbdae038e2878b1c9p'), (('Roxa – 23 a 34 kg',), 41.48, 'S98d2e2fc70514eff963a79353ecaea32J'),
                      (('Verde – 45 a 54 kg',), 53.98, 'S4bcab47b9f1d46d7acca350d901263e4V'), (('Azul – 54 a 79 kg',), 74.31, 'Sb6af59d649d24dffb26b97d25b3e97c4k'),
                      (('Laranja – 77 a 104 kg',), 114.32, 'S05d781e83a444f6cb74ac6225c33e768O'), (('Kit 4 faixas + bolsa',), 141.64, 'S1f3c79db1cae402193e3dd1d205e93eeK')],
    vid='u/ae_sg_item/3000922706017/p/1/e/6/t/10301/5000482830112.mp4', peso=0.5)
add('1005007495756493', 'Super Band Elástica de Látex 5 a 68 kg – Treino em Casa', [E, A, EL],
    'Faixa elástica longa de látex para treino de força, pull-up assistido e mobilidade. 5 intensidades. Mais de 5 mil vendidas.',
    ['S7b0ae73df62d4c2985f2c1291b3f3054A', 'S9b2e9abf77274ae3b204549ddc921bd2G', 'S7fea92f0da034b5bb7e844ee3e62ffb0u', 'S28b4210a22c04595b22cf3925f2764c33', 'S6f1f6adbeb1444e99dbab615b8602ea8B', 'Sb8c9e48bb9be40e78fbc1cb7e7a4ef74z'],
    ['Intensidade'], [(('Amarela – 2 a 7 kg',), 10.95, 'S072da3d5951e40b68b66e078db9f43c4C'), (('Vermelha – 9 a 16 kg',), 17.57, 'S082d4bf0086d4cba8452689bd6665479J'),
                      (('Preta – 14 a 23 kg',), 24.38, 'S32c4c6eac5e3493b84c1ddd41d00877fD'), (('Roxa – 18 a 36 kg',), 35.25, 'S1daf5ab09da14d6e83cdb9524dcaeb6f0'),
                      (('Verde – 23 a 68 kg',), 46.05, 'Sc474854fc43947a283eada01e418332bK')], peso=0.4)
add('1005006367527022', 'Mini Band Faixa Elástica de Látex – Avulsa ou Kit 5', [E, A, EL],
    'Mini band de látex para glúteos, pernas, braços e fisioterapia. Avulsa em várias cores ou kit com 5 intensidades. Mais de 10 mil vendidas.',
    ['Scf8e953e24744877ba27a84667e3eb9c4.png', 'Sfca8a022a2624334a8eb03ea03780649z.png', 'Sec5a7dad271d496f9655f46718effc5cb.png', 'Sbb70725aeb6b4199b16a389121e4b4a1l.png', 'S97819262498348259c50e2fa27a839e6h.png', 'S73933a3a526c4ad487b8c6d379658eadY.png'],
    ['Modelo'], [(('Verde – avulsa',), 6.44, 'Sfd6c99e5c2e44c8c979c257fda63248er'), (('Azul – avulsa',), 6.78, 'Sd99249c539a24b93bced6fb1bb8859fbj'), (('Amarela – avulsa',), 7.44, 'Sb7d510a5af3248daacb833a55bffb2ffT'),
                 (('Vermelha – avulsa',), 8.01, None), (('Preta – avulsa',), 8.33, 'S894409607a094221896ed6df916fc1f7s'), (('Kit 5 coloridas',), 17.79, 'Sba516a30f06e4e82a0f1a7d0155460ca1'),
                 (('Kit 5 tons pastel',), 17.12, None), (('Kit 5 rosa',), 18.35, 'S5340407e9ca242c896c5036c3c40a8b2Z'), (('Kit 5 azul',), 19.29, 'S4565647e7ecd4bc28ff5ab6bd61d7450J'), (('Kit 5 preto',), 19.6, 'Sdaa53b1c8b134a61ba9380321849d4c6c')],
    vid='u/ae_sg_item/2215147501528/p/1/e/6/t/10301/5000612212511.mp4', peso=0.2)
add('1005008948460989', 'Kit 5 Faixas Elásticas TPE de Resistência – com ou sem Bolsa', [E, A, EL],
    'Kit com 5 faixas elásticas em TPE (sem látex), 5 intensidades, para glúteos, pernas e alongamento. Opções com bolsa. Mais de 10 mil vendidos.',
    ['S25f46123795f4fbfb08f08f72f23ff830', 'Se3af1d7450d2442dbb59ed272edc49f5O', 'S3da656d1e7694861ae97a73b17fdff35C', 'Seff9c5a707524ef9b868183f959f77e1H', 'Sbc0cb5939f3246eaa9c2c1a4d411e874T', 'Scd122a0b63f14b00a7153b98840a9fb3i'],
    ['Modelo'], [(('Verde',), 18.41, 'S74c7e34e4e5d4e959243bdfe379dc344W'), (('Azul',), 23.44, 'S05c7b5ea04a94898be0b4d05065fe370A'), (('Coloridas',), 24.45, 'S263dd9c74cb54d39851809c88a1475d79'),
                 (('Azul com bolsa',), 26.11, 'S32b68074ac5f46aaba1ecdd849427ab87'), (('Coloridas com bolsa',), 26.19, 'Sf83b19a99fba4790805d405be8ee9b44s'), (('Amarela',), 27.02, 'Sc7ad58f97b7b4aef99eb072e3ff9eea1p'),
                 (('Vermelha',), 32.71, 'Seaedf50d2fff46e0b3dc074d744f63d1u'), (('Preta',), 34.03, 'S0b05147c2fc54dd2bfd56939205577455')],
    vid='u/ae_sg_item/3000919489071/p/1/e/6/t/10301/5000483452095.mp4', peso=0.3)
add('1005008169175994', 'Faixa de Tecido para Glúteos e Coxas (Hip Band) – Avulsa ou Kit 3', [E, A, EL],
    'Faixa de tecido antiderrapante para glúteos e coxas, não enrola nem belisca. Avulsa (P, M ou G de intensidade) ou kit com 3. Mais de mil vendidas.',
    ['S2cd94bd644a24cd0856052d7b8d21728M', 'Sb9164b35f41940ec8b894081ede3e93f7', 'S1e962764917746c38571e2b266ed66d7O', 'Sf7d7e9fd3dba48f2a469c330458840290', 'S7f4d697e9258439f8c85d7f9050b2fa3l', 'Sc704081a5e3d40768e91ac0c281def50u'],
    ['Modelo'], [(('Modelo A – leve',), 18.52, 'Se7040a00562e4a569b2f5217ed2ab644m'), (('Modelo A – média',), 20.99, 'Sce7027738ade49eabeda744931f64331v'), (('Modelo A – forte',), 23.45, 'Sc93ab1bfcf674e54809f269199ea0e63r'),
                 (('Modelo A – kit 3',), 60.69, 'S64391feca5e84c7e83caa2946eb7dddcs'), (('Modelo B – leve',), 17.41, 'S229ef66b397649ae856b4783493f1666D'), (('Modelo B – média',), 22.69, 'Scac80ada9be541958c1b6ebf80396a0an'),
                 (('Modelo B – forte',), 23.99, 'S34f864d2acb34fb79b5e9aa9998c750dy'), (('Modelo B – kit 3',), 63.89, 'S7e26ef0a7b044ee9b03110cef491048cg')],
    vid='u/ae_sg_item/2215097976963/p/1/e/6/t/10301/245731181922.mp4', peso=0.3)
add('1005006995813310', 'Tornozeleira para Polia e Kit de Elásticos para Glúteos', [E, A, EL],
    'Tornozeleira acolchoada para polia (cabo) e elásticos, para glúteos e pernas. Avulsa ou kits. Mais de 10 mil vendidas.',
    ['S1e18cdd8c0c34e64a764964d6a0004a18', 'S5d55f68f962441288939aa033202748aO', 'S270277808132441bbb040c074f041b26H', 'Sa6679f1bffb043039492da872a79fed2n', 'S5fd05cb2eac14b33bbbdc1076ba7c7a8Y', 'S5d116bd7c50448bc952e6eecfee4e703S'],
    ['Modelo'], [(('Preta – 1 tornozeleira',), 15.18, 'S6dfdbdffb31b4fad82b5143920952a5bm'), (('Rosa – 1 tornozeleira',), 15.36, 'S34d35454b7634473ad61d1797574a8701'), (('Kit 6 peças preto',), 27.48, 'S2eb4cae065884f148ce2d901cb61422ch'),
                 (('Kit 5 peças preto',), 49.67, 'S85d78187304a4855adddef5066bd0ec3x'), (('Kit 5 peças roxo',), 50.0, 'Sd717bb97410e42158b8d53797246526cV'), (('Kit 5 peças rosa',), 52.11, 'S8bfa1e074ab249e4a9bfef0804e720e9O'), (('Kit 6 peças rosa',), 53.13, 'Sfafa8e684ee3473e9b009412b9ce588fx')],
    vid='u/ae_sg_item/2215098398250/p/1/e/6/t/10301/5000232044345.mp4', peso=0.3)
add('1005007353398576', 'Hand Grip Ajustável 10 a 100 kg com Contador', [E, A, FM],
    'Hand grip ajustável de 10 a 100 kg com contador de repetições, para mãos, punho e antebraço. Mais de mil vendidos.',
    ['Scfc30d835e294f2096ba135e73e83361Y', 'S5f63d95178944c38a2a56ec0434f60339', 'S9f05b3ab45c14a2a847c2e232094e6d5a', 'Sb3ccb370d8444e388ec0589d0e8368f60', 'S74bb6a25c1c049a3bb88b3e2144bfa9as', 'S28a3842818134eaf82d5fdf2c0de8345B'],
    ['Cor'], [(('Azul',), 22.92, 'Sa435e0caf22b4775bef9d4ebb31925185'), (('Preto e cinza',), 22.98, 'Sc4c8cafb1a224013a29ddfbb52f6eacao'), (('Cinza',), 23.35, 'Se7205b97a6e74d7c9822fc73573fc672h'), (('Preto',), 23.46, 'Sf6f7e5ceec1744b2bee381e22f16c385U')],
    vid='u/ae_sg_item/2212162878147/p/1/e/6/t/10301/4000211434728.mp4', peso=0.3)
add('1005007790424449', 'Hand Grip Mecânico Ajustável 5 a 150 kg', [E, A, FM],
    'Hand grip mecânico ajustável de 5 a 150 kg, para força de pegada, antebraço e reabilitação. Mais de 4 mil vendidos.',
    ['S730dd62235cb4af5adf16d0a9ad76a43C.png', 'S2549fd0a3dcb454aa0efbd2483824e15P.jpeg', 'Sbc1da1e821544e8ea0dcbc501f71b9f0l.png', 'S51f1f6f43f2b45b3a96ea96f2ea1f407f.png', 'S468d0208cf0743b2ae12b71216e0d170r.png', 'S97b536da96984e87836b2117dea9a846m.png'],
    ['Cor'], [(('Azul',), 28.64, 'S0e9bc9415bf9404ea0d0e16aea5d0b2f9.png'), (('Verde',), 33.81, 'S18ffc733fb2c4915a32221f70d0388deA.png'), (('Rosa',), 34.15, 'Sb9a17676a2f24adbb9d503b6e2841c10e.png')],
    vid='u/ae_sg_item/2215147501528/p/1/e/6/t/10301/5000340722593.mp4', peso=0.3)
add('1005006421605455', 'Extensor de Dedos com Elásticos 9 a 34 kg – Força das Mãos', [E, A, FM],
    'Treinador de extensão e flexão dos dedos, com elásticos de 20, 40, 60 ou 75 lbs. Para escalada, música, fisioterapia e força das mãos. Mais de mil vendidos.',
    ['S313eb525ccbb4ff6a2bd8ae1be6a79f2D', 'S58f2fc70f616496184f164e0b60bcacad', 'Sc50b4aafac194d11afb528a73fc04a93c', 'S450a224a566f41c1877d91f734665c7da', 'S0cfe8dcee1454d3dac02874fc6e3e25ew', 'S46e3d87afe2f4593bdd2e2fb839a6998p'],
    ['Força'], [(('9 kg (20 lbs)',), 45.91, 'Sae44a6f098e3421aac186a0482e890d8n'), (('18 kg (40 lbs)',), 45.85, 'S542f68d2454b48dba9915721f2582a27a'), (('27 kg (60 lbs)',), 45.32, 'S16dff8054ec047848a465129bd8d9c9dO'), (('34 kg (75 lbs)',), 43.51, 'S9113fb95e26b44479300b30dfb97850c5')],
    vid='u/ae_sg_item/2210766937996/p/1/e/6/t/10301/1100206683284.mp4', peso=0.3)
add('1005006301818126', 'Luva de Hypalon para Crossfit e Levantamento de Peso', [E, A, LP],
    'Protetor de palma em hypalon (material de alta resistência), para crossfit, barra e levantamento de peso. Mais de mil vendidos.',
    ['S8322e5f015244a32b932e4b434e163c74', 'S999b13f119ed497aa7e66f954f887f47m', 'Sd85150655c2141e58b4a74c56800513dl', 'S858a62b207ed4f7b828ac6c6488622958', 'Sde1c5b5664a44c24a4a06631b5befa177', 'S4dd89dd5676f49059a61ad7fd17da431q'],
    ['Cor', 'Tamanho'], [(('Verde militar', 'P'), 44.24, 'S35d88a83da674724add39b154c0d5031t'), (('Verde militar', 'M'), 44.24, 'S35d88a83da674724add39b154c0d5031t'), (('Verde militar', 'XG'), 44.24, 'S35d88a83da674724add39b154c0d5031t')]
    + [(('Preto', t), 45.19, 'Sb5804538c2394b46973a392512688419v') for t in ['P', 'M', 'G', 'GG', 'XG']], peso=0.2)
add('1005013175469068', 'Strap para Levantamento de Peso (Par) – Alta Resistência', [E, A, LP],
    'Par de straps (fitas) para levantamento terra, remada e barra: segura a pegada quando a mão cansa. Mais de 100 vendidos.',
    ['S3043b9a3017d4b989275e406786565a41', 'S7afa09ffc10f47bdad5623d6ba8feadaB', 'S55e543d0c02143e4b2a7158d7829ea46R', 'S0922c1ea855347f2b29a341c453ba3771', 'S071afe8903134252ab8b99e9c8221462I', 'S3a480b4168574fa3b38f92c8ca9c4fbfI'],
    ['Cor'], [(('Verde',), 38.98, 'S1fda9328af8c4af0bd46e314209a4e7d7'), (('Preto',), 39.08, 'S55457f1dd00447aab03976ee06c23a74C'), (('Amarelo',), 39.08, 'Sb5fbe28726cb4db688bc3ad54e88d0735'), (('Rosa',), 39.33, 'S1dca35b9732c41c98283f2bb1ca70e86I')],
    vid='u/ae_sg_item/3000903483020/p/1/e/6/t/10301/5000620448578.mp4', peso=0.2)
add('1005007573382887', 'Cinto de Musculação EVA para Levantamento de Peso', [E, A, CM],
    'Cinto de musculação em EVA com fecho firme, protege a lombar no agachamento e levantamento terra. Mais de 800 vendidos.',
    ['S7c7b5d5973354391991ff88f1fdfdb0aL', 'S54473a60ea544f7889df741438650e8es', 'S3b485c3a531642f2a5f4fe357bc961aec', 'S430d41d73f7349b6947b65b89d3d37b1H', 'S6f23c8c9fdf1491591d83c2df697b76cN', 'S04989f3e060f43b4b59af7af7bf985baa'],
    ['Cor', 'Tamanho'], [(('Branco', t), 83.81, 'S67a4c0651d314101baf87f34314613adC') for t in ['P', 'M', 'G', 'GG']] + [(('Cinza', t), 86.71, 'Sb90253bee6b443ada705de4ee8cc8c2fa') for t in ['P', 'M', 'G', 'GG']],
    vid='u/ae_sg_item/3000905762054/p/1/e/6/t/10301/5000135522692.mp4', peso=0.6)
add('1005007713429241', 'Presilha Trava de Anilha para Barra 50 mm (Par)', [E, A, BP],
    'Par de presilhas (colares) de trava rápida para barra olímpica de 50 mm. Seguram as anilhas firmes. Mais de 300 vendidos.',
    ['S1d830fc6744f415c970dc7f951f39dc26', 'Sc61ee5ada3c2445ea449b52b95061ce1O', 'S9604b669bb2b4674ac5b2f5b4fa94293C', 'S5f834d6834824c47b367a623d8ad1ef4U', 'S26df455c22994bccaf6bfb812a15f75dQ', 'S2b86f5a85430492a982d48779c58930a0'],
    ['Cor'], [(('Cinza',), 45.1, 'S584ac7a13eaf445398f725cbd7e1353bu'), (('Preto',), 45.2, 'Sa979fa74a06d4e358eeea5f95fefc4b80'), (('Vermelho',), 45.29, 'S22d4ec6c0ecf472c8edb9761042217acT'),
              (('Laranja',), 45.49, 'S78eda0cb786a4ade994df9517eac73dfM'), (('Azul',), 45.59, 'S22d78ea92b294468bb709a91123d9ee94'), (('Amarelo',), 45.69, 'Sa1ee943591194e7b94edc7ceb4f8cd4fS'), (('Verde',), 45.79, 'S86ca41d2daea41c58bb95e2488f6b26eR')],
    vid='u/ae_sg_item/3000908043103/p/1/e/6/t/10301/5000141402823.mp4', peso=0.4)
add('1005005861598764', 'Almofada de Ombro para Barra (Agachamento e Hip Thrust)', [E, A, BP],
    'Almofada protetora para barra, dá conforto no agachamento, hip thrust e afundo. Modelo simples ou reforçado. Mais de mil vendidas, nota 4,9.',
    ['S39542d630c9d49b396f0b941aaa1d13cx.png', 'Sdbd0fd27c6fb48c6b33af9fe14d85d30y.png', 'Sebb1947cdfaa4f86b32926ac394aa2280.png', 'S9d1cd7de64b2496098a0bc0365d6fc46x.png', 'Sa2976df82d5f45ecaed236708b59d8d8A.png', 'Sfff8412276d9476b9f50de9a5633f33cP.png'],
    ['Modelo'], [(('Simples – cinza',), 42.09, 'Sf8f6853fd1f94a21b1e551b3636dfb35w'), (('Simples – vermelha',), 42.3, 'S7f5a9a741a1441ed90880b0e381851deN'), (('Simples – preta',), 44.69, 'Se53543cf9fd544d99f042433ef2ee2fea'),
                 (('Reforçada – estampa B',), 63.69, 'Sbb1212ba0fd04295b2c792cd0364ac58R'), (('Reforçada – rosa colorida',), 63.89, 'S6cb1aef1ad2344bf81101941a310b6bfq'), (('Reforçada – estampa A',), 64.59, 'Se010610292b7477bb15ecbf950d4e86eA'),
                 (('Reforçada – rosa',), 64.99, 'S0536d1f1f6d44355885b8e7bce5a5de5m'), (('Reforçada – preta',), 66.39, 'Sb8a744d0d3b54b29b822cc337425949f0')],
    vid='u/ae_sg_item/2200704963053/p/1/e/6/t/10301/5000503188354.mp4', peso=0.4)
add('1005010491235377', 'Tatame EVA 30×30 cm de Encaixe – Kit 16 Placas', [E, A, BT],
    'Tatame de EVA 30×30 cm com encaixe, 16 placas, antiderrapante. Para academia em casa, yoga e alongamento. Mais de 3 mil vendidos.',
    ['S17bc2aa6974d4316ae1ce67ccefac5bb5', 'S54d4690a811048489f136327e3994ebdK', 'S79b2fbdccbba4b8a99b9a8a0248ea086y', 'S9705bf25e6f24612baf25998eaac4f62z', 'Sec79039ac1b448a792f173d7d59c3691D', 'Sef7fca49e6894d358d7cc5fa5a0b88c23'],
    ['Cor'], [(('Preto',), 121.99, 'S383c6617df7a470597fb0573a042b1eaL'), (('Preto e cinza',), 128.59, 'S1372ff74d64f44e58ab1f6505c5048dcC')], peso=3.0)
add('1005008906164313', 'Corda de Pular com Cabo de Aço e Rolamento – Ajustável', [E, A, AB],
    'Corda de pular com cabo de aço e rolamento, gira rápido e não embola. Ajustável. Para cardio, crossfit e boxe. Mais de 2 mil vendidas.',
    ['S8654e755bece4d2abce9387c9158f4fcJ.png', 'Sdc080741db45474dacc5ea68a1a56186k.png', 'S0c17e97af114451ba45540f572471e23D', 'S7dee31c7a01a48169773c9bd241b6a54X', 'S56faa2c4815642c28ce87c9749f7418dg', 'S66a7bcf3d412474db70b53c94d27c2d7d'],
    ['Cor'], [(('Azul',), 18.76, 'S774371bd2f47456dabd91d1c2989db71L'), (('Preta',), 19.55, 'S683d84eecb874bd58624ea8c08fe78ed8'), (('Vermelha',), 19.63, 'Sa25bcec9c20f48da9e07a04f2e91e020B'), (('Verde',), 20.09, 'S0a6a16663c4f4f4ba159a2f614ef2ddaW')],
    vid='u/ae_sg_item/3000912026106/p/1/e/6/t/10301/5000240728509.mp4', peso=0.3)
add('1005006924432583', 'Luva de Boxe e Muay Thai – Adulto e Infantil', [E, L, 'Luvas de Boxe'],
    'Luva de boxe em couro sintético, respirável, para boxe, muay thai, kickboxing e saco de pancada. Tamanhos adulto e infantil. Mais de 3 mil vendidas.',
    ['S44d352a402da4cc3bb2b3dc86b5a4c34w', 'Sdf6ab252da564be4abd22ea8a217cf7aQ', 'Sff72cf02547b48b18c4b1838370b1a06V', 'Sb69335a5be96418aa9811327fad077ddC', 'Scc9ed30b2869434ea9523d86d8264450j', 'S10368114786d46c8b129581fce3133ddI'],
    ['Modelo'], [(('Preta lisa – adulto',), 23.45, 'Sc969ee16e6974716b22a66218e66751bq'), (('Tigre preto e azul – adulto',), 31.95, 'Sfd1e9e7a9b114608b71f008bd6db10eeN'), (('Tigre preto – adulto',), 32.13, 'Sc127324bed7542909c1efd0393b965ffW'),
                 (('Tigre vermelho – adulto',), 33.77, 'Sc599ba6d63124d3baa5e4281aa690bf2Q'), (('Tigre preto e azul – infantil',), 26.57, 'Sfd1e9e7a9b114608b71f008bd6db10eeN'), (('Tigre preto – infantil',), 26.01, 'Sc127324bed7542909c1efd0393b965ffW'),
                 (('Tigre vermelho – infantil',), 26.94, 'Sc599ba6d63124d3baa5e4281aa690bf2Q')], peso=0.6)
add('1005007535565843', 'Aparador de Chute e Soco (Pao) – Muay Thai e Kickboxing', [E, L, 'Manoplas e Aparadores'],
    'Aparador curvo (pao) em couro sintético para treino de chutes, joelhadas e socos no muay thai, kickboxing e MMA. Vendido por unidade. Mais de mil vendidos.',
    ['S06ef346e783c4382b939deec3defb885X', 'S02799a9b797f4916b1731b557eecf7c6k', 'S75e8fdcebd8144018c1f40365f0b7fd8k', 'S06c441adf0db48949ddead1b2ea8f102w', 'Sc80f6a52ab8647f5a81729541f6616beS', 'S18bdd6765c3f4da7a7636aeeecb00f92t'],
    ['Cor'], [(('Vermelho e preto',), 83.64, 'Sf424a97a08634811b4757b214176527eL'), (('Azul e preto',), 86.09, 'Sd4937617bd0b4af88da060aeea0d13f3V'), (('Branco e preto',), 86.24, 'S6dc62187240a40829e4d3381daec850bW'), (('Preto e roxo',), 86.8, 'Sf3d1f099d24046e78507bf0972f86f97z')],
    vid='u/ae_sg_item/3000905619041/p/1/e/6/t/10301/5000133692396.mp4', peso=0.8)

def pv(c):
    p = c * (2 if c <= 50 else 1.6 if c <= 100 else 1.5) / 0.94
    q = int(p) + 0.9
    return q if q >= p - 1e-4 else q + 1
json.dump(S, open('lote.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for k, s in S.items():
    cs = [v['cost'] for v in s['vars']] or [s['cost']]
    semimg = sum(1 for v in s['vars'] if not v['img'])
    print(f"{s['nome'][:52]:52} | {len(s['vars']):2} var | fotos {len(s['gallery'])} | s/img {semimg} | custo até {max(cs):7.2f} | R$ {pv(min(cs)):.2f}–{pv(max(cs)):.2f} | {'vídeo' if s['video'] else ''}")
