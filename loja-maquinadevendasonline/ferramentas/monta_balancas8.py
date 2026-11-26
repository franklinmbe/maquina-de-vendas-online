"""26/11/2026 — 5 balanças de 8 eletrodos (Franklin: "mais barato que tiver", 5 modelos; MeeGoo do print + 2º fornecedor).
Nenhuma no Brasil. Custo = preço + imposto da página (todas frete grátis, Do China). Acima de US$100 (R$540) = ×1,3.
Fotos retiradas: selo 'Choice/24 hours fast shipping' (LIFE CHOICE) e 'custom logo service' (Fitdays)."""
import json
K = 'https://ae-pic-a1.aliexpress-media.com/kf/'
S = {}
def add(ali, nome, desc, gal, cost):
    S[ali] = {'nome': nome, 'cats': ['Balanças Digitais', 'Balanças de Bioimpedância'], 'desc': desc, 'aviso': '', 'peso': 3.0, 'origem': 'CN',
              'gallery': [K + g for g in gal], 'attrs': [], 'vars': [], 'cost': cost, 'video': None}
add('1005011845073420', 'Balança MeeGoo 8 Eletrodos com Alça – Bluetooth e App Fitdays',
    'Balança de bioimpedância MeeGoo com 8 eletrodos (pés e mãos, pela alça) para análise do corpo inteiro: peso, gordura corporal, água, massa muscular e mais. Bluetooth, acompanhamento pelo aplicativo no celular e relatório para imprimir. Nota 5,0.',
    ['S802259e93ae2488db545a95959ad417bd.jpg', 'S0571a8361a29426ab74194ae2dd73645h.jpg', 'Se5617f00b6334d289b97f9b630d35e49J.jpg', 'S8128f32193da43df964534304dbb7035i.jpg', 'S53c75584946d47b59fe1af55742f69f8s.jpg', 'S3c2ed68f67834208b107272ce9573771W.jpg', 'S055efd72d2b24fb4821221eef3a45e67H.jpg'], 622.38)
add('1005008291232913', 'Balança Fitdays 8 Eletrodos – Composição Corporal das Mãos aos Pés (Branca)',
    'Balança Fitdays de 8 eletrodos com alça: mede peso, gordura, músculo, água, ossos e mais, do braço à perna. Aplicativo Fitdays grátis no celular, até 24 usuários. Loja oficial Fitdays, nota 4,5.',
    ['Sc97607b5cbbf409f99072cfb6d6c5903q.jpg', 'S5049d1806b0f48e0aeca04b4ce609747y.png', 'S91ff9374688d4efab1a2e9a5d69bf27cI.png', 'S0a29dabf937d4fe2a481643d0c95efe2P.png', 'S18ee54cb50774760a25786a2d6847c55y.jpg', 'Se418d9b91e2c4fb1aef2851373831498S.png'], 689.80)
add('1005005069984287', 'Balança 8 Eletrodos com Tela Colorida – 20 Indicadores e Relatório no App',
    'Balança de bioimpedância segmentada com 8 eletrodos e dupla frequência: 20 indicadores do corpo (gordura, músculo, água, gordura visceral, IMC) por braço, perna e tronco. Tela colorida e acompanhamento pelo aplicativo. Nota 5,0.',
    ['S4630fde9d3884eb9a9c9dcb3c5ba89899.jpg', 'S2d20a4b1aff04fba86096faa7bd60fb8i.jpg', 'S2c29974ab5e44087a0decb7f80072b8fu.jpg', 'S2ebb4ab0c4b3426ebdde6d4b3380dd8bO.jpg', 'S91ee8dea041f418eb372e92be74b4eeeN.jpg', 'S26f365c567a342d6b1c2059145294061q.jpg'], 758.21)
add('1005012472765457', 'Balança de Bioimpedância 8 Eletrodos com Alça Magnética – 57 Medições no App',
    'Balança de 8 eletrodos com alça magnética para medição segmentada do corpo inteiro: 57 itens (gordura, músculo e água por braço, perna e tronco). Aplicativo no celular, vários usuários, relatório para imprimir. Nota 5,0.',
    ['S3cfd458a24144b29b6a91ac057f4b61fk.jpg', 'S77650a1bcccc4bf7ae2e50c6bf86cfd0F.jpg', 'S653c3d33f6564975b5e4e0eb17be140bn.jpg', 'Sf71b18380ed048468c1d58b9bce0a305X.jpg', 'S80f65a6840c9426d9a4c24fbae03875eW.jpg', 'Se6577291241c46b0831c042274a94ca0I.jpg', 'S13461ad626a6478ebc2885c1d7c5a75cr.jpg'], 763.76)
add('1005010356661457', 'Balança Profissional 8 Eletrodos com Voz – 28 Medições e App',
    'Balança de composição corporal profissional com 8 eletrodos (pés e mãos) e aviso por voz: 28 medições do corpo, display LED, vidro ITO e aplicativo em português no celular. Mais de 140 vendidas, nota 4,7.',
    ['S2e4ce6caab53423e898f4df5af35786ef.jpg', 'S7a80ac629694477c9f19770479cab0c1b.jpg', 'S7fb6b0543e2b452eb59b96cf8b81d7d6d.jpg', 'S91fad3d741024992bb6d6b7b1a2f8249p.png', 'S973198f7a06c4ea1a5a1c55c9c886ecbJ.jpg', 'S02684c0450bc49ecb594e14c2e0d109ac.jpg'], 891.20)
json.dump(S, open('balancas8.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
