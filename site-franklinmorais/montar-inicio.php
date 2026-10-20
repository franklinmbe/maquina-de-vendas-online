<?php
// franklinmorais.com = site pessoal do Franklin (empreendedor digital, dono de agência de marketing digital).
// Roda pelo navegador (Hostnet não tem wp-cli): suba como www/mvo-montar.php, abra com ?k=<chave> e apague depois.
// Pode rodar de novo, não duplica. Para voltar ao tema antigo: ?k=<chave>&voltar=1
if (!isset($_GET['k']) || !defined('MVO_KEY') || $_GET['k'] !== MVO_KEY) { http_response_code(404); exit; }
@set_time_limit(300);
require __DIR__ . '/wp-load.php';
header('Content-Type: text/plain; charset=utf-8');
$admin = get_users(array('role' => 'administrator', 'number' => 1, 'fields' => 'ID'));
wp_set_current_user($admin ? $admin[0] : 1);
kses_remove_filters();

if (!empty($_GET['voltar'])) {
	$t = get_option('mvo_old_theme', 'gradiant');
	switch_theme($t);
	$f = (int) get_option('mvo_old_front', 0);
	if ($f) update_option('page_on_front', $f);
	foreach (array('blogname', 'blogdescription') as $o) { $v = get_option('mvo_old_' . $o); if ($v !== false) update_option($o, $v); }
	echo "voltou para o tema $t, página inicial $f\n";
	exit;
}

// Guarda como estava, só na primeira vez
if (get_option('mvo_old_theme') === false) {
	update_option('mvo_old_theme', get_option('stylesheet'));
	update_option('mvo_old_front', get_option('page_on_front'));
	update_option('mvo_old_blogname', get_option('blogname'));
	update_option('mvo_old_blogdescription', get_option('blogdescription'));
}

$loja = 'https://maquinadevendasonline.com.br/wp-content/uploads/2026/10/';
$img = array(
	'foto' => home_url('/wp-content/uploads/2024/08/WhatsApp-Image-2024-07-09-at-11.48.52.jpeg'),
	'mvo' => $loja . 'MAQUINA-DE-VENDAS-1-1-1024x637.jpeg',
	'app' => $loja . 'treinamento-tudo-em-um-app-602x1024.jpg',
	'reeducacao' => home_url('/wp-content/uploads/2023/02/cropped-1.jpg'),
	'time' => $loja . 'time-agentes-ia-1024x572.jpg',
	'icone' => $loja . 'app-icon-1024.png',
);
$empresas = array('MATERIAL-DE-CONSTRUCAO-31-1024x1024.png' => 'Kleber Materiais de Construção', 'Borcelle-Heavy-Rental-7-819x1024.png' => 'RJ Inox', '9-1024x1024.png' => 'PHL Cell', 'PHLCELL-80-1024x1024.png' => 'NR Cell', 'PETISCARIA2-3-1024x1024.png' => 'RN Petiscaria', 'POST-INSTAGRAN-4-819x1024.png' => 'Materiais de Construção João Pinheiro', 'HAMBURGUERIA2-819x1024.png' => 'Cachorrão da Violante', 'WhatsApp-Image-2025-01-29-at-14.04.57-1024x1024.jpeg' => 'Saponificantes');
$alunos = array('ALUNO6.jpeg' => 'R$ 15 de retorno para cada R$ 1 investido em anúncios', 'ALUNO-3.jpeg' => 'Faturamento mensal triplicado', 'ALUNO-1.jpeg' => 'Loja vendendo na internet', 'ALUNO-2.jpeg' => 'Vendendo no Google, Facebook, Instagram, TikTok, Kwai e YouTube', 'ALUNO-4.jpeg' => 'Anúncios na internet', 'ALUNO-5.jpeg' => 'Treinamento de Panfletagem Digital', 'WhatsApp-Image-2024-08-23-at-10.02.26-768x1024.jpeg' => 'Turma de gestor de tráfego', 'WhatsApp-Image-2024-08-23-at-10.04.39.jpeg' => 'Aula de anúncios online');

$wa = function ($txt) { return 'https://wa.me/5521999059608?text=' . rawurlencode($txt); };
$mvo_page = 'https://maquinadevendasonline.com.br/treinamento-maquina-de-vendas-online/';
$pagar = 'https://app.maquinadevendasonline.com.br/pagar/';
$shop = function_exists('wc_get_page_id') && wc_get_page_id('shop') > 0 ? get_permalink(wc_get_page_id('shop')) : home_url('/loja/');

// Treinamentos, na ordem do Franklin (2026-10-20). Todo "comprar" vai para o mesmo pagamento (maquinadevendasonline).
$treinamentos = array(
	array('cor' => 'b-accent', 'img' => $img['app'], 'tag' => 'Principal', 'nome' => 'Treinamento Máquina de Vendas Online',
		'txt' => 'O método que eu uso todos os dias com as empresas que atendo: redes sociais, anúncios com gestor de tráfego, relatórios, site e loja online, tudo dentro do aplicativo Máquina de Vendas Online.',
		'preco' => 'A partir de R$ 100 por mês',
		'btns' => array(array('orange', '👉 Conhecer o treinamento', $mvo_page), array('', '💳 Começar agora', $pagar . 'iniciante'))),
	array('cor' => 'b-violet', 'img' => $img['time'], 'tag' => 'Novo', 'nome' => 'Treinamento Criação de Aplicativos',
		'txt' => 'Aprenda a criar o seu próprio aplicativo, site ou loja com o Claude Code (Anthropic), junto comigo. Crie o seu produto digital e aprenda a vender aplicativos para outras empresas.',
		'preco' => 'R$ 500 por mês',
		'btns' => array(array('orange', '👉 Conhecer o treinamento', $mvo_page . '#planos'), array('', '💳 Quero esse treinamento', $pagar . 'treinamento'))),
	// Anúncios Online e Panfletagem Digital saíram (Franklin, 2026-10-20): já estão dentro do Máquina de Vendas Online.
	array('cor' => 'b-green', 'img' => $img['reeducacao'], 'tag' => 'Saúde', 'nome' => 'Treinamento de Reeducação Alimentar e Controle de Peso',
		'txt' => 'Método baseado na Alimentação Viva (projeto Terrapia, da Fiocruz), com avaliação e reavaliação, aulas gravadas e suporte diário pelo WhatsApp, por vídeo ou áudio. Ligado à Academia VIP Saúde.',
		'preco' => '',
		'btns' => array(array('orange', '👉 Conhecer o treinamento', home_url('/produto/treinamento-de-reeducacao-alimentar-e-controle-de-peso/')), array('', '💬 Quero saber mais', $wa('Olá Franklin! Quero saber mais sobre o Treinamento de Reeducação Alimentar e Controle de Peso.')))),
);
$servicos = array(
	array('b-green', '🎨', 'Social media', 'Imagens, banners e vídeos feitos com inteligência artificial e publicados nas redes da sua empresa todos os dias.'),
	array('b-accent', '🎯', 'Gestor de tráfego', 'Campanhas no Meta Ads, TikTok Ads e Google Ads, criadas e acompanhadas todos os dias para trazer clientes.'),
	array('b-blue', '🛒', 'Sites e lojas online', 'O site e a loja da sua empresa no seu domínio, prontos para vender 24 horas por dia.'),
	array('b-gold', '📱', 'Aplicativo Máquina de Vendas Online', 'O aplicativo onde a sua empresa faz todo o marketing pelo celular, com os nossos robôs de IA trabalhando para você.'),
);

ob_start(); ?>
<div class="mvo">
<div class="wrap">
<header class="hero">
<div>
<span class="kicker">Empreendedor digital</span>
<h1 class="hero-title">Franklin Morais</h1>
<p class="hero-sub">Agência de <em>Marketing Digital</em></p>
<p class="txt"><b>Eu transformo empresários offline em empresários online.</b> Com a minha agência e o aplicativo Máquina de Vendas Online, ajudo empresas a aparecer na internet, receber clientes todos os dias e vender mais. E ensino você a fazer o mesmo nos meus treinamentos.</p>
<div class="btns"><a class="btn orange" href="#treinamentos">👇 Ver meus treinamentos</a><a class="btn" href="<?php echo esc_url($wa('Olá Franklin! Vim pelo site franklinmorais.com.')); ?>" target="_blank" rel="noopener">💬 Falar comigo no WhatsApp</a></div>
</div>
<img class="hero-img" src="<?php echo esc_url($img['foto']); ?>" alt="Franklin Morais no escritório" />
</header>
</div>

<section id="treinamentos"><div class="wrap">
<span class="kicker">Meus treinamentos</span>
<h2>O que eu ensino</h2>
<p class="lead">Cada treinamento é uma conquista do meu trabalho com empresas reais. Escolha o seu e comece hoje.</p>
<div class="grid g3">
<?php foreach ($treinamentos as $t) { ?><div class="card plan <?php echo $t['cor']; ?>">
<img class="plan-img" src="<?php echo esc_url($t['img']); ?>" alt="<?php echo esc_attr($t['nome']); ?>" style="width:100%;height:300px;object-fit:contain;background:#05070a;" />
<?php if ($t['tag']) { ?><span class="pill green" style="align-self:flex-start;"><?php echo esc_html($t['tag']); ?></span><?php } ?>
<h3><?php echo esc_html($t['nome']); ?></h3>
<p><?php echo esc_html($t['txt']); ?></p>
<?php if ($t['preco']) { ?><div class="price" style="font-size:1.4rem;"><?php echo esc_html($t['preco']); ?></div><?php } ?>
<div class="btns"><?php foreach ($t['btns'] as $b) { ?><a class="btn <?php echo $b[0]; ?>" href="<?php echo esc_url($b[2]); ?>"<?php echo strpos($b[2], home_url()) === 0 ? '' : ' target="_blank" rel="noopener"'; ?>><?php echo esc_html($b[1]); ?></a><?php } ?></div>
</div><?php } ?>
</div>
</div></section>

<section id="agencia"><div class="wrap">
<span class="kicker">A agência</span>
<h2>O que a minha agência faz pela sua empresa</h2>
<p class="lead">Tráfego orgânico, tráfego pago e presença digital, com o aplicativo Máquina de Vendas Online no centro de tudo.</p>
<div class="grid g2">
<?php foreach ($servicos as $s) { ?><div class="card <?php echo $s[0]; ?>"><div class="ico"><?php echo $s[1]; ?></div><h3><?php echo esc_html($s[2]); ?></h3><p><?php echo esc_html($s[3]); ?></p></div><?php } ?>
</div>
<div class="btns" style="margin-top:18px;"><a class="btn orange" href="https://maquinadevendasonline.com.br/gestao-de-trafego/" target="_blank" rel="noopener">📈 Ver como funciona a gestão de tráfego</a></div>
</div></section>

<section><div class="wrap">
<span class="kicker">Clientes</span>
<h2>Algumas empresas que confiam no meu trabalho</h2>
<div class="gallery" style="margin-top:18px;">
<?php foreach ($empresas as $f => $alt) { ?><img src="<?php echo esc_url($loja . $f); ?>" alt="<?php echo esc_attr($alt); ?>" loading="lazy" /><?php } ?>
</div>
</div></section>

<section><div class="wrap">
<span class="kicker">Resultados</span>
<h2>Alunos: casos reais</h2>
<div class="gallery" style="margin-top:18px;">
<?php foreach ($alunos as $f => $leg) { ?><figure><img src="<?php echo esc_url($loja . $f); ?>" alt="<?php echo esc_attr($leg); ?>" loading="lazy" /><figcaption><?php echo esc_html($leg); ?></figcaption></figure><?php } ?>
</div>
</div></section>

<section><div class="wrap">
<div class="card b-gold" style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;">
<div><h3 style="font-size:1.3rem;">🛍️ Minha loja</h3><p>Produtos selecionados para você, com entrega em todo o Brasil.</p></div>
<a class="btn orange" href="<?php echo esc_url($shop); ?>">Ver a loja</a>
</div>
</div></section>

<div class="final"><div class="wrap">
<h2>Vamos colocar a sua empresa na internet?</h2>
<p>Fale comigo no WhatsApp e descubra qual treinamento ou serviço é o certo para o seu momento.</p>
<div class="btns"><a class="btn orange" href="#treinamentos">👆 Ver meus treinamentos</a><a class="btn" href="<?php echo esc_url($wa('Olá Franklin! Vim pelo site franklinmorais.com.')); ?>" target="_blank" rel="noopener">💬 Falar no WhatsApp</a></div>
</div></div>
</div>
<?php
$html = preg_replace('/\n\s*/', '', ob_get_clean());

// Página inicial nova
$page = get_page_by_path('inicio');
$content = '<!-- wp:group {"align":"full","layout":{"type":"default"}} --><div class="wp-block-group alignfull"><!-- wp:html -->' . $html . '<!-- /wp:html --></div><!-- /wp:group -->';
$page_id = wp_insert_post(array('ID' => $page ? $page->ID : 0, 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Franklin Morais', 'post_name' => 'inicio', 'post_content' => $content));
update_post_meta($page_id, '_wp_page_template', 'page-no-title');
update_option('show_on_front', 'page');
update_option('page_on_front', $page_id);
update_option('blogname', 'Franklin Morais');
update_option('blogdescription', 'Empreendedor Digital · Agência de Marketing Digital');

// Tema igual ao da loja maquinadevendasonline.com.br
switch_theme('twentytwentyfive');

// Cabeçalho e rodapé enxutos (só para este tema)
$parts = array(
	'header' => array('Cabeçalho', '<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"14px","bottom":"14px","left":"16px","right":"16px"}}},"layout":{"type":"flex","justifyContent":"space-between","flexWrap":"wrap"}} --><div class="wp-block-group alignfull" style="padding-top:14px;padding-right:16px;padding-bottom:14px;padding-left:16px"><!-- wp:site-title {"level":0} /--><!-- wp:navigation {"overlayMenu":"mobile","layout":{"type":"flex","justifyContent":"right"}} --><!-- wp:navigation-link {"label":"Início","url":"/","kind":"custom"} /--><!-- wp:navigation-link {"label":"Treinamentos","url":"/#treinamentos","kind":"custom"} /--><!-- wp:navigation-link {"label":"Agência","url":"/#agencia","kind":"custom"} /--><!-- wp:navigation-link {"label":"Loja","url":"' . esc_url($shop) . '","kind":"custom"} /--><!-- /wp:navigation --></div><!-- /wp:group -->'),
	'footer' => array('Rodapé', '<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"28px","bottom":"28px","left":"16px","right":"16px"}}},"layout":{"type":"constrained"}} --><div class="wp-block-group alignfull" style="padding-top:28px;padding-right:16px;padding-bottom:28px;padding-left:16px"><!-- wp:paragraph {"align":"center"} --><p class="has-text-align-center">Franklin Morais · Empreendedor Digital · Agência de Marketing Digital · <a href="https://wa.me/5521999059608">WhatsApp (21) 99905-9608</a></p><!-- /wp:paragraph --></div><!-- /wp:group -->'),
);
foreach ($parts as $slug => $p) {
	$found = get_posts(array('post_type' => 'wp_template_part', 'name' => $slug, 'post_status' => 'any', 'numberposts' => 1, 'tax_query' => array(array('taxonomy' => 'wp_theme', 'field' => 'name', 'terms' => 'twentytwentyfive'))));
	$id = wp_insert_post(array('ID' => $found ? $found[0]->ID : 0, 'post_type' => 'wp_template_part', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => $p[0], 'post_content' => $p[1]));
	wp_set_object_terms($id, 'twentytwentyfive', 'wp_theme');
	wp_set_object_terms($id, $slug, 'wp_template_part_area');
}

if (function_exists('wp_cache_flush')) wp_cache_flush();
echo "pagina inicial: " . get_permalink($page_id) . " (id $page_id)\ntema: " . get_option('stylesheet') . "\nantes: " . get_option('mvo_old_theme') . ", inicial " . get_option('mvo_old_front') . "\nloja: $shop\n";
