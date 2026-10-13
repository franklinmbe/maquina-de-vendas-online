// "🔗 Copiar link para enviar" (Franklin, 2026-10-13). Só o admin vê o botão:
// na página aberta (Relatório completo, Meu painel, "Saiba mais"…), gera o
// link que o dono da empresa abre direto, sem senha, só pra ver. O admin pode
// estar na conta dele (escolhendo a empresa no seletor da página) ou
// "postando como" o cliente. Quem abre um link desses (?s=…) vê um aviso de
// "só para ver" e a página usa a chave do link no lugar do login.
(function () {
  const SHARE = new URLSearchParams(location.search).get('s');
  window.MVOShare = { token: SHARE };

  function creds() {
    for (const k of ['mvo_session', 'mvo_report_handoff', 'mvo_admin_session']) {
      try { const h = JSON.parse(localStorage.getItem(k) || 'null'); if (h && h.identifier && h.password) return h; } catch (e) { /* sem armazenamento */ }
    }
    return null;
  }
  const post = (body) => fetch('/api/share-page', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json().then((j) => ({ ok: r.ok, j })));

  const css = `
  .mvo-share-btn{position:fixed;left:16px;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:9998;padding:11px 16px;border-radius:999px;border:2px solid #ffc400;background:#1a1606;color:#ffc400;font:800 .95rem system-ui,sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.45);cursor:pointer}
  .mvo-share-bg{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}
  .mvo-share-box{width:100%;max-width:440px;background:#12161f;color:#f2f2f0;border:2px solid #ffc400;border-radius:18px;padding:18px;font:500 .95rem/1.45 system-ui,sans-serif;display:flex;flex-direction:column;gap:10px}
  .mvo-share-box h3{margin:0;font-size:1.1rem;color:#ffc400}
  .mvo-share-box p{margin:0;color:#b7bfcc}
  .mvo-share-box input{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid #232a37;background:#0a0d12;color:#f2f2f0;font:inherit}
  .mvo-share-row{display:flex;gap:8px;flex-wrap:wrap}
  .mvo-share-row a,.mvo-share-row button{flex:1;text-align:center;text-decoration:none;padding:11px;border-radius:999px;border:0;font:800 .95rem system-ui,sans-serif;cursor:pointer}
  .mvo-share-copy{background:#ffc400;color:#1a1606}.mvo-share-wa{background:#25d366;color:#06231f}.mvo-share-x{background:transparent!important;color:#f2f2f0!important;border:1px solid #232a37!important}
  .mvo-share-note{position:sticky;top:0;z-index:9997;background:#1a1606;color:#ffc400;border-bottom:2px solid #ffc400;text-align:center;padding:8px 12px;font:700 .9rem system-ui,sans-serif}`;
  function addCss() { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

  // Empresa escolhida no seletor da página (só quando o admin está na conta dele).
  function contaAtual() {
    const sel = document.querySelector('#g-conta, #conta');
    return sel && sel.value ? sel.value : undefined;
  }

  function openBox(url, nome) {
    const bg = document.createElement('div');
    bg.className = 'mvo-share-bg';
    const msg = `Olá! Aqui está ${nome ? 'o ' + nome : 'a sua página'} da sua empresa, é só tocar para abrir: ${url}`;
    bg.innerHTML = `<div class="mvo-share-box"><h3>🔗 Link pronto para enviar</h3>
      <p>Quem receber abre direto, sem senha, só para ver os números desta empresa. Vale por 1 ano.</p>
      <input readonly value="${url.replace(/"/g, '&quot;')}">
      <div class="mvo-share-row"><button type="button" class="mvo-share-copy">📋 Copiar link</button><a class="mvo-share-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">💬 Enviar no WhatsApp</a></div>
      <div class="mvo-share-row"><button type="button" class="mvo-share-x">Fechar</button></div></div>`;
    document.body.appendChild(bg);
    const input = bg.querySelector('input');
    input.addEventListener('focus', () => input.select());
    bg.querySelector('.mvo-share-copy').addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(url); } catch (err) { input.select(); document.execCommand('copy'); }
      e.currentTarget.textContent = '✅ Copiado!';
    });
    bg.querySelector('.mvo-share-x').addEventListener('click', () => bg.remove());
    bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); });
  }

  async function init() {
    addCss();
    if (SHARE) {
      const n = document.createElement('div');
      n.className = 'mvo-share-note';
      n.textContent = '👀 Página enviada pela Máquina de Vendas Online — só para ver';
      document.body.prepend(n);
      return;
    }
    const c = creds();
    if (!c) return;
    let check;
    try { check = await post({ ...c, action: 'check' }); } catch (e) { return; }
    if (!check.ok || !check.j.admin) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mvo-share-btn';
    btn.textContent = '🔗 Copiar link para enviar';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const r = await post({ ...c, conta: contaAtual(), cliente: new URLSearchParams(location.search).get('cliente') || undefined });
        if (!r.ok) throw new Error(r.j.error || 'Não consegui gerar o link.');
        const hash = location.hash || (document.getElementById('graficos') ? '#graficos' : '');
        const url = `${location.origin}${location.pathname}?s=${encodeURIComponent(r.j.token)}${hash}`;
        openBox(url, (document.title.split('|')[0] || '').trim().toLowerCase());
      } catch (e) {
        alert(e.message);
      } finally {
        btn.disabled = false;
      }
    });
    document.body.appendChild(btn);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
