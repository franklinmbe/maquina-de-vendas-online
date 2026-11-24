<?php
/**
 * Plugin Name: MVO – Aviso de produto importado
 * Description: Nos produtos do fornecedor AliExpress (pa_fornecedor = 45), mostra
 *   o aviso de que o produto pode vir do exterior, entregue no nome e CPF do
 *   cliente, com todos os impostos já inclusos no preço (Franklin, 23/11/2026).
 *   Aparece na página do produto, no carrinho e no fechamento da compra.
 */
if (!defined('ABSPATH')) exit;

const MVO_FORN_ALI = 45;

function mvo_eh_ali($product_id) {
  $p = wc_get_product($product_id);
  if ($p && $p->get_parent_id()) $product_id = $p->get_parent_id();
  // Produto com estoque no Brasil (meta _mvo_origem = BR) não é importação: sem este aviso (Franklin, 24/11/2026).
  if (get_post_meta($product_id, '_mvo_origem', true) === 'BR') return false;
  return has_term(MVO_FORN_ALI, 'pa_fornecedor', $product_id);
}

function mvo_aviso_importado_html($curto = false) {
  $t = $curto
    ? 'Este pedido tem produto que pode vir do exterior. Ele é entregue no seu nome e no seu CPF, e <strong>todos os impostos já estão inclusos no preço</strong>: você não paga nada a mais na entrega.'
    : 'Este produto pode ser enviado de um fornecedor fora do Brasil. Nesse caso, a importação é feita <strong>no seu nome e no seu CPF</strong> (exigência da Receita Federal para a entrega). <strong>Todos os impostos já estão inclusos no preço</strong>: você não paga nada a mais na entrega. Frete grátis para todo o Brasil. <a href="/trocas-e-devolucoes/#importados">Saiba mais</a>.';
  return '<div class="mvo-aviso-importado" style="margin:14px 0;padding:12px 14px;border:1.5px solid #35d07f;border-radius:12px;background:rgba(53,208,127,.08);font-size:.92em;line-height:1.45">🌎 ' . $t . '</div>';
}

// Página do produto: logo abaixo do botão Comprar
add_action('woocommerce_single_product_summary', function () {
  global $product;
  if ($product && mvo_eh_ali($product->get_id())) echo mvo_aviso_importado_html();
}, 35);

// Carrinho e fechamento da compra
function mvo_aviso_importado_carrinho() {
  if (!WC()->cart) return;
  foreach (WC()->cart->get_cart() as $item) {
    if (mvo_eh_ali($item['product_id'])) { echo mvo_aviso_importado_html(true); return; }
  }
}
add_action('woocommerce_before_cart_table', 'mvo_aviso_importado_carrinho');
add_action('woocommerce_review_order_before_payment', 'mvo_aviso_importado_carrinho');
