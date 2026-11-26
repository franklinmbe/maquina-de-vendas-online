<?php
/**
 * Cadastro em lote (genérico) a partir de um JSON montado do AliExpress (só variações EM ESTOQUE).
 * Uso: MVO_LOTE=/var/www/html/import/academia.json wploja eval-file /var/www/html/import/cadastrar-lote.php
 * Cada produto: nome, desc, aviso, peso, gallery, attrs, vars|cost, cats (caminho ["Pai","Filho",...]), origem (BR|CN).
 * Preço = regra do Franklin: custo+imposto; até R$50 ×2, abaixo de R$100 ×1,6, até R$540 (US$100) ×1,5, acima ×1,3; 6% embutido; final ,90.
 * Textos sem calibre/modelo de arma; coletes com aviso "não é balístico"; luvas com aviso "não é EPI".
 * Rodar: wploja eval-file /var/www/html/import/cadastrar-tatico-20261124.php (atualiza pelo SKU, não duplica).
 */
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

const MVO_IMP = 0.06;
function mvo_p($c) { $p = $c * ($c <= 50 ? 2 : ($c < 100 ? 1.6 : ($c <= 540 ? 1.5 : 1.3))) / (1 - MVO_IMP); $q = floor($p) + 0.90; if ($q < $p - 0.0001) $q += 1; return number_format($q, 2, '.', ''); }
function mvo_img($url, $pid) {
  if (!$url) return 0;
  $f = get_posts(['post_type' => 'attachment', 'meta_key' => '_mvo_src', 'meta_value' => $url, 'fields' => 'ids', 'numberposts' => 1]);
  if ($f) return (int) $f[0];
  $a = media_sideload_image($url, $pid, null, 'id');
  if (is_wp_error($a)) { WP_CLI::warning("foto: " . $a->get_error_message()); return 0; }
  update_post_meta($a, '_mvo_src', $url); return (int) $a;
}
function mvo_cat($nome, $pai = 0) {
  $t = get_terms(['taxonomy' => 'product_cat', 'name' => $nome, 'parent' => $pai, 'hide_empty' => false]);
  if ($t && !is_wp_error($t)) return (int) $t[0]->term_id;
  $r = wp_insert_term($nome, 'product_cat', ['parent' => $pai]);
  if (is_wp_error($r)) { $id = $r->get_error_data('term_exists'); if ($id) return (int) $id; WP_CLI::error($r->get_error_message()); }
  return (int) $r['term_id'];
}

$spec = json_decode(file_get_contents(getenv('MVO_LOTE') ?: '/var/www/html/import/lote.json'), true);
foreach ($spec as $ali => $s) {
  $sku = 'ALI-' . $ali;
  $id = wc_get_product_id_by_sku($sku);
  $tipo = empty($s['vars']) ? 'simple' : 'variable';
  if ($id) wp_set_object_terms($id, $tipo, 'product_type');
  $prod = $id ? ($tipo === 'variable' ? new WC_Product_Variable($id) : new WC_Product_Simple($id)) : ($tipo === 'variable' ? new WC_Product_Variable() : new WC_Product_Simple());
  $prod->set_name($s['nome']);
  $prod->set_sku($sku);
  $prod->set_status('publish');
  $prod->set_catalog_visibility('visible');
  $prod->set_description('<p>' . esc_html($s['desc']) . '</p>' . (!empty($s['aviso']) ? '<p><strong>' . esc_html($s['aviso']) . '</strong></p>' : '') . '<p><strong>Frete grátis para todo o Brasil.</strong></p>');
  $prod->set_short_description(esc_html($s['desc']));
  $cids = []; $pai = 0;
  foreach ($s['cats'] as $cn) { $pai = mvo_cat($cn, $pai); $cids[] = $pai; }
  $prod->set_category_ids($cids);
  $prod->set_shipping_class_id(49);
  $prod->set_weight($s['peso'] ?? 0.4); $prod->set_length(25); $prod->set_width(20); $prod->set_height(8);
  $prod->set_manage_stock(false); $prod->set_stock_status('instock');
  $attrs = [];
  if ($tipo === 'variable') {
    foreach ($s['attrs'] as $a) {
      $vals = array_values(array_unique(array_map(fn($v) => $v['attrs'][$a], $s['vars'])));
      $at = new WC_Product_Attribute(); $at->set_name($a); $at->set_options($vals); $at->set_visible(true); $at->set_variation(true); $attrs[] = $at;
    }
  } else {
    $prod->set_regular_price(mvo_p($s['cost']));
  }
  $fo = new WC_Product_Attribute(); $fo->set_id(wc_attribute_taxonomy_id_by_name('pa_fornecedor')); $fo->set_name('pa_fornecedor');
  $fo->set_options([45]); $fo->set_visible(false); $fo->set_variation(false); $attrs[] = $fo;
  $prod->set_attributes($attrs);
  $id = $prod->save();
  wp_set_object_terms($id, [45], 'pa_fornecedor');

  $fotos = array_values(array_filter(array_map(fn($u) => mvo_img($u, $id), array_slice($s['gallery'], 0, 7))));
  if ($fotos) { set_post_thumbnail($id, $fotos[0]); $prod = wc_get_product($id); $prod->set_gallery_image_ids(array_slice($fotos, 1)); $prod->save(); }

  $n = 0; $min = $max = (float) ($tipo === 'simple' ? mvo_p($s['cost']) : 0); $min = $tipo === 'simple' ? $min : PHP_INT_MAX;
  if ($tipo === 'variable') {
    foreach ($prod->get_children() as $vid) wp_delete_post($vid, true);
    foreach ($s['vars'] as $i => $v) {
      $var = new WC_Product_Variation(); $var->set_parent_id($id);
      $att = []; foreach ($v['attrs'] as $k => $val) $att[sanitize_title($k)] = $val;
      $var->set_attributes($att);
      $var->set_sku($sku . '-' . ($i + 1));
      $preco = mvo_p($v['cost']); $var->set_regular_price($preco);
      $var->set_manage_stock(false); $var->set_stock_status('instock'); $var->set_shipping_class_id(49);
      $im = mvo_img($v['img'] ?? null, $id); if ($im) $var->set_image_id($im);
      $vid = $var->save();
      update_post_meta($vid, '_mvo_custo', $v['cost']);
      $n++; $min = min($min, (float) $preco); $max = max($max, (float) $preco);
    }
    WC_Product_Variable::sync($id);
  }
  update_post_meta($id, '_mvo_fornecedor', 'AliExpress');
  update_post_meta($id, '_mvo_fornecedor_url', 'https://pt.aliexpress.com/item/' . $ali . '.html');
  update_post_meta($id, '_mvo_custo', $s['cost'] ?? null);
  update_post_meta($id, '_mvo_imposto_pct', MVO_IMP * 100);
  update_post_meta($id, '_vi_wad_aliexpress_product_id', $ali);
  update_post_meta($id, '_mvo_origem', ($s['origem'] ?? 'CN') === 'BR' ? 'BR' : 'CN');
  // Vídeo do fornecedor: baixa uma vez para a nossa mídia e guarda o endereço em _mvo_video.
  if (!empty($s['video']) && !get_post_meta($id, '_mvo_video', true)) {
    $tmp = download_url($s['video'], 120);
    if (!is_wp_error($tmp)) {
      $file = ['name' => 'video-ali-' . $ali . '.mp4', 'tmp_name' => $tmp];
      $vid = media_handle_sideload($file, $id, $s['nome'] . ' (vídeo)');
      if (!is_wp_error($vid)) update_post_meta($id, '_mvo_video', wp_get_attachment_url($vid));
      else { @unlink($tmp); WP_CLI::warning('vídeo: ' . $vid->get_error_message()); }
    } else WP_CLI::warning('vídeo: ' . $tmp->get_error_message());
  }
  WP_CLI::log(sprintf('%d | %s | %d variações | R$ %.2f a R$ %.2f | fotos %d | %s%s', $id, $s['nome'], $n, $min, $max, count($fotos), implode(' > ', $s['cats']), get_post_meta($id, '_mvo_video', true) ? ' | vídeo' : ''));
}
WP_CLI::success('lote cadastrado');
