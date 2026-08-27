# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Two static artifacts, served together from GitHub Pages:

- `training-nutrition-plan.html` — a single self-contained document (~770 KB, mostly
  base64 exercise photos) describing a 6-day training week and calorie-cycled diet.
  It is the **reference**: read-only prose, its own inline CSS/JS, no dependencies.
- `index.html` + `assets/` — the **tracker**, which logs sets, meals and body metrics
  against that plan and draws a year heatmap and progress charts.

There is no build step, no package manager, no framework, and no backend. Files are
served as-is.

## Commands

```bash
python3 -m http.server 8765          # serve; open http://localhost:8765/
```

Open `index.html` over `http://`, not `file://` — nothing breaks on `file://` today,
but `localStorage` is origin-scoped and a file-origin log will not be the same log.

There is no test runner. To verify a change, render it headlessly and check for
console errors:

```bash
google-chrome --headless --disable-gpu --no-sandbox --virtual-time-budget=6000 \
  --enable-logging=stderr --v=0 --screenshot=/tmp/shot.png \
  http://localhost:8765/index.html 2>&1 | grep -i 'CONSOLE'
```

For behaviour that needs clicking, write a throwaway page in the repo root that seeds
`localStorage`, embeds `index.html` in a same-origin iframe, drives it, and prints
assertions into a `<pre>`; dump it with `--dump-dom`. Delete it afterwards — the repo
root is the served directory. (`Store` is a `const`, so it is *not* on `window`;
reach it from a harness with `iframe.contentWindow.eval('Store')`.)

## Architecture

Four classic `<script>` tags, loaded in order, sharing one global lexical scope:

| File | Role |
|---|---|
| `assets/js/plan.js` | `PLAN` — the programme as data |
| `assets/js/store.js` | `Store` — localStorage read/write and every derived number |
| `assets/js/charts.js` | `Charts` — SVG heatmap, line, columns |
| `assets/js/backup.js` | `Backup` — once-a-day push of the log to a private GitHub repo |
| `assets/js/app.js` | rendering and event wiring |

Load order is a real dependency (`charts.js` calls `Store.parse`, `app.js` needs all
three). There are no modules and no bundler; adding one would be a rewrite, not a
tweak.

### `PLAN` is the single source of truth, and it is a transcription

Every exercise, set count, rep range, rest interval, calorie target and preset meal in
`plan.js` was transcribed by hand from `training-nutrition-plan.html`. **The two files
can drift.** If you change the programme, change it in both, or the log will be
scoring against a plan the user is not reading. `PLAN.schedule` is indexed by
`Date.getDay()` (0 = Sunday), so Tuesday → `push`, Sunday → `rest`.

### Day records are sparse; the session is re-derived, not copied

`Store` never writes a day record until the user enters something, and `prune()`
deletes any record that ends up holding nothing. This is what keeps the heatmap
honest: a day is coloured because it was logged, not because it was opened.

Consequently a stored day holds only *overrides*:

```js
days['2026-08-25'] = {
  ex: { 'Barbell Bench Press': { sets: [{kg, reps, done}, …] },
        'Dips': { removed: true } },   // skipped a planned exercise
  custom: [ /* exercises the user added that day */ ],
  meals: [ {when, what, kcal, protein} ],
  weight, waist, note, sessionOverride
}
```

`Store.exercisesFor(k)` re-merges that against `PLAN` at render time. Two things
follow: editing `plan.js` retroactively changes what past days *display* (the logged
numbers survive, the surrounding template does not), and `ex[name].sets` is a **sparse
array shorter than the visible row count** until the user types into a row. Anything
that appends to it must first pad to `Math.max(plan.sets, sets.length, 1)` — forgetting
that is what made "+ set" silently no-op.

### Rendering is full re-render on write

Every input handler calls `Store.edit(...)` then `renderLog()`, which rebuilds the
section from `innerHTML` and re-attaches listeners. There is no diffing and no
component state; a handler that keeps a DOM reference across a write is holding a
detached node. Interpolated user text goes through `esc()`.

### Charts

Single-hue amber sequential ramp (`Charts.RAMP`), because every chart here encodes
magnitude. The 4 data steps plus the `EMPTY` "nothing logged" track were validated for
monotone lightness, adjacent-step separation and contrast against the `--panel`
surface — re-validate if you change them. Heatmap rows are **Monday-first**
(`(getDay() + 6) % 7`) to match the plan's week strip, and `CELL = 12` is chosen so 53
weeks fit the 900 px column without scrolling; enlarging it makes the grid scroll and
auto-scroll then hides the M/W/F row labels.

Heatmap levels live in `METRICS` in `app.js`: `sets` uses fixed thresholds, `volume` is
relative to the 90th percentile of the visible year, `kcal` scores *closeness* to the
day's target so overeating does not read as a better day.

Volume is `kg × reps` over completed sets only, so bodyweight work (pull-ups, dips,
planks) contributes zero — the lifts table falls back to reps, and the seconds/reps
unit for a lift comes from `PLAN.byName[name].unit`.

### Backup is one-way, and the token is quarantined

`backup.js` writes the whole log to `log.json` in a private repo via the GitHub
Contents API (`GET` for the blob sha, then `PUT`). It is **not** sync: the device is
always the source of truth, and pulling the remote copy back down is a separate,
explicitly confirmed `Backup.restore()` that overwrites local. There is no merge, which
is why there is no conflict handling to get wrong.

The credential lives in its own localStorage key (`gym-workout-log/backup-v1`), never in
`Store.state`. That separation is load-bearing: it is what keeps the token out of
**Export JSON**, so a user can hand someone their log without handing over repo write
access. Anything that moves backup config into the log record breaks that guarantee —
there is a test for it, and it should stay tested.

The token box is write-only in the UI: it is never repopulated from storage, only
overwritten. `Backup.status()` deliberately reports `hasToken`, not the token.

Backups fire on load if more than 20 hours have passed, on a 10-minute in-page timer so
a tab left open still backs up, and on `online`. Failures back off for 30 minutes and
surface as text in the panel rather than a silent retry — an expired token is the
expected failure and the user must be able to see it.

## Styling

`assets/css/app.css` deliberately restates the palette and type from
`training-nutrition-plan.html` (`--ink`/`--panel`/`--amber`/Oswald/IBM Plex) so the two
documents read as one product. The plan's own styles are inline and separate; the app
does not share a stylesheet with it.

## Deployment

Pages serves the repo root. `.nojekyll` is present so nothing is preprocessed. Any
commit to the published branch is a deploy; there is nothing to build first.
