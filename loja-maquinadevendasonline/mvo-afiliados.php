<?php
/**
 * Plugin Name: MVO – Afiliados da loja
 * Description: Programa de afiliados próprio da loja (Franklin, 25/11/2026). O cliente pede para ser afiliado em
 *   Minha conta → Afiliado; o admin aprova em WooCommerce → Afiliados. O afiliado ganha um link (?ref=CODIGO),
 *   que vale 30 dias no aparelho de quem clicou. Cada venda feita por esse link gera comissão (padrão 10% dos
 *   produtos, sem frete), que fica "pendente" até o pedido ser entregue (concluído), vira "a pagar" e o admin
 *   marca como "paga" depois de mandar o Pix. Pedido cancelado/reembolsado cancela a comissão.
 *   Dados: user meta _mvo_af_* (status, codigo, pix, cliques, pedidos) e order meta _mvo_af_* (id, valor, taxa, status).
 */
if (!defined('ABSPATH')) exit;

const MVO_AF_DIAS = 30;

function mvo_af_taxa() { return (float) get_option('mvo_af_taxa', 10); }
function mvo_af_status($uid) { return get_user_meta($uid, '_mvo_af_status', true) ?: ''; }
function mvo_af_brl($v) { return 'R$ ' . number_format((float) $v, 2, ',', '.'); }

function mvo_af_codigo($uid) {
  $c = get_user_meta($uid, '_mvo_af_codigo', true);
  if ($c) return $c;
  $u = get_userdata($uid);
  $base = sanitize_title(remove_accents(explode(' ', trim($u->first_name ?: $u->display_name ?: 'parceiro'))[0]));
  $base = preg_replace('/[^a-z0-9]/', '', $base) ?: 'parceiro';
  $c = substr($base, 0, 12) . $uid;
  update_user_meta($uid, '_mvo_af_codigo', $c);
  return $c;
}

function mvo_af_por_codigo($codigo) {
  $codigo = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', (string) $codigo));
  if ($codigo === '') return 0;
  $u = get_users(['meta_key' => '_mvo_af_codigo', 'meta_value' => $codigo, 'number' => 1, 'fields' => 'ID']);
  return $u ? (int) $u[0] : 0;
}

/* ---------- 1. guarda quem indicou (link ?ref=CODIGO) ---------- */
add_action('init', function () {
  if (is_admin() || empty($_GET['ref'])) return;
  $uid = mvo_af_por_codigo(wp_unslash($_GET['ref']));
  if (!$uid || mvo_af_status($uid) !== 'ativo') return;
  if (is_user_logged_in() && get_current_user_id() === $uid) return; // o próprio afiliado não conta
  setcookie('mvo_ref', (string) $uid, time() + MVO_AF_DIAS * DAY_IN_SECONDS, COOKIEPATH ?: '/', COOKIE_DOMAIN, is_ssl(), true);
  $_COOKIE['mvo_ref'] = (string) $uid;
  update_user_meta($uid, '_mvo_af_cliques', (int) get_user_meta($uid, '_mvo_af_cliques', true) + 1);
});

/* ---------- 2. marca o pedido com o afiliado e calcula a comissão ---------- */
function mvo_af_marcar_pedido($order) {
  if (!$order instanceof WC_Order || $order->get_meta('_mvo_af_id')) return;
  $uid = (int) ($_COOKIE['mvo_ref'] ?? 0);
  if (!$uid || mvo_af_status($uid) !== 'ativo') return;
  $af = get_userdata($uid); if (!$af) return;
  if ((int) $order->get_customer_id() === $uid) return;                                   // comprou para si
  if (strcasecmp((string) $order->get_billing_email(), (string) $af->user_email) === 0) return;
  $base = max(0, (float) $order->get_subtotal() - (float) $order->get_discount_total());  // só produtos, sem frete
  $taxa = mvo_af_taxa();
  $valor = round($base * $taxa / 100, 2);
  $order->update_meta_data('_mvo_af_id', $uid);
  $order->update_meta_data('_mvo_af_taxa', $taxa);
  $order->update_meta_data('_mvo_af_valor', $valor);
  $order->update_meta_data('_mvo_af_status', 'pendente');
  $order->save();
  $l = get_user_meta($uid, '_mvo_af_pedidos', true); if (!is_array($l)) $l = [];
  if (!in_array($order->get_id(), $l, true)) { $l[] = $order->get_id(); update_user_meta($uid, '_mvo_af_pedidos', $l); }
  $order->add_order_note(sprintf('Venda de afiliado: %s (%s), comissão %s (%s%%).', $af->display_name, mvo_af_codigo($uid), mvo_af_brl($valor), $taxa));
  if (function_exists('mvo_notif_add')) {
    mvo_notif_add($uid, $order, sprintf('💰 Venda pelo seu link! Pedido nº %s, comissão de %s (libera depois da entrega).', $order->get_order_number(), mvo_af_brl($valor)), '💰', wc_get_account_endpoint_url('afiliado'));
  }
}
add_action('woocommerce_checkout_order_processed', function ($id, $posted = [], $order = null) { mvo_af_marcar_pedido($order ?: wc_get_order($id)); }, 20, 3);
add_action('woocommerce_store_api_checkout_order_processed', 'mvo_af_marcar_pedido', 20, 1);

/* ---------- 3. a comissão acompanha o pedido ---------- */
add_action('woocommerce_order_status_changed', function ($id, $de, $para, $order) {
  if (!$order || !$order->get_meta('_mvo_af_id') || $order->get_meta('_mvo_af_status') === 'paga') return;
  $novo = null;
  if ($para === 'completed') $novo = 'aprovada';
  elseif (in_array($para, ['cancelled', 'refunded', 'failed'], true)) $novo = 'cancelada';
  elseif (in_array($para, ['processing', 'on-hold', 'pending', 'enviado'], true)) $novo = 'pendente';
  if ($novo && $novo !== $order->get_meta('_mvo_af_status')) {
    $order->update_meta_data('_mvo_af_status', $novo); $order->save();
    if ($novo === 'aprovada' && function_exists('mvo_notif_add')) {
      mvo_notif_add((int) $order->get_meta('_mvo_af_id'), $order, sprintf('✅ Comissão de %s liberada (pedido nº %s entregue). Vai para o seu Pix.', mvo_af_brl($order->get_meta('_mvo_af_valor')), $order->get_order_number()), '✅', wc_get_account_endpoint_url('afiliado'));
    }
  }
}, 30, 4);

function mvo_af_resumo($uid) {
  $r = ['pendente' => 0, 'aprovada' => 0, 'paga' => 0, 'cancelada' => 0, 'linhas' => []];
  $ids = get_user_meta($uid, '_mvo_af_pedidos', true); if (!is_array($ids)) $ids = [];
  foreach (array_reverse($ids) as $id) {
    $o = wc_get_order($id); if (!$o) continue;
    $st = $o->get_meta('_mvo_af_status') ?: 'pendente'; $v = (float) $o->get_meta('_mvo_af_valor');
    $r[$st] = ($r[$st] ?? 0) + $v;
    $r['linhas'][] = ['o' => $o, 'st' => $st, 'v' => $v];
  }
  return $r;
}
function mvo_af_rotulo($st) {
  return ['pendente' => '⏳ aguardando entrega', 'aprovada' => '💵 a receber', 'paga' => '✅ paga', 'cancelada' => '❌ cancelada'][$st] ?? $st;
}

/* ---------- 4. Minha conta → Afiliado ---------- */
add_action('init', function () {
  add_rewrite_endpoint('afiliado', EP_ROOT | EP_PAGES);
  if (get_option('mvo_af_flush') !== '1') { flush_rewrite_rules(false); update_option('mvo_af_flush', '1'); }
}, 5);
add_filter('woocommerce_get_query_vars', function ($v) { $v['afiliado'] = 'afiliado'; return $v; });
add_filter('woocommerce_account_menu_items', function ($m) {
  $novo = [];
  foreach ($m as $k => $t) { if ($k === 'customer-logout') $novo['afiliado'] = '💰 Afiliado'; $novo[$k] = $t; }
  if (!isset($novo['afiliado'])) $novo['afiliado'] = '💰 Afiliado';
  return $novo;
});
add_filter('woocommerce_endpoint_afiliado_title', fn() => 'Programa de afiliados');

add_action('template_redirect', function () {
  if (empty($_POST['mvo_af_acao']) || !is_user_logged_in()) return;
  if (!wp_verify_nonce($_POST['_mvo_af'] ?? '', 'mvo_af_conta')) return;
  $uid = get_current_user_id();
  $pix = sanitize_text_field(wp_unslash($_POST['pix'] ?? ''));
  if ($_POST['mvo_af_acao'] === 'entrar' && !mvo_af_status($uid)) {
    update_user_meta($uid, '_mvo_af_status', 'pendente');
    update_user_meta($uid, '_mvo_af_desde', time());
    mvo_af_codigo($uid);
    wp_mail(get_option('admin_email'), 'Novo pedido de afiliado na loja', 'Aprovar em: ' . admin_url('admin.php?page=mvo-afiliados'));
  }
  if ($pix !== '') update_user_meta($uid, '_mvo_af_pix', $pix);
  wp_safe_redirect(wc_get_account_endpoint_url('afiliado')); exit;
});

add_action('woocommerce_account_afiliado_endpoint', function () {
  $uid = get_current_user_id(); $st = mvo_af_status($uid); $taxa = mvo_af_taxa();
  $pix = get_user_meta($uid, '_mvo_af_pix', true);
  echo '<style>.mvo-af{display:grid;gap:14px}.mvo-af .cx{border:1px solid rgba(51,214,203,.35);border-radius:14px;padding:14px}.mvo-af .tot{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.mvo-af .tot div{border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:10px;text-align:center}.mvo-af .tot b{display:block;font-size:1.2rem}.mvo-af input[type=text]{width:100%}.mvo-af table{width:100%;font-size:.9rem}</style><div class="mvo-af">';
  $form_pix = '<label>Sua chave Pix (para receber as comissões)<input type="text" name="pix" value="' . esc_attr($pix) . '" placeholder="CPF, e-mail, telefone ou chave aleatória"></label>';
  $nonce = wp_nonce_field('mvo_af_conta', '_mvo_af', true, false);
  if (!$st) {
    printf('<div class="cx"><h3>Ganhe %s%% em cada venda que você indicar</h3><p>Você recebe um link da loja. Quem comprar por ele em até %d dias gera comissão para você, paga no Pix depois que o pedido é entregue. Não precisa ter estoque, nem CNPJ.</p><form method="post">%s%s<input type="hidden" name="mvo_af_acao" value="entrar"><p><button class="button" type="submit">Quero ser afiliado</button></p></form></div>', esc_html(rtrim(rtrim(number_format($taxa, 2, ',', ''), '0'), ',')), MVO_AF_DIAS, $nonce, $form_pix);
  } elseif ($st === 'pendente') {
    printf('<div class="cx"><h3>⏳ Pedido recebido</h3><p>A loja vai aprovar o seu cadastro de afiliado. Você recebe o aviso no sininho 🔔.</p><form method="post">%s%s<input type="hidden" name="mvo_af_acao" value="pix"><p><button class="button" type="submit">Salvar Pix</button></p></form></div>', $nonce, $form_pix);
  } elseif ($st === 'inativo') {
    echo '<div class="cx"><h3>Cadastro de afiliado pausado</h3><p>Fale com a loja para reativar.</p></div>';
  } else {
    $cod = mvo_af_codigo($uid); $link = add_query_arg('ref', $cod, home_url('/')); $r = mvo_af_resumo($uid);
    printf('<div class="cx"><h3>Seu link de afiliado</h3><p><input type="text" readonly value="%1$s" onclick="this.select()"></p><p class="small">Também vale em qualquer produto: cole o link do produto abaixo.</p><p><input type="text" id="mvoAfProd" placeholder="Cole aqui o link de um produto da loja"></p><p><input type="text" id="mvoAfOut" readonly onclick="this.select()" placeholder="Seu link do produto aparece aqui"></p><p>Comissão: <b>%2$s%%</b> do valor dos produtos (sem frete). Cliques no seu link: <b>%3$d</b>.</p></div>',
      esc_attr($link), esc_html(rtrim(rtrim(number_format($taxa, 2, ',', ''), '0'), ',')), (int) get_user_meta($uid, '_mvo_af_cliques', true));
    printf('<div class="tot"><div>Aguardando entrega<b>%s</b></div><div>A receber<b>%s</b></div><div>Já pago<b>%s</b></div></div>', mvo_af_brl($r['pendente']), mvo_af_brl($r['aprovada']), mvo_af_brl($r['paga']));
    echo '<div class="cx"><h3>Suas vendas</h3>';
    if (!$r['linhas']) echo '<p>Nenhuma venda ainda. Divulgue o seu link! 🚀</p>';
    else {
      echo '<table><tr><th>Data</th><th>Pedido</th><th>Comissão</th><th>Situação</th></tr>';
      foreach ($r['linhas'] as $l) printf('<tr><td>%s</td><td>nº %s</td><td>%s</td><td>%s</td></tr>', esc_html(wc_format_datetime($l['o']->get_date_created(), 'd/m/Y')), esc_html($l['o']->get_order_number()), mvo_af_brl($l['v']), esc_html(mvo_af_rotulo($l['st'])));
      echo '</table>';
    }
    printf('</div><div class="cx"><form method="post">%s%s<input type="hidden" name="mvo_af_acao" value="pix"><p><button class="button" type="submit">Salvar Pix</button></p></form></div>', $nonce, $form_pix);
    printf('<script>(function(){var i=document.getElementById("mvoAfProd"),o=document.getElementById("mvoAfOut");if(!i)return;i.addEventListener("input",function(){try{var u=new URL(i.value.trim());u.searchParams.set("ref",%s);o.value=u.toString();}catch(e){o.value="";}});})();</script>', wp_json_encode($cod));
  }
  echo '</div>';
});

/* ---------- 5. admin: WooCommerce → Afiliados ---------- */
add_action('admin_menu', function () {
  add_submenu_page('woocommerce', 'Afiliados', 'Afiliados', 'manage_woocommerce', 'mvo-afiliados', 'mvo_af_admin');
});
add_action('admin_post_mvo_af', function () {
  if (!current_user_can('manage_woocommerce') || !check_admin_referer('mvo_af_admin')) wp_die('Sem permissão');
  $a = sanitize_key($_POST['a'] ?? ''); $uid = (int) ($_POST['uid'] ?? 0); $oid = (int) ($_POST['oid'] ?? 0);
  if ($a === 'taxa') update_option('mvo_af_taxa', max(0, min(90, (float) str_replace(',', '.', $_POST['taxa'] ?? 10))));
  if ($uid && in_array($a, ['ativo', 'inativo'], true)) {
    update_user_meta($uid, '_mvo_af_status', $a); mvo_af_codigo($uid);
    if ($a === 'ativo') {
      $l = get_user_meta($uid, '_mvo_notifs', true); if (!is_array($l)) $l = [];
      array_unshift($l, ['id' => uniqid('n', false), 'pedido' => 0, 'ic' => '🎉', 'txt' => 'Você foi aprovado como afiliado! Toque para pegar o seu link.', 'link' => wc_get_account_endpoint_url('afiliado'), 't' => time(), 'lida' => 0]);
      update_user_meta($uid, '_mvo_notifs', array_slice($l, 0, 40)); do_action('mvo_notif_nova', $uid);
    }
  }
  if ($oid && $a === 'paga' && ($o = wc_get_order($oid)) && $o->get_meta('_mvo_af_status') === 'aprovada') {
    $o->update_meta_data('_mvo_af_status', 'paga'); $o->update_meta_data('_mvo_af_pago_em', time()); $o->save();
    $o->add_order_note('Comissão do afiliado marcada como paga.');
  }
  wp_safe_redirect(admin_url('admin.php?page=mvo-afiliados')); exit;
});

function mvo_af_admin() {
  $btn = function ($a, $txt, $extra = '') {
    return '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" style="display:inline">' . wp_nonce_field('mvo_af_admin', '_wpnonce', true, false) . '<input type="hidden" name="action" value="mvo_af"><input type="hidden" name="a" value="' . esc_attr($a) . '">' . $extra . '<button class="button">' . esc_html($txt) . '</button></form>';
  };
  echo '<div class="wrap"><h1>Afiliados da loja</h1>';
  echo '<p>' . $btn('taxa', 'Salvar comissão', 'Comissão padrão: <input type="text" name="taxa" size="4" value="' . esc_attr(mvo_af_taxa()) . '">% do valor dos produtos (sem frete) ') . '</p>';
  echo '<p>O afiliado pede o cadastro em <b>Minha conta → Afiliado</b>. Aqui você aprova, pega a chave Pix e marca a comissão como paga depois de mandar o Pix. A comissão só fica "a pagar" quando o pedido está <b>Concluído</b> (entregue).</p>';
  $us = get_users(['meta_key' => '_mvo_af_status', 'meta_compare' => 'EXISTS']);
  if (!$us) { echo '<p><i>Nenhum afiliado ainda.</i></p></div>'; return; }
  echo '<table class="widefat striped"><thead><tr><th>Afiliado</th><th>Código</th><th>Situação</th><th>Pix</th><th>Cliques</th><th>Aguardando</th><th>A pagar</th><th>Pago</th><th></th></tr></thead><tbody>';
  $pagar = [];
  foreach ($us as $u) {
    $st = mvo_af_status($u->ID); $r = mvo_af_resumo($u->ID);
    foreach ($r['linhas'] as $l) if ($l['st'] === 'aprovada') $pagar[] = [$u, $l];
    $acao = $st === 'ativo' ? $btn('inativo', 'Pausar', '<input type="hidden" name="uid" value="' . $u->ID . '">') : $btn('ativo', 'Aprovar', '<input type="hidden" name="uid" value="' . $u->ID . '">');
    printf('<tr><td>%s<br><small>%s</small></td><td>%s</td><td>%s</td><td>%s</td><td>%d</td><td>%s</td><td><b>%s</b></td><td>%s</td><td>%s</td></tr>',
      esc_html($u->display_name), esc_html($u->user_email), esc_html(mvo_af_codigo($u->ID)), esc_html($st), esc_html(get_user_meta($u->ID, '_mvo_af_pix', true) ?: '—'),
      (int) get_user_meta($u->ID, '_mvo_af_cliques', true), mvo_af_brl($r['pendente']), mvo_af_brl($r['aprovada']), mvo_af_brl($r['paga']), $acao);
  }
  echo '</tbody></table>';
  echo '<h2>Comissões a pagar</h2>';
  if (!$pagar) echo '<p><i>Nada a pagar agora.</i></p>';
  else {
    echo '<table class="widefat striped"><thead><tr><th>Afiliado</th><th>Pix</th><th>Pedido</th><th>Comissão</th><th></th></tr></thead><tbody>';
    foreach ($pagar as [$u, $l]) printf('<tr><td>%s</td><td>%s</td><td><a href="%s">nº %s</a></td><td>%s</td><td>%s</td></tr>', esc_html($u->display_name), esc_html(get_user_meta($u->ID, '_mvo_af_pix', true) ?: '—'), esc_url($l['o']->get_edit_order_url()), esc_html($l['o']->get_order_number()), mvo_af_brl($l['v']), $btn('paga', 'Marcar como paga', '<input type="hidden" name="oid" value="' . $l['o']->get_id() . '">'));
    echo '</tbody></table>';
  }
  echo '</div>';
}

/* coluna no admin de pedidos: mostra a venda de afiliado */
add_action('woocommerce_admin_order_data_after_order_details', function ($o) {
  if (!$o->get_meta('_mvo_af_id')) return;
  $u = get_userdata((int) $o->get_meta('_mvo_af_id'));
  printf('<p class="form-field form-field-wide"><strong>💰 Afiliado:</strong> %s — comissão %s (%s)</p>', esc_html($u ? $u->display_name : '?'), mvo_af_brl($o->get_meta('_mvo_af_valor')), esc_html(mvo_af_rotulo($o->get_meta('_mvo_af_status'))));
});
