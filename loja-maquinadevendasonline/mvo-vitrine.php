<?php
/**
 * Plugin Name: MVO – Vitrine estilo marketplace
 * Description: (Franklin, 2026-11-23) Barra fixa de categorias em ícones logo abaixo do topo,
 *   faixa "como comprar" na loja, e variações escolhidas por FOTO (estilo AliExpress) na página do produto.
 */
if (!defined('ABSPATH')) exit;

function mvo_cat_icone($slug, $nome) {
  $svg = [
    'carrinho' => '<svg viewBox="0 0 40 40"><path d="M4 8h5l4 17h18l4-12H12" fill="none" stroke="#ff7a45" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="31" r="3.2" fill="#ffd166"/><circle cx="28" cy="31" r="3.2" fill="#ffd166"/></svg>',
    'moto' => '<svg viewBox="0 0 40 40"><circle cx="9" cy="27" r="6" fill="none" stroke="#e9eef5" stroke-width="3"/><circle cx="31" cy="27" r="6" fill="none" stroke="#e9eef5" stroke-width="3"/><path d="M9 27l7-9h9l6 9" fill="none" stroke="#ff3b30" stroke-width="3" stroke-linejoin="round"/><path d="M14 18h12l3-5h5" fill="none" stroke="#ff3b30" stroke-width="3" stroke-linecap="round"/><path d="M16 18l3 6h6z" fill="#ff3b30"/><circle cx="34" cy="13" r="2.2" fill="#ffd60a"/></svg>',
    'urso' => '<svg viewBox="0 0 40 40"><circle cx="11" cy="11" r="5" fill="#f4a261"/><circle cx="29" cy="11" r="5" fill="#f4a261"/><circle cx="20" cy="21" r="12" fill="#f4a261"/><circle cx="11" cy="11" r="2.4" fill="#ffd6a5"/><circle cx="29" cy="11" r="2.4" fill="#ffd6a5"/><ellipse cx="20" cy="25" rx="6" ry="4.5" fill="#ffd6a5"/><circle cx="15.5" cy="19" r="1.8" fill="#222"/><circle cx="24.5" cy="19" r="1.8" fill="#222"/><ellipse cx="20" cy="23.5" rx="2" ry="1.5" fill="#222"/></svg>',
    'celular' => '<svg viewBox="0 0 40 40"><rect x="11" y="3" width="18" height="34" rx="4" fill="#1c1f24" stroke="#e9eef5" stroke-width="2"/><rect x="13.5" y="7" width="13" height="24" rx="1.5" fill="#22c1ee"/><rect x="15" y="9" width="4" height="4" rx="1" fill="#ff3b30"/><rect x="21" y="9" width="4" height="4" rx="1" fill="#ffd60a"/><rect x="15" y="15" width="4" height="4" rx="1" fill="#35d07f"/><rect x="21" y="15" width="4" height="4" rx="1" fill="#ff4fa3"/><rect x="15" y="21" width="4" height="4" rx="1" fill="#8b7cf6"/><rect x="21" y="21" width="4" height="4" rx="1" fill="#fff"/><circle cx="20" cy="34" r="1.3" fill="#e9eef5"/></svg>',
    'mouse' => '<svg viewBox="0 0 40 40"><defs><linearGradient id="mvoMg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3b30"/><stop offset=".5" stop-color="#8b7cf6"/><stop offset="1" stop-color="#22c1ee"/></linearGradient></defs><path d="M20 4c-6.6 0-11 4.6-11 11v10c0 6.4 4.6 11 11 11s11-4.6 11-11V15C31 8.6 26.6 4 20 4z" fill="#1c1f24" stroke="url(#mvoMg)" stroke-width="3"/><path d="M20 5v11" stroke="url(#mvoMg)" stroke-width="2"/><rect x="18.5" y="8.5" width="3" height="5.5" rx="1.5" fill="#ff3b30"/><path d="M12 23h16" stroke="url(#mvoMg)" stroke-width="2.5"/></svg>',
    'fone' => '<svg viewBox="0 0 40 40"><path d="M7 25v-5a13 13 0 0 1 26 0v5" fill="none" stroke="#e9eef5" stroke-width="3"/><rect x="4" y="22" width="8" height="13" rx="3" fill="#22c1ee"/><rect x="28" y="22" width="8" height="13" rx="3" fill="#22c1ee"/></svg>',
    'lampada' => '<svg viewBox="0 0 40 40"><g stroke="#ffd60a" stroke-width="2.5" stroke-linecap="round"><path d="M20 1v4M6 7l3 3M34 7l-3 3M2 19h4M34 19h4"/></g><path d="M20 8a10 10 0 0 0-6 18v4h12v-4a10 10 0 0 0-6-18z" fill="#ffd60a"/><rect x="15" y="31" width="10" height="6" rx="1.5" fill="#cfd6df"/><path d="M17 21l3 4 3-4" fill="none" stroke="#ff9f1c" stroke-width="2"/></svg>',
    'oculos' => '<svg viewBox="0 0 40 40"><path d="M3 15h34" stroke="#e9eef5" stroke-width="2.5" stroke-linecap="round"/><path d="M5 15h12v5a6 6 0 0 1-12 0z" fill="#ff4fa3"/><path d="M23 15h12v5a6 6 0 0 1-12 0z" fill="#ff4fa3"/><path d="M17 17q3-2 6 0" fill="none" stroke="#e9eef5" stroke-width="2"/><path d="M8 17.5h4M26 17.5h4" stroke="#fff" stroke-width="1.6" opacity=".85"/></svg>',
    'relogio' => '<svg viewBox="0 0 40 40"><rect x="13" y="1" width="14" height="8" rx="2" fill="#f5c542"/><rect x="13" y="31" width="14" height="8" rx="2" fill="#f5c542"/><rect x="8" y="7" width="24" height="26" rx="6" fill="#1c1f24" stroke="#f5c542" stroke-width="2.5"/><rect x="11.5" y="10.5" width="17" height="19" rx="3" fill="#06121a"/><text x="20" y="21.5" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="7.5" font-weight="700" fill="#35d07f">02:05</text><rect x="13" y="25" width="5" height="2" rx="1" fill="#ff3b30"/><rect x="19" y="25" width="4" height="2" rx="1" fill="#22c1ee"/><rect x="24" y="25" width="3" height="2" rx="1" fill="#ffd60a"/><rect x="32" y="16" width="2.5" height="6" rx="1" fill="#f5c542"/></svg>',
    'capelo' => '<svg viewBox="0 0 40 40"><path d="M2 15l18-8 18 8-18 8z" fill="#a29bfe"/><path d="M10 19v8c0 3 5 6 10 6s10-3 10-6v-8l-10 4z" fill="#6c5ce7"/><path d="M34 16v10" stroke="#ffd60a" stroke-width="2"/><circle cx="34" cy="27" r="2.2" fill="#ffd60a"/></svg>',
  ];
  $map = [
    'automoveis' => 'moto', 'moto' => 'moto', 'brinquedo' => 'urso', 'celular' => 'celular', 'computador' => 'mouse',
    'eletronico' => 'fone', 'luz' => 'lampada', 'ilumina' => 'lampada', 'moda' => 'oculos', 'relogio' => 'relogio',
    'treinamento' => 'capelo', 'tudo' => 'carrinho',
  ];
  $emoji = ['academia' => '🏋️', 'esporte' => '⚽', 'beleza' => '💄', 'casa' => '🏠', 'suplemento' => '💪', 'balanca' => '⚖️', 'ferrament' => '🔧'];
  $k = remove_accents(strtolower($slug . ' ' . $nome));
  foreach ($map as $kw => $ic) if (strpos($k, $kw) !== false) return $svg[$ic];
  foreach ($emoji as $kw => $ic) if (strpos($k, $kw) !== false) return $ic;
  return '🛍️';
}

function mvo_eh_loja() {
  return function_exists('is_woocommerce') && (is_woocommerce() || is_cart() || is_checkout() || is_account_page() || is_front_page());
}

function mvo_barra_html() {
  $cats = get_terms(['taxonomy' => 'product_cat', 'parent' => 0, 'hide_empty' => true,
                     'exclude' => [get_option('default_product_cat')], 'orderby' => 'name']);
  $atual = is_product_category() ? get_queried_object_id() : 0;
  $busca = '<form class="mvo-busca" role="search" action="' . esc_url(home_url('/')) . '"><input type="search" name="s" placeholder="O que você está procurando? Ex.: relógio, fone, luz de Natal…" value="' . esc_attr(get_search_query()) . '" aria-label="Buscar produtos"><input type="hidden" name="post_type" value="product"><button type="submit" aria-label="Buscar">🔍</button><button type="button" class="mvo-tema" aria-label="Tema claro ou escuro" onclick="mvoTema()"><span class="e">☀️</span><span class="c">🌙</span></button></form>';
  $h = '<nav class="mvo-cats" aria-label="Categorias">' . $busca . '<div class="mvo-cats-in">';
  $h .= '<a class="mvo-cat' . (is_shop() ? ' on' : '') . '" href="' . esc_url(wc_get_page_permalink('shop')) . '"><span class="ic">' . mvo_cat_icone('tudo', 'tudo') . '</span><span class="nm">Tudo</span></a>';
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
.mvo-cat .ic{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-size:1.55rem;background:radial-gradient(circle at 50% 35%,#2a313b,#161a20);border:1.5px solid rgba(255,255,255,.22);transition:border-color .2s, box-shadow .2s}
.mvo-cat .ic svg{width:34px;height:34px;display:block}
.mh-painel li>a span svg{width:20px;height:20px;display:block}
.mh-dcard b svg{width:20px;height:20px;display:inline-block;vertical-align:-4px}
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

// Tema claro / escuro (Franklin, 2026-11-23): botão ao lado da busca, lembra a escolha no aparelho.
add_action('wp_head', function () { ?>
<script>
(function(){try{var t=localStorage.getItem('mvo_tema');if(t==='claro')document.documentElement.setAttribute('data-tema','claro');}catch(e){}})();
function mvoTema(){var h=document.documentElement,c=h.getAttribute('data-tema')==='claro';if(c)h.removeAttribute('data-tema');else h.setAttribute('data-tema','claro');try{localStorage.setItem('mvo_tema',c?'escuro':'claro');}catch(e){}}
</script>
<style>
.mvo-busca .mvo-tema{margin-left:10px;width:44px;border-radius:50%;background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.25);font-size:1.1rem;padding:0}
.mvo-tema .c{display:none} html[data-tema="claro"] .mvo-tema .e{display:none} html[data-tema="claro"] .mvo-tema .c{display:inline}
html[data-tema="claro"]{
  --mvo-bg:#f5f6f8;--mvo-card:#ffffff;--mvo-line:#e2e6ec;--mvo-text:#15181d;--mvo-muted:#5b6573;
  --wp--preset--color--base:#f5f6f8;--wp--preset--color--contrast:#15181d;--wp--preset--color--accent-4:#5b6573;
  --wp--preset--color--accent-5:#ffffff;--wp--preset--color--accent-6:#e2e6ec;
}
html[data-tema="claro"] body{background:#f5f6f8;color:#15181d}
html[data-tema="claro"] header,html[data-tema="claro"] .wp-block-template-part{color:#15181d}
html[data-tema="claro"] .mvo-cats{background:#fff;border-bottom-color:#e2e6ec}
html[data-tema="claro"] .mvo-cat .ic{background:radial-gradient(circle at 50% 35%,#ffffff,#eef1f5);border-color:#d6dbe3}
html[data-tema="claro"] .mvo-busca .mvo-tema{background:#fff;border-color:#d6dbe3}
html[data-tema="claro"] .mvo-como{background:#eafaf1}
html[data-tema="claro"] svg [stroke="#e9eef5"]{stroke:#3a4250}
html[data-tema="claro"] svg [fill="#e9eef5"]{fill:#3a4250}
html[data-tema="claro"] .mh-painel,html[data-tema="claro"] .mh-vant>div,html[data-tema="claro"] .mh-bloco,html[data-tema="claro"] .mh-dcard,html[data-tema="claro"] .mh-fly{background:#fff;border-color:#e2e6ec;color:#15181d}
html[data-tema="claro"] .mh-passos>div,html[data-tema="claro"] .mh-frete>div{background:#f5f6f8}
html[data-tema="claro"] .mh-mp>div{background:#eef8fd}
html[data-tema="claro"] .mh-mp b{color:#0077b6}
html[data-tema="claro"] .mvo-sw button{border-color:#cfd5de;background:#fff}
html[data-tema="claro"] select,html[data-tema="claro"] input[type=text],html[data-tema="claro"] input[type=email],html[data-tema="claro"] input[type=tel],html[data-tema="claro"] textarea{background:#fff!important;color:#15181d!important;border-color:#cfd5de!important}
</style>
<?php }, 1);
