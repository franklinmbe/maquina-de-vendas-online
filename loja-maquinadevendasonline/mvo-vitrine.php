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
    $h .= '<div class="mvo-como"><span>🚚 <b>Frete grátis</b> para todo o Brasil</span><span>💳 <b>Pix ou cartão</b> pelo Mercado Pago</span><span>🌎 Importados com <b>impostos inclusos</b></span><span>🔒 Compra <b>100% segura</b></span></div>';
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
#woocommerce-correios-calculo-de-frete-na-pagina-do-produto,.containerCalculator{display:none!important}
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
.mh-tag{display:inline-block;background:#fff;color:#0b7a43;font-weight:800;border-radius:999px;padding:4px 12px;font-size:.8rem}
.mh-hero h1{font-size:2.2rem;line-height:1.1;margin:12px 0}
.mh-hero h1 span{color:#ffe14d}
.mh-hero p{max-width:56ch;opacity:.92;margin:0 0 16px}
.mh-btns{display:flex;flex-wrap:wrap;gap:10px}
.mh-btn{background:#fff;color:#0b7a43!important;font-weight:800;border-radius:999px;padding:10px 20px;text-decoration:none!important}
.mh-btn2{background:transparent;color:#fff!important;border:2px solid #fff}
.mh-hero-sel{display:grid;gap:10px}
.mh-selo{background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.35);border-radius:14px;padding:10px 16px;text-align:center}
.mh-selo b{display:block;font-size:1.4rem;color:#ffe14d}
.mh-vant{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 26px}
.mh-vant>div{display:grid;grid-template-columns:auto 1fr;column-gap:10px;align-items:center;background:#14181d;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px}
.mh-vant span{grid-row:span 2;font-size:1.6rem}
.mh-vant small{opacity:.75;font-size:.8rem}
.mh-relampago{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#FFE14D;color:#15181d;border-radius:12px;padding:12px 16px;margin:22px 0 0;font-size:1.15rem}
.mh-relampago b{font-weight:900;letter-spacing:.02em}
.mh-relampago i{font-style:normal;font-weight:800;background:#fff;border-radius:6px;padding:2px 8px;font-variant-numeric:tabular-nums}
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
(function(){var t=null;try{t=localStorage.getItem('mvo_tema');}catch(e){}if(t!=='escuro')document.documentElement.setAttribute('data-tema','claro');})();
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

// Celular obrigatório no checkout (o AliExpress/WeDrop exigem telefone do destinatário) — Franklin, 2026-11-24.
add_filter('woocommerce_checkout_fields', function ($f) {
  foreach (['billing_cellphone', 'billing_phone'] as $k) if (isset($f['billing'][$k])) { $f['billing'][$k]['required'] = true; $f['billing'][$k]['label'] = 'Celular (WhatsApp)'; break; }
  return $f;
}, 99);

// Faixa do topo em dourado (cor da nossa marca) com o nosso robô redondo ao lado do nome,
// no formato de marketplace (Franklin, 2026-11-24). Sem logo/nome de outras empresas.
add_action('wp_head', function () { ?>
<style>
body .wp-site-blocks > header, body header.wp-block-template-part{background:#FFE14D!important;color:#15181d!important;box-shadow:0 12px 0 #FFE14D;position:relative;z-index:51}
body .wp-site-blocks > header a, body header.wp-block-template-part a, body header.wp-block-template-part .wp-block-navigation-item__content{color:#15181d!important}
body header.wp-block-template-part .wp-block-navigation__submenu-container{background:#fff!important}
body .wp-block-site-title a{display:inline-flex;align-items:center;gap:10px;font-weight:900;color:#2D3277!important;text-decoration:none}
html body .wp-site-blocks > header .wp-block-site-title a, html body header.wp-block-template-part .wp-block-site-title a{color:#2D3277!important}
body .wp-block-site-title a::before{content:"";width:46px;height:46px;border-radius:50%;flex:none;background:#0b0d10 url('/wp-content/uploads/2026/10/robo-rosto.png') center/cover no-repeat;border:2.5px solid #15181d;box-shadow:0 2px 6px rgba(0,0,0,.25)}
.mvo-cats{background:linear-gradient(180deg,#FFE14D 0%,#FFE14D 52%,#fff0a3 78%,var(--mvo-bg,#f5f6f8) 100%)!important;border-bottom:0!important;margin-block-start:0!important;margin-top:0!important}
body .wp-site-blocks > header{margin-block-end:0!important;margin-bottom:0!important}
.mvo-busca input[type=search]{border-color:#fff!important;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.mvo-busca button[type=submit]{background:#fff!important;color:#15181d!important;border-left:1px solid #e6e6e6}
.mvo-busca .mvo-tema{background:rgba(255,255,255,.65)!important;border-color:rgba(0,0,0,.15)!important}
.mvo-cats-in{background:transparent}
.mvo-cat .nm{color:#15181d}
.mvo-cat .ic{background:#fff!important;border:1.5px solid rgba(0,0,0,.12)!important;box-shadow:0 1px 3px rgba(0,0,0,.15)}
.mvo-cat .ic svg [stroke="#e9eef5"]{stroke:#3a4250}
.mvo-cat .ic svg [fill="#e9eef5"]{fill:#3a4250}
.mvo-cat.on .ic{border-color:#ff5a36!important;box-shadow:0 0 0 2px #ff5a36}
.mvo-cat.on .nm{color:#b3260f!important}
.mvo-como{background:#fff7d6!important;color:#15181d;border-bottom:1px solid #f0d97a!important}
html:not([data-tema="claro"]) .mvo-como{background:#2a2410!important;color:#f2f2f0;border-bottom-color:#4a3b10!important}
</style>
<?php }, 20);

// Etiquetas de marketplace nos cartões de produto (Franklin, 2026-11-24):
// texto com sublinhado colorido — Black Friday (laranja), Frete grátis (verde), Envio rápido (azul).
add_action('woocommerce_before_shop_loop_item_title', function () {
  global $product;
  if (!$product) return;
  $mais = (int)$product->get_total_sales() >= 3 || has_term('mais-vendido', 'product_tag', $product->get_id());
  echo '<div class="mvo-pills">' . ($mais ? '<span class="p-mais">MAIS VENDIDO</span>' : '<span class="p-bf">⚡ BLACK FRIDAY</span>') . '</div>';
}, 20);
add_action('woocommerce_after_shop_loop_item_title', function () {
  echo '<div class="mvo-parc">em até <b>12x</b> no cartão</div><div class="mvo-frete">Frete grátis <i>⚡</i></div>';
}, 20);

add_action('wp_head', function () { ?>
<style>
.mvo-tags{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 10px;margin:6px 0 2px;font-size:.8rem;font-weight:800;letter-spacing:.01em}
.mvo-tags span{text-decoration:underline;text-decoration-thickness:2.5px;text-underline-offset:3px}
.mvo-tags .t-bf{color:#ff6a1a;text-decoration-color:#ff6a1a}
.mvo-tags .t-frete{color:#00a650;text-decoration-color:#00a650}
.mvo-tags .t-rapido{color:#3483fa;text-decoration-color:#7fb2ff}
html:not([data-tema="claro"]) .mvo-tags .t-frete{color:#2bd47a;text-decoration-color:#2bd47a}
.mvo-parc{font-size:.78rem;opacity:.85;margin-bottom:6px}
.mvo-parc b{color:#00a650}
ul.products li.product .price, .wc-block-components-product-price{font-size:1.25rem!important;font-weight:800}
</style>
<?php }, 21);

add_action('wp_head', function () { ?>
<style>
li.wc-block-product{display:flex!important;flex-direction:column;align-items:flex-start;text-align:left!important;background:var(--mvo-card);border:1px solid var(--mvo-line);border-radius:10px;padding:10px 10px 14px!important;box-shadow:0 1px 2px rgba(0,0,0,.06)}
li.wc-block-product .wc-block-components-product-image{order:1;width:100%}
li.wc-block-product .wc-block-components-product-image img{border-radius:6px;background:#fff}
li.wc-block-product .mvo-pills{order:2;margin:8px 0 4px}
li.wc-block-product .wp-block-post-title{order:3;text-align:left!important;font-size:.92rem!important;font-weight:400;line-height:1.3;margin:0 0 6px!important}
li.wc-block-product .wp-block-woocommerce-product-price{order:4;width:100%}
li.wc-block-product .wc-block-components-product-price{text-align:left!important;font-size:1.45rem!important;font-weight:500!important}
li.wc-block-product .mvo-parc{order:5}
li.wc-block-product .mvo-frete{order:6}
li.wc-block-product .wp-block-button{order:7;width:100%;margin-top:10px}
li.wc-block-product .wp-block-button .wp-block-button__link{width:100%}
ul.wc-block-product-template{gap:14px!important}
/* cartões de produto estilo marketplace */
ul.products li.product{display:flex!important;flex-direction:column;align-items:flex-start;text-align:left!important;background:var(--mvo-card);border:1px solid var(--mvo-line);border-radius:10px;padding:10px 10px 14px!important;box-shadow:0 1px 2px rgba(0,0,0,.06)}
ul.products li.product a.woocommerce-LoopProduct-link{display:flex;flex-direction:column;align-items:flex-start;width:100%;text-align:left}
ul.products li.product img{order:1;border-radius:6px;background:#fff}
ul.products li.product .mvo-pills{order:2;margin:8px 0 4px}
ul.products li.product .woocommerce-loop-product__title{order:3;font-size:.92rem!important;font-weight:400!important;line-height:1.3;margin:0 0 6px!important;padding:0!important;text-align:left}
ul.products li.product .price{order:4;font-size:1.45rem!important;font-weight:500!important;text-align:left;margin:0!important}
ul.products li.product .mvo-parc{order:5;text-align:left}
ul.products li.product .mvo-frete{order:6}
ul.products li.product .button{order:7;margin-top:10px!important;align-self:stretch;text-align:center}
.mvo-pills span{display:inline-block;font-size:.68rem;font-weight:800;letter-spacing:.03em;padding:2px 6px;border-radius:3px}
.mvo-pills .p-bf{background:#2d3138;color:#fff}
.mvo-pills .p-mais{background:#ff7733;color:#fff}
.mvo-parc{font-size:.8rem;opacity:.85;margin:2px 0}
.mvo-parc b{color:#00a650}
.mvo-frete{font-size:.82rem;font-weight:700;color:#00a650}
.mvo-frete i{font-style:italic;font-weight:900}
.mvo-tags{display:none!important}
/* tema cinza-escuro (quando a pessoa escolhe 🌙) */
html:not([data-tema="claro"]){--mvo-bg:#1f2329;--mvo-card:#2a2f37;--mvo-line:#3a404a;--mvo-text:#e9ebee;--mvo-muted:#aeb6c2;
  --wp--preset--color--base:#1f2329;--wp--preset--color--contrast:#e9ebee;--wp--preset--color--accent-5:#2a2f37;--wp--preset--color--accent-6:#3a404a}
html:not([data-tema="claro"]) body{background:#1f2329!important;color:#e9ebee}
html:not([data-tema="claro"]) .mh-painel,html:not([data-tema="claro"]) .mh-vant>div,html:not([data-tema="claro"]) .mh-bloco,html:not([data-tema="claro"]) .mh-dcard,html:not([data-tema="claro"]) .mh-fly{background:#2a2f37;border-color:#3a404a}
html:not([data-tema="claro"]) .mvo-frete,html:not([data-tema="claro"]) .mvo-parc b{color:#39d98a}
</style>
<?php }, 22);

// Celular no formato de app de marketplace (Franklin, 2026-11-24): menu fixo embaixo,
// topo com robô + busca, abas de categoria em texto, 2 colunas de produtos.
add_action('wp_footer', function () {
  if (is_admin()) return;
  $n = (function_exists('WC') && WC()->cart) ? (int) WC()->cart->get_cart_contents_count() : 0;
  $cats = get_terms(['taxonomy' => 'product_cat', 'parent' => 0, 'hide_empty' => true, 'exclude' => [get_option('default_product_cat')], 'orderby' => 'count', 'order' => 'DESC']);
  $atual = is_product_category() ? get_queried_object_id() : 0;
  $abas = '<a class="' . ((is_shop() || is_front_page()) ? 'on' : '') . '" href="' . esc_url(home_url('/')) . '">Tudo</a>';
  foreach ($cats as $c) $abas .= '<a class="' . ($atual == $c->term_id ? 'on' : '') . '" href="' . esc_url(get_term_link($c)) . '">' . esc_html(preg_replace('/ e .*/u', '', $c->name)) . '</a>';
  $ic = function ($d) { return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' . $d . '</svg>'; };
  echo '<div class="mvo-abas" id="mvo-abas">' . $abas . '</div>';
  echo '<nav class="mvo-bottom" aria-label="Menu">'
    . '<a href="' . esc_url(home_url('/')) . '" class="' . (is_front_page() ? 'on' : '') . '">' . $ic('<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>') . '<span>Início</span></a>'
    . '<a href="' . esc_url(wc_get_page_permalink('shop')) . '" class="' . (is_shop() || is_product_category() ? 'on' : '') . '">' . $ic('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M17.5 14v7M14 17.5h7"/>') . '<span>Categorias</span></a>'
    . '<a href="' . esc_url(wc_get_cart_url()) . '" class="' . (is_cart() ? 'on' : '') . '">' . $ic('<path d="M3 4h2l2.5 11h11l2-8H7"/><circle cx="10" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>') . ($n ? '<b>' . $n . '</b>' : '') . '<span>Carrinho</span></a>'
    . '<a href="' . esc_url(add_query_arg('orderby', 'popularity', wc_get_page_permalink('shop'))) . '">' . $ic('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>') . '<span>Ofertas</span></a>'
    . '<a href="' . esc_url(wc_get_page_permalink('myaccount')) . '" class="' . (is_account_page() ? 'on' : '') . '">' . $ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>') . '<span>Conta</span></a>'
    . '</nav>';
  echo '<script>(function(){var a=document.getElementById("mvo-abas"),c=document.querySelector(".mvo-cats");if(a&&c){var b=c.querySelector(".mvo-busca");(b&&b.nextSibling)?c.insertBefore(a,b.nextSibling):c.appendChild(a);}else if(a){a.remove();}})();</script>';
}, 50);

add_action('wp_head', function () { ?>
<style>
.mvo-bottom{display:none}
.mvo-abas{display:flex;justify-content:center;gap:26px;overflow-x:auto;padding:10px 16px 0;scrollbar-width:none;font-size:1rem}
.mvo-abas::-webkit-scrollbar{display:none}
.mvo-abas a{flex:none;color:#2b2b2b!important;text-decoration:none!important;padding-bottom:8px;border-bottom:3px solid transparent}
.mvo-abas a.on{border-bottom-color:#2b2b2b;font-weight:700}
.mvo-abas a:hover{border-bottom-color:rgba(0,0,0,.3)}
@media (max-width:782px){
  body{padding-bottom:70px}
  body header.wp-block-template-part .wp-block-navigation{display:none!important}
  body header.wp-block-template-part{padding-top:6px!important;padding-bottom:0!important}
  body .wp-block-site-title a{font-size:1.05rem}
  body .wp-block-site-title a::before{width:40px;height:40px}
  .mvo-busca{margin:6px auto 0}
  .mvo-busca input[type=search]{height:42px;font-size:.95rem}
  .mvo-abas{justify-content:flex-start;gap:22px;overflow-x:auto;padding:10px 16px 0;scrollbar-width:none;font-size:1.02rem}
  .mvo-abas::-webkit-scrollbar{display:none}
  .mvo-abas a{flex:none;color:#2b2b2b!important;text-decoration:none!important;padding-bottom:8px;border-bottom:3px solid transparent}
  .mvo-abas a.on{border-bottom-color:#2b2b2b;font-weight:700}
  .mvo-cats-in{padding-top:12px}
  .mvo-bottom{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:100;background:var(--mvo-card,#fff);border-top:1px solid var(--mvo-line,#e2e6ec);padding:6px 4px calc(6px + env(safe-area-inset-bottom,0px));box-shadow:0 -2px 10px rgba(0,0,0,.08)}
  .mvo-bottom a{flex:1;display:grid;justify-items:center;gap:2px;font-size:.72rem;color:var(--mvo-text,#333)!important;text-decoration:none!important;position:relative}
  .mvo-bottom a.on{color:#3483fa!important}
  .mvo-bottom a b{position:absolute;top:-4px;left:52%;background:#3483fa;color:#fff;border-radius:999px;font-size:.66rem;padding:1px 6px;font-weight:800}
  ul.wc-block-product-template{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
  ul.wc-block-product-template li.wc-block-product{width:auto!important;margin:0!important;padding:8px 8px 10px!important}
  li.wc-block-product .wc-block-components-product-price{font-size:1.2rem!important}
  li.wc-block-product .wp-block-button .wp-block-button__link{font-size:.8rem;padding:8px}
  .mh-hero{min-height:auto}
  .woocommerce ul.products::before,.woocommerce ul.products::after{display:none!important}
  .woocommerce ul.products li.product .button{font-size:.8rem!important;padding:8px!important;line-height:1.2}
  .woocommerce ul.products{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
  .woocommerce ul.products li.product{width:auto!important;margin:0!important;padding:8px!important}
  .mvo-como{flex-wrap:nowrap!important;justify-content:flex-start!important;overflow-x:auto;white-space:nowrap;scrollbar-width:none;font-size:.8rem}
  .mvo-como::-webkit-scrollbar{display:none}
}
</style>
<?php }, 23);


// Banners da página principal no estilo marketplace (Franklin, 2026-11-24).
add_action('wp_head', function () { if (!is_front_page()) return; ?>
<style>
.bn-amarelo{display:grid;grid-template-columns:1.25fr 1fr;border-radius:18px;overflow:hidden;background:#FFE14D;margin:26px 0}
.bn-cards{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:22px}
.bn-cards>div{border:1.5px solid rgba(0,0,0,.35);border-radius:12px;padding:12px;display:flex;flex-direction:column;justify-content:space-between;min-height:130px;color:#2b2b2b}
.bn-cards b{font-size:.95rem;line-height:1.2}
.bn-cards span{font-size:1.6rem}
.bn-foto{background-size:cover;background-position:center 30%;position:relative;min-height:220px}
.bn-cta{position:absolute;right:18px;bottom:18px;background:#fff;color:#2b2b2b!important;font-weight:800;border-radius:999px;padding:12px 26px;text-decoration:none!important;box-shadow:0 2px 8px rgba(0,0,0,.2)}
.bn-escuro{display:grid;grid-template-columns:1fr 1.2fr;border-radius:18px;overflow:hidden;background:#4a4f5c;color:#fff!important;text-decoration:none!important;margin:26px 0;min-height:230px}
.bn-escuro .bn-txt{padding:28px}
.bn-escuro h3{font-size:2rem;line-height:1.1;margin:0 0 10px;color:#fff}
.bn-escuro p{opacity:.9;margin:0}
.bn-img{background-size:cover;background-position:center;position:relative}
.bn-par{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:26px 0}
.bn-par a{display:grid;grid-template-columns:42% 1fr;border-radius:16px;overflow:hidden;text-decoration:none!important;min-height:210px}
.bn-p1{background:#FFE14D;color:#2b2b2b!important}
.bn-p2{background:linear-gradient(135deg,#ff7a45,#ff4f6d);color:#fff!important}
.bn-pimg{background-size:cover;background-position:center}
.bn-par a>div:last-child{padding:18px;display:flex;flex-direction:column;justify-content:center;gap:8px}
.bn-par small{font-weight:800;letter-spacing:.06em;opacity:.8}
.bn-par h3{margin:0;font-size:1.45rem;line-height:1.15}
.bn-btn{align-self:flex-start;font-weight:800;border-radius:8px;padding:10px 18px;color:#fff}
.bn-btn.azul{background:#3483fa}
.bn-btn.roxo{background:#2D3277}
.mh-bloco3{margin:30px 0;text-align:center}
.mh-bloco3 h2{margin:0 0 16px}
.mh-3p{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:1000px;margin:0 auto;text-align:left}
.mh-3p>div{background:var(--mvo-card,#fff);border:1px solid var(--mvo-line,#e2e6ec);border-radius:16px;overflow:hidden;display:grid;gap:4px;padding-bottom:14px}
.mh-3p .p-img{height:180px;background-size:cover;background-position:center}
.mh-3p b{padding:8px 14px 0;font-size:1.1rem}
.mh-3p small{padding:0 14px;opacity:.8}
.mh-3p-cta a{display:inline-block;margin-top:16px;background:#FFE14D;color:#2b2b2b!important;font-weight:800;border-radius:999px;padding:12px 28px;text-decoration:none!important}
@media (max-width:782px){
  .bn-amarelo{grid-template-columns:1fr}.bn-cards{grid-template-columns:1fr 1fr;padding:14px}.bn-cards>div{min-height:96px}.bn-foto{min-height:240px}
  .bn-escuro{grid-template-columns:1fr}.bn-escuro h3{font-size:1.6rem}.bn-img{min-height:220px}
  .bn-par{grid-template-columns:1fr}.bn-par a{grid-template-columns:40% 1fr}.bn-par h3{font-size:1.15rem}
  .mh-3p{grid-template-columns:1fr}
}
</style>
<?php }, 24);


// Banner vermelho do topo humanizado: casal comprando pelo celular (Franklin, 2026-11-24).
add_action('wp_head', function () { if (!is_front_page()) return; ?>
<style>
.mh-hero{background:linear-gradient(90deg,#06341f 0%,#0b6b3a 38%,rgba(17,150,80,.55) 58%,rgba(53,208,127,0) 78%),url('/wp-content/uploads/2026/11/banners/mvo-casal-compras.jpg') right center/cover no-repeat!important;min-height:330px}
.mh-hero-sel{display:none!important}
.mh-hero-txt{max-width:560px}
.bn-trein{background:linear-gradient(135deg,#2D3277,#4a3fb3)!important}
.bn-sel{display:inline-block;background:#FFE14D;color:#2b2b2b;font-weight:800;border-radius:999px;padding:3px 10px;margin-bottom:8px;font-size:.75rem}
@media (max-width:782px){.mh-hero{background:linear-gradient(180deg,rgba(6,52,31,.25) 0%,#0a5a31 52%,#0b6b3a 100%),url('/wp-content/uploads/2026/11/banners/mvo-casal-compras.jpg') center top/100% auto no-repeat!important;padding-top:190px!important}}
</style>
<?php }, 25);

// Marketplace como APLICATIVO instalável (PWA) — Franklin, 2026-11-24.
// Arquivos em /app-loja/ (manifest + ícones) e /sw-loja.js na raiz do site.
add_action('wp_head', function () { ?>
<link rel="manifest" href="/app-loja/manifest.json">
<meta name="theme-color" content="#FFE14D">
<link rel="apple-touch-icon" href="/app-loja/loja-icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Máquina de Vendas">
<style>
.mvo-app-btn{display:inline-flex;align-items:center;gap:8px;background:#2D3277;color:#fff!important;font-weight:800;border:0;border-radius:999px;padding:12px 22px;cursor:pointer;text-decoration:none!important;font-size:1rem}
.mvo-app-ios{display:none;margin-top:8px;font-size:.88rem;opacity:.9}
.bn-app{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;background:linear-gradient(135deg,#FFE14D,#ffd21f);border-radius:18px;padding:22px 26px;margin:26px 0;color:#2b2b2b}
.bn-app h3{margin:0 0 6px;font-size:1.6rem;color:#2D3277}
.bn-app p{margin:0;color:#2b2b2b!important}
.bn-app .ico{flex:none;width:96px;height:96px;border-radius:22px;background:url('/app-loja/loja-icon-192.png') center/cover;box-shadow:0 6px 18px rgba(0,0,0,.25)}
.bn-app .esq{display:flex;gap:18px;align-items:center}
@media (max-width:782px){.bn-app{grid-template-columns:1fr}.bn-app .ico{width:72px;height:72px}.bn-app h3{font-size:1.25rem}}
html[data-mvo-app="1"] .mvo-so-site{display:none!important}
</style>
<script>
(function(){
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw-loja.js').catch(function(){});
  var instalado = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (instalado) document.documentElement.setAttribute('data-mvo-app','1');
  var pedido = null;
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); pedido = e; });
  window.mvoInstalarApp = function(btn){
    if (pedido) { pedido.prompt(); pedido.userChoice.then(function(){ pedido = null; }); return; }
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var dica = btn && btn.parentNode && btn.parentNode.querySelector('.mvo-app-ios');
    if (dica) { dica.style.display = 'block'; dica.textContent = ios
      ? 'No iPhone: toque em Compartilhar (□↑) e depois em "Adicionar à Tela de Início".'
      : 'No celular: abra o menu do navegador (⋮) e toque em "Instalar app" ou "Adicionar à tela inicial".'; }
  };
})();
</script>
<?php }, 2);
