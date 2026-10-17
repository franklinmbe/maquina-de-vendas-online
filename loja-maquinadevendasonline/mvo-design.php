<?php
/*
Plugin Name: MVO Design
Description: Visual da Máquina de Vendas Online (mesmo das páginas de plano do app) em todo o site.
*/
add_action('wp_enqueue_scripts', function () {
	$f = __DIR__ . '/mvo-design.css';
	wp_enqueue_style('mvo-design', content_url('mu-plugins/mvo-design.css'), array(), file_exists($f) ? filemtime($f) : null);
}, 99);
