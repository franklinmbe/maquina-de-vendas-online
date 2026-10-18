<?php
// Página de volta depois do pagamento no Mercado Pago (Franklin, 2026-10-18).
wp_set_current_user(1);
kses_remove_filters();
$wa = 'https://wa.me/5521999059608?text=' . rawurlencode('Olá! Acabei de pagar o meu plano da Máquina de Vendas Online.');
$html = '<div class="mvo"><div class="final"><div class="wrap"><h2>🎉 Obrigado! Recebemos o seu pedido.</h2>'
  . '<p>Se você pagou com Pix ou cartão, o pagamento cai na hora. No boleto, leva até 3 dias úteis.</p>'
  . '<p>Agora chame a gente no WhatsApp: em seguida liberamos o seu acesso ao aplicativo Máquina de Vendas Online e já começamos o seu treinamento.</p>'
  . '<div class="btns"><a class="btn orange" href="' . esc_url($wa) . '" target="_blank" rel="noopener">💬 Falar no WhatsApp</a><a class="btn" href="' . esc_url(home_url('/')) . '">Voltar ao site</a></div></div></div></div>';
$page = get_page_by_path('obrigado');
$content = '<!-- wp:group {"align":"full","layout":{"type":"default"}} --><div class="wp-block-group alignfull"><!-- wp:html -->' . $html . '<!-- /wp:html --></div><!-- /wp:group -->';
$id = wp_insert_post(array('ID' => $page ? $page->ID : 0, 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Obrigado', 'post_name' => 'obrigado', 'post_content' => $content));
update_post_meta($id, '_wp_page_template', 'page-no-title');
echo "pagina: " . get_permalink($id) . "\n";
