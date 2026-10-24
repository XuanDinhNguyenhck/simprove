/* UI Controller for the ZIPRO Newlite Device page.
   Renders step-line speed interval charts from change-only points (`changes: [{t, v}]`)
   and lists every separate session per day. */

const TreadmillUI = (() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let selectedSessionId = null;

  const fmtTime = sec => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  function setControlsEnabled(on) {
    const ids = [
      'btn-disconnect', 'btn-wake', 'btn-poll',
      'btn-start', 'btn-stop',
      'btn-speed-down', 'speed-slider', 'btn-speed-up', 'btn-speed-set',
      'btn-raw-send'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !on;
    });
    $$('#speed-presets .chip').forEach(b => { b.disabled = !on; });
  }

  function renderConnection({ connected, name, error }) {
    setControlsEnabled(connected);
    const box = $('#conn-status');
    if (!box) return;
    if (error) {
      box.className = 'bk-status bk-bad';
      box.textContent = `Connection error: ${error}`;
    } else if (connected) {
      box.className = 'bk-status bk-good';
      box.textContent = `Connected to ${name} · FitShow 0xFFF0 active`;
    } else {
      box.className = 'bk-status bk-off';
      box.textContent = 'Disconnected — turn on the treadmill and close the FitShow app on your phone.';
    }
  }

  function renderTelemetry(frame) {
    if (!frame || frame.type !== 'status') return;
    $('#val-state').textContent = frame.stateLabel;
    $('#val-speed').textContent = frame.speedKmh.toFixed(1);
    $('#val-time').textContent  = fmtTime(frame.elapsedSec);
    $('#val-dist').textContent  = frame.distanceKm.toFixed(2);
    $('#val-kcal').textContent  = frame.calories;

    TreadmillStore.ingestStatus(frame);
  }

  /* ---- Step-Line SVG Chart from Change-Only Points ([{t, v}] + durationSec) ---- */
  function renderStepChart(changes, durationSec, title) {
    const host = $('#speed-chart');
    if (!host) return;
    $('#chart-title').textContent = title || 'Speed profile (change-only log)';

    if (!changes || !changes.length || durationSec < 1) {
      host.innerHTML = `<p class="empty">Start the belt (or click a logged session below) to view the interval speed chart.</p>`;
      return;
    }

    const W = 820, H = 175, PAD_L = 36, PAD_R = 14, PAD_T = 16, PAD_B = 26;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;

    const maxT = Math.max(durationSec, changes[changes.length - 1].t + 1, 1);
    const maxV = Math.max(8, Math.ceil(Math.max(...changes.map(p => p.v), 1)));

    const x = t => PAD_L + (t / maxT) * plotW;
    const y = v => PAD_T + plotH - (v / maxV) * plotH;

    /* Expand change-only points into step-function coordinates:
       (t0, v0) -> (t1, v0) -> (t1, v1) -> ... -> (durationSec, vLast) */
    const stepCoords = [];
    for (let i = 0; i < changes.length; i++) {
      const cur = changes[i];
      const nextT = i + 1 < changes.length ? changes[i + 1].t : maxT;
      stepCoords.push([x(cur.t), y(cur.v)]);
      stepCoords.push([x(nextT), y(cur.v)]);
    }

    const pts = stepCoords.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
    const area = `${stepCoords[0][0].toFixed(1)},${(PAD_T + plotH).toFixed(1)} ${pts} ${stepCoords[stepCoords.length - 1][0].toFixed(1)},${(PAD_T + plotH).toFixed(1)}`;

    let grids = '';
    for (let v = 0; v <= maxV; v += 2) {
      const yy = y(v).toFixed(1);
      grids += `<line x1="${PAD_L}" y1="${yy}" x2="${W - PAD_R}" y2="${yy}" stroke="#26333E" stroke-dasharray="2,3"/>
                <text x="${PAD_L - 6}" y="${Number(yy) + 3}" text-anchor="end" class="ax">${v}</text>`;
    }

    const dots = changes.map(c =>
      `<circle cx="${x(c.t).toFixed(1)}" cy="${y(c.v).toFixed(1)}" r="3.2" fill="#F5B33C"><title>${fmtTime(c.t)} → ${c.v.toFixed(1)} km/h</title></circle>`
    ).join('');

    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Treadmill speed step chart">
        ${grids}
        <polygon points="${area}" fill="rgba(245, 179, 60, 0.16)"/>
        <polyline points="${pts}" fill="none" stroke="#F5B33C" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
        <text x="${PAD_L}" y="${H - 6}" class="ax">0:00</text>
        <text x="${W - PAD_R}" y="${H - 6}" text-anchor="end" class="ax">${fmtTime(maxT)} · ${changes.length} speed change${changes.length === 1 ? '' : 's'} saved</text>
      </svg>`;
  }

  /* ---- Session Log & Lifetime Totals ---- */
  function renderHistory() {
    const totals = TreadmillStore.summaryStats();
    $('#tot-runs').textContent  = totals.count;
    $('#tot-km').textContent    = totals.totalKm;
    $('#tot-hours').textContent = totals.totalHours;
    $('#tot-kcal').textContent  = totals.totalCal.toLocaleString();

    const active = TreadmillStore.active;
    const saveBtn = $('#btn-save-session');
    if (saveBtn) saveBtn.disabled = !active || active.durationSec < 5;

    if (active && active.changes.length) {
      renderStepChart(active.changes, Math.max(active.durationSec, 1), `Live session #${(TreadmillStore.sessions.filter(s => s.date === active.date).length) + 1} (${active.changes.length} speed changes)`);
    } else {
      const chosen = TreadmillStore.sessions.find(s => s.id === selectedSessionId) || TreadmillStore.sessions[0];
      if (chosen) {
        const chg = chosen.changes || chosen.samples || [];
        const label = `${chosen.date} · Session #${chosen.sessionIndex || 1}${chosen.at ? ' (' + chosen.at + ')' : ''} — ${chosen.distanceKm} km`;
        renderStepChart(chg, chosen.durationSec, label);
      } else {
        renderStepChart([], 0, 'Speed profile');
      }
    }

    const list = TreadmillStore.sessions;
    const tbl  = $('#session-table');
    if (!list.length) {
      tbl.innerHTML = '<p class="empty">No runs logged yet. Every run is saved as a separate session on that day and synced with your Training Log &amp; Heatmap.</p>';
      return;
    }

    tbl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Date &amp; Session</th>
            <th class="r">Duration</th>
            <th class="r">Distance</th>
            <th class="r">Avg Speed</th>
            <th class="r">Max Speed</th>
            <th class="r">Changes</th>
            <th class="r">Calories</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${list.map(s => {
            const chgCount = (s.changes || s.samples || []).length;
            const sessBadge = `Session #${s.sessionIndex || 1}${s.at ? ' · ' + s.at : ''}`;
            return `
            <tr data-sid="${esc(s.id)}" class="${s.id === selectedSessionId ? 'is-selected' : ''}">
              <td>
                <button class="lnk" data-pick="${esc(s.id)}">${esc(s.date)}</button>
                <span class="tag">${esc(sessBadge)}</span>
              </td>
              <td class="r num">${fmtTime(s.durationSec)}</td>
              <td class="r num">${Number(s.distanceKm).toFixed(2)} km</td>
              <td class="r num">${Number(s.avgSpeedKmh).toFixed(1)} km/h</td>
              <td class="r num">${Number(s.maxSpeedKmh).toFixed(1)} km/h</td>
              <td class="r num">${chgCount} pt${chgCount === 1 ? '' : 's'}</td>
              <td class="r num">${s.calories} kcal</td>
              <td class="r"><button class="x" data-del="${esc(s.id)}" title="Delete session">×</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

    $$('#session-table [data-pick]').forEach(b => {
      b.onclick = () => {
        selectedSessionId = b.dataset.pick;
        renderHistory();
      };
    });

    $$('#session-table [data-del]').forEach(b => {
      b.onclick = () => {
        if (confirm('Delete this treadmill session?')) {
          TreadmillStore.deleteSession(b.dataset.del);
        }
      };
    });
  }

  function appendLog(msg, dir) {
    const box = $('#ble-log');
    if (!box) return;
    const row = document.createElement('div');
    row.className = `dev-log-${dir}`;
    row.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
  }

  function applySpeed(kmh) {
    const clamped = Math.max(1.0, Math.min(12.0, Number(kmh)));
    $('#speed-slider').value = clamped;
    $('#speed-target').textContent = clamped.toFixed(1);
    TreadmillBLE.setSpeed(clamped);
  }

  function boot() {
    TreadmillBLE.onStateChange(renderConnection);
    TreadmillBLE.onFrame(renderTelemetry);
    TreadmillBLE.onLog(appendLog);
    TreadmillStore.onChange(renderHistory);

    $('#btn-connect').onclick    = () => TreadmillBLE.connect();
    $('#btn-disconnect').onclick = () => TreadmillBLE.disconnect();
    $('#btn-wake').onclick       = () => TreadmillBLE.wakeHandshake();
    $('#btn-poll').onclick       = () => TreadmillBLE.pollOnce();
    $('#chk-autopoll').onchange  = e => TreadmillBLE.setAutoPoll(e.target.checked);

    $('#btn-start').onclick = () => TreadmillBLE.start();
    $('#btn-stop').onclick  = () => {
      TreadmillBLE.stop();
      TreadmillStore.finishActiveSession();
    };

    const slider = $('#speed-slider');
    slider.oninput = () => { $('#speed-target').textContent = Number(slider.value).toFixed(1); };
    $('#btn-speed-set').onclick  = () => applySpeed(slider.value);
    $('#btn-speed-down').onclick = () => applySpeed(Number(slider.value) - 0.5);
    $('#btn-speed-up').onclick   = () => applySpeed(Number(slider.value) + 0.5);

    $$('#speed-presets .chip').forEach(btn => {
      btn.onclick = () => applySpeed(btn.dataset.speed);
    });

    $('#btn-save-session').onclick = () => TreadmillStore.finishActiveSession();
    $('#btn-export-csv').onclick   = () => TreadmillStore.exportCSV();
    $('#btn-export-json').onclick  = () => TreadmillStore.exportJSON();
    $('#btn-clear-runs').onclick   = () => {
      if (confirm('Delete all recorded treadmill sessions from this browser?')) {
        TreadmillStore.clearAll();
      }
    };

    $('#btn-raw-send').onclick = () => {
      const bytes = FitShowProtocol.fromHex($('#raw-hex').value);
      if (bytes.length) TreadmillBLE.send(bytes, 'Raw');
    };
    $('#btn-log-clear').onclick = () => { $('#ble-log').innerHTML = ''; };

    renderHistory();
  }

  document.addEventListener('DOMContentLoaded', boot);
  return { boot };
})();
