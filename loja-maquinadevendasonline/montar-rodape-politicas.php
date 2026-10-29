<?php
// Rodapé com os dados do vendedor + Política de Privacidade e Trocas e Devoluções (Franklin, 2026-10-29).
// Loja vende no CPF até passar para a empresa (certificado, nota e Mercado Pago da empresa); aí trocar $doc por CNPJ.
wp_set_current_user(1);
kses_remove_filters();
$nome = 'Franklin Morais Bezerra';
$doc = 'CPF 075.899.597-07';
$cidade = 'Rio de Janeiro – RJ';
$email = 'franklinmbe@gmail.com';
$zap = '(21) 99905-9608';
$wa = 'https://wa.me/5521999059608';

function mvo_pagina($slug, $titulo, $html, $id_antigo = 0) {
	$page = get_page_by_path($slug);
	$content = '<!-- wp:html --><div class="mvo"><div class="wrap">' . $html . '</div></div><!-- /wp:html -->';
	$id = wp_insert_post(array('ID' => $page ? $page->ID : $id_antigo, 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => $titulo, 'post_name' => $slug, 'post_content' => $content));
	update_post_meta($id, '_wp_page_template', 'page-no-title');
	echo "$titulo: " . get_permalink($id) . "\n";
	return $id;
}

$contato = "<p><b>$nome</b> · $doc · $cidade<br>WhatsApp <a href=\"$wa\">$zap</a> · E-mail <a href=\"mailto:$email\">$email</a></p>";

$trocas = '<h1>Trocas e Devoluções</h1>'
	. '<h2>Desistência da compra (7 dias)</h2>'
	. '<p>Você pode desistir da compra em até <b>7 dias corridos</b> depois de receber o produto, sem precisar explicar o motivo (art. 49 do Código de Defesa do Consumidor). Devolvemos o valor total pago, inclusive o frete, pelo mesmo meio de pagamento.</p>'
	. '<h2>Produto com defeito ou diferente do anunciado</h2>'
	. '<p>Avise em até <b>90 dias</b> depois do recebimento. Você escolhe: troca por outro igual, devolução do dinheiro ou abatimento no preço. O custo do envio de volta é nosso.</p>'
	. '<h2>Produto que não chegou</h2>'
	. '<p>O prazo de entrega aparece na página de cada produto. Se passar do prazo, fale com a gente: acompanhamos o rastreio e, se o produto não for entregue, devolvemos o valor pago.</p>'
	. '<h2>Como pedir</h2>'
	. '<p>Mande o número do pedido e, se for defeito, fotos ou vídeo do produto, pelo WhatsApp ou e-mail abaixo. Respondemos com as instruções de devolução.</p>'
	. '<h2>Prazo do reembolso</h2>'
	. '<p>Na desistência, devolvemos o valor <b>de imediato</b>, assim que recebemos o seu pedido, como manda a lei (art. 49 do Código de Defesa do Consumidor e Decreto 7.962/2013). No Pix, o dinheiro volta na hora. No cartão de crédito, pedimos o estorno ao Mercado Pago na hora, e ele aparece na fatura conforme o prazo do seu banco.</p>'
	. '<h2>Contato</h2>' . $contato;

$privacidade = '<h1>Política de Privacidade</h1>'
	. '<p>Esta política explica quais dados pessoais coletamos na loja Máquina de Vendas Online e como usamos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>'
	. '<h2>Quem é o responsável</h2>' . $contato
	. '<h2>Quais dados coletamos</h2>'
	. '<p>Nome, CPF ou CNPJ, endereço de entrega, telefone, e-mail e os produtos comprados. Os dados do cartão são digitados direto no Mercado Pago: não temos acesso a eles.</p>'
	. '<h2>Para que usamos</h2>'
	. '<ul><li>Processar o pagamento e o pedido;</li><li>Entregar o produto e enviar o código de rastreio;</li><li>Atender trocas, devoluções e dúvidas;</li><li>Cumprir obrigações legais e fiscais.</li></ul>'
	. '<h2>Com quem compartilhamos</h2>'
	. '<ul><li><b>Mercado Pago</b>, para o pagamento;</li><li><b>Fornecedor e transportadora</b>, só o necessário para a entrega (nome, endereço, CPF e telefone).</li></ul>'
	. '<p>Não vendemos nem alugamos os seus dados.</p>'
	. '<h2>Cookies</h2>'
	. '<p>Usamos cookies para manter o carrinho e o login funcionando e para entender o uso da loja.</p>'
	. '<h2>Seus direitos</h2>'
	. '<p>Você pode pedir a qualquer momento para ver, corrigir ou apagar os seus dados, pelo WhatsApp ou e-mail acima. Dados de pedidos são guardados pelo prazo exigido pela lei fiscal.</p>';

$id_priv = mvo_pagina('politica-de-privacidade', 'Política de Privacidade', $privacidade, 3);
update_option('wp_page_for_privacy_policy', $id_priv);
$id_trocas = mvo_pagina('trocas-e-devolucoes', 'Trocas e Devoluções', $trocas, 9);
update_option('woocommerce_terms_page_id', $id_trocas);

$rodape = '<!-- wp:group {"tagName":"div","className":"mvo-rodape","layout":{"type":"constrained"}} --><div class="wp-block-group mvo-rodape"><!-- wp:html -->'
	. '<div style="text-align:center;padding:32px 16px;font-size:.92rem;line-height:1.6">'
	. '<p><a href="' . esc_url(home_url('/loja/')) . '">Loja</a> · <a href="' . esc_url(get_permalink($id_trocas)) . '">Trocas e Devoluções</a> · <a href="' . esc_url(get_permalink($id_priv)) . '">Política de Privacidade</a> · <a href="' . esc_url(home_url('/minha-conta/')) . '">Minha conta</a></p>'
	. $contato
	. '<p>🔒 Pagamento seguro pelo Mercado Pago · Pix, cartão e boleto · Frete grátis para todo o Brasil</p>'
	. '<p>© ' . date('Y') . ' Máquina de Vendas Online</p></div>'
	. '<!-- /wp:html --></div><!-- /wp:group -->';

$parte = get_posts(array('post_type' => 'wp_template_part', 'name' => 'footer', 'post_status' => 'any', 'numberposts' => 1, 'tax_query' => array(array('taxonomy' => 'wp_theme', 'field' => 'name', 'terms' => get_stylesheet()))));
$id = wp_insert_post(array('ID' => $parte ? $parte[0]->ID : 0, 'post_type' => 'wp_template_part', 'post_status' => 'publish', 'post_title' => 'Rodapé', 'post_name' => 'footer', 'post_content' => $rodape));
wp_set_object_terms($id, get_stylesheet(), 'wp_theme');
wp_set_object_terms($id, 'footer', 'wp_template_part_area');
echo "rodape: $id\n";
