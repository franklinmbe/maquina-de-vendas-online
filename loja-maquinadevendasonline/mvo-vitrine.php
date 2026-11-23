<?php
/**
 * Plugin Name: MVO – Vitrine estilo marketplace
 * Description: (Franklin, 2026-11-23) Barra fixa de categorias em ícones logo abaixo do topo,
 *   faixa "como comprar" na loja, e variações escolhidas por FOTO (estilo AliExpress) na página do produto.
 */
if (!defined('ABSPATH')) exit;

function mvo_cat_icone($slug, $nome) {
  $map = [
    'automoveis' => '🏍️', 'moto' => '🏍️', 'brinquedo' => '🧸', 'celular' => '📱', 'computador' => '🖱️',
    'eletronico' => '🎧', 'luz' => '💡', 'ilumina' => '💡', 'moda' => '🕶️', 'relogio' => '⌚',
    'treinamento' => '🎓', 'academia' => '🏋️', 'esporte' => '⚽', 'beleza' => '💄', 'casa' => '🏠',
    'suplemento' => '💪', 'balanca' => '⚖️', 'ferrament' => '🔧',
  ];
  $k = remove_accents(strtolower($slug . ' ' . $nome));
  foreach ($map as $kw => $ic) if (strpos($k, $kw) !== false) return $ic;
  return '🛍️';
}

function mvo_eh_loja() {
  return function_exists('is_woocommerce') && (is_woocommerce() || is_cart() || is_checkout() || is_account_page() || is_front_page());
}

function mvo_barra_html() {
  $cats = get_terms(['taxonomy' => 'product_cat', 'parent' => 0, 'hide_empty' => true,
                     'exclude' => [get_option('default_product_cat')], 'orderby' => 'name']);
  $atual = is_product_category() ? get_queried_object_id() : 0;
  $busca = '<form class="mvo-busca" role="search" action="' . esc_url(home_url('/')) . '"><input type="search" name="s" placeholder="O que você está procurando? Ex.: relógio, fone, luz de Natal…" value="' . esc_attr(get_search_query()) . '" aria-label="Buscar produtos"><input type="hidden" name="post_type" value="product"><button type="submit" aria-label="Buscar">🔍</button></form>';
  $h = '<nav class="mvo-cats" aria-label="Categorias">' . $busca . '<div class="mvo-cats-in">';
  $h .= '<a class="mvo-cat' . (is_shop() ? ' on' : '') . '" href="' . esc_url(wc_get_page_permalink('shop')) . '"><span class="ic">🛒</span><span class="nm">Tudo</span></a>';
  foreach ($cats as $c) {
    $on = ($atual == $c->term_id || ($atual && term_is_ancestor_of($c->term_id, $atual, 'product_cat'))) ? ' on' : '';
    $h .= '<a class="mvo-cat' . $on . '" href="' . esc_url(get_term_link($c)) . '"><span class="ic">' . mvo_cat_icone($c->slug, $c->name) . '</span><span class="nm">' . esc_html($c->name) . '</span></a>';
  }
  $h .= '</div></nav>';
  if (is_shop() || is_front_page()) {
    $h .= '<div class="mvo-como"><span>🚚 <b>Frete grátis</b> para todo o Brasil</span><span>💳 <b>Pix ou cartão</b> pelo Mercado Pago</span><span>🌎 Importados com <b>impostos inclusos</b></span><span>↩️ <b>7 dias</b> para desistir</span></div>';
  }
  return $h;
}

// Coloca a barra logo depois do cabeçalho (tema de blocos).
add_filter('render_block', function ($html, $block) {
  if (($block['blockName'] ?? '') === 'core/template-part' && (($block['attrs']['slug'] ?? '') === 'header' || ($block['attrs']['tagName'] ?? '') === 'header') && mvo_eh_loja()) {
    static $feito = false;
    if (!$feito) { $feito = true; return $html . mvo_barra_html(); }
  }
  return $html;
}, 10, 2);

add_action('wp_head', function () {
  if (!mvo_eh_loja()) return; ?>
<style>
.mvo-cats{position:sticky;top:0;z-index:50;background:var(--wp--preset--color--base,#0b0d10);border-bottom:1px solid rgba(255,255,255,.08)}
.mvo-busca{display:flex;max-width:760px;margin:10px auto 2px;padding:0 16px}
.mvo-busca input[type=search]{flex:1;min-width:0;height:44px;border-radius:999px 0 0 999px;border:2px solid #ff5a36;border-right:0;background:#fff;color:#111;padding:0 18px;font-size:1rem}
.mvo-busca button{height:44px;width:64px;border:0;border-radius:0 999px 999px 0;background:#ff5a36;color:#fff;font-size:1.2rem;cursor:pointer}
.mvo-cats-in{display:flex;gap:6px;overflow-x:auto;padding:10px 16px;max-width:1280px;margin:0 auto;scrollbar-width:none}
.mvo-cats-in::-webkit-scrollbar{display:none}
.mvo-cat{flex:none;display:grid;justify-items:center;gap:5px;width:86px;text-decoration:none!important;color:inherit;font-size:.74rem;line-height:1.15;text-align:center}
.mvo-cat .ic{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-size:1.55rem;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.14);transition:border-color .2s, box-shadow .2s}
.mvo-cat:hover .ic{border-color:#ff5a36;box-shadow:0 0 10px rgba(255,90,54,.45)}
.mvo-cat.on .ic{border-color:#ff5a36;background:rgba(255,90,54,.14)}
.mvo-cat.on .nm{color:#ff7554;font-weight:700}
.mvo-como{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 18px;padding:10px 16px;font-size:.86rem;background:rgba(53,208,127,.08);border-bottom:1px solid rgba(53,208,127,.25)}
/* variações por foto */
.mvo-sw{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 4px}
.mvo-sw button{all:unset;cursor:pointer;border:1.5px solid rgba(255,255,255,.22);border-radius:8px;padding:6px 10px;font-size:.86rem;line-height:1.2;background:rgba(255,255,255,.04)}
.mvo-sw button.img{padding:2px;width:58px;height:58px}
.mvo-sw button.img img{width:100%;height:100%;object-fit:cover;border-radius:6px;display:block}
.mvo-sw button.on{border-color:#ff5a36;box-shadow:0 0 0 1px #ff5a36}
.mvo-sw button.off{opacity:.35;text-decoration:line-through}
.mvo-sw-esc{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important}
.variations .label label .mvo-val{font-weight:400;opacity:.85}
@media (max-width:600px){.mvo-cat{width:72px}.mvo-cat .ic{width:46px;height:46px;font-size:1.35rem}}
</style>
<?php });

add_action('wp_footer', function () {
  if (!function_exists('is_product') || !is_product()) return; ?>
<script>
(function () {
  function monta(form) {
    var dados; try { dados = JSON.parse(form.getAttribute('data-product_variations') || '[]'); } catch (e) { dados = []; }
    if (!Array.isArray(dados)) dados = [];
    form.querySelectorAll('select[name^="attribute_"]').forEach(function (sel) {
      if (sel.dataset.mvo) return; sel.dataset.mvo = 1;
      var nome = sel.getAttribute('name');
      // esse atributo muda a foto? (valores diferentes → fotos diferentes)
      var fotoDe = {}, usaFoto = false, vistas = {};
      dados.forEach(function (v) {
        var val = v.attributes[nome]; var src = v.image && (v.image.gallery_thumbnail_src || v.image.thumb_src);
        if (val && src && !fotoDe[val]) fotoDe[val] = src;
      });
      Object.keys(fotoDe).forEach(function (k) { vistas[fotoDe[k]] = 1; });
      usaFoto = Object.keys(vistas).length > 1;
      var box = document.createElement('div'); box.className = 'mvo-sw';
      Array.prototype.forEach.call(sel.options, function (op) {
        if (!op.value) return;
        var b = document.createElement('button'); b.type = 'button'; b.dataset.v = op.value; b.title = op.text;
        if (usaFoto && fotoDe[op.value]) { b.className = 'img'; b.innerHTML = '<img alt="" src="' + fotoDe[op.value] + '">'; }
        else b.textContent = op.text;
        b.addEventListener('click', function () {
          sel.value = (sel.value === op.value) ? '' : op.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          if (window.jQuery) jQuery(sel).trigger('change');
        });
        box.appendChild(b);
      });
      sel.classList.add('mvo-sw-esc');
      sel.parentNode.insertBefore(box, sel);
      var lbl = form.querySelector('label[for="' + sel.id + '"]'), span = document.createElement('span'); span.className = 'mvo-val';
      if (lbl) lbl.appendChild(span);
      function atualiza() {
        box.querySelectorAll('button').forEach(function (b) {
          var opt = Array.prototype.find.call(sel.options, function (o) { return o.value === b.dataset.v; });
          b.classList.toggle('on', sel.value === b.dataset.v);
          b.classList.toggle('off', !opt || opt.disabled);
        });
        span.textContent = sel.value ? ': ' + sel.options[sel.selectedIndex].text : '';
      }
      sel.addEventListener('change', atualiza);
      if (window.jQuery) jQuery(form).on('woocommerce_update_variation_values', atualiza);
      atualiza();
    });
  }
  function tudo() { document.querySelectorAll('form.variations_form').forEach(monta); }
  if (document.readyState !== 'loading') tudo(); else document.addEventListener('DOMContentLoaded', tudo);
  if (window.jQuery) jQuery(document).on('wc_variation_form', function (e) { monta(e.target); });
})();
</script>
<?php }, 99);

// Painel lateral de categorias (estilo AliExpress): passa o mouse e abrem as subcategorias.
add_shortcode('mvo_painel_categorias', function () {
  $cats = get_terms(['taxonomy' => 'product_cat', 'parent' => 0, 'hide_empty' => true,
                     'exclude' => [get_option('default_product_cat')], 'orderby' => 'name']);
  $h = '<aside class="mh-painel"><div class="mh-painel-tit">☰ Categorias</div><ul>';
  foreach ($cats as $c) {
    $subs = get_terms(['taxonomy' => 'product_cat', 'parent' => $c->term_id, 'hide_empty' => true]);
    $h .= '<li><a href="' . esc_url(get_term_link($c)) . '"><span>' . mvo_cat_icone($c->slug, $c->name) . '</span>' . esc_html($c->name) . ($subs ? '<em>›</em>' : '') . '</a>';
    if ($subs) {
      $h .= '<div class="mh-fly"><b>' . esc_html($c->name) . '</b>';
      foreach ($subs as $s) $h .= '<a href="' . esc_url(get_term_link($s)) . '">' . esc_html($s->name) . ' <small>(' . (int)$s->count . ')</small></a>';
      $h .= '</div>';
    }
    $h .= '</li>';
  }
  return $h . '</ul></aside>';
});

add_action('wp_head', function () {
  if (!is_front_page()) return; ?>
<style>
.mvo-home{max-width:1280px;margin:0 auto;padding:0 16px}
.wp-site-blocks .entry-content > .woocommerce, .wp-site-blocks .woocommerce.columns-4{max-width:1280px;margin-left:auto;margin-right:auto;padding:0 16px}
.mh-topo{display:grid;grid-template-columns:250px 1fr;gap:14px;margin:16px 0}
.mh-painel{background:#14181d;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:8px 0;position:relative}
.mh-painel-tit{font-weight:800;padding:6px 14px 8px}
.mh-painel ul{list-style:none;margin:0;padding:0}
.mh-painel li{position:static}
.mh-painel li>a{display:flex;align-items:center;gap:10px;padding:8px 14px;color:inherit;text-decoration:none;font-size:.9rem}
.mh-painel li>a span{width:22px;text-align:center}
.mh-painel li>a em{margin-left:auto;font-style:normal;opacity:.5}
.mh-painel li:hover>a{background:rgba(255,90,54,.12);color:#ff7554}
.mh-fly{display:none;position:absolute;left:100%;top:0;min-height:100%;width:280px;z-index:20;background:#1a1f25;border:1px solid rgba(255,90,54,.4);border-radius:0 14px 14px 0;padding:14px;box-shadow:8px 8px 30px rgba(0,0,0,.45)}
.mh-fly b{display:block;margin-bottom:8px}
.mh-fly a{display:block;padding:6px 0;color:inherit;text-decoration:none;font-size:.9rem}
.mh-fly a:hover{color:#ff7554}
.mh-painel li:hover .mh-fly{display:block}
.mh-hero{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;padding:28px;border-radius:16px;background:linear-gradient(120deg,#3a0d0d 0%,#7a1a10 45%,#ff5a36 100%);color:#fff;min-height:300px}
.mh-tag{display:inline-block;background:#fff;color:#c4161c;font-weight:800;border-radius:999px;padding:4px 12px;font-size:.8rem}
.mh-hero h1{font-size:2.2rem;line-height:1.1;margin:12px 0}
.mh-hero h1 span{color:#ffe14d}
.mh-hero p{max-width:56ch;opacity:.92;margin:0 0 16px}
.mh-btns{display:flex;flex-wrap:wrap;gap:10px}
.mh-btn{background:#fff;color:#c4161c!important;font-weight:800;border-radius:999px;padding:10px 20px;text-decoration:none!important}
.mh-btn2{background:transparent;color:#fff!important;border:2px solid #fff}
.mh-hero-sel{display:grid;gap:10px}
.mh-selo{background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.35);border-radius:14px;padding:10px 16px;text-align:center}
.mh-selo b{display:block;font-size:1.4rem;color:#ffe14d}
.mh-vant{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 26px}
.mh-vant>div{display:grid;grid-template-columns:auto 1fr;column-gap:10px;align-items:center;background:#14181d;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px}
.mh-vant span{grid-row:span 2;font-size:1.6rem}
.mh-vant small{opacity:.75;font-size:.8rem}
.mh-tit{display:flex;justify-content:space-between;align-items:baseline;margin:26px 0 8px}
.mh-tit h2{margin:0;font-size:1.4rem}
.mh-tit a{color:#ff7554;text-decoration:none}
.mh-bloco{background:#14181d;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:20px;margin:26px 0}
.mh-bloco h2{margin:0 0 14px}
.mh-passos,.mh-frete{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.mh-frete{grid-template-columns:repeat(3,1fr)}
.mh-passos>div,.mh-frete>div{display:grid;gap:4px;background:rgba(255,255,255,.04);border-radius:12px;padding:14px}
.mh-passos i{font-style:normal;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#ff5a36;color:#fff;font-weight:800}
.mh-passos small,.mh-frete small{opacity:.8}
.mh-flag{font-size:.8rem;font-weight:800;color:#35d07f}
.mh-nota{margin:14px 0 0;opacity:.85}
.mh-nota a{color:#ff7554}
.home .wp-block-post-title,.home h1.wp-block-post-title{display:none}
@media (max-width:900px){.mh-topo{grid-template-columns:1fr}.mh-painel{display:none}.mh-hero{grid-template-columns:1fr;padding:20px}.mh-hero h1{font-size:1.6rem}.mh-hero-sel{grid-template-columns:repeat(3,1fr)}.mh-vant,.mh-passos{grid-template-columns:1fr 1fr}.mh-frete{grid-template-columns:1fr}}
</style>
<?php });

// Categorias em destaque com explicação (estilo Mercado Livre): foto de um produto + texto curto.
add_shortcode('mvo_categorias_destaque', function () {
  $txt = [
    'relogio' => 'Smartwatches que fazem ligação, medem saúde e combinam com tudo.',
    'ilumina' => 'Luzes solares, projetores e decoração para casa, festa e Natal.',
    'brinquedo' => 'Presentes que encantam: brinquedos de controle e sensor de gesto.',
    'eletronico' => 'Fones, caixas de som e acessórios para o dia a dia.',
    'celular' => 'Acessórios que deixam o seu celular ainda mais útil.',
    'computador' => 'Mouse, teclado e o que você precisa no escritório e no game.',
    'moda' => 'Óculos e acessórios com estilo e proteção.',
    'automoveis' => 'Peças e acessórios para deixar a sua moto do seu jeito.',
    'treinamento' => 'Aprenda a vender online com a Máquina de Vendas Online.',
  ];
  $cats = get_terms(['taxonomy' => 'product_cat', 'parent' => 0, 'hide_empty' => true,
                     'exclude' => [get_option('default_product_cat')], 'orderby' => 'count', 'order' => 'DESC']);
  $h = '<div class="mh-dest">';
  foreach ($cats as $c) {
    $ids = wc_get_products(['category' => [$c->slug], 'limit' => 1, 'status' => 'publish', 'return' => 'ids', 'orderby' => 'rand']);
    $img = $ids ? get_the_post_thumbnail_url($ids[0], 'woocommerce_thumbnail') : '';
    $k = remove_accents(strtolower($c->slug . ' ' . $c->name)); $d = '';
    foreach ($txt as $kw => $tx) if (strpos($k, $kw) !== false) { $d = $tx; break; }
    $h .= '<a class="mh-dcard" href="' . esc_url(get_term_link($c)) . '">' . ($img ? '<img src="' . esc_url($img) . '" alt="" loading="lazy">' : '')
        . '<b>' . mvo_cat_icone($c->slug, $c->name) . ' ' . esc_html($c->name) . '</b><small>' . esc_html($d) . '</small><span>Ver produtos ›</span></a>';
  }
  return $h . '</div>';
});

add_action('wp_head', function () {
  if (!is_front_page()) return; ?>
<style>
.home main{margin-top:0!important;padding-top:0!important}
.home main>.wp-block-group:first-child,.home main .wp-block-post-title{margin-top:0!important;padding-top:0!important}
.home .wp-block-post-title{display:none!important}
.home main .entry-content,.home main .wp-block-post-content{margin-top:0!important}
.mh-dest{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:min(1248px,calc(100vw - 32px));max-width:none!important;margin-left:50%!important;transform:translateX(-50%)}
.mh-dcard{display:grid;gap:6px;background:#14181d;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px;color:inherit;text-decoration:none!important;transition:border-color .2s}
.mh-dcard:hover{border-color:#ff5a36}
.mh-dcard img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;background:#fff}
.mh-dcard small{opacity:.8;font-size:.82rem;line-height:1.35}
.mh-dcard span{color:#ff7554;font-size:.85rem;font-weight:700}
.mh-mp{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.mh-mp>div{background:rgba(0,158,227,.08);border:1px solid rgba(0,158,227,.35);border-radius:12px;padding:14px;display:grid;gap:4px}
.mh-mp b{color:#4fc3ff}
.mh-mp small{opacity:.85}
@media (max-width:900px){.mh-dest,.mh-mp{grid-template-columns:1fr 1fr}}
</style>
<?php });
