<?php
/**
 * 23/11/2026 — Helicóptero vira produto com VARIAÇÕES, cada variação = um fornecedor
 * (regra do Franklin: 2–3 fornecedores por produto, mesma faixa de preço, troca entre si).
 * Custo = preço logado no AliExpress (Black Friday) + imposto estimado (~25% visto no site).
 * Rodar: wploja eval-file /var/www/html/import/helicoptero-variacoes-20261123.php
 */
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

const IMP = 0.06;
function preco_mvo($c) { $p = $c * ($c <= 50 ? 2 : ($c < 100 ? 1.6 : 1.5)) / (1 - IMP); $q = floor($p) + 0.90; if ($q < $p) $q += 1; return number_format($q, 2, '.', ''); }
function foto($url, $pid, $nome) { $a = media_sideload_image($url, $pid, $nome, 'id'); return is_wp_error($a) ? 0 : $a; }

$id = wc_get_product_id_by_sku('ALI-1005006995814818');
if (!$id) WP_CLI::error('produto base não achado');
wp_set_object_terms($id, 'variable', 'product_type');
$prod = new WC_Product_Variable($id);
$prod->set_sku('HELI-GESTO');
$prod->set_name('Helicóptero de Controle por Gesto com Luz LED – 3 Modelos');

$modelos = [
  ['nome' => 'Clássico com controle remoto', 'ali' => '1005006995814818', 'custo' => 25.24,
   'img' => 'https://ae-pic-a1.aliexpress-media.com/kf/Sa0f1098c58f642a0880a6bbeb1e09bb22.jpg',
   'nota' => '4,9★ 4.000+ vendidos', 'reserva' => 'https://pt.aliexpress.com/item/1005012049950790.html (mesmo modelo, 4,2★ 2.000+, ~R$33,90)'],
  ['nome' => 'Aeronave 2 canais com controle', 'ali' => '1005010128468933', 'custo' => 37.40,
   'img' => 'https://ae-pic-a1.aliexpress-media.com/kf/Sa07ecbf03c75421484f29c59469405d05.jpg',
   'nota' => '4,2★ 2.000+ vendidos', 'reserva' => ''],
  ['nome' => 'Com controle de pulso (relógio)', 'ali' => '1005007308760970', 'custo' => 43.66,
   'img' => 'https://ae-pic-a1.aliexpress-media.com/kf/Sdf2cb91beb524eeb9c9fd799804ed1a6V.jpg',
   'nota' => '4,0★ 4.000+ vendidos', 'reserva' => ''],
];

$at = new WC_Product_Attribute();
$at->set_name('Modelo');
$at->set_options(array_column($modelos, 'nome'));
$at->set_visible(true); $at->set_variation(true);
$forn = new WC_Product_Attribute();
$forn->set_id(wc_attribute_taxonomy_id_by_name('pa_fornecedor')); $forn->set_name('pa_fornecedor');
$forn->set_options([45]); $forn->set_visible(false); $forn->set_variation(false);
$prod->set_attributes([$at, $forn]);
$desc = 'Helicóptero de brinquedo que voa com o movimento da mão: aproxime a mão por baixo e ele sobe (sensor de indução). Luz LED e bateria recarregável por USB. Escolha o modelo: clássico com controle remoto, aeronave de 2 canais com controle, ou com controle de pulso (tipo relógio). Ótimo presente. Não recomendado para menores de 3 anos.';
$prod->set_description('<p>' . esc_html($desc) . '</p><p><strong>Frete grátis para todo o Brasil.</strong></p>');
$prod->set_short_description(esc_html($desc));
$prod->save();
wp_set_object_terms($id, [45], 'pa_fornecedor');

// apaga variações antigas (se rodar de novo)
foreach ($prod->get_children() as $vid) wp_delete_post($vid, true);

$galeria = [];
foreach ($modelos as $m) {
  $v = new WC_Product_Variation();
  $v->set_parent_id($id);
  $v->set_attributes(['modelo' => $m['nome']]);
  $v->set_sku('ALI-' . $m['ali']);
  $v->set_regular_price(preco_mvo($m['custo']));
  $v->set_manage_stock(false); $v->set_stock_status('instock');
  $v->set_shipping_class_id(49);
  $v->set_weight(0.25);
  $vid = $v->save();
  $img = foto($m['img'], $id, $m['nome']);
  if ($img) { $v->set_image_id($img); $v->save(); $galeria[] = $img; }
  update_post_meta($vid, '_mvo_fornecedor', 'AliExpress');
  update_post_meta($vid, '_mvo_fornecedor_url', 'https://pt.aliexpress.com/item/' . $m['ali'] . '.html');
  update_post_meta($vid, '_mvo_custo', $m['custo']);
  update_post_meta($vid, '_mvo_nota', $m['nota']);
  if ($m['reserva']) update_post_meta($vid, '_mvo_fornecedores_reserva', $m['reserva']);
  update_post_meta($vid, '_vi_wad_aliexpress_product_id', $m['ali']);
  WP_CLI::log(sprintf('%d | %-34s | custo %6.2f | preço %s | foto %s', $vid, $m['nome'], $m['custo'], preco_mvo($m['custo']), $img ? 'ok' : 'falhou'));
}
$prod = wc_get_product($id);
$prod->set_gallery_image_ids(array_values(array_diff($galeria, [$prod->get_image_id()])));
$prod->save();
WC_Product_Variable::sync($id);
update_post_meta($id, '_mvo_pesquisa', 'Variações = fornecedores. Brasil: só a partir de R$127,99 (não vale).');
WP_CLI::success("produto variável $id pronto");
