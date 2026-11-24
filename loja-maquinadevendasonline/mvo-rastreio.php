<?php
/**
 * Plugin Name: MVO – Acompanhar pedido (estilo marketplace)
 * Description: Na conta do cliente (Meus pedidos e na página de cada pedido): linha do tempo
 *   Pedido feito → Pago → Preparando → A caminho → Entregue, "No prazo · chega entre X e Y",
 *   botão Rastrear (Correios / transportadora / internacional) e "Precisa de ajuda?" no WhatsApp.
 *   No painel do pedido: campo de código de rastreio + transportadora; ao salvar o código o pedido
 *   vira "Enviado" e o cliente recebe e-mail com o link. (Franklin, 24/11/2026, modelo: pedido do Mercado Livre.)
 */
if (!defined('ABSPATH')) exit;

const MVO_WHATS_LOJA = '5521999059608';

/* ---------- status "Enviado" ---------- */
add_action('init', function () {
  register_post_status('wc-enviado', [
    'label' => 'Enviado', 'public' => true, 'exclude_from_search' => false,
    'show_in_admin_all_list' => true, 'show_in_admin_status_list' => true,
    'label_count' => _n_noop('Enviado <span class="count">(%s)</span>', 'Enviados <span class="count">(%s)</span>'),
  ]);
});
add_filter('wc_order_statuses', function ($s) {
  $n = [];
  foreach ($s as $k => $v) { $n[$k] = $v; if ($k === 'wc-processing') $n['wc-enviado'] = 'Enviado'; }
  return $n;
});
add_filter('woocommerce_order_is_paid_statuses', function ($s) { $s[] = 'enviado'; return $s; });
add_filter('bulk_actions-woocommerce_page_wc-orders--shop_order', function ($a) { $a['mark_enviado'] = 'Mudar para Enviado'; return $a; });

/* ---------- transportadoras e links de rastreio ---------- */
function mvo_transportadoras() {
  return [
    'correios' => ['Correios', 'https://rastreamento.correios.com.br/app/index.php?objetos=%s'],
    'jadlog'   => ['Jadlog', 'https://www.melhorrastreio.com.br/rastreio/%s'],
    'loggi'    => ['Loggi', 'https://www.melhorrastreio.com.br/rastreio/%s'],
    'jt'       => ['J&T Express', 'https://www.melhorrastreio.com.br/rastreio/%s'],
    'outra'    => ['Transportadora', 'https://www.melhorrastreio.com.br/rastreio/%s'],
    'internacional' => ['Envio internacional', 'https://t.17track.net/pt#nums=%s'],
    'mao'      => ['Entrega em mãos', ''],
  ];
}
function mvo_link_rastreio($order) {
  $cod = trim((string) $order->get_meta('_mvo_rastreio'));
  $t = mvo_transportadoras()[$order->get_meta('_mvo_transportadora') ?: 'correios'] ?? mvo_transportadoras()['correios'];
  return ($cod && $t[1]) ? sprintf($t[1], rawurlencode($cod)) : '';
}

/* ---------- prazo: Brasil 3–7 dias úteis, internacional 15–25 ---------- */
function mvo_mais_dias_uteis($ts, $n) {
  $d = (new DateTime('@' . $ts))->setTimezone(wp_timezone());
  while ($n > 0) { $d->modify('+1 day'); if ((int) $d->format('N') < 6) $n--; }
  return $d;
}
function mvo_prazo_pedido($order) {
  $intl = false;
  foreach ($order->get_items() as $it) {
    $p = $it->get_product(); if (!$p) continue;
    $pid = $p->get_parent_id() ?: $p->get_id();
    if ($p->is_virtual()) continue;
    if (get_post_meta($pid, '_mvo_origem', true) !== 'BR') $intl = true;
  }
  $base = $order->get_date_paid() ?: $order->get_date_created();
  $ts = $base ? $base->getTimestamp() : time();
  [$a, $b] = $intl ? [15, 25] : [3, 7];
  return [mvo_mais_dias_uteis($ts, $a), mvo_mais_dias_uteis($ts, $b), $intl];
}
function mvo_data_curta($d) {
  $m = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return (int) $d->format('j') . '/' . $m[(int) $d->format('n')];
}

/* ---------- etapa do pedido ---------- */
function mvo_etapa($order) {
  $s = $order->get_status();
  if (in_array($s, ['cancelled', 'refunded', 'failed'], true)) return -1;
  if ($s === 'completed') return 4;
  if ($s === 'enviado' || $order->get_meta('_mvo_rastreio')) return 3;
  if ($order->is_paid()) return $order->get_meta('_mvo_preparando') ? 2 : 1;
  return 0;
}
function mvo_tem_fisico($order) {
  foreach ($order->get_items() as $it) { $p = $it->get_product(); if ($p && !$p->is_virtual()) return true; }
  return false;
}

/* ---------- cartão estilo marketplace ---------- */
function mvo_card_pedido($order, $compacto = false) {
  $et = mvo_etapa($order);
  $fis = mvo_tem_fisico($order);
  if (!$fis) {
    $tit = $order->is_paid() ? 'Seu acesso está liberado' : 'Aguardando pagamento';
    return '<div class="mvo-ped"><div class="mvo-ped-tit">' . $tit . '</div><div class="mvo-ped-sub">Produto digital: o acesso chega no seu e-mail.</div></div>';
  }
  if ($et === -1) return '<div class="mvo-ped cancel"><div class="mvo-ped-tit">Pedido ' . esc_html(wc_get_order_status_name($order->get_status())) . '</div></div>';
  [$d1, $d2, $intl] = mvo_prazo_pedido($order);
  $titulos = ['Aguardando o pagamento', 'Pagamento aprovado', 'Estamos preparando o seu pedido', 'Sua compra já está a caminho', 'Entregue'];
  $passos = ['Pedido feito', 'Pago', 'Preparando', 'A caminho', 'Entregue'];
  $h = '<div class="mvo-ped">';
  if ($et < 4) {
    $atras = $et >= 1 && time() > $d2->getTimestamp() + DAY_IN_SECONDS;
    $h .= '<div class="mvo-ped-prazo ' . ($atras ? 'atras' : '') . '">● ' . ($atras ? 'Atrasado' : 'No prazo') . ' <span>Chegará entre ' . mvo_data_curta($d1) . ' e ' . mvo_data_curta($d2) . '</span>' . ($intl ? ' <em>🌎 internacional</em>' : ' <em>🇧🇷 do Brasil</em>') . '</div>';
  } else {
    $h .= '<div class="mvo-ped-prazo">● Entregue</div>';
  }
  $h .= '<div class="mvo-ped-tit">' . $titulos[$et] . '</div><div class="mvo-linha">';
  foreach ($passos as $i => $p) {
    $c = $i < $et ? 'ok' : ($i === $et ? 'atual' : '');
    $ic = $i === 3 ? '🚚' : ($i === 4 ? '🏠' : '');
    $h .= '<div class="mvo-pas ' . $c . '"><i>' . ($i === $et && $ic ? $ic : '') . '</i><small>' . $p . '</small></div>';
  }
  $h .= '</div>';
  if (!$compacto) {
    $cod = $order->get_meta('_mvo_rastreio'); $lk = mvo_link_rastreio($order);
    $tr = mvo_transportadoras()[$order->get_meta('_mvo_transportadora') ?: 'correios'][0] ?? '';
    $h .= '<div class="mvo-ped-acoes">';
    if ($lk) $h .= '<a class="mvo-ped-bt" href="' . esc_url($lk) . '" target="_blank" rel="noopener"><span>📍</span>Rastrear</a>';
    $msg = 'Olá! Preciso de ajuda com o meu pedido nº ' . $order->get_order_number() . ' da Máquina de Vendas Online.';
    $h .= '<a class="mvo-ped-bt" href="https://wa.me/' . MVO_WHATS_LOJA . '?text=' . rawurlencode($msg) . '" target="_blank" rel="noopener"><span>💬</span>Precisa de ajuda?</a></div>';
    if ($cod) $h .= '<div class="mvo-ped-cod">' . esc_html($tr) . ' · código de rastreio <b>' . esc_html($cod) . '</b></div>';
  }
  return $h . '</div>';
}

/* página de cada pedido (Minha conta → Pedidos → Ver) */
add_action('woocommerce_view_order', function ($order_id) {
  $o = wc_get_order($order_id); if ($o) echo mvo_card_pedido($o);
}, 5);
/* lista de pedidos: uma linha resumida com a etapa */
add_filter('woocommerce_my_account_my_orders_columns', function ($c) {
  $n = []; foreach ($c as $k => $v) { $n[$k] = $v; if ($k === 'order-status') $n['mvo-etapa'] = 'Acompanhar'; } return $n;
});
add_action('woocommerce_my_account_my_orders_column_mvo-etapa', function ($order) {
  echo mvo_card_pedido($order, true);
});

/* ---------- painel do pedido (admin): código de rastreio ---------- */
add_action('add_meta_boxes', function () {
  $tela = function_exists('wc_get_page_screen_id') ? wc_get_page_screen_id('shop-order') : 'shop_order';
  add_meta_box('mvo-rastreio', '🚚 Envio e rastreio', function ($post_or_order) {
    $o = $post_or_order instanceof WC_Order ? $post_or_order : wc_get_order($post_or_order->ID);
    if (!$o) return;
    $t = $o->get_meta('_mvo_transportadora') ?: 'correios';
    echo '<p><label>Transportadora</label><br><select name="mvo_transportadora" style="width:100%">';
    foreach (mvo_transportadoras() as $k => $v) echo '<option value="' . esc_attr($k) . '"' . selected($t, $k, false) . '>' . esc_html($v[0]) . '</option>';
    echo '</select></p><p><label>Código de rastreio</label><br><input name="mvo_rastreio" style="width:100%" value="' . esc_attr($o->get_meta('_mvo_rastreio')) . '" placeholder="Ex.: AA123456789BR"></p>';
    echo '<p><label><input type="checkbox" name="mvo_preparando" value="1"' . checked((bool) $o->get_meta('_mvo_preparando'), true, false) . '> Já estamos preparando</label></p>';
    echo '<p style="color:#666;font-size:12px">Ao salvar um código novo, o pedido passa para <b>Enviado</b> e o cliente recebe e-mail com o link de rastreio. Quando chegar, mude para <b>Concluído</b> (= Entregue).</p>';
    wp_nonce_field('mvo_rastreio', 'mvo_rastreio_nonce');
  }, $tela, 'side', 'high');
});
function mvo_salvar_rastreio($order_id) {
  if (empty($_POST['mvo_rastreio_nonce']) || !wp_verify_nonce($_POST['mvo_rastreio_nonce'], 'mvo_rastreio')) return;
  if (!current_user_can('edit_shop_orders')) return;
  $o = wc_get_order($order_id); if (!$o) return;
  $novo = strtoupper(preg_replace('/\s+/', '', sanitize_text_field(wp_unslash($_POST['mvo_rastreio'] ?? ''))));
  $antes = (string) $o->get_meta('_mvo_rastreio');
  $o->update_meta_data('_mvo_transportadora', sanitize_key($_POST['mvo_transportadora'] ?? 'correios'));
  $o->update_meta_data('_mvo_rastreio', $novo);
  $o->update_meta_data('_mvo_preparando', empty($_POST['mvo_preparando']) ? '' : '1');
  $o->save_meta_data();
  if ($novo && $novo !== $antes) {
    if (in_array($o->get_status(), ['processing', 'on-hold'], true)) $o->update_status('enviado', 'Código de rastreio ' . $novo . ' adicionado.');
    mvo_email_enviado($o);
  }
}
add_action('woocommerce_process_shop_order_meta', 'mvo_salvar_rastreio', 50);

function mvo_email_enviado($o) {
  $lk = mvo_link_rastreio($o);
  [$d1, $d2] = mvo_prazo_pedido($o);
  $conta = wc_get_endpoint_url('view-order', $o->get_id(), wc_get_page_permalink('myaccount'));
  $corpo = '<p>Olá, ' . esc_html($o->get_billing_first_name()) . '!</p><p><b>Seu pedido nº ' . $o->get_order_number() . ' já está a caminho.</b> 🚚</p>'
    . '<p>Previsão de chegada: entre <b>' . mvo_data_curta($d1) . ' e ' . mvo_data_curta($d2) . '</b>.</p>'
    . ($lk ? '<p><a href="' . esc_url($lk) . '" style="background:#3483fa;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Rastrear meu pedido</a></p><p>Código de rastreio: <b>' . esc_html($o->get_meta('_mvo_rastreio')) . '</b></p>' : '')
    . '<p>Você também acompanha tudo em <a href="' . esc_url($conta) . '">Minha conta → Meus pedidos</a>.</p><p>Máquina de Vendas Online</p>';
  $mailer = WC()->mailer();
  $html = $mailer->wrap_message('Seu pedido está a caminho', $corpo);
  $mailer->send($o->get_billing_email(), 'Seu pedido nº ' . $o->get_order_number() . ' está a caminho 🚚', $html, "Content-Type: text/html\r\n");
}

/* ---------- visual ---------- */
add_action('wp_head', function () { if (!function_exists('is_account_page') || !is_account_page()) return; ?>
<style>
.mvo-ped{background:#fff;border:1px solid #e6e8ec;border-radius:14px;padding:18px 18px 14px;margin:0 0 18px;color:#15181d}
.mvo-ped-prazo{color:#00a650;font-weight:700;font-size:.85rem}
.mvo-ped-prazo span{color:#555;font-weight:400}.mvo-ped-prazo em{font-style:normal;color:#555;font-weight:400}
.mvo-ped-prazo.atras{color:#e0351b}
.mvo-ped-tit{font-size:1.25rem;font-weight:700;margin:4px 0 14px}
.mvo-ped-sub{color:#555}
.mvo-linha{display:flex;align-items:flex-start;margin:6px 0 10px}
.mvo-pas{flex:1;position:relative;text-align:center;font-size:.72rem;color:#999}
.mvo-pas:before{content:"";position:absolute;top:9px;left:-50%;width:100%;height:3px;background:#dfe2e7;z-index:0}
.mvo-pas:first-child:before{display:none}
.mvo-pas.ok:before,.mvo-pas.atual:before{background:#15181d}
.mvo-pas i{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#fff;border:3px solid #dfe2e7;font-style:normal;font-size:.8rem}
.mvo-pas.ok i{background:#15181d;border-color:#15181d}
.mvo-pas.atual i{background:#15181d;border-color:#15181d;width:30px;height:30px;margin-top:-5px}
.mvo-pas small{display:block;margin-top:4px}
.mvo-pas.ok small,.mvo-pas.atual small{color:#15181d;font-weight:600}
.mvo-ped-acoes{display:flex;gap:14px;margin-top:8px}
.mvo-ped-bt{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:.75rem;color:#3483fa!important;text-decoration:none!important;text-align:center;width:80px}
.mvo-ped-bt span{display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;background:#eef4ff;font-size:1.2rem}
.mvo-ped-cod{margin-top:10px;font-size:.85rem;color:#555}
.mvo-ped.cancel .mvo-ped-tit{color:#e0351b}
td.woocommerce-orders-table__cell-mvo-etapa .mvo-ped{padding:8px 10px;margin:0;border:0;min-width:240px}
td.woocommerce-orders-table__cell-mvo-etapa .mvo-ped-tit{font-size:.9rem;margin:2px 0 6px}
html:not([data-tema="claro"]) .mvo-ped{background:#1c2027;border-color:#2c313a;color:#eef1f6}
html:not([data-tema="claro"]) .mvo-ped-sub,html:not([data-tema="claro"]) .mvo-ped-cod,html:not([data-tema="claro"]) .mvo-ped-prazo span{color:#aab2bf}
</style>
<?php });
