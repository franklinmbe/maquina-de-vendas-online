<?php
/**
 * Plugin Name: MVO – Seja nosso prestador de serviço
 * Description: Página pública /prestadores (Franklin, 26/11/2026): convida prestadores de serviço a divulgar no
 *   marketplace. O serviço é "empacotado" como um produto da loja (página com benefícios, o que faz, fotos, região
 *   atendida) e o cliente interessado vai direto para o WhatsApp do prestador. A página do serviço também serve para
 *   ele divulgar. Cada cadastro vira um registro em WooCommerce → Prestadores, avisa o admin no sininho/celular e por
 *   e-mail. As condições comerciais NÃO são prometidas: são combinadas na análise.
 */
if (!defined('ABSPATH')) exit;

add_action('init', function () {
  register_post_type('mvo_prestador', [
    'label' => 'Prestadores', 'labels' => ['name' => 'Prestadores de serviço (cadastros)', 'singular_name' => 'Prestador'],
    'public' => false, 'show_ui' => true, 'show_in_menu' => 'woocommerce', 'supports' => ['title', 'editor'],
    'capability_type' => 'post', 'capabilities' => ['create_posts' => 'do_not_allow'], 'map_meta_cap' => true,
  ]);
});

function mvo_prest_avisar_admins($txt) {
  foreach (get_users(['capability' => 'manage_woocommerce', 'fields' => 'ID']) as $aid) {
    $l = get_user_meta($aid, '_mvo_notifs', true); if (!is_array($l)) $l = [];
    array_unshift($l, ['id' => uniqid('n', false), 'pedido' => 0, 'ic' => '🧑‍🔧', 'txt' => $txt, 'link' => admin_url('edit.php?post_type=mvo_prestador'), 't' => time(), 'lida' => 0]);
    update_user_meta($aid, '_mvo_notifs', array_slice($l, 0, 40)); do_action('mvo_notif_nova', (int) $aid);
  }
}

add_action('template_redirect', function () {
  $path = trim((string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
  if ($path !== 'prestadores') return;
  $erro = ''; $ok = false;
  $c = ['nome', 'negocio', 'whats', 'email', 'titulo', 'servico', 'como', 'beneficios', 'diferencial', 'depoimentos', 'regiao', 'horario', 'redes', 'cnpj'];
  $v = [];
  foreach ($c as $k) $v[$k] = sanitize_textarea_field(wp_unslash($_POST[$k] ?? ''));
  if (!empty($_POST['mvo_prest_novo']) && wp_verify_nonce($_POST['_mvo_prest'] ?? '', 'mvo_prest_novo')) {
    $zap = preg_replace('/\D/', '', $v['whats']);
    if (!$v['nome'] || strlen($zap) < 10 || !$v['servico']) $erro = 'Preencha o seu nome, o WhatsApp com DDD e o serviço que você faz.';
    elseif ($v['email'] && !is_email($v['email'])) $erro = 'Confira o e-mail.';
    else {
      $txt = "Nome: {$v['nome']}\nNegócio: {$v['negocio']}\nWhatsApp: {$zap}\nE-mail: {$v['email']}\nCNPJ: {$v['cnpj']}\nRegião que atende: {$v['regiao']}\nHorários: {$v['horario']}\n\nTÍTULO DA PÁGINA:\n{$v['titulo']}\n\nServiços:\n{$v['servico']}\n\nComo funciona o atendimento:\n{$v['como']}\n\nBenefícios:\n{$v['beneficios']}\n\nDiferenciais:\n{$v['diferencial']}\n\nDepoimentos:\n{$v['depoimentos']}\n\nInstagram/site/fotos:\n{$v['redes']}";
      $pid = wp_insert_post(['post_type' => 'mvo_prestador', 'post_status' => 'private', 'post_title' => ($v['negocio'] ?: $v['nome']) . ' — ' . wp_trim_words($v['servico'], 6, '…'), 'post_content' => $txt]);
      if ($pid && !is_wp_error($pid)) {
        update_post_meta($pid, '_mvo_prest_whats', $zap);
        wp_mail(get_option('admin_email'), 'Novo prestador de serviço: ' . $v['nome'], $txt . "\n\nVer: " . admin_url('post.php?action=edit&post=' . $pid));
        mvo_prest_avisar_admins('Novo prestador de serviço: ' . $v['nome'] . ' (' . wp_trim_words($v['servico'], 5, '…') . ', WhatsApp ' . $zap . '). Toque para ver.');
        $ok = true;
      } else $erro = 'Não consegui salvar agora. Tente de novo em instantes.';
    }
  }
  status_header(200); nocache_headers();
  global $wp_query; if ($wp_query) { $wp_query->is_404 = false; $wp_query->is_page = true; }
  add_filter('pre_get_document_title', fn() => 'Seja nosso prestador de serviço – Máquina de Vendas Online', 99);
  add_filter('body_class', fn($cl) => array_diff($cl, ['error404']));
  ob_start(); block_template_part('header'); $topo = ob_get_clean();
  ob_start(); block_template_part('footer'); $rodape = ob_get_clean();
  $share = 'https://wa.me/?text=' . rawurlencode("🧑‍🔧 Você presta algum serviço e quer mais clientes?\nDivulgue no marketplace *Máquina de Vendas Online*: o seu serviço ganha uma página na nossa loja e os clientes chamam você direto no WhatsApp.\n👀 Veja como funciona e faça o cadastro: 👉 " . home_url('/prestadores'));
  ?><!doctype html><html <?php language_attributes(); ?>><head><meta charset="<?php bloginfo('charset'); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><?php wp_head(); ?></head>
  <body <?php body_class(); ?>><?php wp_body_open(); ?><div class="wp-site-blocks"><?php echo $topo; ?>
  <main class="mvo-sp">
    <style>
      .mvo-sp{max-width:680px;margin:18px auto 30px;padding:0 14px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.45}
      .mvo-sp *{box-sizing:border-box}
      .mvo-sp .hero{background:linear-gradient(160deg,#5b1f8c 0%,#2a0f45 75%);color:#fff;border:2px solid #FFD93D;border-radius:20px;padding:22px 18px;text-align:center;box-shadow:0 0 22px rgba(255,217,61,.4)}
      .mvo-sp .hero h1{font-size:1.55rem;line-height:1.15;margin:0 0 8px;color:#FFE14D;font-weight:900;text-transform:uppercase;text-shadow:0 0 10px rgba(255,217,61,.45)}
      .mvo-sp .hero p{margin:0 0 12px;font-size:1.02rem}
      .mvo-sp .chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:10px 0 14px}
      .mvo-sp .chip{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:5px 11px;font-size:.85rem;font-weight:700}
      .mvo-sp .cta{display:inline-block;background:linear-gradient(180deg,#FFF0A3,#FFE14D 55%,#FFD000);color:#2D3277;font-weight:900;border-radius:12px;padding:13px 22px;text-decoration:none;margin:4px}
      .mvo-sp .cta.zap{background:#25D366;color:#fff}
      .mvo-sp .cx{border-radius:16px;padding:16px;margin-top:14px;border:2px solid var(--c);background:color-mix(in srgb,var(--c) 9%,transparent)}
      .mvo-sp .cx h2{font-size:1.2rem;margin:0 0 10px;color:var(--c);font-weight:900}
      .mvo-sp .passos{list-style:none;margin:0;padding:0;display:grid;gap:10px}
      .mvo-sp .passos li{display:flex;gap:10px;align-items:flex-start}
      .mvo-sp .n{flex:0 0 30px;height:30px;border-radius:50%;background:var(--c);color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center}
      .mvo-sp .lista{margin:0;padding-left:0;list-style:none;display:grid;gap:8px}
      .mvo-sp .lista li{padding:9px 11px;border-radius:10px;background:color-mix(in srgb,var(--c) 10%,transparent)}
      .mvo-sp .nota{background:#FFF3C4;color:#3b2f00;border-left:5px solid #FFB800;border-radius:10px;padding:12px;margin-top:12px;font-size:.95rem}
      .mvo-sp .form{--c:#E0A800}
      .mvo-sp label{display:block;font-weight:700;font-size:.92rem;margin-bottom:2px}
      .mvo-sp input,.mvo-sp textarea,.mvo-sp select{display:block;width:100%;margin:4px 0 12px;padding:12px;border-radius:10px;border:1px solid rgba(127,127,127,.5);font-size:1rem;font-family:inherit}
      .mvo-sp textarea{min-height:80px}
      .mvo-sp button{width:100%;padding:15px;border:0;border-radius:12px;font-weight:900;font-size:1.05rem;background:linear-gradient(180deg,#FFF0A3 0%,#FFE14D 55%,#FFD000 100%);color:#2D3277;cursor:pointer}
      .mvo-sp .err{background:#ffe1df;color:#8a1c14;padding:10px;border-radius:10px}
      .mvo-sp .ok{background:#dff7e7;color:#0f5132;padding:14px;border-radius:12px;font-weight:700}
    </style>
    <div class="hero">
      <h1>🧑‍🔧 Seja nosso prestador de serviço</h1>
      <p>Você presta algum serviço e quer <b>mais clientes</b>? A gente cria a sua <b>landing page de especialista</b> no nosso marketplace, divulga a sua especialidade, e quem se interessar <b>chama você direto no WhatsApp</b>.</p>
      <div class="chips"><span class="chip">🎨 Sua landing page</span><span class="chip">📣 Anúncios e afiliados</span><span class="chip">💬 Cliente no seu WhatsApp</span><span class="chip">🔗 Link para você divulgar</span></div>
      <a class="cta" href="#cadastro">Quero divulgar meu serviço ↓</a>
    </div>

    <div class="cx" style="--c:#2D7FF9"><h2>💡 Passo a passo</h2><ol class="passos">
      <li><span class="n">1</span><span><b>Preencha o modelo da sua página</b> aqui embaixo: a sua especialidade, o que você faz, como atende, os benefícios e os seus diferenciais.</span></li>
      <li><span class="n">2</span><span><b>Fale com a gente no WhatsApp</b> para receber o seu <b>código de ativação</b> (o botão aparece assim que você enviar o modelo).</span></li>
      <li><span class="n">3</span><span><b>A gente cria a sua landing page de especialista</b>: uma página bonita, com tudo o que você preencheu e as fotos dos seus trabalhos.</span></li>
      <li><span class="n">4</span><span>A página <b>entra no ar na nossa loja</b>, a gente divulga, e o cliente interessado <b>chama você no WhatsApp</b>.</span></li>
    </ol></div>

    <div class="cx" style="--c:#0FA3B1"><h2>🎨 A sua landing page de especialista</h2>
      <p style="margin:0 0 10px">É uma página só sua, feita para <b>vender a sua especialidade</b>. Ela tem:</p>
      <ul class="lista">
        <li>🏷️ <b>Título forte</b> com a sua especialidade (ex.: “Instalação de ar-condicionado com garantia”).</li>
        <li>🛠️ <b>O que você faz</b>, serviço por serviço.</li>
        <li>📋 <b>Como funciona o atendimento</b>, do primeiro contato até o serviço pronto.</li>
        <li>⭐ <b>Benefícios e diferenciais</b>: por que escolher você.</li>
        <li>📸 <b>Fotos e vídeos</b> dos seus trabalhos e <b>depoimentos</b> de clientes.</li>
        <li>📍 <b>Região e horários</b> de atendimento.</li>
        <li>💬 Botão grande para <b>chamar você no WhatsApp</b>.</li>
      </ul>
      <div class="nota">🔗 O seu serviço vira um “produto” da nossa loja, e a página também é <b>sua para divulgar</b>: mande o link no seu WhatsApp, coloque na bio do Instagram e use nos seus anúncios para fechar mais clientes.</div>
    </div>


    <div class="cx" style="--c:#12A150"><h2>📣 Como a gente arruma clientes para você</h2><ul class="lista">
      <li>🛒 O seu serviço aparece na <b>nossa loja</b> e no nosso <b>aplicativo</b>.</li>
      <li>🎯 <b>Anúncios</b> (tráfego pago) levando gente interessada até a página do seu serviço.</li>
      <li>🤝 A nossa <b>rede de afiliados</b> indica o seu serviço nas redes deles.</li>
      <li>💬 O cliente chama você <b>direto no WhatsApp</b>: você conversa, faz o orçamento e fecha.</li>
    </ul>
      <div class="nota">📝 As condições da parceria (valores e comissão) são <b>combinadas com cada prestador</b> na análise, de acordo com o tipo de serviço.</div>
    </div>

    <div class="cx" style="--c:#E0218A"><h2>🙋 Quem pode participar</h2><ul class="lista">
      <li>🔧 Técnicos, instaladores, eletricistas, encanadores, montadores, pintores…</li>
      <li>💇 Beleza e bem-estar: cabeleireiros, manicures, esteticistas, personal trainers…</li>
      <li>🎉 Eventos, fotografia, buffet, decoração…</li>
      <li>💼 Consultorias, aulas, design, marketing e outros serviços.</li>
      <li>📄 Com CNPJ (MEI, ME ou outro) ou começando agora: conte para a gente no cadastro.</li>
    </ul></div>

    <div class="cx form" id="cadastro"><h2>✍️ Modelo da sua página de especialista</h2>
      <?php if ($ok) {
        $zapf = 'https://wa.me/5521999059608?text=' . rawurlencode('Olá! Preenchi o modelo da minha página de especialista no marketplace Máquina de Vendas Online (' . $v['nome'] . ' – ' . wp_trim_words($v['servico'], 6, '…') . '). Quero receber o meu código de ativação.');
        echo '<p class="ok">✅ Modelo recebido! Agora fale com a gente no WhatsApp para receber o seu <b>código de ativação</b> e começarmos a sua landing page.</p>';
        echo '<p style="text-align:center"><a class="cta zap" href="' . esc_url($zapf) . '" target="_blank" rel="noopener">💬 Receber o meu código no WhatsApp</a></p>';
      } else { ?>
      <p style="margin:0 0 12px;font-size:.95rem">Preencha com calma: é com essas informações que a gente monta a sua página. Quanto mais detalhe, mais bonita e convincente ela fica.</p>
      <?php if ($erro) echo '<p class="err">' . esc_html($erro) . '</p>'; ?>
      <form method="post"><?php wp_nonce_field('mvo_prest_novo', '_mvo_prest'); ?>
        <label>Seu nome<input type="text" name="nome" required value="<?php echo esc_attr($v['nome']); ?>"></label>
        <label>Nome do seu negócio (se tiver)<input type="text" name="negocio" value="<?php echo esc_attr($v['negocio']); ?>"></label>
        <label>WhatsApp com DDD<input type="tel" name="whats" required value="<?php echo esc_attr($v['whats']); ?>"></label>
        <label>E-mail<input type="email" name="email" value="<?php echo esc_attr($v['email']); ?>"></label>
        <label>Sua especialidade em uma frase (título da página)<input type="text" name="titulo" placeholder="Ex.: Instalação de ar-condicionado com garantia" value="<?php echo esc_attr($v['titulo']); ?>"></label>
        <label>Quais serviços você faz?<textarea name="servico" required placeholder="Ex.: instalação, limpeza e manutenção de ar-condicionado split…"><?php echo esc_textarea($v['servico']); ?></textarea></label>
        <label>Como funciona o seu atendimento?<textarea name="como" placeholder="Ex.: o cliente chama no WhatsApp, faço o orçamento por foto, agendo a visita…"><?php echo esc_textarea($v['como']); ?></textarea></label>
        <label>Benefícios para o cliente<textarea name="beneficios" placeholder="Ex.: serviço limpo, garantia de 90 dias, nota fiscal…"><?php echo esc_textarea($v['beneficios']); ?></textarea></label>
        <label>Seus diferenciais<textarea name="diferencial" placeholder="Ex.: 10 anos de experiência, atendimento no mesmo dia…"><?php echo esc_textarea($v['diferencial']); ?></textarea></label>
        <label>Depoimentos de clientes (se tiver)<textarea name="depoimentos" placeholder="Cole aqui elogios que você já recebeu"><?php echo esc_textarea($v['depoimentos']); ?></textarea></label>
        <label>Região que você atende<input type="text" name="regiao" placeholder="Ex.: Zona Norte do Rio, Baixada, online para todo o Brasil" value="<?php echo esc_attr($v['regiao']); ?>"></label>
        <label>Dias e horários de atendimento<input type="text" name="horario" placeholder="Ex.: segunda a sábado, das 8h às 18h" value="<?php echo esc_attr($v['horario']); ?>"></label>
        <label>Instagram, site ou onde vemos fotos e vídeos dos seus trabalhos<input type="text" name="redes" value="<?php echo esc_attr($v['redes']); ?>"></label>
        <label>Tem CNPJ?<select name="cnpj"><?php foreach (['MEI', 'ME / EPP (Simples)', 'Outro', 'Ainda não tenho'] as $o) printf('<option%s>%s</option>', selected($v['cnpj'], $o, false), esc_html($o)); ?></select></label>
        <input type="hidden" name="mvo_prest_novo" value="1">
        <button type="submit">Enviar o modelo da minha página</button>
      </form>
      <?php } ?>
    </div>

    <p style="text-align:center;margin-top:16px"><a class="cta zap" href="<?php echo esc_url($share); ?>" target="_blank" rel="noopener">📲 Indicar para um prestador de serviço</a></p>
    <p style="text-align:center;font-size:.92rem">Vende produtos? <a href="<?php echo esc_url(home_url('/fornecedores')); ?>"><b>Seja nosso fornecedor →</b></a></p>
  </main>
  <?php echo $rodape; ?></div><?php wp_footer(); ?></body></html>
  <?php
  exit;
});
