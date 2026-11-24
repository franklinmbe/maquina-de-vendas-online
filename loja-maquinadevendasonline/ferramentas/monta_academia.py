"""24/11/2026 — Academia (Esportes e Lazer > Academia): 1ª página da busca "acessorios academia" filtro Do Brasil,
no máximo 2 fornecedores por item. Produtos do Brasil: preço do AliExpress já é final (sem imposto de importação).
Gera lote.json para cadastrar-lote.php."""
import json
K = 'https://ae-pic-a1.aliexpress-media.com/kf/'
AV = 'Enviado do Brasil: entrega rápida.'
E, A = 'Esportes e Lazer', 'Academia'
S = {}

def simples(ali, nome, sub, desc, gal, custo, peso=0.3):
    S[ali] = {'nome': nome, 'cats': [E, A, sub], 'desc': desc, 'aviso': AV, 'peso': peso, 'origem': 'BR',
              'gallery': [K + g for g in gal], 'attrs': [], 'vars': [], 'cost': custo}

def variavel(ali, nome, sub, desc, gal, attrs, linhas, peso=0.3):
    S[ali] = {'nome': nome, 'cats': [E, A, sub], 'desc': desc, 'aviso': AV, 'peso': peso, 'origem': 'BR',
              'gallery': [K + g for g in gal], 'attrs': attrs,
              'vars': [{'attrs': dict(zip(attrs, v)), 'cost': c, 'img': (K + i) if i else None} for v, c, i in linhas]}

J, F, EL, M = 'Joelheiras e Suportes', 'Fortalecedores de Mão', 'Elásticos e Acessórios', 'Meias e Compressão'

simples('1005005881690727', 'Joelheira de Compressão Articulada com Cintas Cruzadas', J,
        'Joelheira de compressão com cintas cruzadas ajustáveis que dão firmeza à articulação. Para musculação, corrida, futebol e caminhada. Mais de 5 mil vendidas.',
        ['Ab2431ff907e04ab4939f8918ae97d5a9r.png', 'Aacbf0a243ff740fda89a2a91e3f07199o.png', 'Aa4206c78e5034801835cf4527d553d0eO.png', 'A1fd0dcac12b643839f221b032926b5d84.png', 'A8dc44a7a66c14e8db08535db672970e4v.png', 'Abaee3b0337fb47769ce85a9fd530518f3.png'], 26.5, 0.2)
variavel('1005011690194045', 'Joelheira Esportiva de Compressão 3D com Silicone e Hastes', J,
         'Joelheira de compressão 3D com anel de silicone na patela e hastes laterais para mais estabilidade. Para treino, corrida e esportes.',
         ['S1821e1b48dbb496ab318453f1442c092Y.png', 'Sad5fac929e9c49af822c1285d1fadd647.jpg', 'Se221f78ad6f84c7c984c69faf7f2f54c8.jpg', 'Sfa889e0bb57a40bc9295e8504710be1d8.png', 'Sc3f9ff26f8724fb0beb52088aa1c5567H.jpg', 'S2288b5dedb5f4ffebf094346b4e8fdccw.jpg'],
         ['Tamanho'], [(('G',), 32.98, 'Sffc4cd5ee6174e119654aa63ac6b64a2Z.jpg'), (('GG',), 32.98, 'Sffc4cd5ee6174e119654aa63ac6b64a2Z.jpg')], 0.2)
simples('1005011662328840', 'Hand Grip com Mola Ajustável de 5 a 60 kg', F,
        'Hand grip para fortalecer mãos, dedos e antebraço, com ajuste de 5 a 60 kg. Bom para academia, escalada e fisioterapia. Mais de 600 vendidos.',
        ['A2c19e264297b45a18f2f7281f80c9a8eK.png', 'A4a1ff245d45b40ff863bd7b59b788ed7G.jpeg', 'A72ed0ebf11a44c15811593147de7119ea.jpeg', 'A38e7e515eedc4bcdaf87627a805af57er.jpeg', 'A73cc513e573b447c9e9a877995edac776.jpeg', 'A6063eaad84e341b196f46c63bcbc9d13L.jpeg'], 26.0, 0.25)
variavel('1005011755387471', 'Hand Grip Ajustável de 5 a 60 kg – com ou sem Contador', F,
         'Hand grip ajustável de 5 a 60 kg para fortalecer mãos e antebraço. Opção com contador digital de repetições.',
         ['S8b49777c95b94b4184028294333503a1E.jpg', 'S1b42b9305dbb4373a256877b83202383d.png', 'S370c068bd8ff48b199349794edac2b6eV.png', 'S89cbb8b241d14476a9c49a80ddf34f33w.jpg', 'S473267aff054459985767b45501137daQ.jpg', 'Sda8c58a4eee142e194cb23c4b05b8705T.jpg'],
         ['Modelo'], [(('Sem contador',), 30.92, 'Sacd02493d91242b5a2a7a0b5a67cbb70V.jpg'), (('Com contador',), 34.02, 'S852021f3dbac4dbab8af6f3e1bbdd71bB.jpg')], 0.25)
simples('1005004494194588', 'Elástico de Tensão em 8 para Treino em Casa – Ombro, Braço e Glúteos', EL,
        'Elástico extensor em formato de 8 para exercícios de ombros, braços, costas e glúteos. Leve, cabe na bolsa. Mais de 5 mil vendidos.',
        ['A6b00ec7b52e543dd892757c916c34387Q.png', 'A944eb89b1ee3487ba01d511593eade97j.png', 'A9cbaf02f1c734638b649474c476e8d4en.png', 'A61c655b2fd904983a7895aa5e7b5b053C.png'], 23.03, 0.2)
simples('1005003602908896', 'Kit Elásticos Extensores 11 Peças – Musculação, Yoga e Pilates', EL,
        'Kit com 5 tubos elásticos de resistências diferentes, 2 alças, 2 tornozeleiras, âncora de porta e bolsa. Treino completo em casa. Mais de mil vendidos.',
        ['A56b51b2ddfe64e21b8ae0058b2e58ab4v.png', 'U5ac44e0be3b94d2ab2c101c16649c25f7.png', 'U32680f5b431b4959961c90583c826000U.png', 'U3792c874acf044afa9e205c89bbd95b7l.png', 'U97cb36edfb37407889ae3878ee22c6b1K.png', 'U10baf2dcd8ce41caafc862dcffe55befj.png'], 44.4, 0.6)
simples('1005006650021783', 'Kit 5 Faixas Elásticas de Resistência – Yoga, Pilates e Treino', EL,
        'Kit com 5 mini faixas elásticas de intensidades diferentes para pernas, glúteos e braços. Para academia, pilates e fisioterapia.',
        ['A3c0319a97ccf4ab3bc119d02323f97c8P.png', 'A6ba067c2f4664a1682e7a53ad47e56d4d.jpeg', 'A4727faea19314099af73f41aedaa17d3L.jpeg', 'A8e639f9de1a74e4b981472ff4e852355T.jpeg', 'A3a592698235a456982184bb6a866cfe0k.jpeg', 'Af435a8611cac467488ff6d484015265b1.png'], 21.14, 0.2)
simples('1005005836519421', 'Kit 5 Mini Bands Thera – Fisioterapia e Treino Funcional', EL,
        'Kit com 5 mini bands de resistências diferentes, para fisioterapia, crossfit e treino funcional. Mais de 800 vendidos.',
        ['A5786bedd8cf54bcb9dbac75b270f1e8dF.jpg', 'A399ee21b79b74a78b3123c35a982b331N.jpg', 'A6ab0cb04db944528a8f37907e8ba82c0U.jpg', 'A9b77df303f5e494a858121a7bcf76201q.jpg', 'A6f3dea812bc843b6bef7548fbd23c694N.jpg', 'A42ef441fbfd54e44a79e84e9b734b5afZ.jpg'], 29.19, 0.2)
simples('1005007792841713', 'Kit 3 Faixas de Tecido Hip Band – Glúteos e Pernas', EL,
        'Kit com 3 faixas de tecido (leve, média e forte) antiderrapantes, para treino de glúteos e pernas em casa ou na academia.',
        ['Ad589970dc003418d988b669c282ca372I.jpeg', 'A4e758dc288724ae4ad9ab22f3dba07e1o.jpeg', 'A90fb5ca8744947df83050fa97ea8e097C.jpeg', 'A09d84997cfa545368218817f0b126ab1G.jpeg', 'Ad50c1d40414e4d1c8574ea80f1d11bddz.jpeg', 'A5d1d8bd739254f228a7a85f836a24df7m.jpeg'], 31.49, 0.3)
simples('1005010777878006', 'Kit 3 Faixas de Resistência para Glúteos e Pernas', EL,
        'Kit 3 em 1 com faixas de resistência para glúteos e pernas, três intensidades. Treino em casa ou na academia.',
        ['S16814cf3ba5d476da1708a82af1adac8t.jpg', 'S3533ad24f992466f9475f25d70788f6cL.jpg', 'S041cc351db5443fe9a44950d6b7f3238L.jpg', 'S169526b43f774233adc1e0b359a4ad48K.jpg', 'S6ebc0a3dc1bf4242be611101f7974e6f2.jpg', 'Sd3188f3b092a4220b2dd358574b8bf18L.jpg'], 27.99, 0.3)
mc = [('Amarelo Limão', 'S7ac9c41f353045c5a2a83902affb7eacK.png'), ('Preta', 'Sc58ba0809b1a461682042e0be97450eeB.png'), ('Branca', 'Sd534ddac7c304346acad59fcf152d3a3w.png'),
      ('Cinza Escuro', 'Se7e5a6b5f85245d18fc58e7fc0d5f0d3e.png'), ('Rosa', 'S8b8cad443a794635859f8266e3daa689J.png'), ('Azul Claro', 'S0a72bb1be71e45fca34cebd6c669e93eu.png')]
variavel('1005013420932521', 'Meia Esportiva Curta Masculina – Respirável e Antiderrapante (42 a 46)', M,
         'Meia esportiva curta, respirável e com sola antiderrapante. Para academia, corrida e dia a dia. Tamanho 42 a 46.',
         ['Se620e0528ed44252a3e540fc5b727d96N.png', 'Se7e5a6b5f85245d18fc58e7fc0d5f0d3e.png', 'Sa290f6f59aef476c9796d5a760840b84k.png', 'S3c118b1644a343b780c61225484067d2y.png', 'S821c5e91a68645d3a7d0c26badf51d93l.png', 'Sd8dfbc97ce3b4d648d4a2bf6adca8624d.png'],
         ['Cor'], [((c,), 5.13, i) for c, i in mc], 0.1)
mf = ['S104a63494c394fb5b869f8f8014e4587q.jpg', 'Sc1d31efce82d4c13a80fb2bf2fdefe0en.jpg', 'Sd47914b06c01438f82569928713e5e96D.jpg', 'Sda8b233beb4b43fdbc475229b7a0fa19x.jpg', 'Sd8186a101405487da9ee3685fea6133f2.jpg', 'S2df9fd7995c445fa93229c9e16c17998x.jpg']
variavel('1005011565270418', 'Meia Esportiva Feminina de Algodão – Yoga, Pilates e Academia (35 a 38)', M,
         'Meia esportiva feminina com 76% algodão, macia e respirável. Para yoga, pilates, academia e dia a dia. Tamanho 35 a 38. Mais de mil vendidas.',
         ['Sf51889c452e04ff8a13912a0ec2345b9Y.jpg', 'S8ba0df5197aa462db0d3fedf546defd2h.jpg', 'Sed327b159c6a490cb40173b00732ea78p.jpg', 'S9619563a8b7c4d06ac7d2180ad5d0228L.jpg', 'Se9985df8221b4fa1afd6563ebf8ce0e07.jpg', 'S59c936c6c0644fb7a2ca255c3c0b767bd.jpg'],
         ['Modelo'], [(('Modelo 1 – 1 par',), 24.86, mf[0]), (('Modelo 2 – 1 par',), 24.86, mf[1]), (('Modelo 3 – 3 pares',), 38.24, mf[2]),
                      (('Modelo 4 – 3 pares',), 38.24, mf[3]), (('Modelo 5 – 3 pares',), 38.24, mf[4]), (('Modelo 6 – 3 pares',), 38.24, mf[5])], 0.15)
mm = [('1 par', 'Sd62036b04a09475e94ae15a44e0e05c4n.jpg'), ('3 pares', 'Sbf426f581cdf441bb491773ae6b8bdf2R.jpg'), ('1 par', 'S19f91d77efe6470da97583a174d24c3cZ.jpg'),
      ('1 par', 'Sc28ce74d7abe4d5b9cf6f67465c92762A.jpg'), ('1 par', 'S47fef642974b491b884e3c84768b7e14m.jpg'), ('1 par', 'S0cecc53c475a4f37b0db6ec257eac2029.jpg'),
      ('3 pares', 'Sc3f1998cf9df4619a8819baf44607c98e.jpg'), ('3 pares', 'S5c05f45103b74ffb925d18f0c7340d5fX.jpg'), ('1 par', 'S7f1a94ec8a6042c2bdaa7285936e0729s.jpg'),
      ('1 par', 'S032d2d75121b4311a7e6428017ccac67B.jpg'), ('3 pares', 'S32231ddbd0014c68a7a29ccd03ae36694.jpg')]
variavel('1005012695764183', 'Meião de Compressão – Corrida, Ciclismo e Recuperação Muscular', M,
         'Meião de compressão de alta elasticidade que melhora a circulação e ajuda na recuperação muscular. Para corrida, ciclismo, academia e viagens. Mais de 700 vendidos.',
         ['S823d93a742084bf882af2fdc39cef434X.jpg', 'S9122dcf7212640ef8c3ea5a870ff8610n.jpg', 'Sd3524533cbff4b34a3393919ce064cefl.jpg', 'S727f4dee5b7c4baa8c15dd374c3a24e7C.jpg', 'S36fd3949311e48d6964e8165498a499dF.jpg', 'S23ddd4efb3334f28865caa86b70b4982w.jpg'],
         ['Modelo', 'Tamanho'], [((f'Modelo {n} – {q}', t), 29.71 if q == '1 par' else 52.78, i) for n, (q, i) in enumerate(mm, 1) for t in ['M', 'G', 'GG']], 0.15)
mk = ['S93d280b9d8be498093f9c56e46e29a6dD.jpg', 'Sff0e89e421a24d289891b4c4392dc923U.jpg', 'S45f3a9b5d8ba4fa186475d82910b7b83t.jpg', 'S149e51a3fc894e698e1d8e9ba12a015ey.jpg', 'S132f11fcb3334f7b9e897af9c6e6f08bl.jpg',
      'S1075b24a74c54f7584c145887de99dffi.jpg', 'Sd86b08b99e9c4da5bfb4c3f9bd2e612cq.png', 'Sf8c27c627ae94e3bbcb7c4b3241006d73.png', 'S36ebc9be8b74444a9c41ebe2a36fd4e2W.jpg', 'Sf4edb8eb9a5b43f9bea7f4b3b2d71362z.png',
      'S7ca28f0879984e1fa41694e4f02cb0f9Z.png', 'S2b766fa9e6994144ba3adb5d9128d223B.png', 'S6c2ceb35c828405293711c31228dd6cbB.png', 'Sec9ec1662d8c4c8a875621dee3673cdef.png', 'S14f824eebdba49e8bb8739ae74ac8256G.png']
variavel('1005013223452989', 'Kit 10 Pares de Manga de Compressão para Perna e Joelho', M,
         'Kit com 10 pares de mangas de compressão longas (perna e joelho), respiráveis. Para futebol, ginástica, corrida e academia. Tamanho único.',
         ['S00ec6f3edcbb47c7a34d50f8c22cc017a.png', 'S5639dfbd063949d281965bd313d90ce2T.jpg', 'Sfcf4694155c14f40849093fbf263435ci.jpg', 'Sac0b5e6718054ff49d0786b6d301a7840.jpg', 'S0c6e41431e894758a1648112716d8dd5p.jpg', 'S9c3c48fa3eda41adbec1e54b0c5bc63fM.jpg'],
         ['Cor'], [((f'Opção {n}',), 82.55, i) for n, i in enumerate(mk, 1)], 0.5)

def pv(c):
    p = c * (2 if c <= 50 else 1.6 if c <= 100 else 1.5) / 0.94
    q = int(p) + 0.9
    return q if q >= p - 1e-4 else q + 1
json.dump(S, open('lote.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for k, s in S.items():
    cs = [v['cost'] for v in s['vars']] or [s['cost']]
    print(f"{s['nome'][:58]:58} | {len(s['vars']):2} var | R$ {pv(min(cs)):.2f}–{pv(max(cs)):.2f}")
