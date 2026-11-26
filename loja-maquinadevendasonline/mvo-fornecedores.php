<?php
/**
 * Plugin Name: MVO – Seja nosso fornecedor
 * Description: Página pública /fornecedores (Franklin, 26/11/2026): convida pequenos comércios, fábricas, artesãos e
 *   prestadores de serviço a vender no nosso marketplace. Explica como funciona (cadastro → análise dos produtos e do
 *   estoque → integração → produtos no ar com divulgação por anúncios e afiliados) e recebe o cadastro.
 *   Cada cadastro vira um registro em WooCommerce → Fornecedores, avisa o admin no sininho/celular e por e-mail.
 *   As condições comerciais NÃO são prometidas na página: são combinadas na análise.
 */
if (!defined('ABSPATH')) exit;

add_action('init', function () {
  register_post_type('mvo_fornecedor', [
    'label' => 'Fornecedores', 'labels' => ['name' => 'Fornecedores (cadastros)', 'singular_name' => 'Fornecedor'],
    'public' => false, 'show_ui' => true, 'show_in_menu' => 'woocommerce', 'supports' => ['title', 'editor'],
    'capability_type' => 'post', 'capabilities' => ['create_posts' => 'do_not_allow'], 'map_meta_cap' => true,
  ]);
});

function mvo_forn_avisar_admins($txt) {
  foreach (get_users(['capability' => 'manage_woocommerce', 'fields' => 'ID']) as $aid) {
    $l = get_user_meta($aid, '_mvo_notifs', true); if (!is_array($l)) $l = [];
    array_unshift($l, ['id' => uniqid('n', false), 'pedido' => 0, 'ic' => '🏭', 'txt' => $txt, 'link' => admin_url('edit.php?post_type=mvo_fornecedor'), 't' => time(), 'lida' => 0]);
    update_user_meta($aid, '_mvo_notifs', array_slice($l, 0, 40)); do_action('mvo_notif_nova', (int) $aid);
  }
}

add_action('template_redirect', function () {
  $path = trim((string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
  if ($path !== 'fornecedores') return;
  $erro = ''; $ok = false;
  $c = ['empresa', 'nome', 'whats', 'email', 'cidade', 'produtos', 'cnpj', 'estoque', 'online'];
  $v = [];
  foreach ($c as $k) $v[$k] = sanitize_textarea_field(wp_unslash($_POST[$k] ?? ''));
  if (!empty($_POST['mvo_forn_novo']) && wp_verify_nonce($_POST['_mvo_forn'] ?? '', 'mvo_forn_novo')) {
    $zap = preg_replace('/\D/', '', $v['whats']);
    if (!$v['empresa'] || !$v['nome'] || strlen($zap) < 10 || !$v['produtos']) $erro = 'Preencha o nome da empresa, o seu nome, o WhatsApp com DDD e o que você vende.';
    elseif ($v['email'] && !is_email($v['email'])) $erro = 'Confira o e-mail.';
    else {
      $txt = "Responsável: {$v['nome']}\nWhatsApp: {$zap}\nE-mail: {$v['email']}\nCidade/UF: {$v['cidade']}\nCNPJ: {$v['cnpj']}\n\nO que vende/fabrica:\n{$v['produtos']}\n\nComo controla o estoque:\n{$v['estoque']}\n\nOnde já vende (site, Instagram, marketplaces):\n{$v['online']}";
      $pid = wp_insert_post(['post_type' => 'mvo_fornecedor', 'post_status' => 'private', 'post_title' => $v['empresa'] . ' — ' . $v['nome'], 'post_content' => $txt]);
      if ($pid && !is_wp_error($pid)) {
        update_post_meta($pid, '_mvo_forn_whats', $zap);
        wp_mail(get_option('admin_email'), 'Novo fornecedor: ' . $v['empresa'], $txt . "\n\nVer: " . admin_url('post.php?action=edit&post=' . $pid));
        mvo_forn_avisar_admins('Novo fornecedor: ' . $v['empresa'] . ' (' . $v['nome'] . ', WhatsApp ' . $zap . '). Toque para ver.');
        $ok = true;
      } else $erro = 'Não consegui salvar agora. Tente de novo em instantes.';
    }
  }
  status_header(200); nocache_headers();
  global $wp_query; if ($wp_query) { $wp_query->is_404 = false; $wp_query->is_page = true; }
  add_filter('pre_get_document_title', fn() => 'Seja nosso fornecedor e venda online – Máquina de Vendas Online', 99);
  add_filter('body_class', fn($cl) => array_diff($cl, ['error404']));
  ob_start(); block_template_part('header'); $topo = ob_get_clean();
  ob_start(); block_template_part('footer'); $rodape = ob_get_clean();
  $share = 'https://wa.me/?text=' . rawurlencode("Olá! 👋\n\n🏭 *Você tem um comércio, uma fábrica ou faz algum produto e quer vender pela internet, sem precisar montar loja?*\n\nSeja fornecedor do marketplace *Máquina de Vendas Online*: a gente coloca os seus produtos na nossa loja online, divulga com anúncios e com a nossa rede de afiliados, e o cliente paga com segurança pelo Mercado Pago 💳. O nosso sistema fica ligado ao seu estoque.\n\n👀 No link você vê *como funciona* e já faz o seu cadastro: 👉 " . home_url('/fornecedores'));
  // Prévia do link no WhatsApp/redes (Franklin 26/11/2026)
  add_action('wp_head', function () {
    echo '<meta property="og:title" content="🏭 Seja nosso fornecedor e venda online">' . "\n";
    echo '<meta property="og:description" content="Coloque os seus produtos no marketplace Máquina de Vendas Online: loja pronta, anúncios, afiliados e pagamento pelo Mercado Pago. Veja como funciona e faça o seu cadastro.">' . "\n";
    echo '<meta property="og:url" content="' . esc_url(home_url('/fornecedores')) . '"><meta property="og:type" content="website">' . "\n";
  }, 1);
  ?><!doctype html><html <?php language_attributes(); ?>><head><meta charset="<?php bloginfo('charset'); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><?php wp_head(); ?></head>
  <body <?php body_class(); ?>><?php wp_body_open(); ?><div class="wp-site-blocks"><?php echo $topo; ?>
  <main class="mvo-fp">
    <style>
      .mvo-fp{max-width:680px;margin:18px auto 30px;padding:0 14px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.45}
      .mvo-fp *{box-sizing:border-box}
      .mvo-fp .hero{background:linear-gradient(160deg,#0f5132 0%,#0b2e22 75%);color:#fff;border:2px solid #FFD93D;border-radius:20px;padding:22px 18px;text-align:center;box-shadow:0 0 22px rgba(255,217,61,.4)}
      .mvo-fp .hero h1{font-size:1.6rem;line-height:1.15;margin:0 0 8px;color:#FFE14D;font-weight:900;text-transform:uppercase;text-shadow:0 0 10px rgba(255,217,61,.45)}
      .mvo-fp .hero p{margin:0 0 12px;font-size:1.02rem}
      .mvo-fp .chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:10px 0 14px}
      .mvo-fp .chip{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:5px 11px;font-size:.85rem;font-weight:700}
      .mvo-fp .cta{display:inline-block;background:linear-gradient(180deg,#FFF0A3,#FFE14D 55%,#FFD000);color:#2D3277;font-weight:900;border-radius:12px;padding:13px 22px;text-decoration:none;margin:4px}
      .mvo-fp .cta.zap{background:#25D366;color:#fff}
      .mvo-fp .cx{border-radius:16px;padding:16px;margin-top:14px;border:2px solid var(--c);background:color-mix(in srgb,var(--c) 9%,transparent)}
      .mvo-fp .cx h2{font-size:1.2rem;margin:0 0 10px;color:var(--c);font-weight:900}
      .mvo-fp .passos{list-style:none;margin:0;padding:0;display:grid;gap:10px}
      .mvo-fp .passos li{display:flex;gap:10px;align-items:flex-start}
      .mvo-fp .n{flex:0 0 30px;height:30px;border-radius:50%;background:var(--c);color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center}
      .mvo-fp .lista{margin:0;padding-left:0;list-style:none;display:grid;gap:8px}
      .mvo-fp .lista li{padding:9px 11px;border-radius:10px;background:color-mix(in srgb,var(--c) 10%,transparent)}
      .mvo-fp .nota{background:#FFF3C4;color:#3b2f00;border-left:5px solid #FFB800;border-radius:10px;padding:12px;margin-top:12px;font-size:.95rem}
      .mvo-fp .form{--c:#E0A800}
      .mvo-fp label{display:block;font-weight:700;font-size:.92rem;margin-bottom:2px}
      .mvo-fp input,.mvo-fp textarea,.mvo-fp select{display:block;width:100%;margin:4px 0 12px;padding:12px;border-radius:10px;border:1px solid rgba(127,127,127,.5);font-size:1rem;font-family:inherit}
      .mvo-fp textarea{min-height:80px}
      .mvo-fp button{width:100%;padding:15px;border:0;border-radius:12px;font-weight:900;font-size:1.05rem;background:linear-gradient(180deg,#FFF0A3 0%,#FFE14D 55%,#FFD000 100%);color:#2D3277;cursor:pointer}
      .mvo-fp .err{background:#ffe1df;color:#8a1c14;padding:10px;border-radius:10px}
      .mvo-fp .ok{background:#dff7e7;color:#0f5132;padding:14px;border-radius:12px;font-weight:700}
    </style>
    <div class="hero">
      <h1>🏭 Seja nosso fornecedor e venda online</h1>
      <p>Você tem um <b>comércio, uma fábrica ou faz algum produto</b>, mas não tem estrutura para vender na internet? Coloque os seus produtos no <b>nosso marketplace</b>: a gente mostra, divulga e vende online para você.</p>
      <div class="chips"><span class="chip">🛒 Loja online pronta</span><span class="chip">📣 Anúncios e afiliados</span><span class="chip">💳 Pix e cartão em 12x</span><span class="chip">🔗 Ligado ao seu estoque</span></div>
      <a class="cta" href="#cadastro">Quero ser fornecedor ↓</a>
    </div>

    <div class="cx" style="--c:#2D7FF9"><h2>💡 Como funciona, em 3 passos</h2><ol class="passos">
      <li><span class="n">1</span><span><b>Faça o seu cadastro</b> aqui embaixo, contando o que você vende ou fabrica.</span></li>
      <li><span class="n">2</span><span><b>A gente entra em contato</b> pelo WhatsApp para conhecer os seus produtos e o jeito que você controla o estoque.</span></li>
      <li><span class="n">3</span><span>Ligamos o nosso sistema ao seu estoque e <b>os seus produtos entram no ar</b> na nossa loja.</span></li>
    </ol></div>

    <div class="cx" style="--c:#12A150"><h2>🛍️ O que você ganha sendo nosso fornecedor</h2><ul class="lista">
      <li>🖥️ <b>Seus produtos numa loja online pronta</b>, com fotos, descrição e frete calculado, sem você precisar montar site.</li>
      <li>📣 <b>Divulgação</b> com anúncios (tráfego pago) e com a nossa <b>rede de afiliados</b>, que indicam os produtos nas redes deles.</li>
      <li>💳 <b>Pagamento seguro pelo Mercado Pago</b>: o cliente paga no Pix ou no cartão em até 12x.</li>
      <li>📱 Os produtos aparecem também no nosso <b>aplicativo</b>, para os nossos clientes e afiliados.</li>
      <li>📈 Mais clientes sem aumentar o seu trabalho: você continua cuidando do que sabe fazer.</li>
    </ul></div>

    <div class="cx" style="--c:#8E44EC"><h2>🔗 Integração com o seu estoque</h2>
      <p style="margin:0 0 10px">Para nunca vendermos o que você não tem, <b>o nosso sistema fica ligado ao seu estoque</b>:</p>
      <ul class="lista">
        <li>💻 Usa sistema de gestão (ERP), loja virtual ou vende em marketplace? A gente <b>analisa e conecta</b> o seu estoque ao nosso.</li>
        <li>📋 Controla em planilha ou no caderno? Sem problema: combinamos o <b>jeito mais simples</b> de manter o estoque atualizado e vamos automatizando com o tempo.</li>
        <li>✅ Produto acabou aí, sai da nossa loja. Chegou mais, volta a vender.</li>
      </ul>
    </div>

    <div class="cx" style="--c:#F26B1D"><h2>🛒 Como é uma venda</h2><ol class="passos">
      <li><span class="n">1</span><span>O cliente encontra o seu produto na nossa loja e <b>paga pelo Mercado Pago</b>.</span></li>
      <li><span class="n">2</span><span><b>Você recebe o aviso do pedido</b> e separa o produto.</span></li>
      <li><span class="n">3</span><span>O produto é <b>entregue ao cliente</b> e você recebe pela venda.</span></li>
    </ol>
      <div class="nota">📝 As condições (preço de repasse, prazos, como é feito o envio e o pagamento ao fornecedor) são <b>combinadas com cada fornecedor</b> na análise, de acordo com o tipo de produto.</div>
    </div>

    <div class="cx" style="--c:#E0218A"><h2>🙋 Quem pode ser fornecedor</h2><ul class="lista">
      <li>🏪 Pequenos e médios <b>comércios</b> e lojas físicas.</li>
      <li>🏭 <b>Fábricas</b> e quem produz o próprio produto (móveis, roupas, alimentos embalados, artesanato…).</li>
      <li>🧑‍🔧 Presta <b>serviços</b>? Tem uma página só para você: <a href="<?php echo esc_url(home_url('/prestadores')); ?>"><b>Seja nosso prestador de serviço →</b></a></li>
      <li>📄 Com CNPJ (MEI, ME ou outro) ou começando agora: conte para a gente no cadastro.</li>
    </ul></div>

    <div class="cx form" id="cadastro"><h2>✍️ Quero ser fornecedor</h2>
      <?php if ($ok) { echo '<p class="ok">✅ Cadastro recebido! A nossa equipe vai entrar em contato pelo seu WhatsApp para conhecer os seus produtos.</p>'; } else { ?>
      <?php if ($erro) echo '<p class="err">' . esc_html($erro) . '</p>'; ?>
      <form method="post"><?php wp_nonce_field('mvo_forn_novo', '_mvo_forn'); ?>
        <label>Nome da empresa ou do seu negócio<input type="text" name="empresa" required value="<?php echo esc_attr($v['empresa']); ?>"></label>
        <label>Seu nome<input type="text" name="nome" required value="<?php echo esc_attr($v['nome']); ?>"></label>
        <label>WhatsApp com DDD<input type="tel" name="whats" required value="<?php echo esc_attr($v['whats']); ?>"></label>
        <label>E-mail<input type="email" name="email" value="<?php echo esc_attr($v['email']); ?>"></label>
        <label>Cidade e estado<input type="text" name="cidade" placeholder="Ex.: Rio de Janeiro – RJ" value="<?php echo esc_attr($v['cidade']); ?>"></label>
        <label>O que você vende ou fabrica?<textarea name="produtos" required placeholder="Ex.: móveis de aço inox, roupas fitness, doces, artesanato…"><?php echo esc_textarea($v['produtos']); ?></textarea></label>
        <label>Tem CNPJ?<select name="cnpj"><?php foreach (['MEI', 'ME / EPP (Simples)', 'Outro', 'Ainda não tenho'] as $o) printf('<option%s>%s</option>', selected($v['cnpj'], $o, false), esc_html($o)); ?></select></label>
        <label>Como você controla o estoque hoje?<textarea name="estoque" placeholder="Ex.: planilha, caderno, sistema (qual?), Mercado Livre, Shopee…"><?php echo esc_textarea($v['estoque']); ?></textarea></label>
        <label>Já vende online? Onde? (site, Instagram, marketplaces)<input type="text" name="online" value="<?php echo esc_attr($v['online']); ?>"></label>
        <input type="hidden" name="mvo_forn_novo" value="1">
        <button type="submit">Quero ser fornecedor</button>
      </form>
      <?php } ?>
    </div>

    <p style="text-align:center;margin-top:16px"><a class="cta zap" href="<?php echo esc_url($share); ?>" target="_blank" rel="noopener">📲 Indicar para um comerciante</a></p>
  </main>
  <?php echo $rodape; ?></div><?php wp_footer(); ?></body></html>
  <?php
  exit;
});
