<?php
/**
 * 25/11/2026 — Linha de relógios (pedido do Franklin): 9 abaixo de US$ 50 + 6 acima (até ~US$ 100), com chip M99.
 * Custo = produto + imposto estimado do AliExpress (lido no Chrome logado do Franklin). Brasil = sem imposto.
 * Regra de preço por faixa em DÓLAR do custo (Franklin, 25/11): até US$ 50 (R$ 270) = regra antiga da loja
 * (até R$50 ×2, até R$100 ×1,6, acima ×1,5); de US$ 50 a US$ 100 (R$ 540) = +50%; acima de US$ 100 = +30%.
 * Sempre com 6% de imposto embutido e final ,90. Câmbio de referência: R$ 5,40.
 * Rodar: wploja eval-file /var/www/html/import/cadastrar-relogios-20261125.php (atualiza pelo SKU, não duplica).
 */
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

const MVO_IMP = 0.06;
const K = 'https://ae-pic-a1.aliexpress-media.com/kf/';
function mvo_p($c) {
  $m = $c <= 50 ? 2 : ($c <= 100 ? 1.6 : ($c <= 540 ? 1.5 : 1.3));
  $p = $c * $m / (1 - MVO_IMP); $q = floor($p) + 0.90; if ($q < $p - 0.0001) $q += 1;
  return number_format($q, 2, '.', '');
}
function mvo_img($url, $pid) {
  if (!$url) return 0;
  $f = get_posts(['post_type' => 'attachment', 'meta_key' => '_mvo_src', 'meta_value' => $url, 'fields' => 'ids', 'numberposts' => 1]);
  if ($f) return (int) $f[0];
  $a = media_sideload_image($url, $pid, null, 'id');
  if (is_wp_error($a)) { WP_CLI::warning('foto: ' . $a->get_error_message()); return 0; }
  update_post_meta($a, '_mvo_src', $url); return (int) $a;
}

$CHAM = 'Faz e atende ligações pelo relógio (Bluetooth), mostra as notificações do celular (WhatsApp, Instagram, mensagens), mede frequência cardíaca, sono e passos, e tem vários modos esportivos.';
$P = [
  ['ali' => '1005006593951067', 'origem' => 'CN', 'loja' => 'ColMi official store', 'aval' => '4,8★ · 10.000+ vendidos',
   'nome' => 'Relógio Inteligente COLMI P91 – Tela 1,9" com Chamadas por Voz',
   'desc' => "Smartwatch COLMI P91 com tela grande de 1,9 polegada. $CHAM Marca COLMI, uma das mais vendidas do AliExpress.",
   'fotos' => ['Sc34809383768432aabed82ae597ee86b0.jpg','S4fb506882c40410c993d06cc515965c3I.jpg','S7b1de83e387146ebbcdc5ebce80b2fd5k.jpg','S91a120479ea041b0a34ed37df095976eK.jpg','S14d782d6facd4322917fbb34ca5d4989z.jpg','S9ec431a3287b45f2bfd89d49dcefd946I.jpg'],
   'attr' => 'Cor', 'vars' => [['Prata', 79.73]]],
  ['ali' => '1005006997324750', 'origem' => 'CN', 'loja' => 'LAXASFIT Smart Store', 'aval' => '4,9★ · 5.000+ vendidos',
   'nome' => 'Relógio Inteligente Laxasfit 2,01" com Lanterna e Chamadas',
   'desc' => "Smartwatch masculino com tela HD de 2,01 polegadas e lanterna LED para uso ao ar livre. $CHAM",
   'fotos' => ['Sc707b4fedcde4187b6154251bfa4ae8fC.png','S79f8a3d8903246f09aa8a343db16a20ay.png','Seb6feab4f01c4ef59f7d4fcc802004efi.jpg','Sf674b5ca227240ce8faea9cfcb8ab251d.png','S5d1472ae441e4d7eb477200a0068ab7el.png','S794437e6e4324244b5cecc500c0f72121.jpg'],
   'attr' => 'Cor', 'vars' => [['Preto', 73.51], ['Verde', 74.87], ['Marrom', 73.87], ['Preto (pulseira extra)', 95.41]]],
  ['ali' => '1005007043647896', 'origem' => 'CN', 'loja' => 'LIGE Smart Watch Top Store', 'aval' => '4,5★ · 3.000+ vendidos',
   'nome' => 'Relógio Inteligente Feminino LIGE – À Prova d\'Água',
   'desc' => 'Smartwatch feminino LIGE à prova d\'água, com previsão do tempo, notificações do celular, frequência cardíaca, sono e modos esportivos. Compatível com Android e iPhone.',
   'fotos' => ['S5c3d1f3705884714a97f8da622f84e1bT.jpg','S057e172e7942466e989982551ce0f6005.jpg','Sc483d5a50cde41bfb81edb755a4fda6cF.jpg','S2059afd962044ddc96f447b190d05f15Z.jpg','Sfe0c7d74c8ac48339f399ef59d7d4a6al.jpg','Se24dc8e8f46e47cc96014f7138d3fd7au.png'],
   'attr' => 'Cor', 'vars' => [['Azul', 103.38], ['Rosa', 103.89], ['Preto', 103.89], ['Amarelo', 103.46], ['Rosa – pulseira de malha', 119.41], ['Preto – pulseira de malha', 119.24]]],
  ['ali' => '1005006847425031', 'origem' => 'CN', 'loja' => 'ColMi official store', 'aval' => '1.000+ vendidos',
   'nome' => 'Relógio Inteligente COLMI i28 Ultra AI – Tela AMOLED com Assistente de IA',
   'desc' => "Smartwatch COLMI i28 Ultra com tela AMOLED e assistente de inteligência artificial integrado. $CHAM",
   'fotos' => ['S8139a21cfec54d469578aff18dd445246.jpg','S7aa0e55a7b864de6a561557e5ec0d45fi.jpg','Sce58912fc5974a5db4caff5368f7d067y.jpg','S309c6f1f83f7416c80ea92cf7118fbd3z.jpg','S8223a06a5cfb4479985028f691b81bbb1.jpg','Sf3b3c399a0d24775b392b2aa8882c993S.jpg'],
   'attr' => 'Modelo', 'vars' => [['Preto', 191.28], ['Prata – pulseira magnética', 217.65]]],
  ['ali' => '1005009824109119', 'origem' => 'CN', 'loja' => 'Zeblaze Official Store', 'aval' => '4,8★ · 3.000+ vendidos',
   'nome' => 'Relógio Inteligente Zeblaze Vibe 8 – AMOLED 1,43", Corpo em Aço e Lanterna',
   'desc' => "Smartwatch esportivo Zeblaze Vibe 8 com tela AMOLED de 1,43\", corpo único em aço e lanterna integrada. $CHAM",
   'fotos' => ['Sa6803fac8c124005a09a5df1677eb2b5F.jpg','Sbe404dee19ea4695bee06c97b9374ade0.jpg','S5e1b520cd73948bb8accde378d8032dd2.jpg','S0fb7308e6ec24449969c3eafce31075bx.jpg','Sd05e0634b144484c8c3dc08d12d4132by.jpg','S90cabf54c4a945c99fd42fd8779722402.jpg'],
   'attr' => 'Cor', 'vars' => [['Preto', 220.45], ['Cinza', 221.96]]],
  ['ali' => '1005010397546951', 'origem' => 'CN', 'loja' => 'GUHUAVMI Head Office Direct Store', 'aval' => '4,3★ · 2.000+ vendidos', 'reserva' => '1005009508738931 (4,9★, R$ 200,59)',
   'nome' => 'Relógio Inteligente Militar T-Rex 3 Ultra – GPS, Bússola e 10ATM',
   'desc' => "Smartwatch estilo militar, resistente, com GPS, bússola, altímetro e resistência à água 10ATM (natação). Tela AMOLED. $CHAM",
   'fotos' => ['S52c568a8afdd471dbaa71255068f83efj.jpg','Sc4e322cd2a2544ff94461f6043df5d2cH.jpg','Sb2b4230633f04c8bbe726b63931a255en.jpg','S42d269600a1e445382e50a127479fae3e.jpg','Sbf6b27930efe41a290bb8b5fec029ff6t.jpg','Sc70efcc2d68f4b11ad7a24f59f27b576T.jpg'],
   'attr' => 'Pulseira', 'vars' => [['Preta', 228.17], ['Camuflada', 234.38], ['Couro preto', 244.37], ['Couro claro', 247.72], ['Laranja e preta', 248.23], ['Malha de aço preta', 266.80]]],
  ['ali' => '1005012006783413', 'origem' => 'BR', 'loja' => 'XIYUVEAR Store (Brasil)', 'aval' => '4,7★ · 86 vendidos', 'reserva' => '1005011907240968 (mesma loja)',
   'nome' => 'Relógio Inteligente H9 – Tela Curva HD 2,01" com Chamadas',
   'desc' => "Smartwatch H9 com tela curva HD de 2,01 polegadas e vários mostradores. $CHAM Enviado do Brasil.",
   'fotos' => ['A7f4330cc467a460ca87fcaea1c66cb95o.jpg','A01699f2621844dcbb3d9814f676c8665c.jpg','A0e0047dd967a450b940364e486739034y.jpg','A38b085afc26a447cb896f27214ef4e06a.jpg','A17a30efa9c854a00bffd6567ca403ddek.jpg','A263c3287061a4feda86e9cad5368edb7S.jpg'],
   'attr' => 'Cor', 'vars' => [['Prateado', 76.86], ['Preto', 76.86], ['Dourado', 76.86]]],
  ['ali' => '1005011761351373', 'origem' => 'BR', 'loja' => 'XIYUVEAR Store (Brasil)', 'aval' => '4,8★ · 51 vendidos',
   'nome' => 'Relógio Inteligente X12 – Tela Touch 1,83" com Calculadora',
   'desc' => "Smartwatch X12 com tela touch de 1,83 polegada, calculadora e modos esportivos. $CHAM Enviado do Brasil.",
   'fotos' => ['A9f386c858c7848228596f8118f2cd5630.jpg','Afff7a984b67a47a4bf63bad87ca6fbb7h.png','Ad5ca2d6455f343aa87908e19fef326bbQ.png','Aeb76ba80d8dd46daae70f028d1edd3ebq.png','A2329d661396843e5a38d167d710eccf1Z.png','Ad1607cd9596b40baaaac530b65012eb6x.png'],
   'attr' => 'Cor', 'vars' => [['Rosa', 95.30], ['Preto', 95.30], ['Prateado', 95.30]]],
  ['ali' => '1005009675657647', 'origem' => 'BR', 'loja' => 'AURAFIT SmartWatch Store (Brasil)', 'aval' => '5,0★ · 171 vendidos',
   'nome' => 'Relógio Inteligente Feminino Aurafit Ella 1 – AMOLED 1,32"',
   'desc' => 'Smartwatch feminino Aurafit Ella 1 com tela AMOLED de 1,32", mais de 150 modos esportivos, notificações do celular, frequência cardíaca e sono. Enviado do Brasil.',
   'fotos' => ['Ad2f7a649a20348248c8556a3cbb2d4abQ.jpg','Sa0cdbe9ec73249949f45d1ca7fb432b1O.jpg','S336c38c726d84b34bf798bda4580642cS.jpg','S1184fc56d3244255abdf70c63c8ce87ev.jpg','S8c87513aad5240a1886a247d6bd86496h.jpg','S9deb1cd58500468d8fb13f6ff2cc4e465.jpg'],
   'attr' => 'Modelo', 'vars' => [['Preto – pulseira esportiva', 160.86], ['Rosé – pulseira de metal', 209.50]]],
  ['ali' => '1005012172793474', 'origem' => 'CN', 'loja' => 'Haylou Flagship Store', 'aval' => '4,9★ · 5.000+ vendidos',
   'nome' => 'Relógio Inteligente HAYLOU Watch 4S – GPS e Tela AMOLED 1,43"',
   'desc' => 'Smartwatch HAYLOU Watch 4S com GPS por satélite, tela AMOLED HD de 1,43" e mais de 120 modos de treino. Mostra notificações, mede frequência cardíaca e sono. Marca parceira do ecossistema Xiaomi.',
   'fotos' => ['S625ef83de47e41cd92b31775e14d044fV.jpg','S28d63a5dc1bd4075becb1560342775c4a.jpg','S257bc7cb27da4f9b81657bd8df2c35e34.jpg','S8549b5cc29154d72a96e69e28a127903m.jpg','Sab29d2710e6c4bcaa95225f6bf2de076L.jpg','S449b6b7f4bb84ed589f2e3c3a9884920S.jpg'],
   'attr' => 'Cor', 'vars' => [['Prata', 322.46], ['Preto', 322.46]]],
  ['ali' => '1005009139668769', 'origem' => 'CN', 'loja' => 'Zeblaze Official Store', 'aval' => '4,8★ · 2.000+ vendidos',
   'nome' => 'Relógio Inteligente Zeblaze Stratos 4 – GPS, Bússola, Altímetro e Lanterna',
   'desc' => 'Smartwatch robusto Zeblaze Stratos 4 com GPS, tela AMOLED de 1,43", bússola, altímetro barométrico, lanterna e chamadas por voz. Para trilha, corrida e esportes ao ar livre.',
   'fotos' => ['Sebf24ac52fee4969b2d02767a74b9232v.jpg','Sdefc24b378544053ae6c590184ae0cd7c.jpg','Sbd97fdc86edf404b8d8fe6b7676de7a12.jpg','S1bc946ce11d749d3b7af854cbdfec6b1y.jpg','S67aadebe72704bbd923c024a909ab258R.jpg','S609331b961ad45c28cdc4c9f7546c971T.jpg'],
   'attr' => 'Cor', 'vars' => [['Laranja', 381.61], ['Preto', 381.95]]],
  ['ali' => '1005010036946552', 'origem' => 'CN', 'loja' => '5G LTE Smartwatch Store', 'aval' => '4,9★ · 3.000+ vendidos', 'reserva' => '1005009646483804 (4,8★, R$ 397,60 + R$ 138,13) · 1005009646407802 (4,4★ 1.000+, R$ 439,99 + R$ 177,47)',
   'nome' => 'Relógio Celular M99 com Chip 4G – Android, Câmera Giratória, WhatsApp e Instagram',
   'desc' => 'Relógio-celular M99 com entrada para chip (4G), sistema Android, Wi-Fi e GPS. Tela AMOLED grande de 2,4" e câmera giratória para fotos e chamadas de vídeo. Baixe aplicativos como WhatsApp, Instagram e TikTok direto no relógio. Versão 4 GB de memória + 32 GB de armazenamento.',
   'fotos' => ['Sebc1e98e6f0c4beb8ce4885c037a743eZ.jpg','S602d83e3353f48cbab8602ccd0b9dce1t.jpg','S88db150c60dc4973b1061cd07a38dd9bk.jpg','S6fadf1d18e9a4b859782888e7c704d63D.jpg','S46c47a5d11a549608337e235d66025a8y.jpg','S22f3a405a318463c992e5ca4037c6f953.jpg'],
   'attr' => 'Modelo', 'vars' => [['Preto', 573.85], ['Preto com carregador portátil (power bank)', 611.15]]],
  ['ali' => '1005008774483451', 'origem' => 'CN', 'loja' => 'Haylou Flagship Store', 'aval' => '4,8★ · 3.000+ vendidos',
   'nome' => 'Relógio Inteligente HAYLOU Solar Ultra – GPS, AMOLED 1,6" e Chamadas',
   'desc' => 'Smartwatch HAYLOU Solar Ultra com GPS integrado, tela AMOLED de 1,6", resistência à água 5ATM e chamadas por Bluetooth. Ótimo para corrida e esportes ao ar livre.',
   'fotos' => ['Ac19249cd5b2c41e5b11d2e0fde8f21dcg.jpg','S65ca8abbe9364f90a4887b5093713832j.jpg','A27338602ed3e45d6b8d6f256e8593831I.jpg','Ac8871c5e9a9648d7bbc7fd7328bd6f9fh.jpg','Ac07a377d910940f9821e50e678a19b1b6.jpg','A361b159a64c24cd2bb20a6809a93c2a4R.jpg'],
   'attr' => 'Cor', 'vars' => [['Preto', 557.87], ['Prata', 557.87]], 'obs' => 'imposto estimado (37,5%) — conferir no fechamento'],
  ['ali' => '1005010270577233', 'origem' => 'BR', 'loja' => 'Amazfit (Brasil)', 'aval' => '4,9★ · 1.000+ vendidos',
   'nome' => 'Relógio Inteligente Amazfit Bip 6 – Tela 1,97" e Bateria de Longa Duração',
   'desc' => 'Smartwatch Amazfit Bip 6 original com tela grande de 1,97", GPS, bateria de longa duração, chamadas por Bluetooth, mais de 140 modos esportivos e monitoramento de saúde. Compatível com Android e iPhone. Enviado do Brasil.',
   'fotos' => ['S7549554377ea41dca53eac0a105248c8t.jpg','S785f10b4f97e4c97a468da5d8f981f303.png','S9dde4c0de937455d9b2b688e4485063dP.png','S2916a09c36714067bd2ca9e8cc64bd92r.png','S4145927eb8e9482fb67bfffa4f9208ccz.png'],
   'attr' => 'Cor', 'vars' => [['Preto', 432.00]]],
  ['ali' => '1005009142148297', 'origem' => 'BR', 'loja' => 'Amazfit (Brasil)', 'aval' => '4,9★ · 1.000+ vendidos',
   'nome' => 'Relógio Inteligente Amazfit Active 2 – Redondo, AMOLED e 10 Dias de Bateria',
   'desc' => 'Smartwatch Amazfit Active 2 original, redondo, com tela AMOLED, GPS, até 10 dias de bateria, chamadas por Bluetooth e monitoramento completo de saúde e treino. Compatível com Android e iPhone. Enviado do Brasil.',
   'fotos' => ['S008b03cc74674012ac3ea0350e22d0dfU.jpg','Sd6c4f453807d402abd29b0b21f74460ac.jpg','S9fa9663513744e4e92d6ea0c1984e0bf6.jpg','S6c70f930e4414ea4aa5c6bc6cb5e65bcX.jpg'],
   'attr' => 'Modelo', 'vars' => [['Preto padrão', 547.00]]],
];

$relog = 31;
$smart = get_term_by('name', 'Smartwatches', 'product_cat');
$cats = array_filter([$relog, $smart ? (int) $smart->term_id : 0]);
foreach ($P as $s) {
  $ali = $s['ali']; $sku = 'ALI-' . $ali; $id = wc_get_product_id_by_sku($sku);
  $multi = count($s['vars']) > 1;
  if ($id) wp_set_object_terms($id, $multi ? 'variable' : 'simple', 'product_type');
  $prod = $multi ? new WC_Product_Variable($id ?: 0) : new WC_Product_Simple($id ?: 0);
  $prod->set_name($s['nome']); $prod->set_sku($sku); $prod->set_status('publish'); $prod->set_catalog_visibility('visible');
  $prod->set_description('<p>' . esc_html($s['desc']) . '</p><p><strong>Frete grátis para todo o Brasil.</strong></p>');
  $prod->set_short_description(esc_html($s['desc']));
  $prod->set_category_ids($cats); $prod->set_shipping_class_id(49);
  $prod->set_weight(0.3); $prod->set_length(12); $prod->set_width(10); $prod->set_height(8);
  $prod->set_manage_stock(false); $prod->set_stock_status('instock');
  $attrs = [];
  if ($multi) { $at = new WC_Product_Attribute(); $at->set_name($s['attr']); $at->set_options(array_map(fn($v) => $v[0], $s['vars'])); $at->set_visible(true); $at->set_variation(true); $attrs[] = $at; }
  else $prod->set_regular_price(mvo_p($s['vars'][0][1]));
  $fo = new WC_Product_Attribute(); $fo->set_id(wc_attribute_taxonomy_id_by_name('pa_fornecedor')); $fo->set_name('pa_fornecedor'); $fo->set_options([45]); $fo->set_visible(false); $attrs[] = $fo;
  $prod->set_attributes($attrs);
  $id = $prod->save();
  wp_set_object_terms($id, [45], 'pa_fornecedor');
  $fotos = array_values(array_filter(array_map(fn($k) => mvo_img(K . $k, $id), $s['fotos'])));
  if ($fotos) { set_post_thumbnail($id, $fotos[0]); $prod = wc_get_product($id); $prod->set_gallery_image_ids(array_slice($fotos, 1)); $prod->save(); }
  $min = PHP_INT_MAX; $max = 0;
  if ($multi) {
    foreach ($prod->get_children() as $vid) wp_delete_post($vid, true);
    foreach ($s['vars'] as $i => [$nomeVar, $custo]) {
      $var = new WC_Product_Variation(); $var->set_parent_id($id);
      $var->set_attributes([sanitize_title($s['attr']) => $nomeVar]);
      $var->set_sku($sku . '-' . ($i + 1)); $preco = mvo_p($custo); $var->set_regular_price($preco);
      $var->set_manage_stock(false); $var->set_stock_status('instock'); $var->set_shipping_class_id(49);
      $vid = $var->save(); update_post_meta($vid, '_mvo_custo', $custo);
      $min = min($min, (float) $preco); $max = max($max, (float) $preco);
    }
    WC_Product_Variable::sync($id);
  } else { $min = $max = (float) mvo_p($s['vars'][0][1]); }
  update_post_meta($id, '_mvo_fornecedor', 'AliExpress');
  update_post_meta($id, '_mvo_fornecedor_url', 'https://pt.aliexpress.com/item/' . $ali . '.html');
  update_post_meta($id, '_mvo_custo', $s['vars'][0][1]);
  update_post_meta($id, '_mvo_imposto_pct', MVO_IMP * 100);
  update_post_meta($id, '_mvo_origem', $s['origem']);
  update_post_meta($id, '_vi_wad_aliexpress_product_id', $ali);
  update_post_meta($id, '_mvo_pesquisa', 'Loja: ' . $s['loja'] . ' · ' . $s['aval'] . ' · pesquisa 25/11/2026' . (!empty($s['obs']) ? ' · ' . $s['obs'] : ''));
  if (!empty($s['reserva'])) update_post_meta($id, '_mvo_fornecedores_reserva', $s['reserva']);
  WP_CLI::log(sprintf('%d | %s | %s | %d var | R$ %.2f a R$ %.2f | fotos %d', $id, $s['origem'], mb_substr($s['nome'], 0, 55), count($s['vars']), $min, $max, count($fotos)));
}
WP_CLI::success('relógios cadastrados');
