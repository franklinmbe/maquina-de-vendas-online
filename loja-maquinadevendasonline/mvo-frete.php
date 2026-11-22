<?php
/**
 * Plugin Name: MVO Frete por tipo de estoque
 * Description: Frete grátis para o cliente em tudo. Estoque físico: a loja paga o envio e o custo (cotação mais barata do Melhor Envio) fica gravado no pedido; na cidade do Rio também "Entrega imediata de motoboy — valor a combinar pelo WhatsApp". (Franklin, 22/11/2026)
 */

// Bairros a até ~2 km do centro de Madureira (base de envio). Calculado em 22/11/2026.
const MVO_BAIRROS_MOTO = array('madureira', 'oswaldo cruz', 'cascadura', 'turiacu', 'vaz lobo', 'campinho', 'cavalcanti', 'engenheiro leal');

function mvo_sem_acento($s) {
	return strtolower(remove_accents(trim((string) $s)));
}

// Bairro do CEP pela ViaCEP, guardado por 30 dias.
function mvo_bairro_do_cep($cep) {
	$cep = preg_replace('/\D/', '', (string) $cep);
	if (strlen($cep) !== 8) return '';
	$k = 'mvo_cep_' . $cep;
	$c = get_transient($k);
	if ($c !== false) return $c;
	$r = wp_remote_get("https://viacep.com.br/ws/$cep/json/", array('timeout' => 5));
	if (is_wp_error($r)) return '';
	$d = json_decode(wp_remote_retrieve_body($r), true);
	$out = (is_array($d) && empty($d['erro']) && ($d['localidade'] ?? '') === 'Rio de Janeiro') ? mvo_sem_acento($d['bairro'] ?? '') : '';
	set_transient($k, $out, 30 * DAY_IN_SECONDS);
	return $out;
}

add_filter('woocommerce_package_rates', function ($rates, $package) {
	$tem_fisico = false;
	foreach ($package['contents'] as $item) {
		$p = $item['data'];
		if ($p && $p->get_shipping_class() === 'estoque-fisico') { $tem_fisico = true; break; }
	}
	$gratis = array_filter($rates, function ($r) { return $r->get_method_id() === 'free_shipping'; });
	if (!$tem_fisico) {
		return $gratis ?: $rates;
	}
	// Regra de Franklin (22/11/2026): estoque físico também tem FRETE GRÁTIS para o cliente.
	// A loja paga o envio. Por trás, guarda a cotação MAIS BARATA do Melhor Envio para
	// saber o custo de frete de cada pedido (aparece no pedido, no painel).
	$me = array_filter($rates, function ($r) { return strpos($r->get_method_id(), 'melhor') === 0; });
	$custo = null; $servico = '';
	foreach ($me as $r) {
		$c = (float) $r->get_cost();
		if ($c > 0 && ($custo === null || $c < $custo)) { $custo = $c; $servico = $r->get_label(); }
	}
	if (function_exists('WC') && WC()->session) {
		WC()->session->set('mvo_custo_frete', $custo === null ? null : array('valor' => $custo, 'servico' => $servico));
	}
	$saida = array();
	$g = $gratis ? reset($gratis) : new WC_Shipping_Rate('mvo_gratis', 'Frete grátis', 0, array(), 'free_shipping');
	$g->set_label('Frete grátis');
	$saida[$g->get_id()] = $g;
	// Cidade do Rio: opção de motoboy imediato com valor combinado à parte (WhatsApp);
	// o cliente paga o motoboy (ou divide com a loja).
	if (mvo_bairro_do_cep($package['destination']['postcode'] ?? '')) {
		$saida['mvo_moto'] = new WC_Shipping_Rate('mvo_moto', 'Entrega imediata de motoboy (Rio de Janeiro) — valor a combinar pelo WhatsApp', 0, array(), 'mvo_moto');
	}
	return $saida;
}, 100, 2);

// Grava no pedido o custo de frete que a loja vai pagar.
add_action('woocommerce_checkout_create_order', function ($order) {
	$c = (function_exists('WC') && WC()->session) ? WC()->session->get('mvo_custo_frete') : null;
	if (is_array($c)) {
		$order->update_meta_data('_mvo_custo_frete', $c['valor']);
		$order->update_meta_data('_mvo_frete_servico', $c['servico']);
	}
});

// Mostra no pedido (painel) quanto vamos pagar de frete.
add_action('woocommerce_admin_order_data_after_shipping_address', function ($order) {
	$v = $order->get_meta('_mvo_custo_frete');
	if ($v === '') return;
	echo '<p><strong>Custo de frete (a loja paga):</strong> R$ ' . number_format((float) $v, 2, ',', '.') . ' — ' . esc_html($order->get_meta('_mvo_frete_servico')) . '</p>';
});
