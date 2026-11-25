<?php
/**
 * Plugin Name: MVO – Afiliados da loja (lucro dividido)
 * Description: Programa de afiliados próprio da loja. Modelo do Franklin (25/11/2026): o afiliado recebe
 *   METADE DO LUCRO LÍQUIDO de cada venda que trouxer (não % do preço). Lucro = valor pago pelos produtos
 *   (já com desconto) − 6% de imposto − ~5% do Mercado Pago − custo dos produtos (_mvo_custo) − frete que a
 *   loja paga (_mvo_custo_frete). Desconto: cupom com o código do afiliado, % definido pelo admin (até 10%);
 *   como o lucro é dividido meio a meio, o desconto sai metade de cada lado. Transparência: na área do
 *   afiliado aparece a tabela de produtos com preço, custo, lucro e a parte dele.
 *   Venda é do afiliado pelo cupom (prioridade) ou pelo link ?ref=CODIGO (30 dias). Comissão "pendente" até
 *   o pedido ser concluído (entregue) → "a receber" → admin marca "paga" depois do Pix. Cancelado = cancelada.
 */
if (!defined('ABSPATH')) exit;

const MVO_AF_DIAS = 30;
const MVO_AF_TAXAS = 0.11;      // 6% imposto + ~5% Mercado Pago
const MVO_AF_FALLBACK = 0.10;   // produto sem custo cadastrado: 10% do valor pago

function mvo_af_share() { return (float) get_option('mvo_af_share', 50); }
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

/* custo de um produto/variação (produto + imposto do fornecedor, sem frete) */
function mvo_af_custo_de($product_id, $variation_id = 0) {
  if ($variation_id) { $c = get_post_meta($variation_id, '_mvo_custo', true); if ($c !== '') return (float) $c; }
  $c = get_post_meta($product_id, '_mvo_custo', true);
  return $c === '' ? null : (float) $c;
}

/* lucro líquido de um valor pago, dado o custo */
function mvo_af_lucro($pago, $custo) { return $pago * (1 - MVO_AF_TAXAS) - $custo; }

/* calcula lucro e comissão de um pedido */
function mvo_af_calcular($order) {
  $lucro = 0; $extra = 0; $sem = 0;
  foreach ($order->get_items() as $item) {
    $pago = (float) $item->get_total(); // já com desconto do cupom
    $c = mvo_af_custo_de($item->get_product_id(), $item->get_variation_id());
    if ($c === null) { $extra += $pago * MVO_AF_FALLBACK; $sem++; continue; }
    $lucro += mvo_af_lucro($pago, $c * $item->get_quantity());
  }
  $lucro -= (float) $order->get_meta('_mvo_custo_frete'); // frete que a loja paga (estoque próprio)
  $share = mvo_af_share();
  return ['lucro' => round($lucro, 2), 'share' => $share, 'valor' => round(max(0, $lucro) * $share / 100 + $extra, 2), 'sem_custo' => $sem];
}

/* ---------- cupom do afiliado (desconto negociado com o admin, até 10%) ---------- */
function mvo_af_cupom($uid, $pct) {
  $pct = max(0, min(10, (float) $pct));
  update_user_meta($uid, '_mvo_af_cupom_pct', $pct);
  $code = strtoupper(mvo_af_codigo($uid));
  $id = wc_get_coupon_id_by_code($code);
  $cp = new WC_Coupon($id ?: 0);
  $cp->set_code($code);
  $cp->set_discount_type('percent');
  $cp->set_amount($pct);
  $cp->set_individual_use(true);
  $cp->set_description('Cupom do afiliado ' . get_userdata($uid)->display_name . ' (lucro dividido)');
  $cp->update_meta_data('_mvo_af_uid', $uid);
  $cp->set_status($pct > 0 && mvo_af_status($uid) === 'ativo' ? 'publish' : 'draft');
  $cp->save();
  return $code;
}
function mvo_af_por_cupom($order) {
  foreach ($order->get_coupon_codes() as $code) {
    $id = wc_get_coupon_id_by_code($code); if (!$id) continue;
    $uid = (int) get_post_meta($id, '_mvo_af_uid', true);
    if ($uid && mvo_af_status($uid) === 'ativo') return $uid;
  }
  return 0;
}

/* ---------- 1. guarda quem indicou (link ?ref=CODIGO) ---------- */
add_action('init', function () {
  if (is_admin() || empty($_GET['ref'])) return;
  $uid = mvo_af_por_codigo(wp_unslash($_GET['ref']));
  if (!$uid || mvo_af_status($uid) !== 'ativo') return;
  if (is_user_logged_in() && get_current_user_id() === $uid) return;
  setcookie('mvo_ref', (string) $uid, time() + MVO_AF_DIAS * DAY_IN_SECONDS, COOKIEPATH ?: '/', COOKIE_DOMAIN, is_ssl(), true);
  $_COOKIE['mvo_ref'] = (string) $uid;
  update_user_meta($uid, '_mvo_af_cliques', (int) get_user_meta($uid, '_mvo_af_cliques', true) + 1);
});

/* ---------- 2. marca o pedido com o afiliado e calcula a comissão ---------- */
function mvo_af_marcar_pedido($order) {
  if (!$order instanceof WC_Order || $order->get_meta('_mvo_af_id')) return;
  $uid = mvo_af_por_cupom($order) ?: (int) ($_COOKIE['mvo_ref'] ?? 0);
  if (!$uid || mvo_af_status($uid) !== 'ativo') return;
  $af = get_userdata($uid); if (!$af) return;
  if ((int) $order->get_customer_id() === $uid) return;
  if (strcasecmp((string) $order->get_billing_email(), (string) $af->user_email) === 0) return;
  $r = mvo_af_calcular($order);
  $order->update_meta_data('_mvo_af_id', $uid);
  $order->update_meta_data('_mvo_af_modelo', 'lucro');
  $order->update_meta_data('_mvo_af_taxa', $r['share']);
  $order->update_meta_data('_mvo_af_lucro', $r['lucro']);
  $order->update_meta_data('_mvo_af_valor', $r['valor']);
  $order->update_meta_data('_mvo_af_status', 'pendente');
  $order->save();
  $l = get_user_meta($uid, '_mvo_af_pedidos', true); if (!is_array($l)) $l = [];
  if (!in_array($order->get_id(), $l, true)) { $l[] = $order->get_id(); update_user_meta($uid, '_mvo_af_pedidos', $l); }
  $order->add_order_note(sprintf('Venda de afiliado: %s (%s). Lucro %s, parte do afiliado %s%% = %s.%s', $af->display_name, mvo_af_codigo($uid), mvo_af_brl($r['lucro']), $r['share'], mvo_af_brl($r['valor']), $r['sem_custo'] ? ' (' . $r['sem_custo'] . ' item sem custo cadastrado: 10% do valor)' : ''));
  if (function_exists('mvo_notif_add')) {
    mvo_notif_add($uid, $order, sprintf('💰 Venda sua! Pedido nº %s, sua parte do lucro: %s (libera depois da entrega).', $order->get_order_number(), mvo_af_brl($r['valor'])), '💰', wc_get_account_endpoint_url('afiliado'));
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
      mvo_notif_add((int) $order->get_meta('_mvo_af_id'), $order, sprintf('✅ Sua parte de %s foi liberada (pedido nº %s entregue). Vai para o seu Pix.', mvo_af_brl($order->get_meta('_mvo_af_valor')), $order->get_order_number()), '✅', wc_get_account_endpoint_url('afiliado'));
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
    $r['linhas'][] = ['o' => $o, 'st' => $st, 'v' => $v, 'lucro' => $o->get_meta('_mvo_af_lucro')];
  }
  return $r;
}
function mvo_af_rotulo($st) {
  return ['pendente' => '⏳ aguardando entrega', 'aprovada' => '💵 a receber', 'paga' => '✅ paga', 'cancelada' => '❌ cancelada'][$st] ?? $st;
}

/* tabela de produtos com preço, custo, lucro e a parte do afiliado (transparência) */
function mvo_af_tabela_produtos($pct_desc, $cod = '') {
  $share = mvo_af_share();
  $h = '<p><input type="text" id="mvoAfBusca" placeholder="🔎 Procurar produto" style="width:100%"></p><div style="overflow-x:auto"><table id="mvoAfTab"><tr><th>Produto</th><th>Preço</th><th>Custo</th><th>Lucro da venda</th><th>Sua parte (' . $share . '%)</th>' . ($pct_desc > 0 ? '<th>Com seu cupom (' . $pct_desc . '%)</th>' : '') . '</tr>';
  foreach (wc_get_products(['status' => 'publish', 'limit' => -1, 'orderby' => 'title', 'order' => 'ASC']) as $p) {
    $ops = $p->is_type('variable') ? array_filter(array_map('wc_get_product', $p->get_children())) : [$p];
    $min = null;
    foreach ($ops as $v) {
      $c = mvo_af_custo_de($p->get_id(), $v->is_type('variation') ? $v->get_id() : 0);
      $preco = (float) $v->get_price();
      if ($c === null || $preco <= 0) continue;
      if ($min === null || $preco < $min['preco']) $min = ['preco' => $preco, 'custo' => $c];
    }
    if (!$min) continue;
    $lucro = mvo_af_lucro($min['preco'], $min['custo']);
    $comDesc = $pct_desc > 0 ? max(0, mvo_af_lucro($min['preco'] * (1 - $pct_desc / 100), $min['custo'])) * $share / 100 : 0;
    $h .= sprintf('<tr><td><a href="%s">%s</a>%s</td><td>%s</td><td>%s</td><td>%s</td><td><b>%s</b></td>%s</tr>',
      esc_url(($cod ? add_query_arg('ref', $cod, get_permalink($p->get_id())) : get_permalink($p->get_id()))), esc_html(mb_strimwidth($p->get_name(), 0, 60, '…')), count($ops) > 1 ? ' <small>(a partir de)</small>' : '',
      mvo_af_brl($min['preco']), mvo_af_brl($min['custo']), mvo_af_brl($lucro), mvo_af_brl(max(0, $lucro) * $share / 100), $pct_desc > 0 ? '<td>' . mvo_af_brl($comDesc) . '</td>' : '');
  }
  $h .= '</table></div><p><small>Lucro = preço − 6% de imposto − ~5% do Mercado Pago − custo do produto. Produtos do AliExpress já incluem o frete no custo; nos de estoque próprio o frete da entrega também sai do lucro.</small></p>';
  $h .= '<script>(function(){var b=document.getElementById("mvoAfBusca"),t=document.getElementById("mvoAfTab");if(!b)return;b.addEventListener("input",function(){var q=b.value.toLowerCase();[].slice.call(t.rows,1).forEach(function(r){r.style.display=r.textContent.toLowerCase().indexOf(q)>-1?"":"none";});});})();</script>';
  return $h;
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
  $uid = get_current_user_id(); $st = mvo_af_status($uid); $share = mvo_af_share();
  $pix = get_user_meta($uid, '_mvo_af_pix', true);
  echo '<style>.mvo-af{display:grid;gap:14px}.mvo-af .cx{border:1px solid rgba(51,214,203,.35);border-radius:14px;padding:14px}.mvo-af .tot{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.mvo-af .tot div{border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:10px;text-align:center}.mvo-af .tot b{display:block;font-size:1.2rem}.mvo-af input[type=text]{width:100%}.mvo-af table{width:100%;font-size:.88rem}.mvo-af td,.mvo-af th{padding:4px 6px;text-align:left}</style><div class="mvo-af">';
  $form_pix = '<label>Sua chave Pix (para receber)<input type="text" name="pix" value="' . esc_attr($pix) . '" placeholder="CPF, e-mail, telefone ou chave aleatória"></label>';
  $nonce = wp_nonce_field('mvo_af_conta', '_mvo_af', true, false);
  $explica = sprintf('<p><b>Lucro dividido meio a meio:</b> em cada venda que você trouxer, o lucro líquido (depois de tirar o custo do produto, o frete, os impostos e a taxa do pagamento) é dividido: <b>%s%% para você</b> e o resto para a loja. Você vê abaixo quanto custa cada produto e quanto você ganha. Pago no Pix depois que o pedido é entregue.</p>', rtrim(rtrim(number_format($share, 2, ',', ''), '0'), ','));
  if (!$st) {
    printf('<div class="cx"><h3>Ganhe metade do lucro de cada venda</h3>%s<p>Você recebe um link e um cupom da loja. Não precisa ter estoque nem CNPJ.</p><form method="post">%s%s<input type="hidden" name="mvo_af_acao" value="entrar"><p><button class="button" type="submit">Quero ser afiliado</button></p></form></div>', $explica, $nonce, $form_pix);
  } elseif ($st === 'pendente') {
    printf('<div class="cx"><h3>⏳ Pedido recebido</h3><p>A loja vai aprovar o seu cadastro de afiliado. Você recebe o aviso no sininho 🔔.</p><form method="post">%s%s<input type="hidden" name="mvo_af_acao" value="pix"><p><button class="button" type="submit">Salvar Pix</button></p></form></div>', $nonce, $form_pix);
  } elseif ($st === 'inativo') {
    echo '<div class="cx"><h3>Cadastro de afiliado pausado</h3><p>Fale com a loja para reativar.</p></div>';
  } else {
    $cod = mvo_af_codigo($uid); $link = add_query_arg('ref', $cod, home_url('/')); $r = mvo_af_resumo($uid);
    $pct = (float) get_user_meta($uid, '_mvo_af_cupom_pct', true);
    printf('<div class="cx"><h3>Seu link e seu cupom</h3>%s<p><input type="text" readonly value="%s" onclick="this.select()"></p><p class="small">Também vale em qualquer produto: cole o link do produto abaixo.</p><p><input type="text" id="mvoAfProd" placeholder="Cole aqui o link de um produto da loja"></p><p><input type="text" id="mvoAfOut" readonly onclick="this.select()" placeholder="Seu link do produto aparece aqui"></p><p>%s Cliques no seu link: <b>%d</b>.</p></div>',
      $explica, esc_attr($link), $pct > 0 ? 'Seu cupom: <b>' . esc_html(strtoupper($cod)) . '</b> dá <b>' . esc_html($pct) . '% de desconto</b> ao cliente (o desconto sai metade da sua parte, metade da loja) e conta a venda para você mesmo sem o link.' : 'Cupom de desconto: combine com a loja (até 10%).', (int) get_user_meta($uid, '_mvo_af_cliques', true));
    printf('<div class="tot"><div>Aguardando entrega<b>%s</b></div><div>A receber<b>%s</b></div><div>Já pago<b>%s</b></div></div>', mvo_af_brl($r['pendente']), mvo_af_brl($r['aprovada']), mvo_af_brl($r['paga']));
    echo '<div class="cx"><h3>Suas vendas</h3>';
    if (!$r['linhas']) echo '<p>Nenhuma venda ainda. Divulgue o seu link! 🚀</p>';
    else {
      echo '<table><tr><th>Data</th><th>Pedido</th><th>Lucro da venda</th><th>Sua parte</th><th>Situação</th></tr>';
      foreach ($r['linhas'] as $l) printf('<tr><td>%s</td><td>nº %s</td><td>%s</td><td><b>%s</b></td><td>%s</td></tr>', esc_html(wc_format_datetime($l['o']->get_date_created(), 'd/m/Y')), esc_html($l['o']->get_order_number()), $l['lucro'] !== '' ? mvo_af_brl($l['lucro']) : '—', mvo_af_brl($l['v']), esc_html(mvo_af_rotulo($l['st'])));
      echo '</table>';
    }
    echo '</div><div class="cx"><h3>📊 Produtos: quanto custa e quanto você ganha</h3>' . mvo_af_tabela_produtos($pct, $cod) . '</div>';
    printf('<div class="cx"><form method="post">%s%s<input type="hidden" name="mvo_af_acao" value="pix"><p><button class="button" type="submit">Salvar Pix</button></p></form></div>', $nonce, $form_pix);
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
  if ($a === 'share') update_option('mvo_af_share', max(10, min(90, (float) str_replace(',', '.', $_POST['share'] ?? 50))));
  if ($uid && in_array($a, ['ativo', 'inativo'], true)) {
    update_user_meta($uid, '_mvo_af_status', $a); mvo_af_codigo($uid);
    mvo_af_cupom($uid, (float) get_user_meta($uid, '_mvo_af_cupom_pct', true));
    if ($a === 'ativo') {
      $l = get_user_meta($uid, '_mvo_notifs', true); if (!is_array($l)) $l = [];
      array_unshift($l, ['id' => uniqid('n', false), 'pedido' => 0, 'ic' => '🎉', 'txt' => 'Você foi aprovado como afiliado! Toque para pegar o seu link e ver quanto ganha em cada produto.', 'link' => wc_get_account_endpoint_url('afiliado'), 't' => time(), 'lida' => 0]);
      update_user_meta($uid, '_mvo_notifs', array_slice($l, 0, 40)); do_action('mvo_notif_nova', $uid);
    }
  }
  if ($uid && $a === 'cupom') mvo_af_cupom($uid, (float) str_replace(',', '.', $_POST['pct'] ?? 0));
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
  echo '<div class="wrap"><h1>Afiliados da loja — lucro dividido</h1>';
  echo '<p>' . $btn('share', 'Salvar', 'Parte do afiliado: <input type="text" name="share" size="3" value="' . esc_attr(mvo_af_share()) . '">% do lucro líquido de cada venda ') . '</p>';
  echo '<p>Lucro = valor pago pelos produtos − 6% imposto − ~5% Mercado Pago − custo dos produtos − frete que a loja paga. O afiliado pede o cadastro em <b>Minha conta → Afiliado</b>; aqui você aprova, define o cupom de desconto dele (0 a 10%) e marca a comissão como paga depois do Pix. A comissão só fica "a pagar" quando o pedido está <b>Concluído</b>.</p>';
  $us = get_users(['meta_key' => '_mvo_af_status', 'meta_compare' => 'EXISTS']);
  if (!$us) { echo '<p><i>Nenhum afiliado ainda.</i></p></div>'; return; }
  echo '<table class="widefat striped"><thead><tr><th>Afiliado</th><th>Código / cupom</th><th>Situação</th><th>Pix</th><th>Cliques</th><th>Aguardando</th><th>A pagar</th><th>Pago</th><th>Desconto do cupom</th><th></th></tr></thead><tbody>';
  $pagar = [];
  foreach ($us as $u) {
    $st = mvo_af_status($u->ID); $r = mvo_af_resumo($u->ID);
    foreach ($r['linhas'] as $l) if ($l['st'] === 'aprovada') $pagar[] = [$u, $l];
    $h = '<input type="hidden" name="uid" value="' . $u->ID . '">';
    $acao = $st === 'ativo' ? $btn('inativo', 'Pausar', $h) : $btn('ativo', 'Aprovar', $h);
    $cup = $btn('cupom', 'OK', $h . '<input type="text" name="pct" size="2" value="' . esc_attr((float) get_user_meta($u->ID, '_mvo_af_cupom_pct', true)) . '">% ');
    printf('<tr><td>%s<br><small>%s</small></td><td>%s / %s</td><td>%s</td><td>%s</td><td>%d</td><td>%s</td><td><b>%s</b></td><td>%s</td><td>%s</td><td>%s</td></tr>',
      esc_html($u->display_name), esc_html($u->user_email), esc_html(mvo_af_codigo($u->ID)), esc_html(strtoupper(mvo_af_codigo($u->ID))), esc_html($st), esc_html(get_user_meta($u->ID, '_mvo_af_pix', true) ?: '—'),
      (int) get_user_meta($u->ID, '_mvo_af_cliques', true), mvo_af_brl($r['pendente']), mvo_af_brl($r['aprovada']), mvo_af_brl($r['paga']), $cup, $acao);
  }
  echo '</tbody></table>';
  echo '<h2>Comissões a pagar</h2>';
  if (!$pagar) echo '<p><i>Nada a pagar agora.</i></p>';
  else {
    echo '<table class="widefat striped"><thead><tr><th>Afiliado</th><th>Pix</th><th>Pedido</th><th>Lucro da venda</th><th>Parte do afiliado</th><th></th></tr></thead><tbody>';
    foreach ($pagar as [$u, $l]) printf('<tr><td>%s</td><td>%s</td><td><a href="%s">nº %s</a></td><td>%s</td><td><b>%s</b></td><td>%s</td></tr>', esc_html($u->display_name), esc_html(get_user_meta($u->ID, '_mvo_af_pix', true) ?: '—'), esc_url($l['o']->get_edit_order_url()), esc_html($l['o']->get_order_number()), $l['lucro'] !== '' ? mvo_af_brl($l['lucro']) : '—', mvo_af_brl($l['v']), $btn('paga', 'Marcar como paga', '<input type="hidden" name="oid" value="' . $l['o']->get_id() . '">'));
    echo '</tbody></table>';
  }
  echo '</div>';
}

add_action('woocommerce_admin_order_data_after_order_details', function ($o) {
  if (!$o->get_meta('_mvo_af_id')) return;
  $u = get_userdata((int) $o->get_meta('_mvo_af_id'));
  printf('<p class="form-field form-field-wide"><strong>💰 Afiliado:</strong> %s — lucro %s, parte dele %s (%s)</p>', esc_html($u ? $u->display_name : '?'), mvo_af_brl($o->get_meta('_mvo_af_lucro')), mvo_af_brl($o->get_meta('_mvo_af_valor')), esc_html(mvo_af_rotulo($o->get_meta('_mvo_af_status'))));
});

/* ---------- 6. Página pública /afiliados (Franklin, 25/11/2026) ----------
 * Convite + cadastro de afiliado sem precisar de conta na loja: cria o usuário (cliente), marca como afiliado
 * "pendente" (o admin aprova), entra logado e vai para Minha conta → Afiliado. Já logado: vai direto. */
add_action('template_redirect', function () {
  $path = trim((string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
  if ($path !== 'afiliados') return;
  $erro = '';
  if (is_user_logged_in()) { wp_safe_redirect(wc_get_account_endpoint_url('afiliado')); exit; }
  if (!empty($_POST['mvo_af_novo']) && wp_verify_nonce($_POST['_mvo_afn'] ?? '', 'mvo_af_novo')) {
    $nome = sanitize_text_field(wp_unslash($_POST['nome'] ?? ''));
    $email = sanitize_email(wp_unslash($_POST['email'] ?? ''));
    $zap = preg_replace('/\D/', '', (string) ($_POST['whats'] ?? ''));
    $pix = sanitize_text_field(wp_unslash($_POST['pix'] ?? ''));
    $senha = (string) ($_POST['senha'] ?? '');
    if (!$nome || !is_email($email) || strlen($zap) < 10 || strlen($senha) < 6) $erro = 'Preencha nome, e-mail, WhatsApp com DDD e uma senha de pelo menos 6 caracteres.';
    elseif (email_exists($email)) $erro = 'Esse e-mail já tem conta na loja. Entre na sua conta e vá em Minha conta → Afiliado.';
    else {
      $uid = wc_create_new_customer($email, '', $senha, ['first_name' => $nome]);
      if (is_wp_error($uid)) $erro = $uid->get_error_message();
      else {
        wp_update_user(['ID' => $uid, 'display_name' => $nome, 'first_name' => $nome]);
        update_user_meta($uid, 'billing_phone', $zap);
        if ($pix) update_user_meta($uid, '_mvo_af_pix', $pix);
        update_user_meta($uid, '_mvo_af_status', 'pendente'); update_user_meta($uid, '_mvo_af_desde', time()); mvo_af_codigo($uid);
        wp_mail(get_option('admin_email'), 'Novo afiliado: ' . $nome, "Nome: $nome\nE-mail: $email\nWhatsApp: $zap\nAprovar em: " . admin_url('admin.php?page=mvo-afiliados'));
        wc_set_customer_auth_cookie($uid);
        wp_safe_redirect(wc_get_account_endpoint_url('afiliado')); exit;
      }
    }
  }
  status_header(200); nocache_headers();
  global $wp_query; if ($wp_query) { $wp_query->is_404 = false; $wp_query->is_page = true; }
  add_filter('pre_get_document_title', fn() => 'Seja nosso afiliado e ganhe comissões – Máquina de Vendas Online', 99);
  add_filter('body_class', fn($c) => array_diff($c, ['error404']));
  get_header();
  $share = rtrim(rtrim(number_format(mvo_af_share(), 2, ',', ''), '0'), ',');
  ?>
  <div class="mvo-afp" style="max-width:680px;margin:24px auto;padding:0 16px">
    <style>.mvo-afp .hero{border:2px solid #FFD93D;border-radius:18px;padding:20px;text-align:center;box-shadow:0 0 18px rgba(255,217,61,.35)}.mvo-afp h1{font-size:1.6rem;margin:0 0 6px}.mvo-afp .cx{border:1px solid rgba(127,127,127,.35);border-radius:14px;padding:14px;margin-top:14px}.mvo-afp input{width:100%;margin:4px 0 10px;padding:10px;border-radius:10px}.mvo-afp button{width:100%;padding:14px;border:0;border-radius:12px;font-weight:800;font-size:1rem;background:linear-gradient(180deg,#FFF0A3 0%,#FFE14D 55%,#FFD000 100%);color:#2D3277;cursor:pointer}.mvo-afp .err{background:#ffe1df;color:#8a1c14;padding:10px;border-radius:10px}</style>
    <div class="hero">
      <h1>💰 Seja nosso afiliado e ganhe comissões</h1>
      <p>Conheça a nossa loja: <b>produtos nacionais e importados</b> com frete grátis. Revenda os nossos produtos e ganhe <b><?php echo esc_html($share); ?>% do lucro</b> de cada venda que você trouxer.</p>
    </div>
    <div class="cx"><h3>Como funciona</h3><ol>
      <li>Você se cadastra aqui e a loja aprova (aviso no sininho 🔔).</li>
      <li>Recebe o seu <b>link</b> e o seu <b>cupom</b> com o seu nome.</li>
      <li>Vê a tabela de produtos com <b>preço, custo, lucro e quanto você ganha</b> em cada um.</li>
      <li>Divulga nas suas redes; o cliente compra pela loja e a gente entrega.</li>
      <li>O lucro de cada venda (depois de custo, frete, impostos e taxa) é <b>dividido meio a meio</b>. A sua parte cai no seu Pix depois da entrega.</li>
    </ol><p>Sem estoque, sem CNPJ, sem embalar nem enviar.</p></div>
    <div class="cx"><h3>Quero ser afiliado</h3>
      <?php if ($erro) echo '<p class="err">' . esc_html($erro) . '</p>'; ?>
      <form method="post"><?php wp_nonce_field('mvo_af_novo', '_mvo_afn'); ?>
        <label>Seu nome<input type="text" name="nome" required value="<?php echo esc_attr($_POST['nome'] ?? ''); ?>"></label>
        <label>E-mail<input type="email" name="email" required value="<?php echo esc_attr($_POST['email'] ?? ''); ?>"></label>
        <label>WhatsApp com DDD<input type="tel" name="whats" required value="<?php echo esc_attr($_POST['whats'] ?? ''); ?>"></label>
        <label>Chave Pix (para receber)<input type="text" name="pix" value="<?php echo esc_attr($_POST['pix'] ?? ''); ?>"></label>
        <label>Crie uma senha<input type="password" name="senha" required minlength="6"></label>
        <input type="hidden" name="mvo_af_novo" value="1">
        <button type="submit">Quero ser afiliado e ganhar comissões</button>
      </form>
      <p style="text-align:center;margin-top:10px"><small>Já tem conta na loja? <a href="<?php echo esc_url(wc_get_account_endpoint_url('afiliado')); ?>">Entre aqui</a> e vá em Afiliado.</small></p>
    </div>
  </div>
  <?php
  get_footer();
  exit;
});
