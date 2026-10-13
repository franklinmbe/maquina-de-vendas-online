// Gráficos das páginas "Saiba mais" (/conheca/*) — SVG desenhado à mão, sem
// biblioteca. Linha (evolução, com marcador e dica ao tocar) e barras (por dia
// ou por categoria). Cores na ordem fixa da paleta validada pro fundo escuro.
(function () {
  const C = { blue: '#3987e5', orange: '#d95926', aqua: '#199e70' };
  const NS = 'http://www.w3.org/2000/svg';
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const int = (v) => Math.round(Number(v || 0)).toLocaleString('pt-BR');
  const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const day = (d) => String(d).slice(8, 10) + '/' + String(d).slice(5, 7);

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function frame(host, height) {
    host.classList.add('chart');
    host.innerHTML = '';
    const W = Math.max(280, host.clientWidth || 600);
    const svg = el('svg', { viewBox: `0 0 ${W} ${height}`, width: '100%', height, role: 'img' }, host);
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    host.appendChild(tip);
    return { svg, tip, W };
  }
  function showTip(host, tip, html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    const w = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(0, x - w / 2), host.clientWidth - w) + 'px';
    tip.style.top = Math.max(0, y - tip.offsetHeight - 12) + 'px';
  }
  function yAxis(svg, W, top, bottom, left, max, fmt) {
    for (let i = 0; i <= 3; i += 1) {
      const v = (max / 3) * i;
      const y = bottom - ((bottom - top) * i) / 3;
      el('line', { x1: left, x2: W - 8, y1: y, y2: y, class: i ? 'grid' : 'base' }, svg);
      const t = el('text', { x: left - 6, y: y + 4, 'text-anchor': 'end', class: 'tick' }, svg);
      t.textContent = fmt(v);
    }
  }
  function xLabels(svg, xs, labels, y) {
    const step = Math.max(1, Math.ceil(labels.length / 6));
    const lastShown = Math.floor((labels.length - 1) / step) * step;
    labels.forEach((l, i) => {
      const isLast = i === labels.length - 1;
      if (i % step && !isLast) return;
      if (isLast && i !== lastShown && i - lastShown < step * 0.7) return; // não encavala com o anterior
      if (!isLast && i === lastShown && labels.length - 1 - i < step * 0.7 && i !== 0) return;
      const t = el('text', { x: xs[i], y, 'text-anchor': 'middle', class: 'tick' }, svg);
      t.textContent = l;
    });
  }
  function table(host, head, rows) {
    const d = document.createElement('details');
    d.className = 'chart-table';
    d.innerHTML = `<summary>Ver em tabela</summary><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    host.after(d);
  }

  // series: [{ name, color, points: [{ x: 'AAAA-MM-DD', y }] }]
  function line(host, { series, fmt = int, height = 240, min0 = false }) {
    series = series.filter((s) => s.points.length);
    if (!series.length) return false;
    const { svg, tip, W } = frame(host, height);
    const xsAll = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort();
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (min0) lo = 0;
    const pad = (hi - lo) * 0.15 || Math.max(1, hi * 0.05);
    lo = min0 ? 0 : Math.max(0, lo - pad);
    hi = hi + pad;
    // Divisões redondas no eixo (ex.: 240, 250, 260…), nunca 263,633.
    const raw = (hi - lo) / 3;
    const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const stepY = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) || 10 * mag;
    lo = Math.floor(lo / stepY) * stepY;
    hi = lo + stepY * Math.max(3, Math.ceil((hi - lo) / stepY));
    const ticksN = Math.round((hi - lo) / stepY);
    const left = 52, top = 14, bottom = height - 28, right = W - 64;
    const X = (x) => (xsAll.length === 1 ? (left + right) / 2 : left + ((right - left) * xsAll.indexOf(x)) / (xsAll.length - 1));
    const Y = (y) => bottom - ((bottom - top) * (y - lo)) / (hi - lo);
    for (let i = 0; i <= ticksN; i += 1) {
      const v = lo + stepY * i, y = Y(v);
      el('line', { x1: left, x2: W - 8, y1: y, y2: y, class: i ? 'grid' : 'base' }, svg);
      el('text', { x: left - 6, y: y + 4, 'text-anchor': 'end', class: 'tick' }, svg).textContent = fmt(v);
    }
    xLabels(svg, xsAll.map(X), xsAll.map(day), height - 8);
    series.forEach((s) => {
      const pts = s.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ');
      if (series.length === 1) {
        const first = s.points[0], last = s.points[s.points.length - 1];
        el('polygon', { points: `${X(first.x)},${bottom} ${pts} ${X(last.x)},${bottom}`, fill: s.color, opacity: 0.12 }, svg);
      }
      el('polyline', { points: pts, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      const last = s.points[s.points.length - 1];
      el('circle', { cx: X(last.x), cy: Y(last.y), r: 4.5, fill: s.color, stroke: '#12161e', 'stroke-width': 2 }, svg);
      el('text', { x: X(last.x) + 8, y: Y(last.y) + 4, class: 'endlbl' }, svg).textContent = fmt(last.y);
    });
    const cross = el('line', { y1: top, y2: bottom, class: 'cross', visibility: 'hidden' }, svg);
    const dots = series.map((s) => el('circle', { r: 5, fill: s.color, stroke: '#12161e', 'stroke-width': 2, visibility: 'hidden' }, svg));
    const hit = el('rect', { x: left, y: 0, width: right - left + 20, height, fill: 'transparent' }, svg);
    const move = (clientX) => {
      const r = svg.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * W;
      let i = xsAll.length === 1 ? 0 : Math.round(((px - left) / (right - left)) * (xsAll.length - 1));
      i = Math.max(0, Math.min(xsAll.length - 1, i));
      const x = xsAll[i];
      cross.setAttribute('x1', X(x)); cross.setAttribute('x2', X(x)); cross.setAttribute('visibility', 'visible');
      let html = `<b>${day(x)}/${x.slice(0, 4)}</b>`;
      series.forEach((s, k) => {
        const p = s.points.find((q) => q.x === x);
        if (p) { dots[k].setAttribute('cx', X(x)); dots[k].setAttribute('cy', Y(p.y)); dots[k].setAttribute('visibility', 'visible'); }
        else dots[k].setAttribute('visibility', 'hidden');
        html += `<span><i style="background:${s.color}"></i>${esc(s.name)}: ${p ? fmt(p.y) : '—'}</span>`;
      });
      showTip(host, tip, html, (X(x) / W) * r.width, (top / height) * r.height + 20);
    };
    const leave = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); };
    hit.addEventListener('mousemove', (e) => move(e.clientX));
    hit.addEventListener('touchstart', (e) => move(e.touches[0].clientX), { passive: true });
    hit.addEventListener('touchmove', (e) => move(e.touches[0].clientX), { passive: true });
    hit.addEventListener('mouseleave', leave);
    if (series.length > 1) {
      const lg = document.createElement('div');
      lg.className = 'chart-legend';
      lg.innerHTML = series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
      host.prepend(lg);
    }
    table(host, ['Data', ...series.map((s) => s.name)], xsAll.map((x) => [day(x) + '/' + x.slice(0, 4), ...series.map((s) => { const p = s.points.find((q) => q.x === x); return p ? fmt(p.y) : '—'; })]));
    return true;
  }

  // Barras em pé: data = [{ label, value, tip? }] (ex.: um por dia)
  function bars(host, { data, fmt = int, height = 220, color = C.blue, name = 'Valor' }) {
    if (!data.length) return false;
    const { svg, tip, W } = frame(host, height);
    const left = 44, top = 14, bottom = height - 28, right = W - 8;
    // Teto = 3 divisões redondas (ex.: 0, 1.000, 2.000, 3.000).
    const raw = Math.max(...data.map((d) => d.value)) / 3;
    const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const stepB = Math.max(Number.isInteger(data[0].value) ? 1 : 0, [1, 2, 5, 10].map((m) => m * mag).find((v) => v >= raw) || 10 * mag);
    const max = stepB * 3;
    yAxis(svg, W, top, bottom, left, max, fmt);
    const slot = (right - left) / data.length;
    const bw = Math.max(3, Math.min(36, slot - 2));
    const xs = data.map((d, i) => left + slot * i + slot / 2);
    xLabels(svg, xs, data.map((d) => d.label), height - 8);
    data.forEach((d, i) => {
      const h = ((bottom - top) * d.value) / max;
      const x = xs[i] - bw / 2;
      if (d.value > 0) {
        const r = Math.min(4, bw / 2, h);
        el('path', { d: `M${x},${bottom} V${bottom - h + r} Q${x},${bottom - h} ${x + r},${bottom - h} H${x + bw - r} Q${x + bw},${bottom - h} ${x + bw},${bottom - h + r} V${bottom} Z`, fill: d.color || color }, svg);
      }
      const hit = el('rect', { x: left + slot * i, y: top, width: slot, height: bottom - top, fill: 'transparent' }, svg);
      const on = () => { const r = svg.getBoundingClientRect(); showTip(host, tip, `<b>${esc(d.tip || d.label)}</b><span>${esc(name)}: ${fmt(d.value)}</span>`, (xs[i] / W) * r.width, ((bottom - h) / height) * r.height); };
      hit.addEventListener('mouseenter', on);
      hit.addEventListener('touchstart', on, { passive: true });
      hit.addEventListener('mouseleave', () => { tip.hidden = true; });
    });
    table(host, ['', name], data.map((d) => [d.tip || d.label, fmt(d.value)]));
    return true;
  }

  // Barras deitadas: data = [{ label, value, color?, note? }] — comparar itens
  function hbars(host, { data, fmt = int, color = C.blue, name = 'Valor', avg }) {
    if (!data.length) return false;
    host.classList.add('chart');
    const max = Math.max(...data.map((d) => d.value), avg || 0) * 1.15 || 1;
    host.innerHTML = data.map((d) => `<div class="hbar" title="${esc(d.label)}: ${esc(fmt(d.value))}"><span class="hbar-l">${esc(d.label)}</span><div class="hbar-t"><div class="hbar-b" style="width:${(d.value / max) * 100}%;background:${d.color || color}"></div><span class="hbar-v">${esc(fmt(d.value))}${d.note ? ` <small>${esc(d.note)}</small>` : ''}</span>${avg ? `<i class="hbar-avg" style="left:${(avg / max) * 100}%"></i>` : ''}</div></div>`).join('') +
      (avg ? `<p class="chart-note"><i class="avg-key"></i> Média: ${esc(fmt(avg))}</p>` : '');
    table(host, ['', name], data.map((d) => [d.label, fmt(d.value)]));
    return true;
  }

  // "Subindo / descendo": compara o primeiro e o último ponto.
  // goodWhenUp=false para custo (custo caindo é bom).
  function trend(first, last, { fmt = int, goodWhenUp = true, pct: showPct = true } = {}) {
    if (first == null || last == null) return '';
    const diff = last - first;
    if (Math.abs(diff) < 1e-9) return '<span class="trend flat">→ Estável</span>';
    const up = diff > 0;
    const good = up === goodWhenUp;
    const pct = first && showPct ? ` (${up ? '+' : ''}${((diff / first) * 100).toFixed(0)}%)` : '';
    return `<span class="trend ${good ? 'good' : 'bad'}">${up ? '▲ Subindo' : '▼ Descendo'} ${up ? '+' : '−'}${fmt(Math.abs(diff))}${pct}</span>`;
  }

  // Sessão já salva pelo app (sem pedir senha de novo). A sessão atual vem
  // primeiro, assim o admin "postando como" um cliente vê os dados dele.
  function session() {
    for (const k of ['mvo_session', 'mvo_report_handoff', 'mvo_admin_session']) {
      try { const h = JSON.parse(localStorage.getItem(k) || 'null'); if (h && h.identifier && h.password) return h; } catch (e) { /* sem acesso ao armazenamento */ }
    }
    return null;
  }
  async function api(path, body) {
    const s = session();
    if (!s) throw new Error('login');
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: s.identifier, password: s.password, ...(body || {}) }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'erro');
    return j;
  }

  window.Charts = { C, line, bars, hbars, trend, api, session, esc, int, brl, day };
})();
