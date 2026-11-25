<?php
/**
 * Plugin Name: MVO – Notificação no celular (Web Push)
 * Description: Quando o cliente ganha um aviso no sininho (pedido, mensagem, resposta), o celular dele recebe
 *   a notificação na tela, mesmo com o app da loja fechado. O cliente ativa no sininho ("Ativar notificações").
 *   Envio sem conteúdo (só o "toque" assinado com VAPID); o service worker busca o aviso na conta. (Franklin, 24/11/2026)
 */
if (!defined('ABSPATH')) exit;

function mvo_b64u($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }

/* chaves VAPID (geradas uma vez) */
function mvo_vapid() {
  $priv = get_option('mvo_vapid_priv'); $pub = get_option('mvo_vapid_pub');
  if ($priv && $pub) return [$priv, $pub];
  $k = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
  if (!$k) return [null, null];
  openssl_pkey_export($k, $priv);
  $d = openssl_pkey_get_details($k);
  $pub = mvo_b64u("\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT));
  update_option('mvo_vapid_priv', $priv, false); update_option('mvo_vapid_pub', $pub, false);
  return [$priv, $pub];
}

/* assinatura ES256 (DER -> r||s) */
function mvo_es256($dados, $priv) {
  if (!openssl_sign($dados, $der, $priv, OPENSSL_ALGO_SHA256)) return null;
  $o = 3; $lr = ord($der[$o]); $r = substr($der, $o + 1, $lr); $o += 1 + $lr + 1; $ls = ord($der[$o]); $s = substr($der, $o + 1, $ls);
  $r = str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT); $s = str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);
  return $r . $s;
}

function mvo_push_enviar($user_id) {
  $subs = get_user_meta($user_id, '_mvo_push_subs', true); if (!is_array($subs) || !$subs) return;
  [$priv, $pub] = mvo_vapid(); if (!$priv) return;
  $mudou = false;
  foreach ($subs as $i => $s) {
    $p = wp_parse_url($s['endpoint']); if (empty($p['host'])) continue;
    $aud = $p['scheme'] . '://' . $p['host'];
    $h = mvo_b64u(wp_json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $c = mvo_b64u(wp_json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => 'https://maquinadevendasonline.com.br']));
    $sig = mvo_es256("$h.$c", $priv); if (!$sig) continue;
    $r = wp_remote_post($s['endpoint'], ['timeout' => 6, 'headers' => ['TTL' => '86400', 'Urgency' => 'high', 'Content-Length' => '0',
      'Authorization' => "vapid t=$h.$c." . mvo_b64u($sig) . ", k=$pub"], 'body' => '']);
    $code = is_wp_error($r) ? 0 : wp_remote_retrieve_response_code($r);
    if (in_array($code, [404, 410], true)) { unset($subs[$i]); $mudou = true; }
  }
  if ($mudou) update_user_meta($user_id, '_mvo_push_subs', array_values($subs));
}
add_action('mvo_notif_nova', function ($user_id) { mvo_push_enviar($user_id); });

/* salvar a inscrição do aparelho */
add_action('wp_ajax_mvo_push_sub', function () {
  check_ajax_referer('mvo_push', 'n');
  $s = json_decode(wp_unslash($_POST['sub'] ?? ''), true);
  if (empty($s['endpoint']) || !wp_http_validate_url($s['endpoint'])) wp_send_json_error('inscrição inválida');
  $u = get_current_user_id(); $l = get_user_meta($u, '_mvo_push_subs', true); if (!is_array($l)) $l = [];
  $l = array_values(array_filter($l, fn($x) => $x['endpoint'] !== $s['endpoint']));
  $l[] = ['endpoint' => esc_url_raw($s['endpoint']), 't' => time()];
  update_user_meta($u, '_mvo_push_subs', array_slice($l, -5));
  wp_send_json_success();
});

/* o service worker busca o aviso mais recente para mostrar */
add_action('wp_ajax_mvo_push_ultima', function () {
  $l = get_user_meta(get_current_user_id(), '_mvo_notifs', true);
  if (!is_array($l) || !$l) wp_send_json_error();
  $n = $l[0];
  wp_send_json_success(['id' => $n['id'], 'txt' => html_entity_decode($n['ic'] . ' ' . $n['txt']), 'link' => $n['link']]);
});
add_action('wp_ajax_nopriv_mvo_push_ultima', function () { wp_send_json_error(); });

/* botão "Ativar notificações" dentro do sininho */
add_action('wp_footer', function () {
  if (is_admin() || !is_user_logged_in()) return;
  [, $pub] = mvo_vapid(); if (!$pub) return; ?>
<script>
(function () {
  var pop = document.getElementById('mvo-nt-pop'); if (!pop || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  var box = document.createElement('div'); box.className = 'mvo-push-box';
  function b64(u) { var p = '='.repeat((4 - u.length % 4) % 4), s = atob((u + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function salvar(sub) { var f = new FormData(); f.append('action', 'mvo_push_sub'); f.append('n', '<?php echo wp_create_nonce('mvo_push'); ?>'); f.append('sub', JSON.stringify(sub)); return fetch('<?php echo esc_url(admin_url('admin-ajax.php')); ?>', { method: 'POST', body: f, credentials: 'same-origin' }); }
  function pinta(ok) { box.innerHTML = ok ? '✅ Notificações no celular ativadas' : '<button type="button">🔔 Ativar notificações no celular</button><small>Receba na tela os avisos do seu pedido, mesmo com o app fechado.</small>'; var bt = box.querySelector('button'); if (bt) bt.onclick = ativar; }
  function ativar() {
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { box.innerHTML = 'Você bloqueou os avisos. Para ativar, libere as notificações deste site nas configurações do celular.'; return; }
      navigator.serviceWorker.register('/sw-loja.js').then(function () { return navigator.serviceWorker.ready; }).then(function (reg) {
        return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64('<?php echo esc_js($pub); ?>') }); });
      }).then(function (s) { return salvar(s); }).then(function () { pinta(true); }).catch(function () { box.innerHTML = 'Não deu para ativar agora. No iPhone, instale o app da loja na tela de início e tente de novo.'; });
    });
  }
  pop.insertBefore(box, pop.querySelector('.mvo-nt-lista'));
  if (Notification.permission === 'granted') navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (s) { if (s) { salvar(s); pinta(true); } else pinta(false); }).catch(function () { pinta(false); });
  else pinta(false);
})();
</script>
<style>
.mvo-push-box{padding:10px 14px;background:#fff8d6;border-bottom:1px solid #f0e3a0;font-size:.88rem;color:#2b2b2b}
.mvo-push-box button{display:block;width:100%;padding:10px;border:0;border-radius:10px;background:linear-gradient(180deg,#FFF0A3,#FFE14D 55%,#FFD000);color:#2D3277;font-weight:800;cursor:pointer}
.mvo-push-box small{display:block;margin-top:6px;color:#666}
html:not([data-tema="claro"]) .mvo-push-box{background:#2a2410;color:#f2f2f0;border-color:#4a3b10}
</style>
<?php }, 90);
