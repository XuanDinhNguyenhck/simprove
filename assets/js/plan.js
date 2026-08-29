/* Plan data transcribed from training-nutrition-plan.html.
   Single source of truth for sessions, targets and preset meals.
   Edit here to change the programme; the app reads nothing else. */

const PLAN = {
  athlete: { height_cm: 163, weight_kg: 61, goal: 'recomposition', gym_minutes: 60 },

  /* index = Date.getDay(): 0 = Sunday */
  schedule: ['rest', 'football', 'push', 'pull', 'football', 'mix', 'legs'],

  /* calorie/macro target per kind of day */
  targets: {
    football: { kcal: 2700, protein: 130, carbs: 400, fat: 65,
      why: 'Highest-carb days. Full glycogen stores so you are still sprinting in the last 15 minutes.' },
    gym: { kcal: 2450, protein: 130, carbs: 335, fat: 65,
      why: 'Around maintenance. Enough fuel to add weight to the bar, not enough to add fat.' },
    rest: { kcal: 2150, protein: 135, carbs: 265, fat: 60,
      why: 'Protein stays high, carbs drop. You are not training, so you do not need the fuel.' }
  },

  sessions: {
    football: { day: 'MON / THU', name: 'Football', kind: 'football',
      focus: 'Match day. The legs are already getting trained — no gym.' },
    rest: { day: 'SUN', name: 'Full rest', kind: 'rest',
      focus: 'Six training days a week only works if you recover.' },

    push: {
      day: 'TUE', name: 'Upper Push', kind: 'gym',
      focus: 'Chest, front and side delts, triceps',
      budget: { sets: 19, minutes: 37 },
      exercises: [
        { name: 'Barbell Bench Press', sets: 4, reps: '6–8', rep: 8, muscle: 'chest', gear: 'barbell', rest: 120,
          cue: 'Pin your shoulder blades back and down into the bench. Bar touches the lower chest, elbows around 45° from the torso — not flared straight out. Feet flat, push the floor away.' },
        { name: 'Incline Dumbbell Press', sets: 3, reps: '8–10', rep: 10, muscle: 'chest', gear: 'dumbbell', rest: 105,
          cue: 'Bench at 30–40°, no higher or it turns into a shoulder press. Stop before the dumbbells clash at the top — keep tension on the chest.' },
        { name: 'Overhead Press', sets: 3, reps: '6–8', rep: 8, muscle: 'shoulders', gear: 'barbell', rest: 105,
          cue: 'Squeeze the glutes and keep the ribs down so you do not press by arching your lower back. Move your head back an inch as the bar passes your face, then push it through.' },
        { name: 'Lateral Raise', sets: 3, reps: '12–15', rep: 12, muscle: 'shoulders', gear: 'dumbbell', rest: 60,
          superset: 'Hanging Leg Raise',
          cue: 'Go lighter than your ego wants. Lead with the elbows, stop at shoulder height, lower slowly. This is the exercise that widens your shoulders.' },
        { name: 'Dips', sets: 3, reps: '10–12', rep: 10, muscle: 'triceps', gear: 'body only', rest: 90,
          alt: 'Triceps Pushdown',
          cue: 'Torso upright and elbows tucked to target triceps. Stop when the upper arm is parallel to the floor — going deeper stresses the shoulder for no extra benefit.' },
        { name: 'Hanging Leg Raise', sets: 3, reps: '12', rep: 12, muscle: 'abdominals', gear: 'body only', rest: 60,
          superset: 'Lateral Raise',
          cue: 'No swinging. Curl your pelvis up towards your ribs rather than just lifting the legs. If it is too hard, bend the knees.' }
      ]
    },

    pull: {
      day: 'WED', name: 'Upper Pull', kind: 'gym',
      focus: 'Lats, mid-back, rear delts, biceps',
      budget: { sets: 19, minutes: 35 },
      exercises: [
        { name: 'Pull-ups', sets: 4, reps: '6–10', rep: 6, muscle: 'lats', gear: 'body only', rest: 120,
          alt: 'Wide-Grip Lat Pulldown',
          cue: 'Start from a dead hang. Pull your elbows down towards your ribs and think about your chest reaching the bar. If you cannot get 6, use a band or the lat pulldown.' },
        { name: 'Barbell Row', sets: 3, reps: '8–10', rep: 10, muscle: 'middle back', gear: 'barbell', rest: 105,
          cue: 'Hinge to about 45° with a flat back. Pull to the bottom of your ribcage, not your chest. Control the way down — do not drop it.' },
        { name: 'Seated Cable Row', sets: 3, reps: '10–12', rep: 10, muscle: 'middle back', gear: 'cable', rest: 90,
          cue: 'Chest tall, no rocking backwards. Pull the handle to your belly button and hold the squeeze for a beat before releasing.' },
        { name: 'Face Pull', sets: 3, reps: '15', rep: 15, muscle: 'shoulders', gear: 'cable', rest: 60,
          cue: 'Rope at eye height. Pull towards your forehead and rotate so your knuckles finish facing behind you. This is the exercise that keeps your shoulders healthy for benching.' },
        { name: 'Barbell Curl', sets: 3, reps: '10–12', rep: 10, muscle: 'biceps', gear: 'barbell', rest: 60,
          superset: 'Plank',
          cue: 'Elbows stay pinned at your sides. If your body is swinging, the weight is too heavy — nothing about that builds bigger arms.' },
        { name: 'Plank', sets: 3, reps: '45 s', rep: 45, unit: 'sec', muscle: 'abdominals', gear: 'body only', rest: 45,
          superset: 'Barbell Curl',
          cue: 'Straight line from ear to heel. Squeeze the glutes and tuck the pelvis slightly. If your lower back sags, stop the set.' }
      ]
    },

    mix: {
      day: 'FRI', name: 'Upper Mix + Arms', kind: 'gym',
      focus: 'Upper chest, back thickness, shoulders, arms',
      budget: { sets: 20, minutes: 37 },
      exercises: [
        { name: 'Incline Barbell Press', sets: 4, reps: '8', rep: 8, muscle: 'chest', gear: 'barbell', rest: 120,
          cue: 'Upper chest is what makes a shirt sit well. Bar touches high on the chest, just below the collarbone.' },
        { name: 'Chest-Supported Row', sets: 4, reps: '10', rep: 10, muscle: 'middle back', gear: 'dumbbell', rest: 90,
          cue: 'Lying on the bench takes your lower back out of it completely, so you can go heavy on back without cooking your spine before football.' },
        { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10', rep: 10, muscle: 'shoulders', gear: 'dumbbell', rest: 90,
          cue: 'Seated with back support. Dumbbells travel slightly inwards as you press, not straight up like train tracks.' },
        { name: 'Cable Fly', sets: 3, reps: '12', rep: 12, muscle: 'chest', gear: 'cable', rest: 60,
          cue: 'Soft bend in the elbows, held constant. Think about hugging a barrel. Stretch is the point here, not load.' },
        { name: 'Hammer Curl', sets: 3, reps: '12', rep: 12, muscle: 'biceps', gear: 'dumbbell', rest: 75,
          superset: 'Overhead Triceps Extension',
          cue: 'Hits the brachialis, which pushes the bicep up and makes the arm look thicker. No rest before the triceps extension; 90 s after the pair.' },
        { name: 'Overhead Triceps Extension', sets: 3, reps: '12', rep: 12, muscle: 'triceps', gear: 'cable', rest: 75,
          superset: 'Hammer Curl',
          cue: 'Second half of the superset. Elbows stay high and close to your head; only the forearms move. The overhead position stretches the long head of the triceps.' }
      ]
    },

    legs: {
      day: 'SAT', name: 'Legs + Core', kind: 'gym',
      focus: 'Quads, hamstrings, glutes, calves and rotational core — deliberately short, because Monday is a match',
      budget: { sets: 13, minutes: 32 },
      exercises: [
        { name: 'Back Squat', sets: 3, reps: '8', rep: 8, muscle: 'quadriceps', gear: 'barbell', rest: 150,
          cue: 'Brace as if about to take a punch to the stomach. Knees track over the toes. Depth to at least parallel, or as deep as you can go with a flat back.' },
        { name: 'Romanian Deadlift', sets: 3, reps: '8–10', rep: 10, muscle: 'hamstrings', gear: 'barbell', rest: 120,
          cue: 'The single most valuable lift here. Push the hips back, bar stays close to the legs, slight knee bend held throughout. Strong hamstrings mean faster sprints and far fewer pulled muscles.' },
        { name: 'Bulgarian Split Squat', sets: 2, reps: '10 / leg', rep: 10, muscle: 'quadriceps', gear: 'barbell', rest: 90,
          cue: 'Back foot on a bench. Most of the weight on the front leg. Brutal for balance and single-leg strength — exactly what changing direction on a pitch demands.' },
        { name: 'Standing Calf Raise', sets: 2, reps: '15', rep: 15, muscle: 'calves', gear: 'machine', rest: 60,
          cue: 'Full stretch at the bottom, full contraction at the top, one-second pause. Calves need range of motion, not bounce.' },
        { name: 'Cable Wood Chop', sets: 3, reps: '12 / side', rep: 12, muscle: 'abdominals', gear: 'cable', rest: 60,
          cue: 'Rotate from the ribcage with the hips following, arms fairly straight. This is the core pattern that actually transfers to striking a ball.' }
      ]
    }
  },

  /* preset meals per day kind — tap to log, then edit the numbers if you ate differently */
  meals: {
    gym: [
      { when: 'Breakfast', what: '80 g oats cooked in 250 ml semi-skimmed milk, 1 banana, 1 tsp honey', kcal: 520, protein: 22 },
      { when: 'Lunch', what: '130 g chicken breast, 100 g dry rice (or 300 g potatoes), 200 g vegetables, 1 tsp olive oil', kcal: 700, protein: 50 },
      { when: 'Pre-workout — 60–90 min before', what: '150 g skyr or Greek yogurt, 1 apple or 2 rice cakes', kcal: 220, protein: 20 },
      { when: 'Post-workout', what: '30 g whey shake or 500 ml kefir, 1 banana, 2 slices rye bread', kcal: 380, protein: 28 },
      { when: 'Dinner', what: '140 g salmon, turkey or lean beef, 250 g potatoes or 80 g dry pasta, large salad, 1 tbsp olive oil', kcal: 630, protein: 35 }
    ],
    football: [
      { when: 'Breakfast', what: '100 g oats, milk, banana, honey, 1 whole egg', kcal: 600, protein: 26 },
      { when: 'Lunch — 3 h before kick-off', what: '130 g chicken, 120 g dry rice, cooked vegetables. Keep fat and fibre low so it digests before you play.', kcal: 750, protein: 50 },
      { when: 'Snack — 60 min before', what: '1 banana, 2 rice cakes with jam', kcal: 200, protein: 3 },
      { when: 'During the match', what: 'Water. Sports drink only if it is hot or you play the full 90.', kcal: 0, protein: 0 },
      { when: 'Post-match — within 60 min', what: '30 g whey shake, large banana, bread roll with honey', kcal: 400, protein: 28 },
      { when: 'Dinner', what: '150 g meat or fish, 300 g potatoes or pasta, vegetables, 1 tbsp olive oil', kcal: 750, protein: 42 }
    ],
    rest: [
      { when: 'Breakfast', what: '3 whole eggs, 2 slices rye bread, tomato and cucumber', kcal: 450, protein: 26 },
      { when: 'Lunch', what: '150 g chicken or fish, 150 g cooked rice or quinoa, large portion of vegetables, 1 tsp olive oil', kcal: 650, protein: 48 },
      { when: 'Snack', what: '200 g cottage cheese or skyr, 25 g nuts', kcal: 300, protein: 28 },
      { when: 'Dinner', what: '150 g lean beef or turkey, 200 g potatoes, salad with olive oil', kcal: 600, protein: 40 },
      { when: 'Optional before bed', what: '250 ml milk or a small casein shake', kcal: 150, protein: 12 }
    ]
  },

  swaps: [
    ['Protein', 'Chicken ↔ turkey ↔ white fish ↔ lean pork ↔ tofu or tempeh ↔ lentils'],
    ['Carbs', 'Rice ↔ potatoes ↔ pasta ↔ couscous ↔ rye bread ↔ oats'],
    ['Dairy', 'Skyr ↔ cottage cheese ↔ tvaroh ↔ Greek yogurt ↔ kefir'],
    ['Fats', 'Olive oil ↔ nuts ↔ seeds ↔ avocado ↔ fatty fish']
  ]
};

/* flat lookup so logged history can find an exercise's units, cues and demo
   photos by name. `slug` is the filename stem under assets/img/ — the photos were
   extracted from training-nutrition-plan.html, so the two stay in step only as long
   as the names match. */
PLAN.slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
PLAN.byName = {};
Object.values(PLAN.sessions).forEach(s =>
  (s.exercises || []).forEach(e => { e.slug = PLAN.slug(e.name); PLAN.byName[e.name] = e; }));

/* session key for a Date, and the target block that goes with it */
PLAN.sessionFor = d => PLAN.sessions[PLAN.schedule[d.getDay()]];
PLAN.targetFor = key => PLAN.targets[PLAN.sessions[key].kind];
