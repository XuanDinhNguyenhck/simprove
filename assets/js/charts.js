/* SVG charts, no dependencies.
   Colour: one amber hue, light→dark — every chart here encodes magnitude, so the
   ramp is sequential by design. The 5-step heatmap ramp is validated for monotone
   lightness, step separation and contrast against the panel surface. */

const Charts = (() => {
  const SURFACE = '#131B23';
  const EMPTY   = '#1B242D';                                      /* "nothing logged", not a data step */
  const RAMP    = ['#6B5122', '#A2762B', '#CB9531', '#F5B33C'];   /* level 1 → 4 */
  const GRID    = '#26333E';
  const MUTE    = '#7E8F9C';
  const svgNS   = 'http://www.w3.org/2000/svg';

  /* ---- shared tooltip ---- */
  let tip;
  function tooltip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tip';
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(target, html) {
    const t = tooltip();
    t.innerHTML = html;
    t.hidden = false;
    const r = target.getBoundingClientRect();
    const w = t.offsetWidth, h = t.offsetHeight;
    let x = r.left + r.width / 2 - w / 2 + window.scrollX;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    t.style.left = x + 'px';
    t.style.top = (r.top + window.scrollY - h - 10) + 'px';
  }
  const hideTip = () => { if (tip) tip.hidden = true; };
  window.addEventListener('scroll', hideTip, { passive: true });

  function el(name, attrs, parent) {
    const n = document.createElementNS(svgNS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* interactive marks are focusable, so keyboard reaches the same values as hover */
  function hoverable(node, html) {
    node.setAttribute('tabindex', '0');
    node.addEventListener('mouseenter', () => showTip(node, html));
    node.addEventListener('focus', () => showTip(node, html));
    node.addEventListener('mouseleave', hideTip);
    node.addEventListener('blur', hideTip);
  }

  /* =========================================================
     Calendar heatmap — 53 weeks, magnitude by amber level
     cells: [{ key, level (0-4), label (tooltip html) }]
     ========================================================= */
  function heatmap(host, weeks, opts) {
    const CELL = 12, GAP = 3, LEFT = 26, TOP = 18;   /* 53 weeks fit the 900px column without scrolling */
    const cols = weeks.length;
    const w = LEFT + cols * (CELL + GAP);
    const h = TOP + 7 * (CELL + GAP);
    host.innerHTML = '';

    const svg = el('svg', {
      width: w, height: h, viewBox: `0 0 ${w} ${h}`,
      role: 'img', 'aria-label': opts.title
    }, host);

    /* month labels */
    let lastMonth = -1, lastAt = -9;
    weeks.forEach((week, i) => {
      const first = week.find(Boolean);
      if (!first) return;
      const m = Store.parse(first.key).getMonth();
      if (m !== lastMonth && i < cols - 1 && i - lastAt >= 3) {   /* keep labels from colliding */
        lastMonth = m; lastAt = i;
        const t = el('text', {
          x: LEFT + i * (CELL + GAP), y: 11, class: 'ax'
        }, svg);
        t.textContent = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m];
      }
    });

    /* weekday labels — Mon / Wed / Fri only, so the column stays quiet (rows are Monday-first) */
    [[0, 'M'], [2, 'W'], [4, 'F']].forEach(([row, ch]) => {
      const t = el('text', { x: 0, y: TOP + row * (CELL + GAP) + CELL - 2, class: 'ax' }, svg);
      t.textContent = ch;
    });

    weeks.forEach((week, i) => week.forEach((cell, row) => {
      if (!cell) return;
      const rect = el('rect', {
        x: LEFT + i * (CELL + GAP), y: TOP + row * (CELL + GAP),
        width: CELL, height: CELL, rx: 3,
        fill: cell.level ? RAMP[cell.level - 1] : EMPTY,
        class: 'cell' + (cell.today ? ' cell-today' : '')
      }, svg);
      hoverable(rect, cell.label);
      rect.addEventListener('click', () => opts.onPick && opts.onPick(cell.key));
      rect.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onPick && opts.onPick(cell.key); }
      });
    }));
    return svg;
  }

  function legend(host) {
    host.innerHTML = '';
    const span = t => { const s = document.createElement('span'); s.textContent = t; return s; };
    host.appendChild(span('None'));
    [EMPTY, ...RAMP].forEach(c => {
      const b = document.createElement('i');
      b.style.background = c;
      host.appendChild(b);
    });
    host.appendChild(span('More'));
  }

  /* =========================================================
     Line chart — one series, so no legend box; the title names it
     points: [{ key, value }] oldest first
     ========================================================= */
  function line(host, points, opts) {
    host.innerHTML = '';
    if (points.length < 2) {
      host.innerHTML = `<p class="empty">${opts.emptyText}</p>`;
      return;
    }
    const W = 700, H = 220, P = { t: 16, r: 68, b: 26, l: 44 };
    const xs = points.map((_, i) => i);
    const vals = points.map(p => p.value);
    let min = Math.min(...vals), max = Math.max(...vals);
    const pad = (max - min) * 0.15 || 1;
    min -= pad; max += pad;

    const X = i => P.l + (i / (points.length - 1)) * (W - P.l - P.r);
    const Y = v => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);

    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`,
      role: 'img', 'aria-label': opts.title, class: 'chart-svg'
    }, host);

    /* hairline solid gridlines + clean ticks */
    const ticks = niceTicks(min, max, 5);
    ticks.forEach(v => {
      el('line', { x1: P.l, x2: W - P.r, y1: Y(v), y2: Y(v), stroke: GRID, 'stroke-width': 1 }, svg);
      const t = el('text', { x: P.l - 8, y: Y(v) + 4, class: 'ax', 'text-anchor': 'end' }, svg);
      t.textContent = fmt(v, opts.dp);
    });

    const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(p.value)}`).join(' ');
    el('path', { d, fill: 'none', stroke: RAMP[3], 'stroke-width': 2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);

    points.forEach((p, i) => {
      /* 2px surface ring keeps the dot legible where it crosses the line */
      el('circle', { cx: X(i), cy: Y(p.value), r: 5, fill: SURFACE }, svg);
      const dot = el('circle', { cx: X(i), cy: Y(p.value), r: 3.5, fill: RAMP[3], class: 'dot' }, svg);
      /* hit target is bigger than the mark */
      const hit = el('circle', { cx: X(i), cy: Y(p.value), r: 12, fill: 'transparent', class: 'hit' }, svg);
      hoverable(hit, `<b>${fmt(p.value, opts.dp)} ${opts.unit}</b><br>${nice(p.key)}`);
      dot.setAttribute('pointer-events', 'none');
    });

    /* label the endpoint only — the axis carries the rest */
    const last = points[points.length - 1];
    const lbl = el('text', { x: X(points.length - 1) + 10, y: Y(last.value) + 4, class: 'ax-em' }, svg);
    lbl.textContent = fmt(last.value, opts.dp) + ' ' + opts.unit;

    /* x extent */
    const a = el('text', { x: P.l, y: H - 6, class: 'ax' }, svg); a.textContent = nice(points[0].key);
    const b = el('text', { x: W - P.r, y: H - 6, class: 'ax', 'text-anchor': 'end' }, svg);
    b.textContent = nice(last.key);
  }

  /* =========================================================
     Columns — weekly totals
     bars: [{ label, value, sub }]
     ========================================================= */
  function columns(host, bars, opts) {
    host.innerHTML = '';
    if (!bars.length) { host.innerHTML = `<p class="empty">${opts.emptyText}</p>`; return; }
    const W = 700, H = 200, P = { t: 14, r: 12, b: 30, l: 48 };
    const max = Math.max(...bars.map(b => b.value), 1);
    const band = (W - P.l - P.r) / bars.length;
    const bw = Math.min(24, band - 8);                 /* capped; leftover band is air */
    const base = H - P.b;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`,
      role: 'img', 'aria-label': opts.title, class: 'chart-svg' }, host);

    niceTicks(0, max, 3).forEach(v => {
      const y = base - (v / max) * (base - P.t);
      el('line', { x1: P.l, x2: W - P.r, y1: y, y2: y, stroke: GRID, 'stroke-width': 1 }, svg);
      const t = el('text', { x: P.l - 8, y: y + 4, class: 'ax', 'text-anchor': 'end' }, svg);
      t.textContent = compact(v);
    });

    bars.forEach((b, i) => {
      const x = P.l + i * band + (band - bw) / 2;
      const hgt = Math.max(2, (b.value / max) * (base - P.t));
      const r = Math.min(4, hgt);                       /* 4px rounded top, square at the baseline */
      const d = `M${x} ${base} V${base - hgt + r} q0 ${-r} ${r} ${-r} h${bw - 2 * r} q${r} 0 ${r} ${r} V${base} Z`;
      el('path', { d, fill: RAMP[3] }, svg);
      const hit = el('rect', { x: P.l + i * band, y: P.t, width: band, height: base - P.t,
        fill: 'transparent', class: 'hit' }, svg);
      hoverable(hit, `<b>${compact(b.value)} ${opts.unit}</b><br>${b.sub}`);
      if (i % Math.ceil(bars.length / 8) === 0) {
        const t = el('text', { x: P.l + i * band + band / 2, y: H - 8, class: 'ax', 'text-anchor': 'middle' }, svg);
        t.textContent = b.label;
      }
    });
  }

  /* ---- number helpers ---- */
  function niceTicks(min, max, count) {
    const span = max - min || 1;
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || mag * 10;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
    return out;
  }
  const fmt = (v, dp = 0) => v.toFixed(dp);
  const compact = v => v >= 10000 ? (v / 1000).toFixed(0) + 'k' : Math.round(v).toLocaleString();
  const nice = k => Store.parse(k).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return { heatmap, legend, line, columns, RAMP, compact };
})();
