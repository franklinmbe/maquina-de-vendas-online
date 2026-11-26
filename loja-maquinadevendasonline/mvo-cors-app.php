<?php
/**
 * Plugin Name: MVO – App lê a vitrine da loja
 * Description: Deixa o app (app.maquinadevendasonline.com.br) LER a lista pública de produtos da loja
 *   (/wp-json/wc/store/v1/products, só GET) para o celular da caixa amarela passar os produtos (Franklin, 26/11/2026).
 *   Só leitura pública, só para o endereço do app; nada de carrinho, pedido ou conta.
 */
if (!defined('ABSPATH')) exit;

add_filter('rest_pre_serve_request', function ($served, $result, $request) {
  $origem = $_SERVER['HTTP_ORIGIN'] ?? '';
  if ($origem !== 'https://app.maquinadevendasonline.com.br') return $served;
  if ($request->get_method() !== 'GET' || strpos($request->get_route(), '/wc/store/v1/products') !== 0) return $served;
  header('Access-Control-Allow-Origin: ' . $origem);
  header('Vary: Origin', false);
  return $served;
}, 20, 3);
