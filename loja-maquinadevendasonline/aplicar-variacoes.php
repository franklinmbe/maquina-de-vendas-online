<?php
/**
 * Aplica variações (cor, tamanho, kit…) e galeria de fotos nos produtos do AliExpress,
 * a partir de /var/www/html/import/spec.json (gerado por spec.py a partir das páginas do AliExpress).
 * Preço de cada variação = regra do Franklin (×2 até R$50, ×1,6 até R$100, ×1,5 acima; imposto 6% embutido).
 * Pode rodar de novo: recria as variações e só baixa fotos que ainda não existem.
 */
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

const MVO_IMP = 0.06;
function mvo_p($c) { $p = $c * ($c <= 50 ? 2 : ($c < 100 ? 1.6 : 1.5)) / (1 - MVO_IMP); $q = floor($p) + 0.90; if ($q < $p) $q += 1; return number_format($q, 2, '.', ''); }
function mvo_img($url, $pid) {
  if (!$url) return 0;
  $found = get_posts(['post_type' => 'attachment', 'meta_key' => '_mvo_src', 'meta_value' => $url, 'fields' => 'ids', 'numberposts' => 1]);
  if ($found) return (int)$found[0];
  $a = media_sideload_image($url, $pid, null, 'id');
  if (is_wp_error($a)) return 0;
  update_post_meta($a, '_mvo_src', $url);
  return (int)$a;
}

$spec = json_decode(file_get_contents('/var/www/html/import/spec.json'), true);
foreach ($spec as $ali => $s) {
  $pid = wc_get_product_id_by_sku('ALI-' . $ali);
  if (!$pid) { WP_CLI::warning("sem produto ALI-$ali"); continue; }
  $base = wc_get_product($pid);
  $cats = $base->get_category_ids(); $thumb = $base->get_image_id();

  // galeria (fotos pequenas embaixo da principal)
  $gal = [];
  foreach (array_slice($s['gallery'], 0, 8) as $u) { $i = mvo_img($u, $pid); if ($i && $i != $thumb) $gal[] = $i; }

  if (empty($s['vars'])) {
    $base->set_gallery_image_ids($gal); $base->save();
    WP_CLI::log("$pid simples | galeria " . count($gal));
    continue;
  }

  wp_set_object_terms($pid, 'variable', 'product_type');
  $prod = new WC_Product_Variable($pid);
  $prod->set_sku('ALI-' . $ali);
  if (!empty($s['nome'])) $prod->set_name($s['nome']);
  $attrs = [];
  foreach ($s['attrs'] as $a) {
    $vals = array_values(array_unique(array_map(fn($v) => $v['attrs'][$a], $s['vars'])));
    $at = new WC_Product_Attribute(); $at->set_name($a); $at->set_options($vals);
    $at->set_visible(true); $at->set_variation(true); $attrs[] = $at;
  }
  $forn = new WC_Product_Attribute();
  $forn->set_id(wc_attribute_taxonomy_id_by_name('pa_fornecedor')); $forn->set_name('pa_fornecedor');
  $forn->set_options([45]); $forn->set_visible(false); $forn->set_variation(false);
  $attrs[] = $forn;
  $prod->set_attributes($attrs);
  $prod->set_gallery_image_ids($gal);
  $prod->set_category_ids($cats);
  $prod->save();
  wp_set_object_terms($pid, [45], 'pa_fornecedor');
  foreach ($prod->get_children() as $vid) wp_delete_post($vid, true);

  $n = 0; $min = PHP_INT_MAX; $max = 0;
  foreach ($s['vars'] as $i => $v) {
    $var = new WC_Product_Variation();
    $var->set_parent_id($pid);
    $att = [];
    foreach ($v['attrs'] as $k => $val) $att[sanitize_title($k)] = $val;
    $var->set_attributes($att);
    $var->set_sku('ALI-' . $ali . '-' . ($i + 1));
    $preco = mvo_p($v['cost']);
    $var->set_regular_price($preco);
    $var->set_manage_stock(false); $var->set_stock_status('instock');
    $var->set_shipping_class_id(49);
    $img = mvo_img($v['img'] ?? null, $pid);
    if ($img) $var->set_image_id($img);
    $vid = $var->save();
    update_post_meta($vid, '_mvo_custo', $v['cost']);
    update_post_meta($vid, '_mvo_fornecedor', 'AliExpress');
    update_post_meta($vid, '_mvo_fornecedor_url', 'https://pt.aliexpress.com/item/' . $ali . '.html');
    $n++; $min = min($min, (float)$preco); $max = max($max, (float)$preco);
  }
  WC_Product_Variable::sync($pid);
  WP_CLI::log(sprintf('%d %s | %d variações | R$ %.2f a R$ %.2f | galeria %d', $pid, $prod->get_name(), $n, $min, $max, count($gal)));
}
WP_CLI::success('variações aplicadas');
