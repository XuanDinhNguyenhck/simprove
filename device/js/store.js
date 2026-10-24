/* Treadmill Session Recorder & Log Persistence (Option 1B Change-Only + 2C Full Integration).
   - Stores each treadmill session as a separate entry inside `days[YYYY-MM-DD].runs`
     in the main log ('gym-workout-log/v1'), so multiple sessions per day stay separate
     and are automatically included in Heatmap, Calorie views, and Daily GitHub Backup.
   - Records speed points ONLY when the speed changes (`changes: [{ t, v }]`), minimizing
     storage growth while preserving the exact interval speed curve. */

const TreadmillStore = (() => {
  const MAIN_LOG_KEY = 'gym-workout-log/v1';

  let active = null; /* current live session */
  const listeners = [];
  const notify = () => listeners.forEach(fn => fn());

  const dateKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const timeHM = (d = new Date()) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  function readMainState() {
    try {
      const raw = localStorage.getItem(MAIN_LOG_KEY);
      if (!raw) return { v: 1, days: {}, prefs: { metric: 'sets' } };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.days) {
        return { v: 1, days: {}, prefs: { metric: 'sets' } };
      }
      return parsed;
    } catch (_) {
      return { v: 1, days: {}, prefs: { metric: 'sets' } };
    }
  }

  function writeMainState(main) {
    localStorage.setItem(MAIN_LOG_KEY, JSON.stringify(main));
    notify();
  }

  /* Flatten all runs across all days (newest first), keeping each session separate
     and numbering sessions when multiple runs happen on the same day. */
  function allSessions() {
    const main = readMainState();
    const dates = Object.keys(main.days).sort();
    const out = [];
    for (const d of dates) {
      const runs = (main.days[d] && main.days[d].runs) || [];
      runs.forEach((r, idx) => {
        out.push({
          ...r,
          date: r.date || d,
          sessionIndex: idx + 1,
          daySessionCount: runs.length
        });
      });
    }
    return out.reverse();
  }

  /* ---- Live Telemetry Ingestion (Change-Only Speed Points) ---- */
  function ingestStatus(frame) {
    if (!frame || frame.type !== 'status') return;

    if (frame.running && frame.speedKmh > 0) {
      const now = new Date();
      const speed = Number(frame.speedKmh.toFixed(1));

      if (!active) {
        active = {
          id: now.toISOString(),
          date: dateKey(now),
          at: timeHM(now),
          startedAt: now.getTime(),
          durationSec: 0,
          distanceKm: 0,
          calories: 0,
          maxSpeedKmh: speed,
          speedSum: 0,
          speedTicks: 0,
          changes: [{ t: 0, v: speed }]
        };
      }

      const elapsed = frame.elapsedSec || Math.round((Date.now() - active.startedAt) / 1000);
      active.durationSec = elapsed;
      active.distanceKm  = frame.distanceKm;
      active.calories    = frame.calories;
      if (speed > active.maxSpeedKmh) active.maxSpeedKmh = speed;
      active.speedSum   += speed;
      active.speedTicks += 1;

      /* Only record a new point when the speed actually changes! */
      const lastChange = active.changes[active.changes.length - 1];
      if (!lastChange || Math.abs(lastChange.v - speed) >= 0.1) {
        active.changes.push({ t: elapsed, v: speed });
      }
      notify();
    } else if (active && (frame.stateKey === 'stopped' || frame.stateKey === 'idle')) {
      /* Auto-save as a separate session when the belt stops after >= 15s */
      if (active.durationSec >= 15) {
        finishActiveSession();
      } else {
        active = null;
        notify();
      }
    }
  }

  function finishActiveSession() {
    if (!active || active.durationSec < 5) {
      active = null;
      notify();
      return null;
    }

    const avgSpeed = active.speedTicks > 0
      ? Number((active.speedSum / active.speedTicks).toFixed(1))
      : Number(((active.distanceKm / (active.durationSec / 3600)) || 0).toFixed(1));

    const record = {
      id: active.id,
      date: active.date,
      at: active.at,
      durationSec: active.durationSec,
      distanceKm: Number(active.distanceKm.toFixed(2)),
      calories: active.calories,
      avgSpeedKmh: avgSpeed,
      maxSpeedKmh: Number(active.maxSpeedKmh.toFixed(1)),
      changes: active.changes
    };

    const main = readMainState();
    const day = main.days[record.date] || (main.days[record.date] = { ex: {}, custom: [], meals: [], runs: [] });
    day.runs = Array.isArray(day.runs) ? day.runs : [];
    day.runs.push(record); /* pushed as a separate session on that day */

    active = null;
    writeMainState(main);
    return record;
  }

  function deleteSession(id) {
    const main = readMainState();
    for (const k of Object.keys(main.days)) {
      const d = main.days[k];
      if (Array.isArray(d.runs)) {
        d.runs = d.runs.filter(r => r.id !== id);
      }
    }
    writeMainState(main);
  }

  function clearAll() {
    const main = readMainState();
    for (const k of Object.keys(main.days)) {
      if (main.days[k] && Array.isArray(main.days[k].runs)) {
        delete main.days[k].runs;
      }
    }
    active = null;
    writeMainState(main);
  }

  function summaryStats() {
    const list = allSessions();
    const totalKm  = list.reduce((s, r) => s + (Number(r.distanceKm) || 0), 0);
    const totalSec = list.reduce((s, r) => s + (Number(r.durationSec) || 0), 0);
    const totalCal = list.reduce((s, r) => s + (Number(r.calories) || 0), 0);
    return {
      count: list.length,
      totalKm: totalKm.toFixed(2),
      totalHours: (totalSec / 3600).toFixed(1),
      totalCal
    };
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(allSessions(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zipro-treadmill-runs-${dateKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportCSV() {
    const header = 'date,time,session_num,duration_sec,distance_km,calories,avg_speed_kmh,max_speed_kmh,speed_changes\n';
    const rows = allSessions().map(s => {
      const chg = (s.changes || []).map(c => `${c.t}s:${c.v}kmh`).join('|');
      return `${s.date},${s.at || ''},${s.sessionIndex || 1},${s.durationSec},${s.distanceKm},${s.calories},${s.avgSpeedKmh},${s.maxSpeedKmh},"${chg}"`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zipro-treadmill-runs-${dateKey()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return {
    get sessions() { return allSessions(); },
    get active()   { return active; },
    ingestStatus,
    finishActiveSession,
    deleteSession,
    clearAll,
    summaryStats,
    exportJSON,
    exportCSV,
    onChange: fn => listeners.push(fn)
  };
})();
