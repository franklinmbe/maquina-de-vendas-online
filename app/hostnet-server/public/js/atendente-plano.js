// Bloco "Atendente de WhatsApp" dos planos (Franklin, 2026-11-08): um só texto
// para os cartões de planos (index.html) e as páginas de cada plano. Serviço
// ainda em breve; quando lançar, trocar o selo e o texto aqui.
(function () {
  const css = `
  .atw-box{margin:0 0 14px;padding:14px;border-radius:12px;border:2px solid #25d366;background:linear-gradient(135deg,rgba(37,211,102,.16),rgba(77,158,255,.08));box-shadow:0 0 18px rgba(37,211,102,.28);text-align:left;color:#f2f2f0}
  .atw-soon{display:inline-block;font-size:.72rem;font-weight:900;letter-spacing:.04em;text-transform:uppercase;color:#ffc400;border:1px dashed #ffc400;border-radius:999px;padding:3px 10px;margin-bottom:8px}
  .atw-box h4{margin:0 0 4px;font-size:1.3rem;font-weight:900;color:#25d366;line-height:1.2}
  .atw-price{margin:0 0 10px;font-size:1.02rem;font-weight:800}
  .atw-box ul{margin:0 0 12px;padding-left:18px;font-size:.92rem;line-height:1.55}
  .atw-btn{display:block;text-align:center;text-decoration:none;font-weight:800;background:#25d366;color:#06210f;border-radius:10px;padding:11px 14px}
  .atw-btn.atw-alt{background:transparent;color:#25d366;border:2px solid #25d366;margin-top:8px}
  .atw-section .atw-box{margin:0;padding:22px;border-radius:18px}`;
  const box = `
    <div class="atw-box">
      <span class="atw-soon">Em breve</span>
      <h4>💬 Atendente de WhatsApp com IA</h4>
      <p class="atw-price">Serviço adicional: + R$ 100 por mês, somados a este plano.</p>
      <ul>
        <li>Atende os clientes da sua empresa no WhatsApp, 24 horas por dia.</li>
        <li>Você treina o atendente pelo aplicativo, com uma barra mostrando o quanto falta.</li>
        <li>Até 12.000 respostas por mês. Depois disso, R$ 0,02 por resposta.</li>
        <li>O WhatsApp é cobrado pela Meta, no seu cartão: 1.000 mensagens grátis por mês e, depois, cerca de R$ 0,035 cada.</li>
        <li>Quanto mais você usa o app, mais treinado ele fica, e você não precisa pagar montagem. Prefere que a gente monte? R$ 500, uma vez só.</li>
      </ul>
      <a class="atw-btn" href="/conheca/atendente-whatsapp.html" target="_blank" rel="noopener">🔎 Ver como funciona</a>
      <a class="atw-btn atw-alt" href="/atendente-painel-demo.html" target="_blank" rel="noopener">👀 Ver o painel funcionando</a>
    </div>`;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Tela de planos do app: logo depois do quadro de créditos de cada cartão.
  document.querySelectorAll('.plan-card[data-plan] .plan-credit-box').forEach((el) => {
    el.insertAdjacentHTML('afterend', box);
  });

  // Página de cada plano: uma seção antes do fechamento.
  const fim = document.querySelector('.wrap.final');
  if (fim && !document.querySelector('.plan-card[data-plan]')) {
    fim.insertAdjacentHTML('beforebegin', `<section class="atw-section"><div class="wrap">${box}</div></section>`);
  }
})();
