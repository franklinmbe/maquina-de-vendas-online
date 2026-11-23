<?php
/**
 * 23/11/2026 — Helicóptero de controle por gesto (AliExpress 1005006995814818).
 * Pesquisa: China R$ 20,90 + R$ 4,34 de imposto (4,9★, 4.000+ vendidos) = melhor opção;
 * Brasil só a partir de R$ 127,99. Regra de preço: custo ≤ R$50 → ×2, imposto 6% embutido.
 * Rodar: wploja eval-file /var/www/html/import/cadastrar-helicoptero-20261123.php
 */
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

function mvo_cat2($nome, $pai = 0) {
  $t = get_term_by('name', $nome, 'product_cat');
  if ($t) return (int)$t->term_id;
  $r = wp_insert_term($nome, 'product_cat', ['parent' => $pai]);
  return is_wp_error($r) ? (int)$r->get_error_data('term_exists') : (int)$r['term_id'];
}
$brinq = mvo_cat2('Brinquedos e Hobbies');
$rc    = mvo_cat2('Brinquedos de Controle Remoto', $brinq);

$custo = 25.24; $imposto = 0.06;
$p = $custo * ($custo <= 50 ? 2 : ($custo <= 100 ? 1.6 : 1.5)) / (1 - $imposto);
$preco = floor($p) + 0.90; if ($preco < $p) $preco += 1;

$ali = '1005006995814818'; $sku = 'ALI-' . $ali;
$id = wc_get_product_id_by_sku($sku);
$prod = $id ? wc_get_product($id) : new WC_Product_Simple();
$desc = 'Helicóptero de brinquedo que voa com o movimento da mão: é só aproximar a mão por baixo que ele sobe (sensor de indução). Também vem com controle remoto de 2 canais. Tem luz LED e bateria recarregável por cabo USB. Ótimo presente para crianças. Não recomendado para menores de 3 anos.';
$prod->set_name('Helicóptero de Controle por Gesto com Luz LED – Recarregável');
$prod->set_sku($sku);
$prod->set_status('publish');
$prod->set_description('<p>' . esc_html($desc) . '</p><p><strong>Frete grátis para todo o Brasil.</strong></p>');
$prod->set_short_description(esc_html($desc));
$prod->set_regular_price(number_format($preco, 2, '.', ''));
$prod->set_manage_stock(false);
$prod->set_stock_status('instock');
$prod->set_category_ids([$brinq, $rc]);
$prod->set_shipping_class_id(49);
$prod->set_weight(0.2); $prod->set_length(22); $prod->set_width(12); $prod->set_height(8);
$at = new WC_Product_Attribute();
$at->set_id(wc_attribute_taxonomy_id_by_name('pa_fornecedor')); $at->set_name('pa_fornecedor');
$at->set_options([45]); $at->set_visible(false);
$prod->set_attributes([$at]);
$id = $prod->save();
wp_set_object_terms($id, [45], 'pa_fornecedor');
if (!has_post_thumbnail($id)) {
  $att = media_sideload_image('https://ae-pic-a1.aliexpress-media.com/kf/Sa0f1098c58f642a0880a6bbeb1e09bb22.jpg', $id, $prod->get_name(), 'id');
  if (!is_wp_error($att)) set_post_thumbnail($id, $att);
}
update_post_meta($id, '_mvo_fornecedor', 'AliExpress');
update_post_meta($id, '_mvo_fornecedor_url', 'https://pt.aliexpress.com/item/' . $ali . '.html');
update_post_meta($id, '_mvo_custo', $custo);
update_post_meta($id, '_mvo_imposto_pct', $imposto * 100);
update_post_meta($id, '_vi_wad_aliexpress_product_id', $ali);
update_post_meta($id, '_mvo_pesquisa', 'China R$20,90+R$4,34 imp, 4.9★ 4000+ vendidos (melhor); outros iguais R$29,90-33,90 4.2★; Brasil a partir de R$127,99');
WP_CLI::success("produto $id | preço $preco | foto " . (has_post_thumbnail($id) ? 'ok' : 'falhou'));
