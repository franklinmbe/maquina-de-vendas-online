<?php
// Página própria da Gestão de Tráfego (Franklin, 2026-10-18): maquinadevendasonline.com.br/gestao-de-trafego/
// Tráfego orgânico + tráfego pago (gestor de tráfego nos gerenciadores de anúncio).
// Fonte: cartões dos planos (app/hostnet-server/public/index.html), LIMITE_ANUNCIOS
// (lib/roteiro.js) e a página "Meu fluxo de tráfego" do app. Rodar de novo:
//   wploja eval-file /var/www/html/import/montar-trafego.php
wp_set_current_user(1);
kses_remove_filters();

$wa = 'https://wa.me/5521999059608?text=' . rawurlencode('Olá! Quero saber mais sobre a gestão de tráfego da Máquina de Vendas Online.');
$planos = home_url('/produto/treinamento-maquina-de-vendas-online/');

ob_start(); ?>
<div class="mvo">
<div class="wrap">
<header class="hero">
<div>
<h1 class="hero-title">📈 Gestão de Tráfego</h1>
<p class="hero-sub">Clientes chegando <em>todos os dias</em></p>
<p class="txt">Não basta postar: a sua empresa precisa aparecer para as pessoas certas. A Máquina de Vendas Online junta as duas forças que trazem clientes pela internet. O <b>tráfego orgânico</b> são as suas redes sociais trabalhando todos os dias. O <b>tráfego pago</b> são anúncios bem feitos no Facebook, Instagram, TikTok e Google, criados e acompanhados pelo nosso gestor de tráfego.</p>
<div class="price-row"><span class="pill green">Gestor de tráfego em todos os planos</span><span class="pill blue">Meta Ads · TikTok Ads · Google Ads</span></div>
<div class="btns"><a class="btn orange" href="<?php echo esc_url($planos); ?>">👉 Ver os planos</a><a class="btn" href="<?php echo esc_url($wa); ?>" target="_blank" rel="noopener">💬 Falar no WhatsApp</a></div>
</div>
</header>
</div>

<section><div class="wrap">
<span class="kicker">As duas forças</span>
<h2>Tráfego orgânico + tráfego pago</h2>
<p class="lead">Uma ajuda a outra: o anúncio leva gente nova até a sua empresa, e as suas redes bem cuidadas fazem essa pessoa confiar e comprar.</p>
<div class="grid g2">
<div class="card b-green"><div class="ico">🌱</div><h3>Tráfego orgânico (sem pagar anúncio)</h3>
<ul class="check">
<li><b>Postagens frequentes:</b> post, Reels, carrossel e Stories feitos pelo app, com imagens e vídeos criados por IA.</li>
<li><b>Um texto certo para cada rede:</b> Facebook, Instagram, YouTube e TikTok, cada um com a sua linguagem.</li>
<li><b>Agendamento nos melhores horários</b> e calendário de postagens.</li>
<li><b>Relatórios das redes:</b> seguidores, curtidas, comentários e engajamento.</li>
</ul></div>
<div class="card b-accent"><div class="ico">🎯</div><h3>Tráfego pago (anúncios)</h3>
<ul class="check">
<li><b>Campanhas nos gerenciadores de anúncio:</b> Meta Ads (Facebook e Instagram), TikTok Ads e Google Ads, conforme o plano.</li>
<li><b>Para quem quer comprar:</b> o anúncio aparece para o público certo, na sua região, na hora certa.</li>
<li><b>Mais conversas no WhatsApp:</b> o cliente toca no anúncio e já cai na conversa com a sua empresa.</li>
<li><b>Acompanhamento todos os dias</b> pelo nosso gestor de tráfego.</li>
</ul></div>
</div>
</div></section>

<section><div class="wrap">
<span class="kicker">Por que é difícil fazer sozinho</span>
<h2>Anunciar sem estratégia é jogar dinheiro fora</h2>
<p class="lead">O empresário que tenta anunciar sozinho esbarra sempre nas mesmas perguntas. Essas são as decisões que o nosso gestor de tráfego toma por você:</p>
<div class="grid g3">
<div class="card b-gold"><div class="ico">🧭</div><h3>Qual campanha fazer?</h3><p>Mensagens no WhatsApp, visitas ao site ou à loja, vendas, reconhecimento da marca. Cada objetivo pede uma campanha diferente.</p></div>
<div class="card b-blue"><div class="ico">💰</div><h3>Quanto colocar em cada uma?</h3><p>Quanto investir por dia, como dividir o dinheiro entre as campanhas e quando aumentar ou diminuir.</p></div>
<div class="card b-violet"><div class="ico">👥</div><h3>Para quem mostrar?</h3><p>Região, idade, interesses e as pessoas que já conhecem a sua empresa. Público errado é dinheiro perdido.</p></div>
<div class="card b-pink"><div class="ico">🖼️</div><h3>Qual anúncio funciona?</h3><p>Foto, vídeo, banner, texto. Só testando dá pra saber, e o anúncio "cansa" com o tempo e precisa ser trocado.</p></div>
<div class="card b-green"><div class="ico">📊</div><h3>Está dando resultado?</h3><p>Ler os números do gerenciador de anúncios não é simples: custo por conversa, alcance, cliques, frequência.</p></div>
<div class="card b-accent"><div class="ico">⏱️</div><h3>Quem tem tempo pra isso?</h3><p>Anúncio precisa de acompanhamento todos os dias. O empresário precisa cuidar das vendas e da empresa.</p></div>
</div>
</div></section>

<section><div class="wrap">
<span class="kicker">Como trabalhamos</span>
<h2>Como funciona a nossa gestão de tráfego</h2>
<div class="steps">
<div class="step"><h3>Objetivo e diagnóstico</h3><p>Entendemos a sua empresa, os seus produtos, a sua região e o que você quer: mais conversas no WhatsApp, mais visitas, mais vendas.</p></div>
<div class="step"><h3>Estrutura das campanhas</h3><p>Montamos tudo no gerenciador de anúncios: campanhas, grupos de anúncios (com o público certo e o orçamento de cada um) e os anúncios.</p></div>
<div class="step"><h3>Anúncios com o seu conteúdo</h3><p>Os vídeos e banners que você cria no aplicativo e no Cut Estúdio viram anúncios, testados em versões diferentes.</p></div>
<div class="step"><h3>Acompanhamento todo dia</h3><p>Olhamos os números, trocamos o anúncio que cansou, reforçamos o que está funcionando e ajustamos o orçamento.</p></div>
<div class="step"><h3>Você vê tudo no app</h3><p>Relatório com conversas e custo por conversa, e o diário dos seus anúncios: tudo que foi feito, com data.</p></div>
</div>
</div></section>

<section><div class="wrap">
<span class="kicker">Estratégias de tráfego pago</span>
<h2>As estratégias que usamos nos seus anúncios</h2>
<div class="grid g2">
<div class="card b-green"><div class="ico">💬</div><h3>Campanha de mensagens</h3><p>O anúncio leva o cliente direto para a conversa no WhatsApp da sua empresa. É a estratégia preferida para o comércio local.</p></div>
<div class="card b-blue"><div class="ico">🛒</div><h3>Tráfego para o site ou a loja</h3><p>Leva as pessoas para a sua loja online ou para a página do produto, para comprar na hora.</p></div>
<div class="card b-violet"><div class="ico">🔁</div><h3>Remarketing</h3><p>Volta a mostrar a sua empresa para quem já viu um vídeo, visitou o perfil ou conversou com você, mas ainda não comprou.</p></div>
<div class="card b-gold"><div class="ico">🧪</div><h3>Teste de anúncios</h3><p>Vários anúncios diferentes rodando ao mesmo tempo, para descobrir qual traz mais clientes gastando menos.</p></div>
<div class="card b-pink"><div class="ico">📅</div><h3>Datas e ofertas</h3><p>Campanhas especiais para Black Friday, Natal, Dia das Mães e as datas que mais vendem no seu ramo.</p></div>
<div class="card b-accent"><div class="ico">🚀</div><h3>Crescer o que funciona</h3><p>Quando um anúncio dá resultado, aumentamos o investimento nele com cuidado, sem desperdiçar.</p></div>
</div>
</div></section>

<section><div class="wrap">
<span class="kicker">Por plano</span>
<h2>Onde a sua empresa anuncia em cada plano</h2>
<div class="grid g3">
<div class="card b-green"><h3>Iniciante</h3><p>Meta Ads (Facebook e Instagram). Limite para investir em anúncios: até R$ 200 por mês.</p></div>
<div class="card b-blue"><h3>Profissional</h3><p>Meta Ads e TikTok Ads. Limite para investir em anúncios: até R$ 400 por mês.</p></div>
<div class="card b-gold"><h3>Especialista</h3><p>Meta Ads, TikTok Ads e Google Ads. Limite para investir em anúncios: até R$ 600 por mês.</p></div>
<div class="card b-violet"><h3>Personalizado</h3><p>Meta Ads, TikTok Ads e Google Ads. Limite para investir em anúncios: até R$ 800 por mês.</p></div>
<div class="card b-pink"><h3>Treinamento Criação de Aplicativos</h3><p>Meta Ads, TikTok Ads e Google Ads. Limite para investir em anúncios: até R$ 1.000 por mês.</p></div>
</div>
<p class="lead" style="margin-top:14px;">O valor dos anúncios é da sua empresa e é pago direto à plataforma de anúncios (Meta, TikTok ou Google). O plano define até quanto investido por mês o nosso gestor de tráfego cuida para você.</p>
</div></section>

<section><div class="wrap">
<span class="kicker">Transparência</span>
<h2>Você no controle do seu dinheiro</h2>
<div class="grid g3">
<div class="card b-blue"><div class="ico">📒</div><h3>Diário dos anúncios</h3><p>Cada mudança feita na sua conta de anúncios fica registrada no app: o que foi feito, como estava antes e como ficou.</p></div>
<div class="card b-green"><div class="ico">💡</div><h3>Dicas todos os dias</h3><p>Todo dia chegam ideias de estratégia para trazer mais conversas gastando menos. Você escolhe as próximas.</p></div>
<div class="card b-gold"><div class="ico">🛡️</div><h3>Nada sai sem revisão</h3><p>Nenhuma mudança que gaste dinheiro ou coloque anúncio no ar acontece sozinha: tudo passa pela revisão do nosso time.</p></div>
</div>
</div></section>

<div class="final"><div class="wrap">
<h2>Quer a sua empresa aparecendo para quem quer comprar?</h2>
<p>Gestor de tráfego em todos os planos, a partir de R$ 100 por mês. No treinamento, você também aprende como funciona cada estratégia.</p>
<div class="btns"><a class="btn orange" href="<?php echo esc_url($planos); ?>">👉 Ver os planos</a><a class="btn" href="<?php echo esc_url($wa); ?>" target="_blank" rel="noopener">💬 Falar no WhatsApp</a></div>
</div></div>
</div>
<?php
$html = preg_replace('/\n\s*/', '', ob_get_clean());
$page = get_page_by_path('gestao-de-trafego');
$content = '<!-- wp:group {"align":"full","layout":{"type":"default"}} --><div class="wp-block-group alignfull"><!-- wp:html -->' . $html . '<!-- /wp:html --></div><!-- /wp:group -->';
$id = wp_insert_post(array('ID' => $page ? $page->ID : 0, 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Gestão de Tráfego', 'post_name' => 'gestao-de-trafego', 'post_content' => $content));
update_post_meta($id, '_wp_page_template', 'page-no-title');
echo "pagina: " . get_permalink($id) . "\n";
