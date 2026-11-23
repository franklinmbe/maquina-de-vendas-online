<?php
/**
 * 23/11/2026 — Cadastra os 11 produtos que o Franklin comprou no AliExpress
 * (fornecedor = AliExpress, classe de frete "drop") e organiza as categorias
 * no padrão de marketplace (AliExpress), sem apagar nenhuma categoria.
 *
 * Regra de preço (Franklin, 23/11): base = custo + imposto; margem POR CIMA:
 *   custo até R$50 -> +100% | R$50 a R$100 -> +60% | acima de R$100 -> +50%.
 *   Imposto embutido no preço (cliente não vê). Preço = custo*fator/(1-imposto),
 *   arredondado para cima no final ,90.
 * Rodar: wploja eval-file /var/www/html/import/cadastrar-aliexpress-20261123.php
 * Pode rodar de novo: atualiza pelo SKU, não duplica.
 */
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

const MVO_IMPOSTO = 0.06; // PROVISÓRIO: federais do Lucro Presumido (comércio). Ajustar quando fecharmos a parte da nota.

function mvo_fator($custo) { return $custo <= 50 ? 2.0 : ($custo <= 100 ? 1.6 : 1.5); }
function mvo_preco($custo) {
  $p = $custo * mvo_fator($custo) / (1 - MVO_IMPOSTO);
  $p90 = floor($p) + 0.90;
  if ($p90 < $p - 0.0001) $p90 += 1;
  return number_format($p90, 2, '.', '');
}

/* ---------- categorias (renomeia / move / cria; nunca apaga) ---------- */
function mvo_cat($nome, $pai = 0, $slug = null) {
  $t = get_term_by('name', $nome, 'product_cat');
  if ($t && (int)$t->parent === (int)$pai) return (int)$t->term_id;
  $r = wp_insert_term($nome, 'product_cat', array_filter(['parent' => $pai, 'slug' => $slug]));
  if (is_wp_error($r)) { $id = $r->get_error_data('term_exists'); if ($id) return (int)$id; WP_CLI::error($r->get_error_message()); }
  return (int)$r['term_id'];
}
function mvo_mexe($id, $nome, $pai = 0) {
  wp_update_term($id, 'product_cat', ['name' => $nome, 'parent' => $pai]);
  return $id;
}

$auto   = mvo_mexe(38, 'Automóveis e Motos');
$motos  = mvo_cat('Peças e Acessórios para Motos', $auto);
$luz    = mvo_mexe(40, 'Luzes e Iluminação', 0);
$luzDec = mvo_cat('Luzes Decorativas', $luz);
$luzExt = mvo_cat('Iluminação Externa', $luz);
$casa   = mvo_mexe(39, 'Casa e Jardim');
$moda   = mvo_mexe(37, 'Moda e Acessórios');
$oculos = mvo_cat('Óculos de Sol', $moda);
$relog  = 31;
$smart  = mvo_cat('Smartwatches', $relog);
$eletr  = 25;
$fones  = 28;
$cel    = mvo_cat('Celulares e Acessórios', 0);
$celAc  = mvo_cat('Acessórios para Celular', $cel);
$comp   = mvo_cat('Computador e Escritório', 0);
$mouse  = mvo_cat('Mouses e Teclados', $comp);
$esport = mvo_cat('Esportes e Lazer', 0);
mvo_mexe(19, 'Academia e Fitness', $esport);
mvo_mexe(35, 'Beleza e Saúde');

/* ---------- produtos ---------- */
$P = [
 ['ali'=>'1005008647127673','pedido'=>'8217067199274456','custo'=>10.96,'cat'=>[$moda,$oculos],'peso'=>0.1,'dim'=>[16,7,5],
  'nome'=>'Óculos de Sol Polarizado com Proteção UV – Dia e Noite',
  'img'=>'https://ae-pic-a1.aliexpress-media.com/kf/Sd6e2f9f7455746c58997fc5ece850bc93.jpg',
  'desc'=>'Óculos de sol polarizado, que reduz o reflexo e cansa menos a vista. Proteção UV e lentes resistentes a arranhões. Serve para o dia e para a noite (dirigir, praia, moto). Cor: preto.'],
 ['ali'=>'1005007219248618','pedido'=>'8217067199234456','custo'=>21.47,'cat'=>[$auto,$motos],'peso'=>0.15,'dim'=>[20,10,4],
  'nome'=>'Pisca LED Sequencial para Moto 12V (par) – Amarelo',
  'img'=>'https://ae-pic-a1.aliexpress-media.com/kf/Sb413d01c3f3a4c9690f91b0ddbfa4bf6w.jpg',
  'desc'=>'Par de piscas de LED para moto, com efeito sequencial (luz "correndo") e função de luz diurna. Ligação 12V. Cor da luz: amarelo. Vem 2 peças.'],
 ['ali'=>'1005010272750467','pedido'=>'8217067199254456','custo'=>13.99,'cat'=>[$eletr,$fones],'peso'=>0.1,'dim'=>[12,9,4],
  'nome'=>'Fone de Ouvido Bluetooth 5.4 com Gancho de Orelha e Microfone',
  'img'=>'https://ae-pic-a1.aliexpress-media.com/kf/S1d5d91b0d2214d89ac389dc3324707f9Z.jpg',
  'desc'=>'Fone sem fio Bluetooth 5.4 com gancho de orelha, que fica firme. Tem microfone para atender ligações com as mãos livres e redução de ruído. Bom para dirigir, trabalhar e treinar.'],
 ['ali'=>'1005012993555792','pedido'=>'8217067199134456','custo'=>23.72,'cat'=>[$luz,$luzDec],'peso'=>0.15,'dim'=>[12,8,8],
  'nome'=>'Projetor de Luz LED USB de Natal – 4 Desenhos',
  'img'=>'https://ae-pic-a1.aliexpress-media.com/kf/A26dc057bdf6c4028998695555f492032A.jpg',
  'desc'=>'Projetor de luz LED com entrada USB que projeta desenhos de Natal no teto e na parede. Kit com 4 desenhos que se trocam. Ótimo para decoração de festa, quarto e sala.'],
 ['ali'=>'1005005307917892','pedido'=>'8216870370464456','custo'=>133.87,'cat'=>[$auto,$motos],'peso'=>0.4,'dim'=>[15,15,8],
  'nome'=>'Tampa do Tanque com Chave para Kawasaki (Z800, Ninja ZX-6R, ER-4N)',
  'img'=>'https://ae-pic-a1.aliexpress-media.com/kf/S5e846e2c15af42d29fb1230ec43975cbc.jpg',
  'desc'=>'Tampa do tanque de combustível com chaves, para motos Kawasaki. Compatível com: ER-4N/ER400 (2011–2013), Ninja ZX-6R/ZX636 (2007–2014), ZX600 (2007–2008) e Z800 (2013–2014). Confira o modelo e o ano da sua moto antes de comprar.'],
 ['ali'=>'1005013034403258','pedido'=>'8216870370424456','custo'=>21.37,'cat'=>[$luz,$luzDec],'peso'=>0.15,'dim'=>[10,10,10],
  'nome'=>'Mini Projetor Galáxia USB 360° – 15 Desenhos',
  'img'=>'https://ae-pic-a1.aliexpress-media.com/kf/S8f722c7a271349749bd6711111cd1e5aR.png',
  'desc'=>'Mini projetor de luz noturna USB que transforma o quarto num céu estrelado de galáxia. Gira 360°, ajustável, com 15 desenhos. Cor: preto. Para quarto, sala gamer e festas.'],
 ['ali'=>'1005009896873428','pedido'=>'8216870370444456','custo'=>144.61,'cat'=>[$relog,$smart],'peso'=>0.25,'dim'=>[12,10,8],
  'nome'=>'Relógio Inteligente LIGE Esportivo 2.01" HD – Dourado',
  'img'=>'https://ae-pic-a1.aliexpress-media.com/kf/S217846a22d104ba3a78fdea92b7494adk.jpg',
  'desc'=>'Smartwatch LIGE esportivo com tela HD de 2.01 polegadas. Faz e atende ligações pelo relógio e acompanha seus exercícios. Pulseira de aço dourada, com lanterna LED.'],
 ['ali'=>'1005010661063682','pedido'=>'8217067199214456','custo'=>28.01,'cat'=>[$cel,$celAc],'peso'=>0.35,'dim'=>[33,22,5],
  'nome'=>'Ampliador de Tela 3D para Celular 12" Dobrável',
  'img'=>'https://ae-pic-a1.aliexpress-media.com/kf/Sfcab2e784e514377a13460282397af73E.jpg',
  'desc'=>'Ampliador de tela para celular de 12 polegadas (30,48 cm), com efeito 3D. Dobrável e fácil de levar. Coloque o celular atrás da lente e assista filmes, vídeos e jogos numa imagem maior. Cor: preto.'],
 ['ali'=>'1005010739044059','pedido'=>'8217067199194456','custo'=>18.28,'cat'=>[$comp,$mouse],'peso'=>0.15,'dim'=>[15,10,6],
  'nome'=>'Mouse Gamer Ergonômico USB com Luz RGB – 4 Botões',
  'img'=>'https://ae-pic-a1.aliexpress-media.com/kf/Sddc0650c4ca3414ea40b107c702e7d32Z.jpg',
  'desc'=>'Mouse gamer ergonômico com fio USB e luz RGB. 4 botões, funciona em computador de mesa e notebook. Cor: preto.'],
 ['ali'=>'1005009831396471','pedido'=>'8217067199154456','custo'=>33.38,'cat'=>[$luz,$luzExt],'peso'=>0.5,'dim'=>[20,15,10],
  'nome'=>'Cordão de Luz Solar 33 m com 300 LEDs RGB – Uso Externo',
  'img'=>'https://ae-pic-a1.aliexpress-media.com/kf/S185cb9e62e1647eea988396135e7aa66h.jpg',
  'desc'=>'Cordão de luzes de LED com placa de energia solar: carrega de dia e acende sozinho à noite, sem conta de luz. 33 metros com 300 LEDs coloridos (RGB). Para jardim, varanda, árvore e festas.'],
 ['ali'=>'1005009663699684','pedido'=>'8217067199174456','custo'=>37.74,'cat'=>[$relog,$smart],'peso'=>0.2,'dim'=>[12,10,8],
  'nome'=>'Smartwatch Militar Masculino à Prova d\'Água IP67 – Preto',
  'img'=>'https://ae-pic-a1.aliexpress-media.com/kf/Se0d8f474cca34afeaeb4ca866bb217288.jpg',
  'desc'=>'Smartwatch masculino estilo militar, resistente à água (IP67 / 3ATM). Monitora atividades e saúde. Cor: preto.'],
];

foreach ($P as $p) {
  $sku = 'ALI-' . $p['ali'];
  $id = wc_get_product_id_by_sku($sku);
  $prod = $id ? wc_get_product($id) : new WC_Product_Simple();
  $prod->set_name($p['nome']);
  $prod->set_sku($sku);
  $prod->set_status('publish');
  $prod->set_catalog_visibility('visible');
  $prod->set_description('<p>' . esc_html($p['desc']) . '</p><p><strong>Frete grátis para todo o Brasil.</strong></p>');
  $prod->set_short_description(esc_html($p['desc']));
  $prod->set_regular_price(mvo_preco($p['custo']));
  $prod->set_manage_stock(false);
  $prod->set_stock_status('instock');
  $prod->set_category_ids($p['cat']);
  $prod->set_shipping_class_id(49); // drop
  $prod->set_weight($p['peso']);
  $prod->set_length($p['dim'][0]); $prod->set_width($p['dim'][1]); $prod->set_height($p['dim'][2]);

  $at = new WC_Product_Attribute();
  $at->set_id(wc_attribute_taxonomy_id_by_name('pa_fornecedor'));
  $at->set_name('pa_fornecedor');
  $at->set_options([45]); // AliExpress
  $at->set_visible(false);
  $prod->set_attributes([$at]);
  $id = $prod->save();
  wp_set_object_terms($id, [45], 'pa_fornecedor');

  if (!has_post_thumbnail($id)) {
    $att = media_sideload_image($p['img'], $id, $p['nome'], 'id');
    if (!is_wp_error($att)) set_post_thumbnail($id, $att);
    else WP_CLI::warning("imagem falhou: {$p['nome']} - " . $att->get_error_message());
  }
  // dados do fornecedor (só no painel; cliente não vê)
  update_post_meta($id, '_mvo_fornecedor', 'AliExpress');
  update_post_meta($id, '_mvo_fornecedor_url', 'https://pt.aliexpress.com/item/' . $p['ali'] . '.html');
  update_post_meta($id, '_mvo_custo', $p['custo']);
  update_post_meta($id, '_mvo_imposto_pct', MVO_IMPOSTO * 100);
  update_post_meta($id, '_mvo_pedido_compra', $p['pedido']);
  update_post_meta($id, '_vi_wad_aliexpress_product_id', $p['ali']);

  WP_CLI::log(sprintf("%d | %-62s | custo %7.2f | preço %s", $id, $p['nome'], $p['custo'], mvo_preco($p['custo'])));
}
WP_CLI::success('ok');
