<?php
// Página própria do Cut Estúdio (Franklin, 2026-10-17): maquinadevendasonline.com.br/cut-estudio/
// Explica cada ferramenta e diz o que já funciona e o que vem em breve. O app
// (estudio.html) e a página principal apontam pra cá. Fonte das ferramentas:
// TOOLS em app/hostnet-server/public/estudio.html — ao ligar uma ferramenta
// nova lá, trocar o status dela aqui e rodar de novo:
//   wploja eval-file /var/www/html/import/montar-cut.php
wp_set_current_user(1);
kses_remove_filters();

$app = 'https://app.maquinadevendasonline.com.br/estudio.html';
$wa = 'https://wa.me/5521999059608?text=' . rawurlencode('Olá! Quero saber mais sobre o Cut Estúdio do aplicativo Máquina de Vendas Online.');
$planos = home_url('/produto/treinamento-maquina-de-vendas-online/');

// [ícone, nome, o que faz, status] — status: ok = já funciona, breve = em breve
$estudios = array(
	array('🎨 Estúdio de design', 'b-gold', array(
		array('📰', 'Banner', 'Mande uma foto e escolha o estilo (oferta, novidade ou chamada pro WhatsApp). A IA monta um banner pronto pra postar.', 'ok'),
		array('✍️', 'Texto para design', 'Escreva uma frase e a IA cria um design bonito com ela em destaque.', 'ok'),
		array('🔤', 'Texto na foto', 'Escreva em cima da sua foto, escolhendo a cor, o lugar e se tem tarja. Fica pronto na hora, no próprio celular.', 'ok'),
	)),
	array('🎬 Estúdio de vídeo', 'b-accent', array(
		array('🎬', 'Foto em movimento', 'A sua foto vira um vídeo com movimento de verdade, com narração e música.', 'ok'),
		array('⚡', 'AutoCut', 'Escolha de 2 a 8 fotos e vídeos e uma música: o app corta, junta tudo num vídeo em pé com transições e coloca a música.', 'ok'),
		array('🎞️', 'Vídeo com fotos', 'Junte até 5 fotos num vídeo com zoom, transições, narração e música.', 'ok'),
		array('🔗', 'Link do produto → anúncio', 'Cole o link do produto (da sua loja, Shopee, Mercado Livre...). O app lê o nome, a descrição e as fotos e monta o banner e o vídeo do anúncio.', 'ok'),
		array('🧑‍💼', 'Personagem de IA falando', 'Um apresentador digital falando sobre o seu produto.', 'breve'),
	)),
	array('✂️ Editor de vídeo', 'b-blue', array(
		array('✂️', 'Cortar vídeo', 'Arraste o começo e o fim e fique só com o trecho que interessa.', 'ok'),
		array('🫨', 'Estabilizar vídeo', 'Tira a tremedeira do vídeo gravado com o celular na mão. O som continua igual.', 'ok'),
		array('⏩', 'Velocidade', 'Deixe o vídeo mais rápido ou mais devagar, de 0,5x até 3x, com o som junto.', 'ok'),
		array('🐢', 'Câmera super lenta', 'Câmera lenta suave (2x ou 4x), sem travar. Ótima pra mostrar detalhes do produto.', 'ok'),
		array('🌈', 'Filtros', 'Vivo, quente, frio, preto e branco, vintage e cinema, pra foto e pra vídeo.', 'ok'),
		array('🎵', 'Música', 'Escolha entre 30 músicas sem direitos autorais. Ela entra baixinha por baixo do som do seu vídeo.', 'ok'),
		array('📐', 'Redimensionar', 'Deixe a foto ou o vídeo no formato de Reels, Stories, feed ou YouTube sem cortar nada.', 'ok'),
		array('💬', 'Legendas automáticas', 'O app escuta o que é falado no vídeo e escreve a legenda na tela, no tempo certo. Branca, amarela ou com tarja.', 'ok'),
	)),
	array('🎙️ Estúdio de voz', 'b-violet', array(
		array('🗣️', 'Texto em fala', 'Escreva o texto e escolha uma das 30 vozes (homem ou mulher, toque pra ouvir). A voz narra o seu vídeo.', 'ok'),
		array('🎙️', 'Gravar minha voz', 'Grave a narração com a sua própria voz pelo celular (até 90 segundos) e ela entra no vídeo.', 'ok'),
	)),
	array('🖼️ Estúdio de imagem', 'b-green', array(
		array('🖼️', 'Criar imagem', 'Descreva o que quer e a IA cria a imagem pra você.', 'ok'),
		array('🪄', 'Editar foto com IA', 'Escreva o que quer mudar ("troque o fundo por uma loja", "deixe o dia ensolarado") e a IA muda só isso.', 'ok'),
		array('💄', 'Retoque', 'Pele mais bonita, sem manchas, e luz no rosto. A pessoa continua a mesma.', 'ok'),
		array('☀️', 'Aprimorar foto', 'Mais luz, cor e nitidez na sua foto, num toque.', 'ok'),
		array('🧽', 'Tirar fundo', 'A IA tira o fundo da foto e deixa só o seu produto, num fundo branco, de estúdio ou preto elegante.', 'ok'),
	)),
	array('📚 Edição em lote', 'b-pink', array(
		array('📚', 'Vários banners de uma vez', 'Mande até 5 fotos e receba um banner diferente pra cada uma.', 'ok'),
	)),
);

ob_start(); ?>
<div class="mvo">
<div class="wrap">
<header class="hero">
<div>
<h1 class="hero-title">✂️ Cut Estúdio</h1>
<p class="hero-sub">O editor de foto e vídeo da <em>sua empresa</em></p>
<p class="txt">Fica dentro do aplicativo Máquina de Vendas Online. Quem já usa o CapCut se sente em casa: as mesmas abas e os botões no mesmo lugar. A diferença é que tudo o que você cria vai para a sua aprovação e é publicado nas redes da sua empresa, com o texto certo para cada rede.</p>
<div class="price-row"><span class="pill green">✅ Já funciona</span><span class="pill blue">🔜 Em breve</span></div>
<div class="btns"><a class="btn orange" href="<?php echo esc_url($app); ?>">✂️ Abrir o Cut Estúdio</a><a class="btn" href="<?php echo esc_url($wa); ?>" target="_blank" rel="noopener">💬 Falar no WhatsApp</a></div>
</div>
</header>
</div>

<section><div class="wrap">
<span class="kicker">Como funciona</span>
<h2>As abas do Cut Estúdio</h2>
<p class="lead">As abas ficam embaixo da tela, igual no CapCut.</p>
<div class="grid g3">
<div class="card b-accent"><div class="ico">✂️</div><h3>Editar</h3><p>Todas as ferramentas, separadas por estúdio: design, vídeo, editor de vídeo, voz, imagem e edição em lote.</p></div>
<div class="card b-pink"><div class="ico">✨</div><h3>Modelos</h3><p>Efeitos prontos pro seu produto: Marketing (comercial de marca grande), Viral, Datas comemorativas (Black Friday, Natal, Dia das Mães...), Dia de jogo e efeitos gratuitos. É só mandar a foto.</p></div>
<div class="card b-violet"><div class="ico">🧪</div><h3>Lab. de IA</h3><p>"O que vamos criar hoje?" Conte a sua ideia, anexe fotos ou vídeos e os robôs criam o conteúdo.</p></div>
<div class="card b-blue"><div class="ico">📁</div><h3>Projetos</h3><p>Tudo o que você criou, separado em vídeos e fotos, com o andamento (criando, pronto pra aprovar ou publicado) e uma lixeira.</p></div>
<div class="card b-green"><div class="ico">📤</div><h3>Postar</h3><p>Aprovou, publicou: Facebook, Instagram, YouTube e as outras redes conectadas.</p></div>
<div class="card b-gold"><div class="ico">⋯</div><h3>Minha conta</h3><p>No canto de cima: o seu plano, o tema claro ou escuro e a ajuda pelo WhatsApp.</p></div>
</div>
</div></section>

<?php foreach ($estudios as $e) { ?>
<section><div class="wrap">
<h2><?php echo esc_html($e[0]); ?></h2>
<div class="grid g3">
<?php foreach ($e[2] as $t) { ?><div class="card <?php echo $e[1]; ?>"<?php echo $t[3] === 'breve' ? ' style="opacity:.6;"' : ''; ?>><div class="ico"><?php echo $t[0]; ?></div><h3><?php echo esc_html($t[1]); ?></h3><p><?php echo esc_html($t[2]); ?></p><p style="margin-top:10px;"><span class="pill <?php echo $t[3] === 'ok' ? 'green' : 'blue'; ?>"><?php echo $t[3] === 'ok' ? '✅ Já funciona' : '🔜 Em breve'; ?></span></p></div><?php } ?>
</div>
</div></section>
<?php } ?>

<section><div class="wrap">
<span class="kicker">Bom saber</span>
<h2>Do jeito que a sua empresa precisa</h2>
<div class="grid g2">
<ul class="check">
<li><b>Edição em sequência:</b> corte, depois coloque música, depois câmera lenta. O vídeo editado continua aberto quando você troca de ferramenta.</li>
<li><b>Nada sai sem você ver:</b> tudo passa pela sua aprovação antes de publicar.</li>
<li><b>Salve no celular:</b> baixe a foto ou o vídeo editado quando quiser.</li>
</ul>
<ul class="check">
<li><b>Sem créditos complicados:</b> você vê no topo quantas imagens e vídeos ainda restam no seu plano este mês.</li>
<li><b>Ferramentas de edição grátis:</b> cortar, velocidade, câmera lenta, estabilizar, música, redimensionar e aprimorar não gastam a sua cota.</li>
<li><b>Tema claro ou escuro:</b> escolha como prefere usar.</li>
</ul>
</div>
</div></section>

<div class="final"><div class="wrap">
<h2>Quer o Cut Estúdio na sua empresa?</h2>
<p>Ele vem em todos os planos do aplicativo Máquina de Vendas Online, a partir de R$ 100 por mês. No treinamento, ensinamos você e a sua equipe a usar cada ferramenta.</p>
<div class="btns"><a class="btn orange" href="<?php echo esc_url($planos); ?>">👉 Ver os planos</a><a class="btn" href="<?php echo esc_url($wa); ?>" target="_blank" rel="noopener">💬 Falar no WhatsApp</a></div>
</div></div>
</div>
<?php
$html = preg_replace('/\n\s*/', '', ob_get_clean());
$page = get_page_by_path('cut-estudio');
$content = '<!-- wp:group {"align":"full","layout":{"type":"default"}} --><div class="wp-block-group alignfull"><!-- wp:html -->' . $html . '<!-- /wp:html --></div><!-- /wp:group -->';
$id = wp_insert_post(array('ID' => $page ? $page->ID : 0, 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Cut Estúdio', 'post_name' => 'cut-estudio', 'post_content' => $content));
update_post_meta($id, '_wp_page_template', 'page-no-title');
echo "pagina: " . get_permalink($id) . "\n";
