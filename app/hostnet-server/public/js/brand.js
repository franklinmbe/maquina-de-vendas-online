// "Aplicativo com a cara da sua empresa" (Franklin, 2026-10-13).
// Aplica o nome, a logo e as cores escolhidas pelo cliente (user.brand, ver
// routes/brand.js) nas telas do app. A escolha fica guardada no navegador
// (mvo_brand) pra aplicar na hora, sem piscar, e é conferida no servidor a
// cada login. Só vale com alguém logado: sem sessão, o app fica no padrão.
(function () {
  const KEY = 'mvo_brand';
  const PADRAO = { fundo: '#0a0d12', texto: '#f2f2f0', botoes: '#ff5a36', destaque: '#33d6cb' };
  // Tema claro/escuro (Franklin, 2026-10-17, igual ao CapCut): vale pra todo
  // usuário, em qualquer plano, guardado só neste aparelho (mvo_tema). As cores
  // da empresa ("cara da sua empresa"), quando existem, têm prioridade.
  const TEMA_KEY = 'mvo_tema';
  const CLARO = { fundo: '#f3f4f7', texto: '#15181e', botoes: '#ff5a36', destaque: '#0b8f87' };
  function getTema() { try { return localStorage.getItem(TEMA_KEY) === 'claro' ? 'claro' : 'escuro'; } catch (e) { return 'escuro'; } }
  const VARS = ['--bg', '--panel', '--panel-2', '--card', '--border', '--line', '--text', '--muted', '--accent', '--accent-hover', '--cyan', '--ground', '--surface', '--ink', '--accent-soft', 'color-scheme'];

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const lum = (h) => { const [r, g, b] = hex(h).map((v) => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

  function hasSession() {
    for (const k of ['mvo_session', 'mvo_report_handoff', 'mvo_admin_session']) {
      try { if (localStorage.getItem(k)) return true; } catch (e) { return false; }
    }
    return false;
  }

  function apply(brand) {
    const root = document.documentElement;
    let b = brand || {};
    if (!['fundo', 'texto', 'botoes', 'destaque'].some((k) => b[k]) && getTema() === 'claro') b = { ...b, ...CLARO };
    const temCor = ['fundo', 'texto', 'botoes', 'destaque'].some((k) => b[k]);
    if (!temCor) {
      VARS.forEach((v) => root.style.removeProperty(v));
      root.removeAttribute('data-brand-light');
    } else {
      const c = { ...PADRAO, ...b };
      const set = (k, v) => root.style.setProperty(k, v);
      set('--bg', c.fundo);
      set('--text', c.texto);
      set('--panel', mix(c.fundo, c.texto, 0.06));
      set('--card', mix(c.fundo, c.texto, 0.06));
      set('--panel-2', mix(c.fundo, c.texto, 0.11));
      set('--border', mix(c.fundo, c.texto, 0.18));
      set('--line', mix(c.fundo, c.texto, 0.18));
      set('--muted', mix(c.texto, c.fundo, 0.35));
      set('--accent', c.botoes);
      set('--accent-hover', mix(c.botoes, '#ffffff', 0.15));
      set('--cyan', c.destaque);
      // Nomes usados no Relatório completo.
      set('--ground', c.fundo);
      set('--surface', mix(c.fundo, c.texto, 0.06));
      set('--ink', c.texto);
      set('--accent-soft', mix(c.fundo, c.botoes, 0.22));
      const claro = lum(c.fundo) > 0.5;
      set('color-scheme', claro ? 'light' : 'dark');
      if (claro) root.setAttribute('data-brand-light', ''); else root.removeAttribute('data-brand-light');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', c.fundo);
    }
    // Logo e nome: só nas telas que marcam onde eles entram.
    const ready = () => {
      document.querySelectorAll('[data-brand-logo]').forEach((img) => {
        if (!img.dataset.brandDefault) img.dataset.brandDefault = img.getAttribute('src') || '';
        img.src = b.logo || img.dataset.brandDefault;
        img.classList.toggle('brand-logo-on', !!b.logo);
      });
      document.querySelectorAll('[data-brand-name]').forEach((el) => {
        el.textContent = b.nome || '';
        el.hidden = !b.nome;
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true }); else ready();
  }

  function cached() {
    try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); return c && c.brand ? c : null; } catch (e) { return null; }
  }
  function store(client, brand) {
    try { if (brand) localStorage.setItem(KEY, JSON.stringify({ client, brand })); else localStorage.removeItem(KEY); } catch (e) { /* sem armazenamento */ }
  }

  async function call(identifier, password, body) {
    const r = await fetch('/api/brand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Não consegui salvar agora.');
    if (typeof j.allowed === 'boolean') { api.allowed = j.allowed; api.message = j.message || ''; }
    return j.brand || null;
  }

  // Depois do login: confere no servidor e aplica (pode ter mudado em outro aparelho).
  async function load(identifier, password, client) {
    const brand = await call(identifier, password, { action: 'get' });
    store(client, brand);
    apply(brand);
    return brand;
  }
  async function save(identifier, password, client, brand) {
    const saved = await call(identifier, password, { action: 'save', brand });
    store(client, saved);
    apply(saved);
    return saved;
  }
  async function reset(identifier, password) {
    await call(identifier, password, { action: 'reset' });
    store(null, null);
    apply(null);
  }
  function clear() { store(null, null); apply(null); }

  const c = cached();
  if (c && hasSession()) apply(c.brand);
  else if (getTema() === 'claro') apply(null);

  function setTema(t) {
    try { localStorage.setItem(TEMA_KEY, t === 'claro' ? 'claro' : 'escuro'); } catch (e) { /* sem armazenamento */ }
    const cc = cached();
    apply(cc && hasSession() ? cc.brand : null);
  }

  const api = { PADRAO, apply, load, save, reset, clear, cached, lum, mix, getTema, setTema, allowed: true, message: '' };
  window.MVOBrand = api;
})();
