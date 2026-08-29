# Training Log

A daily workout and meal log for the plan in
[`training-nutrition-plan.html`](training-nutrition-plan.html) — six training days a
week built around football on Monday and Thursday.

Static files only: no build, no server, no account. The log is saved in your
browser's `localStorage`.

## What it does

**Log** — opens on today and already knows what the day is: Tuesday is Upper Push,
Saturday is Legs + Core, Sunday is rest. Every planned exercise shows a looping photo of
the start and end position, so you can see the movement rather than read about it — tap
it for a bigger view with the form cue and a link to a video. Each set has a weight box,
a reps box and a tick.

On football days there is nothing to tick, so you get a **Did you play?** card instead —
*Played* or *Missed it*. That is what puts match days on the heatmap. It shows what you lifted the last time you did that exercise, so you know
what to beat. Add a set, skip an exercise, add one that isn't on the plan, or switch
the whole session if you trained on a different day.

Meals work the same way: the day's planned meals are one tap each, with the calorie
and protein numbers filled in, and you edit them if you ate something else or type in
your own. There is also a **snack row** of single items — banana, whey shake, rice cakes — for
whatever you ate that was not in the plan.

A meter tracks the running total against that day's target — 2,700 kcal on football
days, 2,150 on gym days, 1,900 on rest days, with 130 g protein every day. Those numbers
are calculated for 163 cm / 59 kg and sit about 50 kcal under maintenance: near enough to
maintenance that training, not hunger, drives the change. They are formula estimates
carrying roughly ±230 kcal of error, so treat the first three weeks as calibration and
recompute if your weight shifts more than ~3 kg.

Weight, waist and a note sit at the bottom.

**Heatmap** — a square per day for the last year, by sets completed, volume lifted, or
how close you landed to the calorie target. Click any square to open that day.

**Progress** — bodyweight and waist over time, weekly training volume, and your best
set on every lift. The headline number is the weekly rate of weight change, checked
against the plan's −0.2 to −0.4 kg/week target.

**Data** — export the log to a JSON file, import it back, or wipe it. Also where you set
up the daily backup.

## Daily backup (optional, recommended on a phone)

Phones throw storage away. iOS clears website data for sites you have not opened in
about a week, which can silently take your whole training history with it. The backup
copies the log to a file in a **private** GitHub repo once a day.

1. On github.com create a new **private** repo, e.g. `gym-log-data`, with a README.
2. **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token.**
3. Repository access: **Only select repositories** → `gym-log-data`.
4. Permissions: **Contents → Read and write**. Nothing else.
5. Copy the token, open the app's **Data** tab, paste it with the repo name, and press
   **Save & back up now**.

After that it runs by itself. The panel says when the last backup happened, and says so
plainly if the token expires.

If the phone ever loses the log, install the app again and press **Restore from
GitHub**.

The token is stored in your browser only, is never written into an exported log file,
and is never committed to this repo. Scope it to that one private repo so a leak cannot
touch anything else.

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
