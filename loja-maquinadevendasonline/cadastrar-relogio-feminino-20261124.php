<?php
/**
 * 24/11/2026 — Relógio inteligente feminino de luxo 1.75" (AliExpress 1005007804724274), pedido do Franklin para uma revendedora.
 * Custo = R$152,90 + R$31,35 de imposto estimado (tela do Franklin, Black Friday até 03/12) = R$184,25.
 * Regra de preço: acima de R$100 -> +50%, imposto 6% embutido, final ,90.
 * Rodar: wploja eval-file /var/www/html/import/cadastrar-relogio-feminino-20261124.php (não duplica: atualiza pelo SKU).
 */
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

const MVO_IMPOSTO = 0.06;
function mvo_preco($c) { $p = $c * ($c <= 50 ? 2 : ($c <= 100 ? 1.6 : 1.5)) / (1 - MVO_IMPOSTO); $q = floor($p) + 0.90; if ($q < $p - 0.0001) $q += 1; return number_format($q, 2, '.', ''); }

$ali = '1005007804724274';
$custo = 184.25;
$nome = 'Relógio Inteligente Feminino de Luxo 1.75" AMOLED com Strass – Chamadas Bluetooth';
$desc = 'Smartwatch feminino de luxo com tela AMOLED HD de 1.75 polegadas e acabamento com strass. Faz e atende ligações pelo relógio (Bluetooth), mede frequência cardíaca, acompanha exercícios e sono, mostra notificações do celular e controla a câmera e as músicas. À prova d\'água IP68. Ótima opção de presente.';
$fotos = [
  'https://ae-pic-a1.aliexpress-media.com/kf/S9b0d2301a7994ad08d99e7ce1775240c2.png',
  'https://ae-pic-a1.aliexpress-media.com/kf/S7899fcee7e81475fbbf7bc31704af6c0i.png',
  'https://ae-pic-a1.aliexpress-media.com/kf/S91b7002d642c48e6b4511563d3acc2d9s.png',
  'https://ae-pic-a1.aliexpress-media.com/kf/S18d0e1c46254485cae7dd936100eaa93x.png',
  'https://ae-pic-a1.aliexpress-media.com/kf/Sbca389b0dfee4f81b2dc717a80036c647.png',
  'https://ae-pic-a1.aliexpress-media.com/kf/S9e377928e59b45ffb77c1fb6ba9f28340.png',
];
function mvo_img($url, $pid) {
  $f = get_posts(['post_type' => 'attachment', 'meta_key' => '_mvo_src', 'meta_value' => $url, 'fields' => 'ids', 'numberposts' => 1]);
  if ($f) return (int) $f[0];
  $a = media_sideload_image($url, $pid, null, 'id');
  if (is_wp_error($a)) { WP_CLI::warning($a->get_error_message()); return 0; }
  update_post_meta($a, '_mvo_src', $url); return (int) $a;
}

$relog = 31;
$smart = get_term_by('name', 'Smartwatches', 'product_cat');
$sku = 'ALI-' . $ali;
$id = wc_get_product_id_by_sku($sku);
$prod = $id ? wc_get_product($id) : new WC_Product_Simple();
$prod->set_name($nome);
$prod->set_sku($sku);
$prod->set_status('publish');
$prod->set_catalog_visibility('visible');
$prod->set_description('<p>' . esc_html($desc) . '</p><p><strong>Frete grátis para todo o Brasil.</strong></p>');
$prod->set_short_description(esc_html($desc));
$prod->set_regular_price(mvo_preco($custo));
$prod->set_manage_stock(false);
$prod->set_stock_status('instock');
$prod->set_category_ids(array_filter([$relog, $smart ? $smart->term_id : 0]));
$prod->set_shipping_class_id(49);
$prod->set_weight(0.25); $prod->set_length(12); $prod->set_width(10); $prod->set_height(8);
$at = new WC_Product_Attribute();
$at->set_id(wc_attribute_taxonomy_id_by_name('pa_fornecedor')); $at->set_name('pa_fornecedor');
$at->set_options([45]); $at->set_visible(false);
$prod->set_attributes([$at]);
$id = $prod->save();
wp_set_object_terms($id, [45], 'pa_fornecedor');

$ids = array_values(array_filter(array_map(fn($u) => mvo_img($u, $id), $fotos)));
if ($ids) { set_post_thumbnail($id, $ids[0]); $prod = wc_get_product($id); $prod->set_gallery_image_ids(array_slice($ids, 1)); $prod->save(); }

update_post_meta($id, '_mvo_fornecedor', 'AliExpress');
update_post_meta($id, '_mvo_fornecedor_url', 'https://pt.aliexpress.com/item/' . $ali . '.html');
update_post_meta($id, '_mvo_custo', $custo);
update_post_meta($id, '_mvo_imposto_pct', MVO_IMPOSTO * 100);
update_post_meta($id, '_vi_wad_aliexpress_product_id', $ali);
WP_CLI::log("$id | $nome | custo $custo | preço " . mvo_preco($custo) . ' | fotos ' . count($ids) . ' | ' . get_permalink($id));
