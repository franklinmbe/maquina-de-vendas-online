<?php
// Treinamento Máquina de Vendas Online = entrada no aplicativo. Produto com opções (um plano por opção) + página de vendas.
require_once ABSPATH . 'wp-admin/includes/image.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';
wp_set_current_user(1);
kses_remove_filters();

$dir = ABSPATH . 'import/';
$media = function ($file, $alt) use ($dir) {
	$found = get_posts(array('post_type' => 'attachment', 'meta_key' => '_mvo_origem', 'meta_value' => $file, 'numberposts' => 1, 'fields' => 'ids'));
	if ($found) return $found[0];
	$tmp = wp_tempnam($file);
	copy($dir . $file, $tmp);
	$id = media_handle_sideload(array('name' => $file, 'tmp_name' => $tmp), 0, $alt);
	if (is_wp_error($id)) { echo "ERRO $file\n"; return 0; }
	update_post_meta($id, '_wp_attachment_image_alt', $alt);
	update_post_meta($id, '_mvo_origem', $file);
	return $id;
};
$url = function ($file, $size = 'large') { $f = get_posts(array('post_type' => 'attachment', 'meta_key' => '_mvo_origem', 'meta_value' => $file, 'numberposts' => 1, 'fields' => 'ids')); return $f ? wp_get_attachment_image_url($f[0], $size) : ''; };

// Planos: fonte = cartões do app (app/hostnet-server/public/index.html). Preços provisórios até o Franklin definir.
$planos = array(
	array('nome' => 'Plano Iniciante', 'preco' => '100', 'img' => 'hero-robo-crop.png', 'frase' => 'Para começar a vender pela internet com o básico bem feito.', 'itens' => array(
		'Social media: tráfego orgânico e criação de imagens, banners e vídeos.',
		'Gestor de tráfego: anúncios no Meta Ads (Facebook e Instagram).',
		'2 redes sociais (Facebook e Instagram), até 2 posts por dia.',
		'30 imagens e 7 vídeos por IA por mês (3 em movimento).',
		'Relatórios automáticos das suas redes sociais.',
		'Limite para investir em anúncios: até R$ 200.',
	)),
	array('nome' => 'Plano Profissional', 'preco' => '200', 'img' => 'plan-profissional-robo.jpg', 'frase' => 'O aplicativo com a cara da sua empresa e mais alcance.', 'itens' => array(
		'Aplicativo com a logo, as cores e o nome da sua empresa.',
		'Gestor de tráfego: anúncios no Meta Ads e TikTok Ads.',
		'3 redes sociais e posts ilimitados.',
		'90 imagens e 10 vídeos por IA por mês (4 em movimento).',
		'Até 10 agendamentos de posts por mês, nos melhores horários.',
		'Limite para investir em anúncios: até R$ 400.',
	)),
	array('nome' => 'Plano Especialista', 'preco' => '300', 'img' => 'plan-especialista-robo.jpg', 'frase' => 'Para quem quer crescer com anúncios em todas as plataformas.', 'itens' => array(
		'Aplicativo com a logo, as cores e o nome da sua empresa.',
		'Gestor de tráfego: anúncios no Meta Ads, TikTok Ads e Google Ads.',
		'5 redes sociais, posts e agendamentos ilimitados.',
		'150 imagens e 30 vídeos por IA por mês (8 em movimento).',
		'Todas as integrações.',
		'Limite para investir em anúncios: até R$ 600.',
	)),
	array('nome' => 'Plano Personalizado', 'preco' => '400', 'img' => 'plan-personalizado-loja.jpg', 'frase' => 'Tudo que a sua empresa precisa: redes, anúncios, site e loja online.', 'itens' => array(
		'Aplicativo com a cara da sua empresa no seu domínio próprio.',
		'Criação de site e loja online para vender produtos e serviços.',
		'Dropshipping: venda produtos com estoque de terceiros, sem estoque próprio.',
		'Hospedagem incluída enquanto você for cliente (o domínio é seu).',
		'Todas as redes sociais, inclusive várias contas da mesma rede.',
		'Análise de mercado e de concorrentes, calendário editorial e usuários ilimitados.',
		'Limite para investir em anúncios: até R$ 800.',
	)),
	array('nome' => 'Treinamento Criação de Aplicativos', 'preco' => '500', 'img' => 'treinamento-tudo-em-um-app.jpg', 'frase' => 'Crie o seu produto digital: um aplicativo para a sua empresa, para ensinar ou para vender.', 'itens' => array(
		'Seu próprio aplicativo (o seu produto digital) criado junto com a gente.',
		'Aprenda a criar apps, sites e lojas com o Claude Code (Anthropic).',
		'Ganhe na construção do projeto e na assinatura mensal de cada cliente.',
		'Hospedagem e suporte para o seu app e até 5 apps ou sites dos seus clientes.',
		'Suporte humanizado ao vivo, todos os dias.',
		'Limite para investir em anúncios: até R$ 1.000.',
	)),
);
foreach ($planos as $p) $media($p['img'], $p['nome'] . ' - Máquina de Vendas Online');

// 1) Produto com opções (troca o produto simples antigo, mesmo endereço)
$cat = get_term_by('slug', 'marketing-digital', 'product_cat');
$old = wc_get_product_id_by_sku('MVO-TREINAMENTO');
if ($old && wc_get_product($old)->get_type() !== 'variable') { wc_get_product($old)->delete(true); $old = 0; }
$product = $old ? wc_get_product($old) : new WC_Product_Variable();
$product->set_name('Treinamento Máquina de Vendas Online');
$product->set_slug('treinamento-maquina-de-vendas-online');
$product->set_sku('MVO-TREINAMENTO');
$product->set_status('publish');
$product->set_featured(true);
$product->set_category_ids(array($cat->term_id));
$product->set_image_id($media('MAQUINA-DE-VENDAS-1.jpeg', 'Treinamento Máquina de Vendas Online'));
$product->set_gallery_image_ids(array_map(function ($p) use ($media) { return $media($p['img'], $p['nome']); }, $planos));
$attr = new WC_Product_Attribute();
$attr->set_name('Plano');
$attr->set_options(array_column($planos, 'nome'));
$attr->set_visible(true);
$attr->set_variation(true);
$product->set_attributes(array($attr));
$product->set_short_description('<p>Aprenda a usar o <strong>aplicativo Máquina de Vendas Online</strong> e coloque a sua empresa para vender pela internet: redes sociais, anúncios, relatórios, site e loja online, tudo num só lugar.</p><p>Escolha o seu plano abaixo. Comece no Iniciante e suba de plano quando a sua empresa crescer. <strong>Valores por mês.</strong></p>');
$pid = $product->save();

$var_ids = array();
$existing = array();
foreach ($product->get_children() as $vid) { $v = wc_get_product($vid); $existing[$v->get_attribute('plano')] = $vid; }
foreach ($planos as $i => $p) {
	$v = isset($existing[$p['nome']]) ? wc_get_product($existing[$p['nome']]) : new WC_Product_Variation();
	$v->set_parent_id($pid);
	$v->set_attributes(array('plano' => $p['nome']));
	$v->set_regular_price($p['preco']);
	$v->set_virtual(true);
	$v->set_status('publish');
	$v->set_menu_order($i);
	$v->set_description(implode(' · ', $p['itens']));
	$var_ids[$p['nome']] = $v->save();
}
$product->set_default_attributes(array('plano' => 'Plano Iniciante'));
$product->save();
WC_Product_Variable::sync($pid);

$checkout = wc_get_checkout_url();
$buy = function ($p) use ($pid, $var_ids, $checkout) { return add_query_arg(array('add-to-cart' => $pid, 'variation_id' => $var_ids[$p['nome']], 'attribute_plano' => $p['nome']), $checkout); };
$wa = 'https://wa.me/5521999059608?text=' . rawurlencode('Olá! Quero saber mais sobre o aplicativo Máquina de Vendas Online.');

// 2) Conteúdo no visual das páginas de plano do app (classes em mu-plugins/mvo-design.css)
foreach (array('treinamento-tudo-em-um-app.jpg' => 'Robô de IA: tudo em um só app, marketing, administração, loja e atendimento', 'time-agentes-ia.jpg' => 'Time de robôs de IA, cada um no seu computador', 'support-robot-cutout.png' => 'Robô do chat de suporte', 'app-icon-1024.png' => 'Máquina de Vendas Online') as $f => $a) $media($f, $a);

// Ícone e logo do site = ícone do app
$icon = get_posts(array('post_type' => 'attachment', 'meta_key' => '_mvo_origem', 'meta_value' => 'app-icon-1024.png', 'numberposts' => 1, 'fields' => 'ids'));
if ($icon) { update_option('site_icon', $icon[0]); set_theme_mod('custom_logo', $icon[0]); }

// Time de agentes de IA: mesma fonte das páginas de plano (só os ativos)
$times = array();
$r = wp_remote_get('https://app.franklinmorais.com/api/agentes-catalogo', array('timeout' => 20));
if (!is_wp_error($r)) { $j = json_decode(wp_remote_retrieve_body($r), true); if (!empty($j['catalogo'])) $times = $j['catalogo']; }

$cores = array('b-accent', 'b-gold', 'b-blue', 'b-violet', 'b-green', 'b-pink', 'b-blue', 'b-accent');
$estrategias = array(
	array('🎨', 'Social media (tráfego orgânico)', 'Nossos robôs criam imagens, banners e vídeos com inteligência artificial, inclusive vídeos com movimento, narração e música. Escrevem um texto diferente para cada rede e publicam no Facebook, Instagram, YouTube e outras, depois que você aprova com um toque.'),
	array('🎯', 'Gestor de tráfego (tráfego pago)', 'Todos os planos têm gestor de tráfego: criamos e gerenciamos suas campanhas no Meta Ads, TikTok Ads e Google Ads (conforme o plano), para levar o seu produto até o cliente certo, na hora certa.'),
	array('📊', 'Relatórios automáticos', 'Acompanhe seguidores, curtidas, comentários, engajamento e o resultado dos anúncios num painel simples, sem planilha e sem complicação.'),
	array('🛒', 'Site e loja online', 'No Plano Personalizado, a sua empresa ganha site e loja online no seu domínio, com hospedagem incluída, para vender os seus produtos e serviços 24 horas por dia.'),
	array('📦', 'Dropshipping', 'Venda com estoque de terceiros: a sua loja online já vem pronta para oferecer produtos sem você precisar comprar estoque nem cuidar do envio. Você escolhe o que quer vender e foca em vender.'),
	array('🎓', 'Produto digital: o seu próprio aplicativo', 'No Treinamento Criação de Aplicativos, você aprende a montar o seu produto digital, que é um aplicativo, qualquer que seja a sua profissão. Use o app para trabalhar a sua empresa, ensinar outras pessoas ou vender produtos e serviços, e ganhe dinheiro vendendo aplicativos para outras empresas.'),
	array('📱', 'O aplicativo com a cara da sua empresa', 'A partir do Profissional, o app fica com a logo, as cores e o nome da sua marca: sua equipe usa como se fosse o aplicativo próprio da empresa.'),
	array('🤖', 'Inteligência artificial ao seu lado', 'Peça o que precisa direto no app: um banner, um vídeo, uma ideia de postagem ou uma dúvida sobre o seu plano. Nossos robôs respondem e criam na hora.'),
);
$empresas = array('MATERIAL-DE-CONSTRUCAO-31.png' => 'Kleber Materiais de Construção', 'Borcelle-Heavy-Rental-7.png' => 'RJ Inox', '9.png' => 'PHL Cell', 'PHLCELL-80.png' => 'NR Cell', 'PETISCARIA2-3.png' => 'RN Petiscaria', 'POST-INSTAGRAN-4.png' => 'Materiais de Construção João Pinheiro', 'HAMBURGUERIA2.png' => 'Cachorrão da Violante', 'WhatsApp-Image-2025-01-29-at-14.04.57.jpeg' => 'Saponificantes');
$alunos = array('19.png' => 'Ludy Depósito de Bebidas', '19-1.png' => 'PHL Cell', 'ALUNO6.jpeg' => 'R$ 15 de retorno para cada R$ 1 investido em anúncios', 'ALUNO-1.jpeg' => 'Loja vendendo na internet', 'ALUNO-3.jpeg' => 'Faturamento mensal triplicado', 'ALUNO-4.jpeg' => 'Anúncios na internet', 'ALUNO-2.jpeg' => 'Vendendo no Google, Facebook, Instagram, TikTok, Kwai e YouTube', 'ALUNO-5.jpeg' => 'Treinamento de Panfletagem Digital', 'WhatsApp-Image-2024-08-23-at-10.02.26.jpeg' => 'Turma de gestor de tráfego', 'WhatsApp-Image-2024-08-23-at-10.04.39.jpeg' => 'Aula de anúncios online');
$plan_cores = array('b-green', 'b-blue', 'b-gold', 'b-violet', 'b-pink');
ob_start(); ?>
<div class="mvo">
<div class="wrap">
<header class="hero">
<div>
<h1 class="hero-title">Treinamento</h1>
<p class="hero-sub">Máquina de <em>Vendas Online</em></p>
<p class="txt">Aprenda a usar o nosso aplicativo e coloque a sua empresa para vender pela internet com <b>tráfego orgânico</b> (redes sociais todos os dias) e <b>tráfego pago</b> (anúncios feitos e acompanhados pelo nosso gestor de tráfego). Relatórios, site, loja online, dropshipping e o seu próprio aplicativo: tudo num só lugar, com nossos robôs de inteligência artificial trabalhando para você.</p>
<div class="price-row"><div class="price">R$ 100 <small>por mês para começar</small></div><span class="pill green">📈 Gestor de tráfego em todos os planos</span><span class="pill green">🌱 Tráfego orgânico + 🎯 tráfego pago</span><span class="pill blue">✂️ Novo: Cut Estúdio, o editor de foto e vídeo</span><span class="pill blue">Suba de plano quando quiser</span></div>
<div class="btns"><a class="btn orange" href="#planos">👇 Escolher meu plano</a><a class="btn" href="<?php echo esc_url($wa); ?>" target="_blank" rel="noopener">💬 Falar no WhatsApp</a></div>
</div>
<img class="hero-img" src="<?php echo esc_url($url('treinamento-tudo-em-um-app.jpg')); ?>" alt="Robô de IA: tudo em um só app" />
</header>
</div>

<section><div class="wrap">
<span class="kicker">O aplicativo</span>
<h2>O que é o aplicativo Máquina de Vendas Online</h2>
<p class="lead">É o aplicativo que nós usamos todos os dias com as empresas que atendemos. Nele, a sua empresa faz todo o marketing pelo celular: pede o conteúdo, aprova, publica nas redes, anuncia e acompanha os resultados, com os nossos robôs de inteligência artificial fazendo o trabalho pesado. <b style="color:var(--mvo-text);">No Treinamento Máquina de Vendas Online, nós ensinamos você a operar cada nível do aplicativo</b>, do primeiro post até a sua loja online e o seu próprio aplicativo.</p>
<div class="grid g3">
<div class="card b-green"><div class="ico">🎯</div><h3>Objetivo: clientes todos os dias</h3><p>Sua empresa aparecendo nas redes e nos anúncios para quem quer comprar, todos os dias, sem parar.</p></div>
<div class="card b-blue"><div class="ico">⏱️</div><h3>Objetivo: economizar tempo</h3><p>Banner, vídeo, texto e publicação saem do mesmo lugar, em minutos. Você cuida do negócio enquanto os robôs trabalham.</p></div>
<div class="card b-gold"><div class="ico">🕹️</div><h3>Objetivo: você no controle</h3><p>Nada é publicado sem a sua aprovação, e os números da sua empresa ficam na palma da mão.</p></div>
</div>
</div></section>

<section><div class="wrap">
<span class="kicker">A máquina completa</span>
<h2>📈 Tráfego orgânico + tráfego pago</h2>
<p class="lead">É assim que uma empresa recebe clientes pela internet todos os dias. As redes sociais bem cuidadas fazem as pessoas confiarem na sua empresa (<b style="color:var(--mvo-text);">tráfego orgânico</b>). Os anúncios levam a sua empresa até quem quer comprar (<b style="color:var(--mvo-text);">tráfego pago</b>). Na Máquina de Vendas Online você tem os dois, e o nosso gestor de tráfego cuida dos seus anúncios.</p>
<div class="grid g2">
<div class="card b-green"><div class="ico">🌱</div><h3>Tráfego orgânico</h3>
<ul class="check">
<li><b>Postagens todos os dias:</b> post, Reels, carrossel e Stories com imagens e vídeos feitos por IA.</li>
<li><b>Um texto certo para cada rede</b> e agendamento nos melhores horários.</li>
<li><b>Relatórios das redes:</b> seguidores, curtidas, comentários e engajamento.</li>
</ul></div>
<div class="card b-accent"><div class="ico">🎯</div><h3>Tráfego pago: o nosso gestor de tráfego</h3>
<ul class="check">
<li><b>Campanhas nos gerenciadores de anúncio:</b> Meta Ads (Facebook e Instagram), TikTok Ads e Google Ads, conforme o plano.</li>
<li><b>A campanha certa e o investimento certo:</b> qual campanha fazer, para qual público e quanto colocar em cada uma.</li>
<li><b>Acompanhamento todo dia:</b> trocamos o anúncio que cansou e reforçamos o que traz cliente.</li>
<li><b>Mais conversas no WhatsApp:</b> o cliente toca no anúncio e já fala com a sua empresa.</li>
</ul></div>
</div>
<div class="grid g3" style="margin-top:14px;">
<div class="card b-gold"><div class="ico">🧭</div><h3>O mais difícil, a gente faz</h3><p>Saber qual campanha fazer, quanto investir e quando mudar é o que mais trava o empresário. Essas decisões ficam com o nosso gestor de tráfego.</p></div>
<div class="card b-blue"><div class="ico">🧪</div><h3>Estratégias que funcionam</h3><p>Campanhas de mensagens no WhatsApp, tráfego para a sua loja, remarketing, teste de anúncios e campanhas de datas comemorativas.</p></div>
<div class="card b-violet"><div class="ico">📒</div><h3>Transparência total</h3><p>Relatório com conversas e custo por conversa, e o diário dos seus anúncios no app. Nenhuma mudança que gaste dinheiro sai sem a revisão do nosso time.</p></div>
</div>
<div class="btns" style="margin-top:18px;"><a class="btn orange" href="<?php echo esc_url(home_url('/gestao-de-trafego/')); ?>">👉 Ver como funciona a gestão de tráfego</a></div>
</div></section>

<section><div class="wrap">
<span class="kicker">Dentro do aplicativo</span>
<h2>Tudo o que você faz no app</h2>
<p class="lead">É isso que você aprende a usar no treinamento, passo a passo.</p>
<div class="grid g2">
<ul class="check">
<li><b>Pedir o seu conteúdo:</b> mande fotos e vídeos, escreva o que quer ou escolha um pedido pronto. Não precisa saber design.</li>
<li><b>Banners e imagens por IA:</b> os robôs criam banners profissionais a partir das suas fotos ou do zero.</li>
<li><b>Vídeos com narração e música:</b> inclusive vídeos com movimento real, de até 90 segundos.</li>
<li><b>A sua própria voz:</b> grave a narração no app, ou use a voz do seu vídeo, e ela entra no vídeo pronto.</li>
<li><b>Um texto diferente para cada rede:</b> os robôs escrevem a legenda certa para cada rede social.</li>
<li><b>Post, Reels, Carrossel e Stories:</b> escolha os formatos e publique em todos de uma vez.</li>
</ul>
<ul class="check">
<li><b>Aprovação simples:</b> veja tudo antes, exclua o que não gostar e publique com um toque.</li>
<li><b>Publicação nas redes:</b> Facebook, Instagram, YouTube e outras, direto do app.</li>
<li><b>Agendamento e calendário:</b> deixe os posts programados para os melhores horários.</li>
<li><b>Relatórios:</b> seguidores, curtidas, comentários, engajamento e o resultado dos anúncios.</li>
<li><b>Gestor de tráfego:</b> campanhas no Meta Ads, TikTok Ads e Google Ads, conforme o plano, criadas e acompanhadas pelo nosso time.</li>
<li><b>Diário dos anúncios:</b> tudo que foi feito nos seus anúncios, com data, e dicas de estratégia todos os dias.</li>
<li><b>Chat com os robôs:</b> tire dúvidas e faça pedidos a qualquer hora, direto no app.</li>
<li><b>Cut Estúdio:</b> edite as suas fotos e vídeos no próprio app, no mesmo jeito do CapCut.</li>
</ul>
</div>
</div></section>

<section><div class="wrap">
<span class="kicker">Novo no aplicativo</span>
<h2>✂️ Cut Estúdio: o editor de foto e vídeo da sua empresa</h2>
<p class="lead">Quem já usa o CapCut se sente em casa: as mesmas abas e os botões no mesmo lugar (Editar, Modelos, Lab. de IA, Projetos). A diferença é que, no Cut Estúdio, o que você cria vai direto para a aprovação e é publicado nas redes da sua empresa, com o texto certo para cada rede. <b style="color:var(--mvo-text);">No treinamento, ensinamos você e a sua equipe a usar cada ferramenta.</b></p>
<div class="grid g3">
<div class="card b-accent"><div class="ico">🎬</div><h3>Estúdio de vídeo</h3><p>A sua foto vira vídeo com movimento de verdade, narração e música. Ou junte várias fotos num vídeo com transições.</p></div>
<div class="card b-blue"><div class="ico">✂️</div><h3>Editor de vídeo</h3><p>Corte o trecho que quer, mude a velocidade, faça câmera super lenta, tire a tremedeira do vídeo e coloque música, na hora.</p></div>
<div class="card b-gold"><div class="ico">🎨</div><h3>Estúdio de design</h3><p>Banners prontos a partir das suas fotos, um design bonito a partir de uma frase e texto escrito em cima da foto.</p></div>
<div class="card b-green"><div class="ico">🖼️</div><h3>Estúdio de imagem</h3><p>Crie imagens com inteligência artificial e aprimore a luz, a cor e a nitidez das suas fotos com um toque.</p></div>
<div class="card b-violet"><div class="ico">🧪</div><h3>Lab. de IA</h3><p>"O que vamos criar hoje?" Conte a sua ideia, anexe fotos ou vídeos e os robôs criam o conteúdo para você.</p></div>
<div class="card b-pink"><div class="ico">✨</div><h3>Modelos prontos</h3><p>Efeitos de comercial de marca grande para o seu produto: toque de luxo, respingo de impacto, caindo com confete e muito mais.</p></div>
<div class="card b-blue"><div class="ico">📐</div><h3>Tamanho certo para cada rede</h3><p>Deixe a foto ou o vídeo no formato de Reels, Stories, feed ou YouTube sem cortar nada.</p></div>
<div class="card b-accent"><div class="ico">📚</div><h3>Edição em lote</h3><p>Mande várias fotos de uma vez e receba um banner diferente para cada uma.</p></div>
<div class="card b-gold"><div class="ico">🌓</div><h3>Do seu jeito</h3><p>Tema claro ou escuro, e você vê na hora quantas imagens e vídeos ainda restam no seu plano este mês.</p></div>
</div>
<div class="btns" style="margin-top:18px;"><a class="btn orange" href="<?php echo esc_url(home_url('/cut-estudio/')); ?>">👉 Ver tudo o que o Cut Estúdio faz</a></div>
</div></section>

<section><div class="wrap">
<span class="kicker">Os níveis do treinamento</span>
<h2>Cada plano é um nível que você aprende a operar</h2>
<p class="lead">Você começa no primeiro nível e vai subindo junto com a sua empresa. Em cada nível, a gente treina você nas ferramentas novas que foram liberadas.</p>
<div class="grid g3">
<div class="card b-green"><div class="ico">1️⃣</div><h3>Iniciante</h3><p>O básico bem feito: pedidos, aprovação, Facebook e Instagram, relatórios e os primeiros anúncios no Meta Ads.</p></div>
<div class="card b-blue"><div class="ico">2️⃣</div><h3>Profissional</h3><p>O app com a cara da sua empresa, mais redes, agendamento nos melhores horários e anúncios no TikTok Ads.</p></div>
<div class="card b-gold"><div class="ico">3️⃣</div><h3>Especialista</h3><p>Anúncios também no Google Ads, 5 redes sociais, mais imagens e vídeos e agendamento ilimitado.</p></div>
<div class="card b-violet"><div class="ico">4️⃣</div><h3>Personalizado</h3><p>Site e loja online no seu domínio, dropshipping e tudo que a sua empresa precisar, sob medida.</p></div>
<div class="card b-pink"><div class="ico">5️⃣</div><h3>Treinamento Criação de Aplicativos</h3><p>Você aprende a criar o seu próprio aplicativo, o seu produto digital, e a vender aplicativos para outras empresas.</p></div>
</div>
</div></section>

<section><div class="wrap">
<span class="kicker">Como funciona</span>
<h2>Do primeiro plano até a empresa crescendo</h2>
<p class="lead">O treinamento é a sua entrada no nosso ecossistema: você aprende o nosso método e as ferramentas do aplicativo, passo a passo.</p>
<div class="steps">
<div class="step"><h3>Escolha o seu plano</h3><p>Comece pelo plano que cabe no seu momento. Dá para começar com R$ 100 por mês.</p></div>
<div class="step"><h3>A gente treina você</h3><p>Ensinamos você e a sua equipe a usar o aplicativo, o Cut Estúdio e o nosso método, e a digitalizar a sua empresa.</p></div>
<div class="step"><h3>Sua empresa cresce</h3><p>Com mais clientes chegando, você sobe de plano e libera mais recursos quando precisar.</p></div>
</div>
</div></section>

<section><div class="wrap">
<span class="kicker">O que o aplicativo faz</span>
<h2>As estratégias da máquina, funcionando no app</h2>
<p class="lead">Uma ajuda a outra: quem vê o seu anúncio visita as suas redes, conhece a sua loja e compra.</p>
<div class="grid g2">
<?php foreach ($estrategias as $i => $e) { ?><div class="card <?php echo $cores[$i]; ?>"><div class="ico"><?php echo $e[0]; ?></div><h3><?php echo esc_html($e[1]); ?></h3><p><?php echo esc_html($e[2]); ?></p></div><?php } ?>
</div>
</div></section>

<section id="planos"><div class="wrap">
<span class="kicker">Planos</span>
<h2>Escolha o seu plano</h2>
<p class="lead">Valores por mês. Comece no Iniciante e suba de plano quando a sua empresa crescer.</p>
<div class="card b-accent chooser">
<form action="<?php echo esc_url($checkout); ?>" method="get">
<input type="hidden" name="add-to-cart" value="<?php echo $pid; ?>" />
<label for="mvo-plano">Qual plano você quer?</label>
<select id="mvo-plano" name="variation_id" onchange="this.form['attribute_plano'].value=this.options[this.selectedIndex].dataset.plano">
<?php foreach ($planos as $p) { ?><option value="<?php echo $var_ids[$p['nome']]; ?>" data-plano="<?php echo esc_attr($p['nome']); ?>"><?php echo esc_html($p['nome'] . ' - R$ ' . $p['preco'] . ' por mês'); ?></option><?php } ?>
</select>
<input type="hidden" name="attribute_plano" value="<?php echo esc_attr($planos[0]['nome']); ?>" />
<button type="submit" class="btn orange">🛒 Contratar este plano</button>
</form>
</div>
<div class="grid g3">
<?php foreach ($planos as $i => $p) { ?><div class="card plan <?php echo $plan_cores[$i]; ?>">
<img class="plan-img" src="<?php echo esc_url($url($p['img'], 'medium_large')); ?>" alt="<?php echo esc_attr($p['nome']); ?>" />
<h3><?php echo esc_html($p['nome']); ?></h3>
<p><?php echo esc_html($p['frase']); ?></p>
<div class="price">R$ <?php echo $p['preco']; ?> <small>por mês</small></div>
<ul class="check"><?php foreach ($p['itens'] as $it) echo '<li>' . esc_html($it) . '</li>'; ?></ul>
<a class="btn orange" href="<?php echo esc_url($buy($p)); ?>">Escolher este plano</a>
</div><?php } ?>
</div>
</div></section>

<?php if ($times) { $total = 0; foreach ($times as $g) foreach ($g['itens'] as $it) if (!empty($it['instalado'])) $total++; ?>
<section><div class="wrap">
<span class="kicker">Quem trabalha para você</span>
<h2>🤖 Nosso time de robôs de IA</h2>
<p class="lead">É esse time que trabalha por trás de cada plano. Cada robô é um especialista em uma área e já está ativo no aplicativo, trabalhando na sua empresa.</p>
<img class="hero-img" src="<?php echo esc_url($url('time-agentes-ia.jpg')); ?>" alt="Time de robôs de IA" style="margin:8px 0 18px;border-color:var(--mvo-blue);" />
<div class="price-row"><span class="pill green"><?php echo $total; ?> robôs ativos</span><span class="pill blue"><?php echo count($times); ?> áreas de especialidade</span></div>
<div class="grid g2">
<?php foreach ($times as $g) { $it = array_filter($g['itens'], function ($x) { return !empty($x['instalado']); }); if (!$it) continue; ?>
<div class="card" style="border-color:<?php echo esc_attr($g['cor']); ?>;"><h3><?php echo esc_html($g['area']); ?> <small style="color:var(--mvo-muted);font-weight:600;">(<?php echo count($it); ?>)</small></h3><p><?php echo esc_html(implode(' · ', array_map(function ($x) { return $x['emoji'] . ' ' . $x['nome']; }, $it))); ?></p></div>
<?php } ?>
</div>
</div></section>
<?php } ?>

<section><div class="wrap">
<div class="grid g2" style="align-items:center;">
<img src="<?php echo esc_url($url('support-robot-cutout.png', 'medium_large')); ?>" alt="Robô do chat de suporte" style="max-width:320px;margin:0 auto;border-radius:22px;" />
<div>
<span class="kicker">Você nunca fica sozinho</span>
<h2>Suporte de gente e de robô</h2>
<p class="lead">Dúvida sobre o app ou sobre o seu plano? Pergunte direto no aplicativo e nossos robôs respondem na hora. Precisa de uma pessoa? O nosso time atende você no WhatsApp.</p>
<a class="btn" href="<?php echo esc_url($wa); ?>" target="_blank" rel="noopener">💬 Falar no WhatsApp</a>
</div>
</div>
</div></section>

<section><div class="wrap">
<span class="kicker">Clientes</span>
<h2>Algumas empresas que confiam no nosso trabalho</h2>
<div class="gallery" style="margin-top:18px;">
<?php foreach ($empresas as $f => $alt) { ?><img src="<?php echo esc_url($url($f, 'medium_large')); ?>" alt="<?php echo esc_attr($alt); ?>" /><?php } ?>
</div>
</div></section>

<section><div class="wrap">
<span class="kicker">Resultados</span>
<h2>Alunos: casos reais</h2>
<div class="gallery" style="margin-top:18px;">
<?php foreach ($alunos as $f => $leg) { ?><figure><img src="<?php echo esc_url($url($f, 'medium_large')); ?>" alt="<?php echo esc_attr($leg); ?>" /><figcaption><?php echo esc_html($leg); ?></figcaption></figure><?php } ?>
</div>
</div></section>

<div class="final"><div class="wrap">
<h2>Vamos colocar a sua máquina de vendas para funcionar?</h2>
<p>Tráfego orgânico, tráfego pago com gestor de tráfego e o Cut Estúdio, a partir de R$ 100 por mês. Suba de plano quando quiser. Qualquer dúvida, nos chame agora no WhatsApp.</p>
<div class="btns"><a class="btn orange" href="#planos">👆 Escolher meu plano</a><a class="btn" href="<?php echo esc_url($wa); ?>" target="_blank" rel="noopener">💬 Falar no WhatsApp</a></div>
</div></div>
</div>
<?php
$html = preg_replace('/\n\s*/', '', ob_get_clean());

// Produto: mesma história, sem o bloco de planos (a página do produto já tem a caixinha "Plano")
$desc = preg_replace('#<section id="planos">.*?</section>#s', '', $html);
$desc = str_replace('href="#planos"', 'href="' . esc_url(get_permalink($pid)) . '"', $desc);
$product = wc_get_product($pid);
$product->set_description($desc);
$product->save();

$page = get_page_by_path('treinamento-maquina-de-vendas-online');
$content = '<!-- wp:group {"align":"full","layout":{"type":"default"}} --><div class="wp-block-group alignfull"><!-- wp:html -->' . $html . '<!-- /wp:html --></div><!-- /wp:group -->';
$page_id = wp_insert_post(array('ID' => $page ? $page->ID : 0, 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Treinamento Máquina de Vendas Online', 'post_name' => 'treinamento-maquina-de-vendas-online', 'post_content' => $content));
update_post_meta($page_id, '_wp_page_template', 'page-no-title');

echo "produto: " . get_permalink($pid) . " (opções: " . count($var_ids) . ")\npagina: " . get_permalink($page_id) . "\nrobôs: " . count($times) . " áreas\n";
