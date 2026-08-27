# Training Log

A daily workout and meal log for the plan in
[`training-nutrition-plan.html`](training-nutrition-plan.html) — six training days a
week built around football on Monday and Thursday.

Static files only: no build, no server, no account. The log is saved in your
browser's `localStorage`.

## What it does

**Log** — opens on today and already knows what the day is: Tuesday is Upper Push,
Saturday is Legs + Core, Sunday is rest. Every planned exercise is laid out with its
sets, rep range, rest interval and form cue, and each set has a weight box, a reps box
and a tick. It shows what you lifted the last time you did that exercise, so you know
what to beat. Add a set, skip an exercise, add one that isn't on the plan, or switch
the whole session if you trained on a different day.

Meals work the same way: the day's planned meals are one tap each, with the calorie
and protein numbers filled in, and you edit them if you ate something else or type in
your own. A meter tracks the running total against that day's target — 2,700 kcal on
football days, 2,450 on gym days, 2,150 on rest days.

Weight, waist and a note sit at the bottom.

**Heatmap** — a square per day for the last year, by sets completed, volume lifted, or
how close you landed to the calorie target. Click any square to open that day.

**Progress** — bodyweight and waist over time, weekly training volume, and your best
set on every lift. The headline number is the weekly rate of weight change, checked
against the plan's −0.2 to −0.4 kg/week target.

**Data** — export the log to a JSON file, import it back, or wipe it.

## Running it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8765     # then http://localhost:8765/
```

## Publishing it to GitHub Pages

From this folder:

```bash
git init && git add . && git commit -m "Training log"
git branch -M main
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

Then in the repository: **Settings → Pages → Build and deployment → Source:
Deploy from a branch**, branch `main`, folder `/ (root)`. The app appears at
`https://<you>.github.io/<repo>/` within a minute or two.

On your phone, open that URL and use *Add to Home Screen* — it opens like an app.

## Where your data lives

In the browser you logged it in, and nowhere else. Nothing is uploaded and there is no
account, which also means:

- a different browser, or a different phone, is a different log
- clearing site data deletes it
- private/incognito windows lose it when closed

Use **Data → Export JSON** now and then, and import the file on your other device.

## Changing the plan

The programme lives in [`assets/js/plan.js`](assets/js/plan.js) — sessions, exercises,
sets, rep ranges, rest, calorie targets and preset meals. Edit that file to change what
the app asks you to do. It is a transcription of `training-nutrition-plan.html`, so if
you change one, change the other too.

---

The numbers in the plan are estimates from formulas, not measurements, and this is not
medical advice. See the plan's own notes for the caveats.
