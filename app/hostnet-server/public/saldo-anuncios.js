// Bloco "Saldo dos anúncios" (Meta Ads) — usado no Relatório completo e no
// Meu painel. Uso: mvoSaldoAnuncios(elemento, { identifier, password } | { share }, { conta, cliente }).
// Dados: POST /api/saldo-anuncios (lib/saldo-anuncios.js). Anúncios = verde.
(function () {
  const css = `
.sa-box{border:2px solid #2fbf71;border-radius:14px;padding:14px 16px;background:rgba(47,191,113,.07);display:grid;gap:12px;color:inherit}
.sa-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.sa-head b{font-size:1rem}
.sa-btn{font:inherit;font-weight:700;font-size:.9rem;padding:8px 14px;border-radius:999px;border:2px solid #2fbf71;background:transparent;color:inherit;cursor:pointer}
.sa-btn:hover{box-shadow:0 0 0 3px rgba(47,191,113,.35)}
.sa-btn[disabled]{opacity:.6;cursor:wait}
.sa-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.sa-acc{border:1px solid rgba(127,127,127,.3);border-radius:10px;padding:12px 14px;display:grid;gap:3px}
.sa-acc small{opacity:.75;font-size:.8rem}
.sa-val{font-size:1.5rem;font-weight:700;font-family:"IBM Plex Mono",Consolas,monospace}
.sa-low{color:#e5484d}
.sa-tag{justify-self:start;font-size:.75rem;font-weight:700;padding:2px 9px;border-radius:999px;background:rgba(229,72,77,.15);color:#e5484d}
.sa-foot{font-size:.82rem;opacity:.8}`;
  if (!document.getElementById('sa-css')) {
    const st = document.createElement('style'); st.id = 'sa-css'; st.textContent = css; document.head.appendChild(st);
  }
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hora = (iso) => {
    const d = new Date(iso); const hoje = new Date();
    const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === hoje.toDateString() ? `hoje às ${h}` : `${d.toLocaleDateString('pt-BR')} às ${h}`;
  };

  function conta(c) {
    if (c.erro) return `<div class="sa-acc"><small>Conta ${esc(c.act)}</small><span>${esc(c.erro)}</span></div>`;
    let corpo;
    if (c.prePaga) {
      corpo = c.saldo == null
        ? '<span>A Meta não mostrou o valor agora.</span>'
        : `<span class="sa-val ${c.baixo ? 'sa-low' : ''}">${brl(c.saldo)}</span><small>saldo disponível para anúncios</small>${c.baixo ? '<span class="sa-tag">Acabando — recarregue</span>' : ''}`;
    } else {
      corpo = `<span class="sa-val">${brl(c.aCobrar || 0)}</span><small>gasto ainda não cobrado${c.pagamento ? ` · cobra no cartão ${esc(c.pagamento)}` : ''}</small>${c.limiteRestante != null ? `<small>Limite da conta: restam ${brl(c.limiteRestante)}</small>` : ''}`;
    }
    return `<div class="sa-acc"><small>${esc(c.nome || 'Conta ' + c.act)}${c.ativa === false ? ' · desativada' : ''}</small>${corpo}<small>Atualizado ${hora(c.atualizadoEm)}${c.aviso ? ` · ${esc(c.aviso)}` : ''}</small></div>`;
  }

  window.mvoSaldoAnuncios = function (el, auth, opts) {
    opts = opts || {};
    if (!el) return;
    async function carregar(atualizar) {
      const btn = el.querySelector('.sa-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Atualizando…'; }
      let j;
      try {
        const r = await fetch('/api/saldo-anuncios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...auth, ...(opts.conta ? { conta: opts.conta } : {}), ...(opts.cliente ? { cliente: opts.cliente } : {}), atualizar: !!atualizar }) });
        j = await r.json();
        if (!r.ok) throw new Error(j.error || 'erro');
      } catch (e) {
        el.innerHTML = `<div class="sa-box"><div class="sa-head"><b>💰 Saldo dos anúncios</b></div><span>Não consegui ler o saldo agora. Tente de novo em instantes.</span></div>`;
        return;
      }
      if (!j.contas.length) {
        el.innerHTML = `<div class="sa-box"><div class="sa-head"><b>💰 Saldo dos anúncios</b></div><span>Nenhuma conta de anúncios ligada ao app ainda. Conecte o Facebook marcando a permissão de anúncios para ver o saldo aqui.</span></div>`;
        return;
      }
      const prox = j.proximaAtualizacao ? `Você postou: o saldo se atualiza sozinho ${hora(j.proximaAtualizacao)}. ` : '';
      el.innerHTML = `<div class="sa-box">
        <div class="sa-head"><b>💰 Saldo dos anúncios (Meta Ads)</b>${auth.share ? '' : '<button type="button" class="sa-btn">↻ Atualizar agora</button>'}</div>
        <div class="sa-list">${j.contas.map(conta).join('')}</div>
        <div class="sa-foot">${prox}O valor vem direto da Meta. Depois de cada postagem ele se atualiza sozinho em alguns minutos; o botão lê na hora.</div>
      </div>`;
      const b = el.querySelector('.sa-btn');
      if (b) b.addEventListener('click', () => carregar(true));
    }
    carregar(false);
  };
})();
