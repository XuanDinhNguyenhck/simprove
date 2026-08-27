/* UI. Renders three views off Store + PLAN; every input writes straight through
   to localStorage, so there is no save button and nothing to lose. */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let current = Store.key(new Date());
let view = 'log';

/* ============================ shell ============================ */

function setView(v) {
  view = v;
  $$('.tabs button').forEach(b => b.classList.toggle('is-on', b.dataset.view === v));
  $$('.view').forEach(s => s.hidden = s.id !== 'view-' + v);
  render();
}

function setDate(k) {
  current = k;
  if (view !== 'log') setView('log'); else render();
}

function render() {
  if (view === 'log') renderLog();
  if (view === 'heatmap') renderHeatmap();
  if (view === 'progress') renderProgress();
  if (view === 'data') renderData();
}

const dayName = k => Store.parse(k).toLocaleDateString(undefined,
  { weekday: 'long', day: 'numeric', month: 'long' });
const isToday = k => k === Store.key(new Date());

/* ============================ log view ============================ */

function renderLog() {
  const k = current;
  const sk = Store.sessionKey(k);
  const s = PLAN.sessions[sk];
  const d = Store.day(k);

  $('#log-date').value = k;
  $('#log-title').textContent = isToday(k) ? 'Today' : dayName(k);
  $('#log-sub').textContent = isToday(k) ? dayName(k) : '';

  /* --- session header --- */
  $('#session').innerHTML = `
    <div class="sess-head">
      <div>
        <p class="eyebrow ${s.kind}">${esc(s.day)} · ${esc(s.kind === 'gym' ? 'Gym' : s.name)}</p>
        <h3>${esc(s.name)}</h3>
        <p class="sess-focus">${esc(s.focus)}</p>
      </div>
      <label class="swap-sess">Session
        <select id="sess-pick">
          ${Object.keys(PLAN.sessions).map(key =>
            `<option value="${key}"${key === sk ? ' selected' : ''}>${esc(PLAN.sessions[key].name)}</option>`).join('')}
        </select>
      </label>
    </div>`;
  $('#sess-pick').onchange = e => {
    const v = e.target.value;
    Store.edit(k, day => {
      day.sessionOverride = v === PLAN.schedule[Store.parse(k).getDay()] ? undefined : v;
    });
    renderLog();
  };

  /* --- exercises --- */
  const list = Store.exercisesFor(k);
  const done = list.reduce((n, e) => n + e.logged.filter(x => x.done).length, 0);
  const planned = list.reduce((n, e) => n + Math.max(e.sets || 0, e.logged.length), 0);

  $('#work-sum').innerHTML = planned
    ? `<b class="num">${done}</b> of <b class="num">${planned}</b> sets · <b class="num">${Charts.compact(Store.volume(k))}</b> kg lifted`
    : 'No lifting scheduled — log anything extra you did below.';

  $('#exercises').innerHTML = list.map(e => exerciseCard(e, k)).join('') || '';
  wireExercises(k);

  /* --- meals --- */
  renderMeals(k);

  /* --- body --- */
  $('#f-weight').value = d.weight ?? '';
  $('#f-waist').value = d.waist ?? '';
  $('#f-note').value = d.note ?? '';
}

function exerciseCard(e, k) {
  const rows = Math.max(e.sets || 0, e.logged.length, 1);
  const last = Store.lastTime(e.name, k);
  const unit = e.unit === 'sec' ? 'sec' : 'reps';

  let sets = '';
  for (let i = 0; i < rows; i++) {
    const s = e.logged[i] || {};
    sets += `<div class="set${s.done ? ' is-done' : ''}" data-set="${i}">
      <span class="set-n num">${i + 1}</span>
      <label class="fld"><span>kg</span><input type="number" step="0.5" min="0" inputmode="decimal"
        data-f="kg" value="${s.kg ?? ''}" placeholder="${last ? (last.sets[Math.min(i, last.sets.length - 1)].kg ?? '') : ''}"></label>
      <label class="fld"><span>${unit}</span><input type="number" step="1" min="0" inputmode="numeric"
        data-f="reps" value="${s.reps ?? ''}" placeholder="${e.rep ?? ''}"></label>
      <button class="tick" data-act="done" aria-pressed="${!!s.done}" title="Mark set ${i + 1} done">✓</button>
      ${i >= (e.sets || 0) ? '<button class="x" data-act="delset" title="Remove set">×</button>' : ''}
    </div>`;
  }

  return `<article class="ex" data-ex="${esc(e.name)}">
    <header class="ex-head">
      <h4>${esc(e.name)}${e.custom ? '<span class="badge">added</span>' : ''}</h4>
      <p class="ex-load"><span class="num">${e.sets || '—'}</span> <span class="x">×</span> <span class="num">${esc(e.reps || '')}</span></p>
    </header>
    <p class="ex-meta">${esc(e.muscle || 'custom')} · ${esc(e.gear || '')}${e.rest ? ` · <span class="num">${e.rest}</span>s rest` : ''}
      ${e.superset ? `<span class="tag">superset with ${esc(e.superset)}</span>` : ''}
      ${e.alt ? `<span class="tag">or ${esc(e.alt)}</span>` : ''}</p>
    ${last ? `<p class="last">Last on ${esc(Store.parse(last.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))} —
       ${last.sets.map(s => `<span class="num">${s.kg || 0}×${s.reps || 0}</span>`).join(' ')}</p>` : ''}
    <div class="sets">${sets}</div>
    <div class="ex-foot">
      <button class="lnk" data-act="addset">+ set</button>
      ${e.cue ? `<button class="lnk" data-act="cue">Form cue</button>` : ''}
      <button class="lnk lnk-dim" data-act="drop">Skip</button>
    </div>
    ${e.cue ? `<p class="cue" hidden>${esc(e.cue)}</p>` : ''}
  </article>`;
}

function wireExercises(k) {
  $$('#exercises .ex').forEach(card => {
    const name = card.dataset.ex;
    const plan = Store.exercisesFor(k).find(x => x.name === name) || {};

    /* writing a value materialises the set row */
    card.querySelectorAll('.set input').forEach(inp => {
      inp.addEventListener('change', () => {
        const i = Number(inp.closest('.set').dataset.set);
        Store.edit(k, d => {
          const rec = d.ex[name] || (d.ex[name] = { sets: [] });
          rec.sets = rec.sets || [];
          while (rec.sets.length <= i) rec.sets.push({});
          const v = inp.value === '' ? undefined : Number(inp.value);
          rec.sets[i][inp.dataset.f] = v;
        });
      });
    });

    card.querySelectorAll('[data-act="done"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.set');
        const i = Number(row.dataset.set);
        Store.edit(k, d => {
          const rec = d.ex[name] || (d.ex[name] = { sets: [] });
          rec.sets = rec.sets || [];
          while (rec.sets.length <= i) rec.sets.push({});
          const s = rec.sets[i];
          s.done = !s.done;
          /* ticking a blank set fills in the target so it counts towards volume */
          if (s.done && s.reps == null) s.reps = plan.rep;
        });
        renderLog();
      });
    });

    const on = (act, fn) => card.querySelectorAll(`[data-act="${act}"]`).forEach(b => b.addEventListener('click', fn));

    on('addset', () => {
      Store.edit(k, d => {
        const rec = d.ex[name] || (d.ex[name] = { sets: [] });
        rec.sets = rec.sets || [];
        /* the array is sparse until you type into a row, so fill it up to what is
           on screen first — otherwise "+ set" lands below the planned rows and
           the card looks unchanged */
        const shown = Math.max(plan.sets || 0, rec.sets.length, 1);
        while (rec.sets.length < shown) rec.sets.push({});
        rec.sets.push({});
      });
      renderLog();
    });
    on('delset', e => {
      const i = Number(e.target.closest('.set').dataset.set);
      Store.edit(k, d => { const rec = d.ex[name]; if (rec && rec.sets) rec.sets.splice(i, 1); });
      renderLog();
    });
    on('drop', () => {
      Store.edit(k, d => {
        if (plan.custom) d.custom = d.custom.filter(x => x.name !== name);
        else (d.ex[name] || (d.ex[name] = {})).removed = true;
        if (d.ex[name]) d.ex[name].sets = [];
      });
      renderLog();
    });
    on('cue', () => { const c = card.querySelector('.cue'); c.hidden = !c.hidden; });
  });
}

/* ---- meals ---- */

function renderMeals(k) {
  const d = Store.day(k);
  const t = Store.target(k);
  const kcal = Store.kcal(k), prot = Store.protein(k);
  const pct = Math.min(100, Math.round(kcal / t.kcal * 100));

  $('#kcal-sum').innerHTML = `
    <div class="meter">
      <div class="meter-top">
        <span><b class="num">${kcal.toLocaleString()}</b> <span class="unit">of ${t.kcal.toLocaleString()} kcal</span></span>
        <span class="num ${kcal > t.kcal * 1.05 ? 'over' : ''}">${kcal - t.kcal >= 0 ? '+' : '−'}${Math.abs(kcal - t.kcal).toLocaleString()}</span>
      </div>
      <div class="meter-track"><div class="meter-fill" style="width:${pct}%"></div></div>
      <div class="meter-top meter-sub">
        <span>Protein <b class="num">${prot}</b> / ${t.protein} g</span>
        <span>${esc(t.why)}</span>
      </div>
    </div>`;

  const presets = PLAN.meals[PLAN.sessions[Store.sessionKey(k)].kind] || [];
  $('#meal-presets').innerHTML = presets.map((m, i) => `
    <button class="chip" data-preset="${i}">
      <span class="chip-when">${esc(m.when)}</span>
      <span class="chip-n num">${m.kcal} kcal · ${m.protein} P</span>
    </button>`).join('');

  $$('#meal-presets .chip').forEach(b => b.onclick = () => {
    const m = presets[Number(b.dataset.preset)];
    Store.edit(k, day => day.meals.push({ when: m.when, what: m.what, kcal: m.kcal, protein: m.protein }));
    renderLog();
  });

  $('#meals').innerHTML = d.meals.length ? d.meals.map((m, i) => `
    <li class="meal" data-i="${i}">
      <div class="meal-txt">
        <input class="meal-when" data-f="when" value="${esc(m.when)}" aria-label="Meal name">
        ${m.what ? `<span class="meal-what">${esc(m.what)}</span>` : ''}
      </div>
      <label class="fld"><span>kcal</span><input type="number" min="0" step="10" inputmode="numeric" data-f="kcal" value="${m.kcal ?? ''}"></label>
      <label class="fld"><span>P</span><input type="number" min="0" step="1" inputmode="numeric" data-f="protein" value="${m.protein ?? ''}"></label>
      <button class="x" data-act="delmeal" title="Remove">×</button>
    </li>`).join('') : '<li class="empty">Nothing logged yet. Tap a meal above, or add your own.</li>';

  $$('#meals .meal').forEach(li => {
    const i = Number(li.dataset.i);
    li.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
      Store.edit(k, day => {
        const f = inp.dataset.f;
        day.meals[i][f] = f === 'when' ? inp.value : (inp.value === '' ? 0 : Number(inp.value));
      });
      renderMeals(k);
    }));
    li.querySelector('[data-act="delmeal"]').onclick = () => {
      Store.edit(k, day => day.meals.splice(i, 1));
      renderLog();
    };
  });
}

/* ============================ heatmap view ============================ */

const METRICS = {
  sets:   { label: 'Sets completed', unit: 'sets',
            value: Store.doneSets,
            level: v => v === 0 ? 0 : v < 6 ? 1 : v < 12 ? 2 : v < 18 ? 3 : 4 },
  volume: { label: 'Volume lifted', unit: 'kg',
            value: Store.volume,
            level: (v, p90) => v === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil(v / (p90 || v) * 4))) },
  kcal:   { label: 'Calories vs target', unit: 'kcal',
            value: Store.kcal,
            level: (v, _, k) => {
              if (!v) return 0;
              const off = Math.abs(v / Store.target(k).kcal - 1);
              return off <= 0.05 ? 4 : off <= 0.12 ? 3 : off <= 0.25 ? 2 : 1;
            } }
};

function renderHeatmap() {
  const m = METRICS[Store.state.prefs.metric] || METRICS.sets;
  $$('#metric-pick button').forEach(b => b.classList.toggle('is-on', b.dataset.metric === Store.state.prefs.metric));

  /* 53 weeks back to the Monday on or before the start, Monday-first rows */
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

  const all = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) all.push(Store.key(new Date(d)));
  const values = all.map(k => m.value(k));
  const p90 = percentile(values.filter(v => v > 0), 0.9);

  const weeks = [];
  all.forEach(k => {
    const row = (Store.parse(k).getDay() + 6) % 7;
    if (row === 0 || !weeks.length) weeks.push([null, null, null, null, null, null, null]);
    const v = m.value(k);
    weeks[weeks.length - 1][row] = {
      key: k, level: m.level(v, p90, k), today: isToday(k),
      label: `<b>${dayName(k)}</b><br>${PLAN.sessions[Store.sessionKey(k)].name}<br>
              ${v ? `${Charts.compact(v)} ${m.unit}` : 'nothing logged'}${
              Store.state.prefs.metric === 'kcal' && v ? ` of ${Store.target(k).kcal.toLocaleString()}` : ''}`
    };
  });

  Charts.heatmap($('#heat'), weeks, { title: m.label + ' over the last year', onPick: setDate });
  const scroll = $('.heat-scroll');
  scroll.scrollLeft = scroll.scrollWidth;                 /* land on the recent weeks, not last September */
  Charts.legend($('#heat-legend'));

  /* streaks & totals */
  const logged = Store.loggedKeys();
  $('#heat-stats').innerHTML = [
    stat('Current streak', streak(), 'days in a row'),
    stat('Days logged', logged.length, 'since ' + (logged[0] ? Store.parse(logged[0]).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')),
    stat('Sets this year', values.reduce((a, _, i) => a + Store.doneSets(all[i]), 0), 'completed'),
    stat('Total volume', Charts.compact(all.reduce((a, k) => a + Store.volume(k), 0)), 'kg lifted')
  ].join('');

  $('#heat-table').innerHTML = logged.length
    ? `<table><thead><tr><th>Date</th><th>Session</th><th class="r">Sets</th><th class="r">Volume (kg)</th><th class="r">kcal</th></tr></thead><tbody>
       ${logged.slice().reverse().map(k => `<tr><td><button class="lnk" data-go="${k}">${k}</button></td>
         <td>${esc(PLAN.sessions[Store.sessionKey(k)].name)}</td>
         <td class="r num">${Store.doneSets(k) || '—'}</td>
         <td class="r num">${Store.volume(k) ? Math.round(Store.volume(k)).toLocaleString() : '—'}</td>
         <td class="r num">${Store.kcal(k) ? Store.kcal(k).toLocaleString() : '—'}</td></tr>`).join('')}
       </tbody></table>`
    : '<p class="empty">Nothing logged yet.</p>';
  $$('#heat-table [data-go]').forEach(b => b.onclick = () => setDate(b.dataset.go));
}

const stat = (label, value, sub) =>
  `<div class="stat"><dt>${label}</dt><dd>${value}</dd><p>${sub}</p></div>`;

function streak() {
  let n = 0;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (!Store.state.days[Store.key(d)]) d.setDate(d.getDate() - 1);   /* today may not be logged yet */
  while (Store.state.days[Store.key(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

/* ============================ progress view ============================ */

function renderProgress() {
  const logged = Store.loggedKeys();
  const weights = logged.filter(k => Store.day(k).weight != null)
    .map(k => ({ key: k, value: Number(Store.day(k).weight) }));
  const waists = logged.filter(k => Store.day(k).waist != null)
    .map(k => ({ key: k, value: Number(Store.day(k).waist) }));

  /* hero: latest weight and the weekly rate, which is the number the plan cares about */
  const latest = weights[weights.length - 1];
  const rate = weeklyRate(weights);
  $('#hero').innerHTML = latest ? `
    <p class="hero-label">Bodyweight</p>
    <p class="hero-num">${latest.value.toFixed(1)}<span class="unit">kg</span></p>
    <p class="hero-sub">${rate == null ? 'Log a second weigh-in to see the trend.'
      : `${rate >= 0 ? '+' : '−'}${Math.abs(rate).toFixed(2)} kg / week ·
         <span class="${rate <= -0.05 && rate >= -0.4 ? 'ok' : 'warn'}">${
           rate > -0.05 ? 'holding — fine if lifts are climbing'
           : rate < -0.4 ? 'dropping too fast — add 150 kcal'
           : 'in the −0.2 to −0.4 kg target'}</span>`}</p>`
    : `<p class="hero-label">Bodyweight</p><p class="hero-num">—</p>
       <p class="hero-sub">Weigh in on Sunday morning and log it on the day.</p>`;

  Charts.line($('#chart-weight'), weights,
    { title: 'Bodyweight over time', unit: 'kg', dp: 1, emptyText: 'Two weigh-ins needed before this draws.' });
  Charts.line($('#chart-waist'), waists,
    { title: 'Waist over time', unit: 'cm', dp: 1, emptyText: 'Measure at the navel every two weeks.' });

  /* weekly training volume */
  const byWeek = new Map();
  logged.forEach(k => {
    const wk = mondayOf(k);
    byWeek.set(wk, (byWeek.get(wk) || 0) + Store.volume(k));
  });
  const bars = Array.from(byWeek.entries()).sort().slice(-16).map(([wk, v]) => ({
    label: Store.parse(wk).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    value: v,
    sub: 'Week of ' + Store.parse(wk).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
  }));
  Charts.columns($('#chart-volume'), bars, { title: 'Volume per week', unit: 'kg', emptyText: 'Log some sets first.' });

  /* per-lift bests — progressive overload is the whole mechanism */
  const lifts = new Map();
  logged.forEach(k => {
    const rec = Store.day(k).ex || {};
    Object.keys(rec).forEach(name => {
      (rec[name].sets || []).filter(s => s.done).forEach(s => {
        const kg = Number(s.kg) || 0, reps = Number(s.reps) || 0;
        const cur = lifts.get(name) || { name, last: k, bestKg: 0, bestReps: 0, bestVol: 0 };
        cur.last = k > cur.last ? k : cur.last;
        if (kg > cur.bestKg || (kg === cur.bestKg && reps > cur.bestReps)) { cur.bestKg = kg; cur.bestReps = reps; }
        lifts.set(name, cur);
      });
      const vol = (rec[name].sets || []).filter(s => s.done)
        .reduce((t, s) => t + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0);
      const cur = lifts.get(name);
      if (cur && vol > cur.bestVol) cur.bestVol = vol;
    });
  });
  const rows = Array.from(lifts.values()).sort((a, b) => b.last.localeCompare(a.last));
  $('#lifts').innerHTML = rows.length
    ? `<table><thead><tr><th>Exercise</th><th>Last done</th><th class="r">Best set</th><th class="r">Best session volume</th></tr></thead><tbody>
       ${rows.map(r => `<tr><td>${esc(r.name)}</td>
         <td><button class="lnk" data-go="${r.last}">${Store.parse(r.last).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</button></td>
         <td class="r num">${r.bestKg ? `${r.bestKg} × ${r.bestReps}`
              : (r.bestReps ? `${r.bestReps} ${(PLAN.byName[r.name] || {}).unit === 'sec' ? 's' : 'reps'}` : '—')}</td>
         <td class="r num">${r.bestVol ? Math.round(r.bestVol).toLocaleString() + ' kg' : 'bodyweight'}</td></tr>`).join('')}
       </tbody></table>`
    : '<p class="empty">Tick some sets and your lifts will show up here.</p>';
  $$('#lifts [data-go]').forEach(b => b.onclick = () => setDate(b.dataset.go));
}

function mondayOf(k) {
  const d = Store.parse(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Store.key(d);
}

/* least-squares slope in kg per week, over the last 42 days of weigh-ins */
function weeklyRate(points) {
  const recent = points.slice(-8);
  if (recent.length < 2) return null;
  const t0 = Store.parse(recent[0].key).getTime();
  const xs = recent.map(p => (Store.parse(p.key).getTime() - t0) / 604800000);
  const ys = recent.map(p => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return den ? num / den : null;
}

/* ============================ data view ============================ */

function renderData() {
  const days = Store.loggedKeys();
  $('#data-sum').textContent = days.length
    ? `${days.length} days logged, ${days[0]} to ${days[days.length - 1]}.`
    : 'Nothing logged yet.';
}

function download() {
  const blob = new Blob([JSON.stringify(Store.state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gym-log-${Store.key(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ============================ boot ============================ */

function boot() {
  $$('.tabs button').forEach(b => b.onclick = () => setView(b.dataset.view));

  $('#log-date').onchange = e => setDate(e.target.value);
  $('#prev').onclick = () => { const d = Store.parse(current); d.setDate(d.getDate() - 1); setDate(Store.key(d)); };
  $('#next').onclick = () => { const d = Store.parse(current); d.setDate(d.getDate() + 1); setDate(Store.key(d)); };
  $('#today').onclick = () => setDate(Store.key(new Date()));

  $('#add-ex').onsubmit = e => {
    e.preventDefault();
    const f = e.target;
    const name = f.exname.value.trim();
    if (!name) return;
    Store.edit(current, d => d.custom.push({
      name, sets: Number(f.exsets.value) || 3, reps: f.exreps.value.trim() || '10',
      rep: parseInt(f.exreps.value, 10) || 10, muscle: 'added', gear: ''
    }));
    f.reset();
    renderLog();
  };

  $('#add-meal').onsubmit = e => {
    e.preventDefault();
    const f = e.target;
    const when = f.mname.value.trim();
    if (!when) return;
    Store.edit(current, d => d.meals.push({
      when, kcal: Number(f.mkcal.value) || 0, protein: Number(f.mprot.value) || 0
    }));
    f.reset();
    renderLog();
  };

  ['weight', 'waist'].forEach(field => {
    $('#f-' + field).onchange = e => {
      const v = e.target.value === '' ? null : Number(e.target.value);
      Store.edit(current, d => { d[field] = v; });
    };
  });
  $('#f-note').onchange = e => Store.edit(current, d => { d.note = e.target.value.trim() || undefined; });

  $$('#metric-pick button').forEach(b => b.onclick = () => { Store.prefs({ metric: b.dataset.metric }); renderHeatmap(); });

  $('#export').onclick = download;
  $('#import').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        Store.replaceAll(JSON.parse(fr.result));
        render();
        alert('Log imported.');
      } catch (err) { alert('Could not read that file: ' + err.message); }
      e.target.value = '';
    };
    fr.readAsText(file);
  };
  $('#wipe').onclick = () => {
    if (confirm('Delete every logged day from this browser? Export first if you want a copy.')) {
      Store.clearAll(); render();
    }
  };

  $('#swaps').innerHTML = PLAN.swaps.map(([k, v]) =>
    `<div class="swap"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');

  setView('log');
}

document.addEventListener('DOMContentLoaded', boot);
