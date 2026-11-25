<?php
/**
 * Plugin Name: MVO – Aba de custos (só admin)
 * Description: Na página do produto, uma aba "💼 Custos (só admin)" visível só para quem administra a loja
 *   (Franklin, 25/11/2026): custo mínimo e máximo (produto + imposto do fornecedor, sem frete), frete estimado
 *   mínimo e máximo, preço de venda, lucro e até quanto dá para descontar sem prejuízo — para negociar na hora.
 *   Custos vêm do meta _mvo_custo (produto e variações). Frete: AliExpress/fornecedor = grátis (já incluso);
 *   estoque próprio = cotação do Melhor Envio (Madureira → Rio e → Manaus), guardada por 1 dia.
 */
if (!defined('ABSPATH')) exit;

const MVO_CA_TAXAS = 0.06 + 0.05; // 6% imposto embutido + ~5% Mercado Pago (cartão; Pix é menos)

function mvo_ca_brl($v) { return 'R$ ' . number_format((float) $v, 2, ',', '.'); }

function mvo_ca_linhas($product) {
  $l = [];
  if ($product->is_type('variable')) {
    foreach ($product->get_children() as $vid) {
      $v = wc_get_product($vid); if (!$v) continue;
      $c = get_post_meta($vid, '_mvo_custo', true);
      if ($c === '') $c = get_post_meta($product->get_id(), '_mvo_custo', true);
      $l[] = ['nome' => wc_get_formatted_variation($v, true, false, false), 'custo' => $c === '' ? null : (float) $c, 'preco' => (float) $v->get_price(), 'estoque' => $v->is_in_stock()];
    }
  } else {
    $c = get_post_meta($product->get_id(), '_mvo_custo', true);
    $l[] = ['nome' => 'Produto', 'custo' => $c === '' ? null : (float) $c, 'preco' => (float) $product->get_price(), 'estoque' => $product->is_in_stock()];
  }
  return $l;
}

/* frete estimado: fornecedor de dropshipping entrega com frete grátis; estoque próprio cota no Melhor Envio */
function mvo_ca_frete($product) {
  $forn = (string) get_post_meta($product->get_id(), '_mvo_fornecedor', true);
  if (preg_match('/aliexpress|dropi|cj|eprolo/i', $forn)) return ['min' => 0, 'max' => 0, 'obs' => 'Grátis: o fornecedor (' . $forn . ') entrega com frete incluso no custo.'];
  $key = 'mvo_ca_frete_' . $product->get_id();
  $c = get_transient($key); if ($c) return $c;
  $tok = get_option('wpmelhorenvio_token');
  if (!$tok) return ['min' => null, 'max' => null, 'obs' => 'Sem token do Melhor Envio para cotar.'];
  $pkg = ['height' => max(2, (float) $product->get_height() ?: 8), 'width' => max(11, (float) $product->get_width() ?: 12), 'length' => max(16, (float) $product->get_length() ?: 16), 'weight' => max(0.1, (float) $product->get_weight() ?: 0.3)];
  $vals = [];
  foreach (['20040020', '69005000'] as $cep) { // Centro do Rio (perto) e Manaus (longe)
    $r = wp_remote_post('https://melhorenvio.com.br/api/v2/me/shipment/calculate', ['timeout' => 20,
      'headers' => ['Authorization' => "Bearer $tok", 'Accept' => 'application/json', 'Content-Type' => 'application/json', 'User-Agent' => 'Loja MVO'],
      'body' => wp_json_encode(['from' => ['postal_code' => '21360360'], 'to' => ['postal_code' => $cep], 'package' => $pkg, 'options' => ['insurance_value' => (float) $product->get_price(), 'receipt' => false, 'own_hand' => false]])]);
    $best = null;
    foreach ((array) json_decode(wp_remote_retrieve_body($r), true) as $s) if (empty($s['error']) && isset($s['price']) && ($best === null || $s['price'] < $best)) $best = (float) $s['price'];
    if ($best !== null) $vals[] = $best;
  }
  $c = $vals ? ['min' => min($vals), 'max' => max($vals), 'obs' => 'Estoque próprio: Melhor Envio saindo de Madureira (mais barato: Centro do Rio; mais caro: Manaus). Estimativa, conferir na hora.']
             : ['min' => null, 'max' => null, 'obs' => 'Não consegui cotar o frete agora.'];
  set_transient($key, $c, DAY_IN_SECONDS);
  return $c;
}

add_filter('woocommerce_product_tabs', function ($tabs) {
  if (!current_user_can('manage_woocommerce')) return $tabs;
  $tabs['mvo_custos'] = ['title' => '💼 Custos (só admin)', 'priority' => 5, 'callback' => 'mvo_ca_aba'];
  return $tabs;
}, 99);

function mvo_ca_aba() {
  global $product;
  if (!$product || !current_user_can('manage_woocommerce')) return;
  $l = mvo_ca_linhas($product);
  $custos = array_filter(array_column($l, 'custo'), fn($x) => $x !== null);
  $fr = mvo_ca_frete($product);
  $frMax = (float) ($fr['max'] ?? 0);
  echo '<div class="mvo-ca"><style>.mvo-ca{border:2px dashed #FFD93D;border-radius:14px;padding:14px;font-size:.92rem}.mvo-ca .g{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:8px 0 12px}.mvo-ca .g div{border:1px solid rgba(127,127,127,.35);border-radius:10px;padding:8px;text-align:center}.mvo-ca .g b{display:block;font-size:1.15rem}.mvo-ca table{width:100%;font-size:.86rem}.mvo-ca td,.mvo-ca th{padding:4px 6px;text-align:left}.mvo-ca .ok{color:#35d07f;font-weight:700}.mvo-ca small{opacity:.75}</style>';
  echo '<p><b>🔒 Só você vê esta aba</b> (admin). Use para negociar desconto na hora.</p>';
  if (!$custos) { echo '<p>Custo não cadastrado neste produto.</p></div>'; return; }
  printf('<div class="g"><div>Custo mínimo<b>%s</b><small>produto + imposto, sem frete</small></div><div>Custo máximo<b>%s</b><small>produto + imposto, sem frete</small></div><div>Frete estimado<b>%s</b><small>mín. a máx.</small></div></div>',
    mvo_ca_brl(min($custos)), mvo_ca_brl(max($custos)),
    $fr['min'] === null ? '—' : ($fr['max'] == 0 ? 'Grátis' : mvo_ca_brl($fr['min']) . ' a ' . mvo_ca_brl($fr['max'])));
  echo '<p><small>' . esc_html($fr['obs']) . '</small></p>';
  echo '<p><b>Regra do Franklin (25/11/2026): desconto de no máximo 10%.</b></p>';
  echo '<table><tr><th>Opção</th><th>Custo</th><th>Preço de venda</th><th>Lucro hoje</th><th>Menor preço sem prejuízo*</th><th>Desconto permitido (até 10%)</th><th>Preço com desconto</th></tr>';
  foreach ($l as $x) {
    if ($x['custo'] === null) { printf('<tr><td>%s</td><td colspan="5">sem custo</td></tr>', esc_html($x['nome'])); continue; }
    $base = $x['custo'] + $frMax;
    $min = $base / (1 - MVO_CA_TAXAS);
    $lucro = $x['preco'] * (1 - MVO_CA_TAXAS) - $base;
    $desc = min(max(0, $x['preco'] - $min), $x['preco'] * 0.10); // nunca passa de 10%
    printf('<tr><td>%s%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td class="ok">%s (%d%%)</td><td><b>%s</b></td></tr>',
      esc_html($x['nome']), $x['estoque'] ? '' : ' <small>(sem estoque)</small>', mvo_ca_brl($x['custo']), mvo_ca_brl($x['preco']), mvo_ca_brl($lucro), mvo_ca_brl(ceil($min)), mvo_ca_brl($desc), $x['preco'] > 0 ? round($desc / $x['preco'] * 100) : 0, mvo_ca_brl(floor($x['preco'] - $desc) + 0.90));
  }
  echo '</table>';
  echo '<p><small>* Cobre custo + frete máximo + 6% de imposto + ~5% do Mercado Pago. Abaixo disso a venda dá prejuízo. Afiliado (10%) não incluso: se a venda vier de afiliado, desconte ainda os 10%.</small></p>';
  $url = get_post_meta($product->get_id(), '_mvo_fornecedor_url', true);
  $pesq = get_post_meta($product->get_id(), '_mvo_pesquisa', true);
  $res = get_post_meta($product->get_id(), '_mvo_fornecedores_reserva', true);
  echo '<p><small>Fornecedor: ' . esc_html(get_post_meta($product->get_id(), '_mvo_fornecedor', true) ?: '—') . ($url ? ' · <a href="' . esc_url($url) . '" target="_blank" rel="noopener">abrir anúncio</a>' : '') . ($pesq ? ' · ' . esc_html($pesq) : '') . ($res ? ' · Reserva: ' . esc_html($res) : '') . '</small></p>';
  echo '</div>';
}
