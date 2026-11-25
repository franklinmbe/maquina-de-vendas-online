<?php
/**
 * Plugin Name: MVO – Sininho de notificações do pedido
 * Description: A cada passo do pedido (recebido, pago, a caminho, entregue, cancelado) o cliente ganha um aviso
 *   no sininho 🔔 do topo da loja, com bolinha vermelha de quantidade, igual ao Mercado Livre. Tocar no aviso
 *   abre o pedido. Os avisos ficam na conta do cliente (user meta _mvo_notifs, últimos 40). (Franklin, 24/11/2026)
 */
if (!defined('ABSPATH')) exit;

function mvo_notif_add($user_id, $order, $texto, $icone, $link = '') {
  if (!$user_id) return;
  $l = get_user_meta($user_id, '_mvo_notifs', true); if (!is_array($l)) $l = [];
  array_unshift($l, ['id' => uniqid('n', false), 'pedido' => $order->get_id(), 'txt' => $texto, 'ic' => $icone,
    'link' => $link ?: wc_get_endpoint_url('view-order', $order->get_id(), wc_get_page_permalink('myaccount')), 't' => time(), 'lida' => 0]);
  update_user_meta($user_id, '_mvo_notifs', array_slice($l, 0, 40));
  do_action('mvo_notif_nova', $user_id); // notificação no celular (mvo-push.php)
}

function mvo_notif_status($order_id, $de, $para, $order) {
  if (!$order || !$order->get_customer_id()) return;
  $n = $order->get_order_number();
  $msg = [
    'pending'    => ['🛒', "Pedido nº $n recebido. Aguardando o pagamento."],
    'on-hold'    => ['🛒', "Pedido nº $n recebido. Aguardando a confirmação do pagamento."],
    'processing' => ['✅', "Pagamento aprovado! Estamos preparando o pedido nº $n."],
    'enviado'    => ['🚚', "Seu pedido nº $n está a caminho! Toque para acompanhar."],
    'completed'  => ['🏠', "Pedido nº $n entregue. Aproveite! ⭐ Conta pra gente o que achou."],
    'cancelled'  => ['❌', "Pedido nº $n cancelado."],
    'refunded'   => ['↩️', "O valor do pedido nº $n foi reembolsado."],
    'failed'     => ['⚠️', "O pagamento do pedido nº $n não foi aprovado. Toque para tentar de novo."],
  ];
  if (!isset($msg[$para])) return;
  mvo_notif_add($order->get_customer_id(), $order, $msg[$para][1], $msg[$para][0]);
}
add_action('woocommerce_order_status_changed', 'mvo_notif_status', 20, 4);
// pedido novo já nasce com status: avisa o "recebido"
add_action('woocommerce_new_order', function ($order_id, $order = null) {
  $order = $order ?: wc_get_order($order_id);
  if ($order) mvo_notif_status($order_id, '', $order->get_status(), $order);
}, 20, 2);

/* mensagem da loja para o cliente dentro do pedido ("nota para o cliente") */
add_action('woocommerce_new_customer_note', function ($args) {
  $o = wc_get_order($args['order_id'] ?? 0); if (!$o || !$o->get_customer_id()) return;
  $txt = wp_strip_all_tags($args['customer_note'] ?? '');
  mvo_notif_add($o->get_customer_id(), $o, '💬 Mensagem da loja sobre o pedido nº ' . $o->get_order_number() . ': ' . mb_strimwidth($txt, 0, 120, '…'), '💬');
});

/* a loja respondeu a pergunta ou avaliação do cliente num produto */
add_action('wp_insert_comment', function ($id, $c) {
  if (empty($c->comment_parent) || $c->comment_approved != 1) return;
  $resp = get_userdata($c->user_id);
  if (!$resp || !array_intersect(['administrator', 'shop_manager'], (array) $resp->roles)) return;
  $pai = get_comment($c->comment_parent); if (!$pai || !$pai->user_id || (int) $pai->user_id === (int) $c->user_id) return;
  $l = get_user_meta($pai->user_id, '_mvo_notifs', true); if (!is_array($l)) $l = [];
  array_unshift($l, ['id' => uniqid('n', false), 'pedido' => 0, 'ic' => '💬',
    'txt' => 'A loja respondeu você em "' . mb_strimwidth(get_the_title($c->comment_post_ID), 0, 60, '…') . '": ' . mb_strimwidth(wp_strip_all_tags($c->comment_content), 0, 100, '…'),
    'link' => get_comment_link($c), 't' => time(), 'lida' => 0]);
  update_user_meta($pai->user_id, '_mvo_notifs', array_slice($l, 0, 40));
  do_action('mvo_notif_nova', $pai->user_id);
}, 20, 2);

/* marcar como lidas */
add_action('wp_ajax_mvo_notifs_lidas', function () {
  check_ajax_referer('mvo_notifs', 'n');
  $u = get_current_user_id(); $l = get_user_meta($u, '_mvo_notifs', true);
  if (is_array($l)) { foreach ($l as &$x) $x['lida'] = 1; update_user_meta($u, '_mvo_notifs', $l); }
  wp_send_json_success();
});

/* sininho no topo (só logado) */
add_action('wp_footer', function () {
  if (is_admin()) return;
  $logado = is_user_logged_in();
  $l = $logado ? get_user_meta(get_current_user_id(), '_mvo_notifs', true) : []; if (!is_array($l)) $l = [];
  $novas = count(array_filter($l, fn($x) => empty($x['lida'])));
  $itens = '';
  foreach (array_slice($l, 0, 20) as $x) {
    $quando = human_time_diff($x['t'], time()) . ' atrás';
    $itens .= '<a class="mvo-nt-it' . (empty($x['lida']) ? ' nova' : '') . '" href="' . esc_url($x['link']) . '"><i>' . esc_html($x['ic']) . '</i><span>' . esc_html($x['txt']) . '<small>' . esc_html($quando) . '</small></span></a>';
  }
  if (!$itens) $itens = '<p class="mvo-nt-vazio">Você ainda não tem avisos. Quando fizer um pedido, cada passo aparece aqui. 🔔</p>';
  if (!$logado) $itens = '<p class="mvo-nt-vazio">Entre na sua conta para receber aqui os avisos dos seus pedidos: compra aprovada, a caminho, entregue e as respostas da loja. 🔔</p><a class="mvo-nt-pedidos" href="' . esc_url(wc_get_page_permalink('myaccount')) . '">Entrar ou criar conta ›</a>';
  ?>
<div id="mvo-nt-pop" hidden><div class="mvo-nt-top"><b>Notificações</b><button type="button" onclick="document.getElementById('mvo-nt-pop').hidden=true" aria-label="Fechar">✕</button></div><div class="mvo-nt-lista"><?php echo $itens; ?></div><a class="mvo-nt-pedidos" href="<?php echo esc_url(wc_get_endpoint_url('orders', '', wc_get_page_permalink('myaccount'))); ?>">Ver todos os meus pedidos ›</a></div>
<script>
(function () {
  var alvo = document.querySelector('.mvo-fav-topo'); if (!alvo || document.getElementById('mvo-nt-btn')) return;
  var b = document.createElement('button'); b.type = 'button'; b.id = 'mvo-nt-btn'; b.setAttribute('aria-label', 'Notificações');
  b.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>'<?php echo $novas ? " + '<b>" . min($novas, 9) . ($novas > 9 ? '+' : '') . "</b>'" : ''; ?>;
  alvo.parentNode.insertBefore(b, alvo);
  var pop = document.getElementById('mvo-nt-pop');
  b.onclick = function (e) {
    e.preventDefault(); pop.hidden = !pop.hidden;
    var bol = b.querySelector('b');
    if (!pop.hidden && bol) {
      bol.remove();
      var f = new FormData(); f.append('action', 'mvo_notifs_lidas'); f.append('n', '<?php echo wp_create_nonce('mvo_notifs'); ?>');
      fetch('<?php echo esc_url(admin_url('admin-ajax.php')); ?>', { method: 'POST', body: f, credentials: 'same-origin' });
    }
  };
  document.addEventListener('click', function (e) { if (!pop.hidden && !pop.contains(e.target) && !b.contains(e.target)) pop.hidden = true; });
})();
</script>
<style>
#mvo-nt-btn{position:relative;display:inline-flex;align-items:center;background:none;border:0;padding:0;margin-right:10px;color:#2b2b2b;cursor:pointer}
#mvo-nt-btn b{position:absolute;top:-6px;right:-7px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#e0351b;color:#fff;font:800 .68rem/17px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #FFE14D}
#mvo-nt-pop{position:fixed;top:78px;right:12px;z-index:10002;width:min(92vw,360px);max-height:70vh;display:flex;flex-direction:column;background:#fff;color:#15181d;border-radius:14px;box-shadow:0 12px 34px rgba(0,0,0,.28);overflow:hidden}
#mvo-nt-pop[hidden]{display:none}
.mvo-nt-top{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#FFE14D}
.mvo-nt-top button{background:none;border:0;font-size:1.1rem;cursor:pointer}
.mvo-nt-lista{overflow-y:auto}
.mvo-nt-it{display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid #f0f1f3;color:#15181d!important;text-decoration:none!important;font-size:.92rem;line-height:1.35}
.mvo-nt-it.nova{background:#eef4ff}
.mvo-nt-it i{font-style:normal;font-size:1.2rem}
.mvo-nt-it small{display:block;color:#777;font-size:.75rem;margin-top:3px}
.mvo-nt-vazio{padding:16px 14px;color:#555;margin:0}
.mvo-nt-pedidos{display:block;padding:12px 14px;text-align:center;font-weight:700;color:#3483fa!important;text-decoration:none!important;border-top:1px solid #f0f1f3}
@media (max-width:782px){#mvo-nt-btn{margin-right:8px}#mvo-nt-pop{top:70px}}
@media (max-width:370px){#mvo-nt-btn{margin-right:6px}}
html:not([data-tema="claro"]) #mvo-nt-pop{background:#1c2027;color:#eef1f6}
html:not([data-tema="claro"]) .mvo-nt-it{color:#eef1f6!important;border-color:#2c313a}
html:not([data-tema="claro"]) .mvo-nt-it.nova{background:#22304a}
</style>
<?php }, 80);
