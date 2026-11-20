// "🔊 Ouvir" nas respostas dos chats (Franklin, 2026-11-20): o chat continua
// respondendo por escrito e cada resposta ganha um botãozinho que lê o texto
// em voz alta, com a voz em português do próprio celular (speechSynthesis —
// grátis, sem baixar nada). Vale pra todos os usuários e todos os chats
// (Suporte e chat de criação): qualquer balão .support-msg.bot ou
// .creative-msg.bot que aparecer na tela recebe o botão.
(function () {
  if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return;
  const SELETOR = '.support-msg.bot, .creative-msg.bot';
  let tocando = null; // botão da mensagem que está falando agora

  function vozPt() {
    const vozes = window.speechSynthesis.getVoices() || [];
    return vozes.find((v) => /^pt[-_]BR/i.test(v.lang) && /google|natural|online/i.test(v.name))
      || vozes.find((v) => /^pt[-_]BR/i.test(v.lang))
      || vozes.find((v) => /^pt/i.test(v.lang))
      || null;
  }
  // Algumas vozes demoram pra carregar no Android — chama uma vez cedo.
  try { window.speechSynthesis.getVoices(); } catch (e) {}

  function textoDoBalao(el) {
    const copia = el.cloneNode(true);
    copia.querySelectorAll('button, .ouvir-btn, video, img, input').forEach((n) => n.remove());
    return (copia.innerText || copia.textContent || '')
      .replace(/[*_#`>]+/g, ' ')
      .replace(/\p{Extended_Pictographic}/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parar() {
    try { window.speechSynthesis.cancel(); } catch (e) {}
    if (tocando) { tocando.textContent = '🔊 Ouvir'; tocando.classList.remove('falando'); }
    tocando = null;
  }

  function falar(btn, texto) {
    if (tocando === btn) { parar(); return; }
    parar();
    if (!texto) return;
    const u = new SpeechSynthesisUtterance(texto);
    const v = vozPt();
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'pt-BR';
    u.rate = 1;
    u.onend = u.onerror = () => { if (tocando === btn) parar(); };
    tocando = btn;
    btn.textContent = '⏹ Parar';
    btn.classList.add('falando');
    window.speechSynthesis.speak(u);
  }

  function enfeitar(el) {
    if (!el || el.dataset.ouvir || el.classList.contains('loading') || el.classList.contains('preview')) return;
    const texto = textoDoBalao(el);
    if (!texto || texto.length < 3) return;
    el.dataset.ouvir = '1';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ouvir-btn';
    btn.textContent = '🔊 Ouvir';
    btn.setAttribute('aria-label', 'Ouvir esta resposta em áudio');
    btn.addEventListener('click', (e) => { e.stopPropagation(); falar(btn, textoDoBalao(el)); });
    el.appendChild(btn);
  }

  const css = document.createElement('style');
  css.textContent = '.ouvir-btn{display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:5px 12px;border-radius:999px;border:1px solid rgba(53,208,127,.6);background:rgba(53,208,127,.12);color:#35d07f;font:inherit;font-size:.82rem;font-weight:800;cursor:pointer}.ouvir-btn.falando{border-color:#ff5a36;background:rgba(255,90,54,.14);color:#ff5a36}';
  document.head.appendChild(css);

  function varrer(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    if (raiz.matches && raiz.matches(SELETOR)) enfeitar(raiz);
    raiz.querySelectorAll(SELETOR).forEach(enfeitar);
  }
  function iniciar() {
    varrer(document.body);
    new MutationObserver((muts) => {
      muts.forEach((m) => {
        m.addedNodes.forEach((n) => varrer(n));
        // "Pensando..." vira resposta trocando a classe/texto no mesmo balão
        if (m.type === 'attributes' || m.type === 'characterData') varrer(m.target.parentElement || m.target);
      });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    // Sair da tela/fechar o chat para a fala
    document.addEventListener('visibilitychange', () => { if (document.hidden) parar(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
