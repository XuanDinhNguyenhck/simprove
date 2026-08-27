/* Persistence. Everything lives in one localStorage key so export/import is a
   straight JSON round-trip — there is no server, this site is static files only. */

const Store = (() => {
  const KEY = 'gym-workout-log/v1';

  let state = load();

  function blank() {
    return { v: 1, days: {}, prefs: { metric: 'sets' } };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.days) return blank();
      parsed.prefs = Object.assign({ metric: 'sets' }, parsed.prefs);
      return parsed;
    } catch (e) {
      console.warn('Could not read saved log, starting empty:', e);
      return blank();
    }
  }

  const listeners = [];
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      alert('Could not save — browser storage is full or blocked.\n\n' + e.message);
    }
    listeners.forEach(fn => fn());
  }

  /* ---- dates ---- */
  const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

  /* ---- day records ---- */
  /* A day is stored sparsely: only what you actually entered. The session
     template is re-derived from PLAN at render time, so `ex` holds overrides
     keyed by exercise name and `custom` holds anything you added yourself. */
  function day(k) {
    return state.days[k] || { ex: {}, custom: [], meals: [] };
  }

  function edit(k, fn) {
    const d = state.days[k] || (state.days[k] = { ex: {}, custom: [], meals: [] });
    d.ex = d.ex || {}; d.custom = d.custom || []; d.meals = d.meals || [];
    fn(d);
    prune(k);
    save();
  }

  /* drop a day record that ended up holding nothing, so it never shows on the heatmap */
  function prune(k) {
    const d = state.days[k];
    if (!d) return;
    const hasSets = Object.values(d.ex).some(e =>
      e.removed || (e.sets || []).some(s => s.done || s.kg || s.reps));
    const empty = !hasSets && !d.custom.length && !d.meals.length &&
      d.weight == null && d.waist == null && !d.note && !d.sessionOverride;
    if (empty) delete state.days[k];
  }

  /* ---- derived per-day numbers ---- */
  function sessionKey(k) {
    const d = state.days[k];
    return (d && d.sessionOverride) || PLAN.schedule[parse(k).getDay()];
  }

  /* plan exercises minus removed ones, plus custom ones, each with its logged sets */
  function exercisesFor(k) {
    const d = day(k);
    const s = PLAN.sessions[sessionKey(k)];
    const planned = (s.exercises || [])
      .filter(e => !(d.ex[e.name] || {}).removed)
      .map(e => ({ ...e, logged: (d.ex[e.name] || {}).sets || [] }));
    const custom = d.custom.map(e => ({
      ...e, custom: true, logged: (d.ex[e.name] || {}).sets || []
    }));
    return planned.concat(custom);
  }

  const doneSets = k => exercisesFor(k).reduce(
    (n, e) => n + e.logged.filter(s => s.done).length, 0);

  const volume = k => exercisesFor(k).reduce((v, e) => v + e.logged.reduce(
    (t, s) => t + (s.done ? (Number(s.kg) || 0) * (Number(s.reps) || 0) : 0), 0), 0);

  const kcal = k => day(k).meals.reduce((t, m) => t + (Number(m.kcal) || 0), 0);
  const protein = k => day(k).meals.reduce((t, m) => t + (Number(m.protein) || 0), 0);
  const target = k => PLAN.targets[PLAN.sessions[sessionKey(k)].kind];

  /* every date that has any entry, oldest first */
  const loggedKeys = () => Object.keys(state.days).sort();

  /* the last time this exercise was worked, before date k */
  function lastTime(name, before) {
    const keys = loggedKeys().filter(x => x < before).reverse();
    for (const x of keys) {
      const sets = ((state.days[x].ex || {})[name] || {}).sets || [];
      const done = sets.filter(s => s.done && (s.kg || s.reps));
      if (done.length) return { date: x, sets: done };
    }
    return null;
  }

  return {
    get state() { return state; },
    key, parse, day, edit, sessionKey, exercisesFor, lastTime,
    doneSets, volume, kcal, protein, target, loggedKeys,
    onChange: fn => listeners.push(fn),
    prefs: (patch) => { Object.assign(state.prefs, patch); save(); },
    replaceAll(next) {
      if (!next || typeof next !== 'object' || !next.days) throw new Error('Not a log file.');
      state = Object.assign(blank(), next);
      state.prefs = Object.assign({ metric: 'sets' }, next.prefs);
      save();
    },
    clearAll() { state = blank(); save(); }
  };
})();
