# Depth Pack Training Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the two Depth Pack curricula (learning-to-learn, communication) inside the app: enrollment creates a domain-tagged habit, tapping it opens a Dose Player with the current week's drill, and a guided Sunday Review captures weekly numbers, bumps the week, and feeds the brag sheet.

**Architecture:** Pack content is a code-defined template registry (`server/capabilities/packs/`), mirrored to the existing `activitiesSeed.js` pattern. Two new models (`TrainingProgram`, `WeeklyMeasure`). A new router mounted at `/api/capabilities/programs` reuses `authorizeChild` + `requireAdmin`. Dose completion flows through the existing habit engine (points/streaks/rollup untouched — R7 intact). Frontend: `DosePlayer` (kid), `SundayReview` (parent), Today-page ▶ affordance.

**Tech Stack:** Express 5 / Mongoose 9 / `node --test` with model stubs (server); React 19 + Vite + Tailwind + react-router 7 (client).

**Spec:** `docs/superpowers/specs/2026-07-03-depth-pack-training-design.md`

**Execution rules (user mandate):** sequential, no parallel; commit after every phase; full server test suite + `npm run build` green before each commit; no shortcuts.

---

## File map

| File | Responsibility |
|---|---|
| `server/capabilities/packs/learningToLearn.js` | Pack 01 template (create) |
| `server/capabilities/packs/communicationPrecision.js` | Pack 02 template (create) |
| `server/capabilities/packs/index.js` | Registry accessors (create) |
| `server/capabilities/packs/packs.test.js` | Template integrity tests (create) |
| `server/models/TrainingProgram.js` | Program state (create) |
| `server/models/WeeklyMeasure.js` | Weekly numbers (create) |
| `server/routes/capabilityPrograms.js` | Program API (create) |
| `server/routes/capabilityPrograms.routes.test.js` | Route tests (create) |
| `server/routes/capabilities.js` | Export `authorizeChild` (modify, end of file) |
| `server/app.js` | Mount programs router (modify) |
| `src/lib/capabilities/programs.js` | API wrappers (create) |
| `src/pages/DosePlayer.jsx` | Kid daily drill screen (create) |
| `src/pages/SundayReview.jsx` | Parent weekly ritual screen (create) |
| `src/components/ProgramsCard.jsx` | Dashboard programs section + enrollment (create) |
| `src/hooks/useHabits.js` | Add `setStatus` direct setter (modify) |
| `src/pages/Today.jsx` | habitId→program map, pass `trainTo` (modify) |
| `src/components/HabitCard.jsx` | ▶ train link (modify) |
| `src/pages/SkillsDashboard.jsx` | Render ProgramsCard (modify) |
| `src/pages/Skills.jsx` | Sunday review nav card (modify) |
| `src/App.jsx` | Two routes (modify) |

---

# Phase 1 — Pack template registry (+ tests, commit)

### Task 1: Pack templates

**Files:**
- Create: `server/capabilities/packs/learningToLearn.js`
- Create: `server/capabilities/packs/communicationPrecision.js`
- Create: `server/capabilities/packs/index.js`

- [ ] **Step 1.1: Write `learningToLearn.js`**

Content transcribed from `docs/plans/capable-kids/depth/01-learning-to-learn.md` §4 (phases → weeks). Repeating week shapes are built by local helpers (DRY):

```js
// Depth Pack 01 template — machine form of docs/plans/capable-kids/depth/01-learning-to-learn.md.
// Pure data + tiny builders so it can be integrity-tested (packs.test.js). The doc
// stays the human-readable source; edit both together.

const day = (dayNum, title, steps, timerMin = 15, scoreMetric = null) =>
  ({ day: dayNum, title, steps, timerMin, scoreMetric });

// Weeks 3–6 share the community beginner schedule (1 ML attempt/day + palace upkeep).
const mlWeek = (week, theme, extras = []) => ({
  week, theme,
  days: [
    day(1, 'Memory League: 1 Images attempt (palace #1)',
      ['Walk palace #1 once before starting', 'One Images attempt on Memory League', 'Note the level on screen', ...extras]),
    day(2, 'Palace upkeep + review',
      ['Walk both palaces forward and backward', 'Fix any locus that "went dark" — make its image louder', ...extras]),
    day(3, 'Memory League: 1 Images attempt (palace #2)',
      ['One Images attempt using palace #2', 'Two images per locus, make them interact with the location', ...extras]),
    day(4, 'Memory League: 1 Images attempt (palace #1)',
      ['One Images attempt using palace #1', 'Focus on speed of walking, not the images', ...extras]),
    day(5, 'Review + log your level',
      ['Review both palaces (26 loci)', 'One final attempt if you want', 'Enter your Memory League level below'],
      15, 'ml_level'),
  ],
});

// Weeks 7–12: 2 days ML ladder, 2 days school content, Friday calibration.
const schoolWeek = (week, theme, schoolFocus) => ({
  week, theme,
  days: [
    day(1, 'Memory League ladder day', ['Walk a palace, then 1–2 Images attempts', 'Chasing the next level is the fun part']),
    day(2, `School: ${schoolFocus}`, ['Pick material from an actual upcoming test or unit', 'Palace for lists/facts, deck cards for vocabulary/dates', 'PREDICT how many you will get right tomorrow — write it down']),
    day(3, 'Memory League ladder day', ['1–2 Images attempts', 'Try recalling the images backwards after submitting']),
    day(4, `School: ${schoolFocus}`, ['Closed-book self-quiz on Tuesday’s material', 'Compare against your prediction — that gap is your calibration', 'Review deck cards due today (1/3/7 spacing)'], 15, 'retention_pct'),
    day(5, 'Calibration + wrapper check', ['Chart: predicted vs actual for this week', 'Enter your average prediction error below', 'Homework wrapper: how many days this week did you do plan + review questions?'], 10, 'calibration_err'),
  ],
});

const PACK = {
  key: 'learning_to_learn',
  title: 'Learning-to-learn & Memory',
  domainKeys: ['metacognition', 'cognitive'],
  habitDefaults: { name: 'Memory training (15 min)', emoji: '🧠', frequency: 'daily' },
  metrics: [
    { key: 'ml_level',        label: 'Memory League level',    min: 0, max: 10 },
    { key: 'retention_pct',   label: 'Deck retention %',       min: 0, max: 100 },
    { key: 'calibration_err', label: 'Calibration error',      min: 0, max: 100 },
    { key: 'wrapper_days',    label: 'Homework wrapper days',  min: 0, max: 5 },
  ],
  ladder: [
    { level: 0, milestone: 'Walks his 13-locus home palace forwards AND backwards, eyes closed, no hesitation' },
    { level: 1, milestone: '10-item list via linking — 100% recall next morning, order intact' },
    { level: 2, milestone: 'Memory League Images level 3; first school list stored in a palace' },
    { level: 3, milestone: '20-card school deck at ≥85% retention across 2 weeks; ML Images level 5' },
    { level: 4, milestone: 'Calibration error <10% on 4 straight predictions; palace used for a real test' },
    { level: 5, milestone: 'ML Images level 7 or a played Kid-division match; teaches the technique to someone else' },
  ],
  weeks: [
    { week: 1, theme: 'Palace + linking', days: [
      day(1, 'Build your palace', ['Walk the house with paper', 'Pick 13 spots in a fixed route (front door → … → your bed)', 'Number them and draw the map']),
      day(2, 'Own the route', ['Eyes closed: walk the route 3× forward, 3× backward', 'Redraw the map from memory, check against yesterday’s']),
      day(3, 'Linking drill #1', ['Get the 10-item list from a parent', 'Link item 1→2→3… with ridiculous MOVING images', 'The banana CRUSHES the couch — it never just sits there']),
      day(4, 'Recall + linking drill #2', ['At breakfast: recall yesterday’s list out loud, in order', 'Evening: new 10-item list, link it']),
      day(5, 'Backwards day', ['At breakfast: recall list #2', 'Evening: recall it BACKWARDS', 'Walk the palace once, forward + backward']),
    ]},
    { week: 2, theme: 'Palace #2 + first palace list', days: [
      day(1, 'Build palace #2', ['Pick a second location (grandma’s house, school route)', '13 more loci, fixed route, draw the map']),
      day(2, 'Walk both palaces', ['Both palaces forward and backward', 'Any locus you hesitate on: stop and study the real spot']),
      day(3, 'First list IN the palace', ['Take a 10-item list', 'Place items at loci 1–10 of palace #1, two per locus is fine', 'Walk it once, then recall away from the map']),
      day(4, 'Memory League setup', ['Create free Memory League account', 'Play 1 practice Images game — just to see how it works']),
      day(5, 'Review + first attempt', ['Walk both palaces', 'One real Images attempt', 'Enter the level it gave you below'], 15, 'ml_level'),
    ]},
    mlWeek(3, 'Memory League: first levels'),
    mlWeek(4, 'Ladder + first school deck', ['Deck: add/review school cards due today (day 1/3/7 spacing)']),
    mlWeek(5, 'Ladder + spacing', ['Deck: review cards due today — guess first, then check']),
    mlWeek(6, 'Demo night week', ['Prepare: family shouts 15 items, you recall them backwards']),
    schoolWeek(7, 'Aim it at school', 'store a real list in a palace'),
    schoolWeek(8, 'Test-prep palace', 'palace the next test’s facts'),
    schoolWeek(9, 'Calibration focus', 'deck + predict every review'),
    schoolWeek(10, 'Own the system', 'you pick the tool: palace, deck, or problems'),
    schoolWeek(11, 'Match prep', 'light school load, extra ML attempts'),
    schoolWeek(12, 'Memory League match + review', 'match week — play a real match'),
  ],
};

module.exports = { PACK };
```

- [ ] **Step 1.2: Write `communicationPrecision.js`**

Transcribed from `docs/plans/capable-kids/depth/02-communication-precision.md` §4:

```js
// Depth Pack 02 template — machine form of docs/plans/capable-kids/depth/02-communication-precision.md.

const day = (dayNum, title, steps, timerMin = 10, scoreMetric = null) =>
  ({ day: dayNum, title, steps, timerMin, scoreMetric });

// Weeks 3–6: Mon/Wed/Fri recorded retells, Tue/Thu describe-and-draw.
const retellWeek = (week, theme, extra) => ({
  week, theme,
  days: [
    day(1, 'Recorded 1-minute retell', ['Pick anything: recess drama, a chapter, a video', 'Use the 5-finger frame: who/where → problem → tried → ended → zinger', 'Record on the phone, watch it back, self-score /10 (2 pts per element)', 'Re-record ONCE max']),
    day(2, 'Describe-and-draw', ['You describe, someone draws only what your words say', 'No hands, no peeking until done', 'Score = shapes right / total']),
    day(3, 'Recorded 1-minute retell', ['New topic, same frame', 'Watch back: did every finger get its sentence?']),
    day(4, 'Describe-and-draw', ['Add a shape if yesterday’s retell scored ≥8', 'Swap roles once — listen to what a good description sounds like']),
    day(5, extra || 'Retell + score the week', ['One more retell, best effort', 'Enter your best self-score below'], 10, 'retell_score'),
  ],
});

// Weeks 7–12: Mon/Wed teach-backs, Friday review + filler game.
const teachWeek = (week, theme, extra = []) => ({
  week, theme,
  days: [
    day(1, '3-minute teach-back (recorded)', ['Teach dad something you learned this week', 'Hook → structure (first/then/because) → one concrete example → landing', 'Record it; no watching yet', ...extra]),
    day(2, 'Describe-and-draw or retell', ['Your pick — keep the precision muscle warm']),
    day(3, '3-minute teach-back (recorded)', ['New topic or improved take on Monday’s', 'One real question from your audience at the end', ...extra]),
    day(4, 'Practice run', ['Rehearse Friday’s scoring pick', 'Work on ONE mechanic only (pace, pauses, or ending)']),
    day(5, 'Watch + score + filler game', ['Watch Monday’s recording together', 'Score the rubric /20, enter it below', 'Dinner filler-counter game: chart your fillers per minute'], 15, 'teachback_score'),
  ],
});

const PACK = {
  key: 'communication_precision',
  title: 'Communication Precision',
  domainKeys: ['communication'],
  habitDefaults: { name: 'Communication practice (10 min)', emoji: '🎤', frequency: 'daily' },
  metrics: [
    { key: 'dd_accuracy_pct', label: 'Describe-and-draw accuracy %', min: 0, max: 100 },
    { key: 'retell_score',    label: 'Retell rubric /10',            min: 0, max: 10 },
    { key: 'teachback_score', label: 'Teach-back rubric /20',        min: 0, max: 20 },
    { key: 'fillers_per_min', label: 'Fillers per minute',           min: 0, max: 60 },
    { key: 'audience_events', label: 'Audience events',              min: 0, max: 20 },
  ],
  ladder: [
    { level: 0, milestone: 'Baselines recorded and locked away: one describe-and-draw score, one 1-min retell video' },
    { level: 1, milestone: 'Describe-and-draw ≥80% on 5-shape figures; says the 5 story elements from memory' },
    { level: 2, milestone: '1-min retell hits all 5 elements, self-scored from the recording ≥8/10' },
    { level: 3, milestone: '3-min teach-back ≥16/20; under 5 fillers/min' },
    { level: 4, milestone: 'Family demo night delivered; volunteers for a class presentation' },
    { level: 5, milestone: 'Attends a Gavel Club / YLP session and delivers a prepared 2-min speech to non-family' },
  ],
  weeks: [
    { week: 1, theme: 'Baselines + describe-and-draw', days: [
      day(1, 'Baseline day', ['Describe a hidden 4-shape figure; parent draws only your words; write the % down', 'Phone out: retell any movie you like for 1 minute', 'SAVE the video. Nobody critiques it. It’s the week-12 before/after'], 10, 'dd_accuracy_pct'),
      day(2, 'Describe-and-draw', ['You describe a 3-shape figure, parent draws', 'No hands, no peeking until done', 'Score it together']),
      day(3, 'Swap day', ['Parent describes, YOU draw', 'Then one more with you describing — 4 shapes if yesterday was ≥80%']),
      day(4, 'New drawer', ['Sibling or other parent draws', 'Add a shape if you scored ≥80% yesterday']),
      day(5, 'Family round', ['Everyone describes one figure, everyone gets scored', 'You keep the scoreboard'], 10, 'dd_accuracy_pct'),
    ]},
    { week: 2, theme: '5-shape figures + the story frame', days: [
      day(1, 'Describe-and-draw: 5 shapes', ['5-shape figure, target ≥80%', 'Precision words: pointing down, touching, half the size']),
      day(2, 'Learn the 5-finger frame', ['Thumb who/where · index problem · middle tried · ring ended · pinky zinger', 'Say the five from memory, then map a movie you know onto them']),
      day(3, 'Describe-and-draw: 5 shapes', ['New figure, new drawer if possible'], 10, 'dd_accuracy_pct'),
      day(4, 'Frame practice (not recorded)', ['Retell today’s lunch story on the frame, out loud, no phone', 'Which finger was weakest? Do that one again']),
      day(5, 'First recorded retell', ['1 minute, on the frame, recorded', 'Watch it back once. Score /10. That’s your starting number'], 10, 'retell_score'),
    ]},
    retellWeek(3, 'Retell reps'),
    retellWeek(4, 'Retell reps: tighter'),
    retellWeek(5, 'Retell reps: new material'),
    retellWeek(6, 'Demo night week', 'Demo night prep: pick your best retell topic'),
    teachWeek(7, 'Teach-it-back begins'),
    teachWeek(8, 'Teach-back: structure'),
    teachWeek(9, 'Teach-back: mechanics', ['This week’s single mechanic: pauses instead of fillers']),
    teachWeek(10, 'Teach-back: audience', ['Volunteer for anything at school that means standing up front']),
    teachWeek(11, 'Speech prep', ['Draft and rehearse your 2-minute prepared speech']),
    teachWeek(12, 'Gavel Club week', ['Visit a Gavel Club / YLP session, deliver the speech', 'Watch the week-1 baseline video next to this week’s — that pair goes on the brag sheet']),
  ],
};

module.exports = { PACK };
```

- [ ] **Step 1.3: Write `index.js`**

```js
// Pack template registry — the machine-readable Depth Pack curricula.
// Templates are pure data; programs reference them by key (TrainingProgram.packKey).

const { PACK: learningToLearn } = require('./learningToLearn');
const { PACK: communicationPrecision } = require('./communicationPrecision');

const PACKS = new Map([
  [learningToLearn.key, learningToLearn],
  [communicationPrecision.key, communicationPrecision],
]);

const listPacks = () => [...PACKS.values()];
const getPack = key => PACKS.get(key) || null;

// Metric keys a kid may self-report from the dose player (every day.scoreMetric).
function kidWritableMetricKeys(pack) {
  const keys = new Set();
  for (const w of pack.weeks) for (const d of w.days) if (d.scoreMetric) keys.add(d.scoreMetric);
  return keys;
}

module.exports = { PACKS, listPacks, getPack, kidWritableMetricKeys };
```

### Task 2: Template integrity tests

**Files:**
- Create: `server/capabilities/packs/packs.test.js`

- [ ] **Step 2.1: Write the tests** (mirrors `activitiesSeed.test.js` style — pure data, no DB)

```js
// Integrity tests for the Depth Pack templates: every pack must be a complete,
// well-formed 12-week × 5-day curriculum whose references (domains, metrics) resolve.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { listPacks, getPack, kidWritableMetricKeys } = require('./index');
const { DOMAINS } = require('../domains');

const DOMAIN_KEYS = new Set(DOMAINS.map(d => d.key));

test('registry lists both pilot packs and getPack resolves them', () => {
  const keys = listPacks().map(p => p.key).sort();
  assert.deepEqual(keys, ['communication_precision', 'learning_to_learn']);
  assert.equal(getPack('learning_to_learn').title, 'Learning-to-learn & Memory');
  assert.equal(getPack('nope'), null);
});

for (const pack of require('./index').listPacks()) {
  test(`${pack.key}: 12 weeks × 5 days, sequential numbering`, () => {
    assert.equal(pack.weeks.length, 12);
    pack.weeks.forEach((w, i) => {
      assert.equal(w.week, i + 1);
      assert.ok(w.theme.length > 0);
      assert.equal(w.days.length, 5);
      w.days.forEach((d, j) => assert.equal(d.day, j + 1));
    });
  });

  test(`${pack.key}: ladder is exactly L0–L5 with milestones`, () => {
    assert.equal(pack.ladder.length, 6);
    pack.ladder.forEach((l, i) => {
      assert.equal(l.level, i);
      assert.ok(l.milestone.length > 10);
    });
  });

  test(`${pack.key}: domainKeys valid, habitDefaults complete`, () => {
    assert.ok(pack.domainKeys.length >= 1);
    for (const k of pack.domainKeys) assert.ok(DOMAIN_KEYS.has(k), `bad domain ${k}`);
    assert.ok(pack.habitDefaults.name && pack.habitDefaults.emoji && pack.habitDefaults.frequency);
  });

  test(`${pack.key}: metrics well-formed, unique keys, sane bounds`, () => {
    const keys = pack.metrics.map(m => m.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const m of pack.metrics) {
      assert.ok(m.label.length > 0);
      assert.ok(Number.isFinite(m.min) && Number.isFinite(m.max) && m.min < m.max);
    }
  });

  test(`${pack.key}: every day has steps + timer; scoreMetric refs resolve`, () => {
    const metricKeys = new Set(pack.metrics.map(m => m.key));
    for (const w of pack.weeks) for (const d of w.days) {
      assert.ok(d.title.length > 0, `${w.week}/${d.day} title`);
      assert.ok(Array.isArray(d.steps) && d.steps.length >= 1, `${w.week}/${d.day} steps`);
      for (const s of d.steps) assert.ok(typeof s === 'string' && s.length > 0);
      assert.ok(d.timerMin >= 5 && d.timerMin <= 20, `${w.week}/${d.day} timer`);
      if (d.scoreMetric) assert.ok(metricKeys.has(d.scoreMetric), `${w.week}/${d.day} scoreMetric ${d.scoreMetric}`);
    }
    assert.ok(kidWritableMetricKeys(pack).size >= 1, 'at least one kid-scorable metric');
  });
}
```

- [ ] **Step 2.2: Run** `cd server && node --test capabilities/packs/` — expect ALL PASS (fix template data, not tests, on failure)
- [ ] **Step 2.3: Run full suite** `cd server && npm test` — expect no regressions
- [ ] **Step 2.4: Commit**

```bash
git add server/capabilities/packs/
git commit -m "feat(capabilities): depth pack template registry + integrity tests"
```

---

# Phase 2 — Models (commit)

### Task 3: TrainingProgram + WeeklyMeasure

**Files:**
- Create: `server/models/TrainingProgram.js`
- Create: `server/models/WeeklyMeasure.js`

- [ ] **Step 3.1: `TrainingProgram.js`**

```js
const mongoose = require('mongoose');

// One kid's enrollment in a Depth Pack (server/capabilities/packs). The linked
// habit is the daily-dose vehicle: completing it flows through the normal habit
// engine (points/streaks/rollup) — this model never touches the ledger.
const trainingProgramSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  packKey:     { type: String, required: true },
  status:      { type: String, enum: ['active', 'paused', 'done'], default: 'active', index: true },
  currentWeek: { type: Number, default: 1, min: 1, max: 12 },
  habitId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
  startedAt:   { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

// One live (non-done) program per kid per pack; done programs keep history.
trainingProgramSchema.index(
  { userId: 1, packKey: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['active', 'paused'] } } }
);

module.exports = mongoose.model('TrainingProgram', trainingProgramSchema);
```

- [ ] **Step 3.2: `WeeklyMeasure.js`**

```js
const mongoose = require('mongoose');

// The digitized fridge chart: one row per program-week. metrics keys are validated
// against the pack's metric registry in the routes (schema stays permissive so
// packs can evolve). Never grants points (guardrail R7).
const weeklyMeasureSchema = new mongoose.Schema({
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingProgram', required: true, index: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  week:      { type: Number, required: true, min: 1, max: 12 },
  metrics:   { type: mongoose.Schema.Types.Mixed, default: {} },
  note:      { type: String, trim: true, maxlength: 500, default: '' },
}, { timestamps: true });

weeklyMeasureSchema.index({ programId: 1, week: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyMeasure', weeklyMeasureSchema);
```

- [ ] **Step 3.3: Run** `cd server && npm test` (models load transitively; expect green)
- [ ] **Step 3.4: Commit**

```bash
git add server/models/TrainingProgram.js server/models/WeeklyMeasure.js
git commit -m "feat(capabilities): TrainingProgram + WeeklyMeasure models"
```

---

# Phase 3 — API routes (+ tests, commit)

### Task 4: Export `authorizeChild`

**Files:**
- Modify: `server/routes/capabilities.js:461-463` (module.exports block at end)

- [ ] **Step 4.1:** Append export (keep existing two lines):

```js
module.exports = router;
module.exports.buildBaselineGap = buildBaselineGap;
module.exports.authorizeChild = authorizeChild;
```

### Task 5: Programs router

**Files:**
- Create: `server/routes/capabilityPrograms.js`
- Modify: `server/app.js` (require + mount)

- [ ] **Step 5.1: Write the router**

```js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { listPacks, getPack, kidWritableMetricKeys } = require('../capabilities/packs');
const { DOMAINS } = require('../capabilities/domains');
const TrainingProgram = require('../models/TrainingProgram');
const WeeklyMeasure = require('../models/WeeklyMeasure');
const Habit = require('../models/Habit');
const { authorizeChild } = require('./capabilities');
const { isAdmin, requireAdmin } = require('../utils/auth');

const DOMAIN_KEYS = new Set(DOMAINS.map(d => d.key));

// Public (non-day-content) view of a pack for pickers and headers.
function packSummary(p) {
  return {
    key: p.key, title: p.title, domainKeys: p.domainKeys,
    habitDefaults: p.habitDefaults, metrics: p.metrics, ladder: p.ladder,
    weekThemes: p.weeks.map(w => ({ week: w.week, theme: w.theme })),
  };
}

function serializeProgram(prog, pack, habit) {
  const week = pack.weeks.find(w => w.week === prog.currentWeek) || null;
  return {
    _id: prog._id,
    userId: prog.userId,
    packKey: prog.packKey,
    status: prog.status,
    currentWeek: prog.currentWeek,
    totalWeeks: pack.weeks.length,
    startedAt: prog.startedAt,
    completedAt: prog.completedAt,
    pack: packSummary(pack),
    week,                                   // full day cards for the current week
    habitId: prog.habitId,
    habit: habit ? { _id: habit._id, name: habit.name, emoji: habit.emoji, points: habit.points || 0, archivedAt: habit.archivedAt } : null,
    habitMissing: !habit,
  };
}

// GET /api/capabilities/programs/packs — the enrollable pack registry.
router.get('/packs', (_req, res) => {
  res.json({ packs: listPacks().map(packSummary) });
});

// POST /api/capabilities/programs — enroll a child in a pack (parent/admin only).
// Body: { childId, packKey, points? }. Creates the domain-tagged daily habit and
// the program pointing at it.
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { childId, packKey } = req.body || {};
    const pack = getPack(packKey);
    if (!pack) return res.status(400).json({ error: 'unknown packKey' });
    if (!mongoose.Types.ObjectId.isValid(childId)) return res.status(400).json({ error: 'valid childId required' });

    const points = Number(req.body.points);
    const habitPoints = Number.isFinite(points) && points >= 0 ? Math.floor(points) : 0;

    const existing = await TrainingProgram.findOne({ userId: childId, packKey, status: { $in: ['active', 'paused'] } }).lean();
    if (existing) return res.status(409).json({ error: 'This pack is already running for this child' });

    const habits = await Habit.find({ userId: childId }).select('order').lean();
    const maxOrder = habits.reduce((m, h) => Math.max(m, h.order ?? 0), -1);

    const habit = await Habit.create({
      userId: childId,
      name: pack.habitDefaults.name,
      emoji: pack.habitDefaults.emoji,
      frequency: pack.habitDefaults.frequency,
      order: maxOrder + 1,
      points: habitPoints,
      domainKeys: pack.domainKeys.filter(k => DOMAIN_KEYS.has(k)),
    });

    const program = await TrainingProgram.create({ userId: childId, packKey, habitId: habit._id });
    res.status(201).json(serializeProgram(program, pack, habit));
  } catch (err) {
    // Race on the partial unique index → same message as the pre-check.
    if (err && err.code === 11000) return res.status(409).json({ error: 'This pack is already running for this child' });
    next(err);
  }
});

// GET /api/capabilities/programs?childId= — programs for a child (default self).
router.get('/', async (req, res, next) => {
  try {
    const childId = req.query.childId || req.user._id;
    const access = await authorizeChild(req, childId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const programs = await TrainingProgram.find({ userId: access.childId }).sort({ createdAt: 1 }).lean();
    const habitIds = programs.map(p => p.habitId).filter(Boolean);
    const habitDocs = await Habit.find({ _id: { $in: habitIds } }).lean();
    const habitById = new Map(habitDocs.map(h => [String(h._id), h]));

    const out = [];
    for (const p of programs) {
      const pack = getPack(p.packKey);
      if (!pack) continue; // template removed — hide rather than crash
      out.push(serializeProgram(p, pack, habitById.get(String(p.habitId)) || null));
    }
    res.json({ programs: out });
  } catch (err) { next(err); }
});

// PATCH /api/capabilities/programs/:id — week bump / pause / resume / done (parent only).
router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const program = await TrainingProgram.findById(req.params.id);
    if (!program) return res.status(404).json({ error: 'Not found' });
    const pack = getPack(program.packKey);
    if (!pack) return res.status(410).json({ error: 'Pack template no longer exists' });

    const { currentWeek, status } = req.body || {};

    if (currentWeek !== undefined) {
      const w = Number(currentWeek);
      if (!Number.isInteger(w) || w < 1 || w > pack.weeks.length) {
        return res.status(400).json({ error: `currentWeek must be 1–${pack.weeks.length}` });
      }
      program.currentWeek = w;
    }

    if (status !== undefined) {
      if (!['active', 'paused', 'done'].includes(status)) return res.status(400).json({ error: 'invalid status' });
      program.status = status;
      program.completedAt = status === 'done' ? new Date() : null;
      // Pause/done park the daily habit so Today stays clean; resume brings it back.
      await Habit.updateOne({ _id: program.habitId }, { archivedAt: status === 'active' ? null : new Date() });
    }

    await program.save();
    const habit = await Habit.findById(program.habitId).lean();
    res.json(serializeProgram(program, pack, habit));
  } catch (err) { next(err); }
});

// PUT /api/capabilities/programs/:id/measures/:week — upsert a week's numbers.
// Parent: any pack metric + note. Kid (self): only dose scoreMetric keys, no note.
router.put('/:id/measures/:week', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const program = await TrainingProgram.findById(req.params.id).lean();
    if (!program) return res.status(404).json({ error: 'Not found' });
    const pack = getPack(program.packKey);
    if (!pack) return res.status(410).json({ error: 'Pack template no longer exists' });

    const access = await authorizeChild(req, program.userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const week = Number(req.params.week);
    if (!Number.isInteger(week) || week < 1 || week > program.currentWeek) {
      return res.status(400).json({ error: 'week must be 1..currentWeek' });
    }

    const admin = isAdmin(req);
    const self = String(program.userId) === String(req.user._id);
    if (!admin && !self) return res.status(403).json({ error: 'Not authorised' });

    const allowedKeys = admin
      ? new Set(pack.metrics.map(m => m.key))
      : kidWritableMetricKeys(pack);
    const metricDefs = new Map(pack.metrics.map(m => [m.key, m]));

    const incoming = (req.body && typeof req.body.metrics === 'object' && req.body.metrics) || {};
    const clean = {};
    for (const [key, raw] of Object.entries(incoming)) {
      if (!allowedKeys.has(key)) return res.status(400).json({ error: `metric not allowed: ${key}` });
      const def = metricDefs.get(key);
      const n = Number(raw);
      if (!Number.isFinite(n)) return res.status(400).json({ error: `metric ${key} must be a number` });
      clean[key] = Math.min(Math.max(n, def.min), def.max);
    }

    let note;
    if (req.body && req.body.note !== undefined) {
      if (!admin) return res.status(400).json({ error: 'note is parent-only' });
      note = String(req.body.note).slice(0, 500);
    }

    const existing = await WeeklyMeasure.findOne({ programId: program._id, week });
    const metrics = { ...(existing?.metrics || {}), ...clean };
    const update = { metrics, userId: program.userId };
    if (note !== undefined) update.note = note;

    const saved = await WeeklyMeasure.findOneAndUpdate(
      { programId: program._id, week },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    res.json({ measure: { week: saved.week, metrics: saved.metrics, note: saved.note || '' } });
  } catch (err) { next(err); }
});

// GET /api/capabilities/programs/:id/measures — all weeks ascending (chart data).
router.get('/:id/measures', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const program = await TrainingProgram.findById(req.params.id).lean();
    if (!program) return res.status(404).json({ error: 'Not found' });

    const access = await authorizeChild(req, program.userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const measures = await WeeklyMeasure.find({ programId: program._id }).sort({ week: 1 }).lean();
    res.json({ measures: measures.map(m => ({ week: m.week, metrics: m.metrics || {}, note: m.note || '' })) });
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 5.2: Mount in `app.js`** — add require under the capabilities require and mount BEFORE the capabilities router:

```js
const capabilitiesRouter = require('./routes/capabilities');
const capabilityProgramsRouter = require('./routes/capabilityPrograms');
```
```js
app.use('/api/capabilities/programs', requireAuth, capabilityProgramsRouter);
app.use('/api/capabilities', requireAuth, capabilitiesRouter);
```

### Task 6: Route tests

**Files:**
- Create: `server/routes/capabilityPrograms.routes.test.js`

- [ ] **Step 6.1: Write the tests** (same harness as `capabilities.routes.test.js`: stub models, real express + JWT cookies)

```js
// HTTP-layer tests for the programs router: auth matrix (kid / admin / stranger),
// enrollment side-effects (tagged habit), duplicate 409, week bounds, measure
// upsert + kid metric whitelist, status transitions archiving the habit.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ADMIN_EMAIL = 'admin.e2e@example.com';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const q = result => {
  const o = { select: () => o, sort: () => o, limit: () => o, lean: () => Promise.resolve(result) };
  return o;
};
const oid = () => new mongoose.Types.ObjectId().toString();

const TrainingProgram = require('../models/TrainingProgram');
const WeeklyMeasure = require('../models/WeeklyMeasure');
const Habit = require('../models/Habit');
const ParentingLink = require('../models/ParentingLink');

// --- in-memory stores ---------------------------------------------------------
const programStore = new Map();
const habitStore = new Map();
const measureStore = new Map(); // key `${programId}:${week}`

function progDoc(fields) {
  const doc = {
    _id: oid(), status: 'active', currentWeek: 1, startedAt: new Date(), completedAt: null,
    createdAt: new Date(), ...fields,
    save: async function () { programStore.set(String(this._id), this); return this; },
  };
  return doc;
}

TrainingProgram.create = async fields => {
  const doc = progDoc(fields);
  programStore.set(String(doc._id), doc);
  return doc;
};
TrainingProgram.findById = id => {
  const doc = programStore.get(String(id)) || null;
  const p = Promise.resolve(doc);
  p.lean = () => Promise.resolve(doc);
  return p;
};
TrainingProgram.findOne = filter => q(
  [...programStore.values()].find(p =>
    String(p.userId) === String(filter.userId) && p.packKey === filter.packKey &&
    (filter.status?.$in ? filter.status.$in.includes(p.status) : true)) || null
);
TrainingProgram.find = filter => q([...programStore.values()].filter(p => String(p.userId) === String(filter.userId)));

Habit.create = async fields => {
  const doc = { _id: oid(), archivedAt: null, ...fields };
  habitStore.set(String(doc._id), doc);
  return doc;
};
Habit.find = () => q([...habitStore.values()]);
Habit.findById = id => q(habitStore.get(String(id)) || null);
Habit.updateOne = async (filter, update) => {
  const h = habitStore.get(String(filter._id));
  if (h) Object.assign(h, update);
  return { matchedCount: h ? 1 : 0 };
};

WeeklyMeasure.findOne = async filter => measureStore.get(`${filter.programId}:${filter.week}`) || null;
WeeklyMeasure.findOneAndUpdate = (filter, update) => {
  const key = `${filter.programId}:${filter.week}`;
  const existing = measureStore.get(key) || { programId: filter.programId, week: filter.week, metrics: {}, note: '' };
  const saved = { ...existing, ...update.$set };
  measureStore.set(key, saved);
  return q(saved);
};
WeeklyMeasure.find = filter => q(
  [...measureStore.values()].filter(m => String(m.programId) === String(filter.programId)).sort((a, b) => a.week - b.week)
);

ParentingLink.findOne = async () => null; // no linked parents in these tests

const requireAuth = require('../middleware/auth');
const router = require('./capabilityPrograms');

let server, base;
before(async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/capabilities/programs', requireAuth, router);
  app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(r => server.close(r)));
beforeEach(() => { programStore.clear(); habitStore.clear(); measureStore.clear(); });

const cookie = (id, email) => `token=${jwt.sign({ _id: id, email, name: email }, process.env.JWT_SECRET)}`;
const kidId = oid();
const strangerId = oid();
const ckKid = cookie(kidId, 'kid.e2e@example.com');
const ckStranger = cookie(strangerId, 'stranger.e2e@example.com');
const ckAdmin = cookie(oid(), 'admin.e2e@example.com');
const send = (method, ck, body) => ({ method, headers: { Cookie: ck, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('GET /packs requires auth; lists both packs for any user', async () => {
  assert.equal((await fetch(`${base}/api/capabilities/programs/packs`)).status, 401);
  const res = await fetch(`${base}/api/capabilities/programs/packs`, { headers: { Cookie: ckKid } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(body.packs.map(p => p.key).sort(), ['communication_precision', 'learning_to_learn']);
  // day-level content is not in the summary
  assert.equal(body.packs[0].weekThemes.length, 12);
  assert.equal(body.packs[0].weeks, undefined);
});

test('POST /: kid cannot enroll (403); admin enrolls and habit is tagged + pointed', async () => {
  assert.equal((await fetch(`${base}/api/capabilities/programs`,
    send('POST', ckKid, { childId: kidId, packKey: 'learning_to_learn' }))).status, 403);

  const res = await fetch(`${base}/api/capabilities/programs`,
    send('POST', ckAdmin, { childId: kidId, packKey: 'learning_to_learn', points: 150 }));
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.currentWeek, 1);
  assert.equal(body.week.days.length, 5);
  const habit = habitStore.get(String(body.habitId));
  assert.equal(habit.points, 150);
  assert.deepEqual(habit.domainKeys, ['metacognition', 'cognitive']);
  assert.equal(habit.frequency, 'daily');
});

test('POST /: unknown pack 400; duplicate active enrollment 409', async () => {
  assert.equal((await fetch(`${base}/api/capabilities/programs`,
    send('POST', ckAdmin, { childId: kidId, packKey: 'nope' }))).status, 400);
  await fetch(`${base}/api/capabilities/programs`, send('POST', ckAdmin, { childId: kidId, packKey: 'learning_to_learn' }));
  assert.equal((await fetch(`${base}/api/capabilities/programs`,
    send('POST', ckAdmin, { childId: kidId, packKey: 'learning_to_learn' }))).status, 409);
});

test('GET /: kid sees own programs; stranger blocked from kid via 403', async () => {
  await fetch(`${base}/api/capabilities/programs`, send('POST', ckAdmin, { childId: kidId, packKey: 'learning_to_learn' }));
  const mine = await (await fetch(`${base}/api/capabilities/programs`, { headers: { Cookie: ckKid } })).json();
  assert.equal(mine.programs.length, 1);
  assert.equal(mine.programs[0].packKey, 'learning_to_learn');
  assert.equal((await fetch(`${base}/api/capabilities/programs?childId=${kidId}`, { headers: { Cookie: ckStranger } })).status, 403);
});

test('PATCH /:id: admin-only; week bounds; done/pause archive habit, resume restores', async () => {
  const created = await (await fetch(`${base}/api/capabilities/programs`,
    send('POST', ckAdmin, { childId: kidId, packKey: 'learning_to_learn' }))).json();

  assert.equal((await fetch(`${base}/api/capabilities/programs/${created._id}`,
    send('PATCH', ckKid, { currentWeek: 2 }))).status, 403);
  assert.equal((await fetch(`${base}/api/capabilities/programs/${created._id}`,
    send('PATCH', ckAdmin, { currentWeek: 13 }))).status, 400);
  assert.equal((await fetch(`${base}/api/capabilities/programs/${created._id}`,
    send('PATCH', ckAdmin, { currentWeek: 0 }))).status, 400);

  const bumped = await (await fetch(`${base}/api/capabilities/programs/${created._id}`,
    send('PATCH', ckAdmin, { currentWeek: 2 }))).json();
  assert.equal(bumped.currentWeek, 2);

  await fetch(`${base}/api/capabilities/programs/${created._id}`, send('PATCH', ckAdmin, { status: 'paused' }));
  assert.ok(habitStore.get(String(created.habitId)).archivedAt);
  await fetch(`${base}/api/capabilities/programs/${created._id}`, send('PATCH', ckAdmin, { status: 'active' }));
  assert.equal(habitStore.get(String(created.habitId)).archivedAt, null);

  const done = await (await fetch(`${base}/api/capabilities/programs/${created._id}`,
    send('PATCH', ckAdmin, { status: 'done' }))).json();
  assert.ok(done.completedAt);
  assert.ok(habitStore.get(String(created.habitId)).archivedAt);
});

test('measures: kid limited to scoreMetric keys + no note; parent free; clamped; upsert merges', async () => {
  const created = await (await fetch(`${base}/api/capabilities/programs`,
    send('POST', ckAdmin, { childId: kidId, packKey: 'learning_to_learn' }))).json();
  const url = w => `${base}/api/capabilities/programs/${created._id}/measures/${w}`;

  // kid: ml_level is a dose scoreMetric → allowed (and clamped to max 10)
  const kidRes = await fetch(url(1), send('PUT', ckKid, { metrics: { ml_level: 22 } }));
  const kidBody = await kidRes.json();
  assert.equal(kidRes.status, 200);
  assert.equal(kidBody.measure.metrics.ml_level, 10);

  // kid: wrapper_days is parent-entered only → 400; note from kid → 400
  assert.equal((await fetch(url(1), send('PUT', ckKid, { metrics: { wrapper_days: 3 } }))).status, 400);
  assert.equal((await fetch(url(1), send('PUT', ckKid, { metrics: {}, note: 'hi' }))).status, 400);

  // stranger: 403
  assert.equal((await fetch(url(1), send('PUT', ckStranger, { metrics: { ml_level: 2 } }))).status, 403);

  // future week: 400 (currentWeek is 1)
  assert.equal((await fetch(url(2), send('PUT', ckAdmin, { metrics: { ml_level: 2 } }))).status, 400);

  // parent upsert merges with kid's earlier value
  const parentRes = await fetch(url(1), send('PUT', ckAdmin, { metrics: { wrapper_days: 4 }, note: 'good week' }));
  const parentBody = await parentRes.json();
  assert.equal(parentBody.measure.metrics.ml_level, 10);
  assert.equal(parentBody.measure.metrics.wrapper_days, 4);
  assert.equal(parentBody.measure.note, 'good week');

  // non-numeric → 400; unknown key → 400
  assert.equal((await fetch(url(1), send('PUT', ckAdmin, { metrics: { ml_level: 'x' } }))).status, 400);
  assert.equal((await fetch(url(1), send('PUT', ckAdmin, { metrics: { nope: 1 } }))).status, 400);

  // GET measures ascending
  const list = await (await fetch(`${base}/api/capabilities/programs/${created._id}/measures`, { headers: { Cookie: ckKid } })).json();
  assert.equal(list.measures.length, 1);
  assert.equal(list.measures[0].week, 1);
});
```

- [ ] **Step 6.2: Run** `cd server && node --test routes/capabilityPrograms.routes.test.js` — expect ALL PASS
- [ ] **Step 6.3: Run full suite** `cd server && npm test` — green
- [ ] **Step 6.4: Commit**

```bash
git add server/routes/capabilityPrograms.js server/routes/capabilityPrograms.routes.test.js server/routes/capabilities.js server/app.js
git commit -m "feat(capabilities): training program API (enroll, week bump, weekly measures)"
```

---

# Phase 4 — Kid surface: Dose Player + Today ▶ (commit)

### Task 7: API wrappers + `setStatus` in useHabits

**Files:**
- Create: `src/lib/capabilities/programs.js`
- Modify: `src/hooks/useHabits.js` (add `setStatus` next to `cycleStatus`, export it)

- [ ] **Step 7.1: `programs.js`**

```js
// Client API for the Depth Pack training engine (mirrors server/routes/capabilityPrograms.js).
import { apiFetch } from '../api';

export const listPacks = () => apiFetch('/api/capabilities/programs/packs');
export const listPrograms = ({ childId } = {}) =>
  apiFetch(`/api/capabilities/programs${childId ? `?childId=${childId}` : ''}`);
export const enrollProgram = ({ childId, packKey, points }) =>
  apiFetch('/api/capabilities/programs', { method: 'POST', body: JSON.stringify({ childId, packKey, points }) });
export const patchProgram = (id, body) =>
  apiFetch(`/api/capabilities/programs/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const putMeasure = (id, week, body) =>
  apiFetch(`/api/capabilities/programs/${id}/measures/${week}`, { method: 'PUT', body: JSON.stringify(body) });
export const getMeasures = (id) => apiFetch(`/api/capabilities/programs/${id}/measures`);
```

- [ ] **Step 7.2: `useHabits.js`** — insert after `cycleStatus` (`src/hooks/useHabits.js:212`) and add to the return object:

```js
  // Direct status set (Dose Player "Done" button) — same optimistic pattern as cycleStatus.
  const setStatus = useCallback(async (habitId, date, status) => {
    const key = format(date, 'yyyy-MM-dd');
    const current = logs[key]?.[habitId]?.status || 'not_started';
    if (current === status) return;
    setLogs(prev => ({
      ...prev,
      [key]: { ...prev[key], [habitId]: { ...prev[key]?.[habitId], status } },
    }));
    try {
      await apiFetch(`/api/logs/${habitId}`, { method: 'PUT', body: JSON.stringify({ date: key, status }) });
    } catch {
      setLogs(prev => ({
        ...prev,
        [key]: { ...prev[key], [habitId]: { ...prev[key]?.[habitId], status: current } },
      }));
      toast.error('Failed to save — check your connection');
    }
  }, [logs]);
```

Return object: add `setStatus` alongside `cycleStatus`.

### Task 8: DosePlayer page + Today/HabitCard wiring + route

**Files:**
- Create: `src/pages/DosePlayer.jsx`
- Modify: `src/pages/Today.jsx` (programs fetch + `trainTo` prop)
- Modify: `src/components/HabitCard.jsx` (▶ link)
- Modify: `src/App.jsx` (route `/skills/train/:programId` inside the Layout routes)

- [ ] **Step 8.1: `DosePlayer.jsx`**

```jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Play, Pause, RotateCcw, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useHabitsContext } from '../hooks/useHabits';
import { listPrograms, putMeasure } from '../lib/capabilities/programs';

// Mon–Fri drill cards; weekend shows Friday's card with a rest-day banner.
const jsDayToCard = jsDay => (jsDay >= 1 && jsDay <= 5 ? jsDay : 5);

function Timer({ minutes }) {
  const [left, setLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!running) return undefined;
    ref.current = setInterval(() => setLeft(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(ref.current);
  }, [running]);
  useEffect(() => { if (left === 0 && running) { setRunning(false); toast('⏰ Time! Nice work.'); } }, [left, running]);
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5">
      <span className={`font-mono text-2xl font-bold ${left === 0 ? 'text-green-600' : 'text-slate-700'}`}>{mm}:{ss}</span>
      <button onClick={() => setRunning(r => !r)} className="p-2 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200">
        {running ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button onClick={() => { setRunning(false); setLeft(minutes * 60); }} className="p-2 rounded-full text-slate-400 hover:bg-slate-200">
        <RotateCcw size={16} />
      </button>
    </div>
  );
}

export default function DosePlayer() {
  const { programId } = useParams();
  const { getStatus, setStatus } = useHabitsContext();
  const [program, setProgram] = useState(null);
  const [error, setError] = useState(null);
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState(jsDayToCard(today.getDay()));
  const [checked, setChecked] = useState({});
  const [score, setScore] = useState('');
  const [savingScore, setSavingScore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPrograms()
      .then(({ programs }) => {
        if (cancelled) return;
        const p = programs.find(x => String(x._id) === String(programId));
        if (!p) setError('Program not found');
        else setProgram(p);
      })
      .catch(() => { if (!cancelled) setError('Failed to load program'); });
    return () => { cancelled = true; };
  }, [programId]);

  const card = useMemo(
    () => program?.week?.days?.find(d => d.day === selectedDay) || null,
    [program, selectedDay]
  );
  const scoreDef = card?.scoreMetric
    ? program.pack.metrics.find(m => m.key === card.scoreMetric)
    : null;

  if (error) return (
    <div className="p-6 text-center text-slate-500">
      <p>{error}</p>
      <Link to="/today" className="text-violet-600 font-semibold text-sm">Back to Today</Link>
    </div>
  );
  if (!program) return <div className="p-6 text-center text-slate-400">Loading…</div>;

  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
  const doneToday = program.habit && getStatus(program.habitId, today) === 'done';
  const paused = program.status !== 'active';

  const saveScore = async () => {
    if (score === '' || !scoreDef) return;
    setSavingScore(true);
    try {
      await putMeasure(program._id, program.currentWeek, { metrics: { [card.scoreMetric]: Number(score) } });
      toast.success(`${scoreDef.label} saved!`);
    } catch { toast.error('Could not save score'); }
    setSavingScore(false);
  };

  const markDone = () => {
    if (program.habitMissing) return;
    setStatus(program.habitId, today, 'done');
    toast.success('Dose done! 🎉');
  };

  return (
    <div className="px-4 pb-12 pt-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Link to="/today" className="p-1.5 rounded-full hover:bg-slate-100"><ChevronLeft size={20} className="text-slate-500" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-800">{program.pack.title}</h1>
          <p className="text-xs text-slate-400">Week {program.currentWeek} of {program.totalWeeks} · {program.week?.theme}</p>
        </div>
      </div>

      {/* Ladder strip (read-only) */}
      <div className="flex gap-1 my-3">
        {program.pack.ladder.map(l => (
          <span key={l.level} title={l.milestone}
            className="flex-1 text-center text-[10px] font-bold py-1 rounded bg-slate-100 text-slate-400">
            L{l.level}
          </span>
        ))}
      </div>

      {paused && <p className="mb-3 text-xs font-semibold text-amber-600 bg-amber-50 rounded-lg px-3 py-2">This program is {program.status}. Ask a parent to resume it.</p>}
      {isWeekend && <p className="mb-3 text-xs font-semibold text-sky-600 bg-sky-50 rounded-lg px-3 py-2">Weekend — rest day. Friday's card is here if you want it.</p>}

      {/* Day tabs */}
      <div className="flex gap-1.5 mb-4">
        {(program.week?.days || []).map(d => (
          <button key={d.day} onClick={() => { setSelectedDay(d.day); setChecked({}); setScore(''); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${d.day === selectedDay ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][d.day - 1]}
          </button>
        ))}
      </div>

      {card && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-800 mb-3">{card.title}</h2>
          <div className="space-y-2 mb-4">
            {card.steps.map((s, i) => (
              <label key={i} className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={!!checked[i]}
                  onChange={() => setChecked(c => ({ ...c, [i]: !c[i] }))}
                  className="mt-0.5 accent-violet-600" />
                <span className={`text-sm ${checked[i] ? 'text-slate-300 line-through' : 'text-slate-600'}`}>{s}</span>
              </label>
            ))}
          </div>

          <Timer minutes={card.timerMin} />

          {scoreDef && (
            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-1">{scoreDef.label} ({scoreDef.min}–{scoreDef.max})</p>
              <div className="flex gap-2">
                <input type="number" min={scoreDef.min} max={scoreDef.max} value={score}
                  onChange={e => setScore(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                <button onClick={saveScore} disabled={savingScore || score === ''}
                  className="px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-40">
                  Save
                </button>
              </div>
            </div>
          )}

          <button onClick={markDone} disabled={doneToday || program.habitMissing || paused}
            className={`mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm ${doneToday ? 'bg-green-100 text-green-600' : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-40'}`}>
            <CheckCircle2 size={18} />
            {doneToday ? 'Done for today!' : 'Done for today'}
          </button>
          {program.habitMissing && <p className="mt-2 text-xs text-red-400">The linked habit was deleted — ask a parent to restart this pack.</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8.2: `Today.jsx`** — after the awards effect (`src/pages/Today.jsx:49`), add a one-shot programs fetch and pass a `trainTo` prop:

```jsx
  // Depth Pack programs (self): habitId -> programId so training habits get a ▶ link.
  const [programByHabit, setProgramByHabit] = useState({});
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/capabilities/programs')
      .then(({ programs }) => {
        if (cancelled) return;
        const map = {};
        for (const p of programs) if (p.status === 'active') map[p.habitId] = p._id;
        setProgramByHabit(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
```

And in the `HabitCard` render (`src/pages/Today.jsx:200-210`) add:

```jsx
                      trainTo={programByHabit[habit._id] ? `/skills/train/${programByHabit[habit._id]}` : null}
```

- [ ] **Step 8.3: `HabitCard.jsx`** — accept `trainTo` prop; render a link row under the status label (inside the flex-1 div, after the award line, `src/components/HabitCard.jsx:94`). Import Link at top:

```jsx
import { Link } from 'react-router-dom';
```
```jsx
          {trainTo && (
            <Link to={trainTo} onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 mt-1 hover:underline">
              ▶ Open today's drill
            </Link>
          )}
```

Signature becomes `({ habit, status, onCycle, value, onValueChange, award, flash, trainTo })`.

- [ ] **Step 8.4: `App.jsx`** — import `DosePlayer` and register inside the Layout `<Routes>` next to the other `/skills/*` routes:

```jsx
<Route path="/skills/train/:programId" element={<DosePlayer />} />
```

- [ ] **Step 8.5: Verify** `npm run build` (root) — green; `npm run lint` — no new errors
- [ ] **Step 8.6: Commit**

```bash
git add src/lib/capabilities/programs.js src/hooks/useHabits.js src/pages/DosePlayer.jsx src/pages/Today.jsx src/components/HabitCard.jsx src/App.jsx
git commit -m "feat(skills): kid dose player + Today drill link"
```

---

# Phase 5 — Parent surface: enrollment + Sunday Review (commit)

### Task 9: ProgramsCard (dashboard enrollment + status)

**Files:**
- Create: `src/components/ProgramsCard.jsx`
- Modify: `src/pages/SkillsDashboard.jsx` (render it; it receives `childId` + `isAdmin`)

- [ ] **Step 9.1: `ProgramsCard.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import { listPacks, listPrograms, enrollProgram } from '../lib/capabilities/programs';

// Depth Pack programs for one kid: active list + (admin) enrollment buttons.
export default function ProgramsCard({ childId, isAdmin }) {
  const [packs, setPacks] = useState([]);
  const [programs, setPrograms] = useState(null);
  const [points, setPoints] = useState(100);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    listPrograms({ childId: childId || undefined })
      .then(({ programs: p }) => setPrograms(p))
      .catch(() => setPrograms([]));
  }, [childId]);

  useEffect(() => { listPacks().then(({ packs: p }) => setPacks(p)).catch(() => {}); }, []);
  useEffect(() => { reload(); }, [reload]);

  if (programs === null) return null;
  const liveByPack = new Map(programs.filter(p => p.status !== 'done').map(p => [p.packKey, p]));

  const enroll = async (packKey) => {
    setBusy(true);
    try {
      await enrollProgram({ childId, packKey, points: Number(points) || 0 });
      toast.success('Pack started — habit added to their Today page');
      reload();
    } catch (err) { toast.error(err.message || 'Failed to start pack'); }
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-slate-500">
          <GraduationCap size={14} /> <span className="text-[11px] font-bold uppercase tracking-wider">Training programs</span>
        </div>
        {isAdmin && programs.some(p => p.status === 'active') && (
          <Link to="/skills/sunday" className="text-[11px] font-bold text-violet-600 hover:underline">Sunday review →</Link>
        )}
      </div>

      {programs.length === 0 && <p className="text-xs text-slate-400 mb-2">No programs yet.</p>}
      <div className="space-y-2">
        {programs.map(p => (
          <div key={p._id} className="flex items-center justify-between text-sm">
            <div>
              <p className="font-semibold text-slate-700">{p.pack.title}</p>
              <p className="text-xs text-slate-400">
                Week {p.currentWeek}/{p.totalWeeks} · {p.status}{p.habit ? ` · ⭐ ${p.habit.points}/day` : ''}
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : p.status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
              {p.status}
            </span>
          </div>
        ))}
      </div>

      {isAdmin && childId && packs.some(pk => !liveByPack.has(pk.key)) && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-slate-400">Points/day</label>
            <input type="number" min="0" value={points} onChange={e => setPoints(e.target.value)}
              className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-xs" />
          </div>
          <div className="flex flex-wrap gap-2">
            {packs.filter(pk => !liveByPack.has(pk.key)).map(pk => (
              <button key={pk.key} disabled={busy} onClick={() => enroll(pk.key)}
                className="text-xs font-semibold bg-violet-600 text-white rounded-lg px-3 py-1.5 hover:bg-violet-700 disabled:opacity-40">
                Start: {pk.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 9.2: `SkillsDashboard.jsx`** — import and render `<ProgramsCard childId={childId} isAdmin={isAdmin} />` directly under the kid picker / header area (after the radar section wrapper opens; place at top of the returned content, after the error banner if any). For the kid's own (non-admin) view pass `childId=""` (self) and `isAdmin={false}`.

### Task 10: SundayReview page + nav

**Files:**
- Create: `src/pages/SundayReview.jsx`
- Modify: `src/App.jsx` (route), `src/pages/Skills.jsx` (admin nav card)

- [ ] **Step 10.1: `SundayReview.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronLeft, Trophy, ArrowRight, Pause, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { listPrograms, patchProgram, putMeasure, getMeasures } from '../lib/capabilities/programs';

// Dependency-free sparkline (same philosophy as CapabilityRadar: inline SVG only).
function Sparkline({ points, max }) {
  if (!points.length) return null;
  const w = 120, h = 28, pad = 2;
  const xs = points.map((p, i) => pad + (i * (w - 2 * pad)) / Math.max(points.length - 1, 1));
  const ys = points.map(p => h - pad - ((p / (max || 1)) * (h - 2 * pad)));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <path d={d} fill="none" stroke="#7c3aed" strokeWidth="1.5" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.5" fill="#7c3aed" />
    </svg>
  );
}

function ProgramReview({ program, childId, onChanged }) {
  const [measures, setMeasures] = useState([]);
  const [form, setForm] = useState({});
  const [note, setNote] = useState('');
  const [brag, setBrag] = useState('');
  const [busy, setBusy] = useState(false);
  const week = program.currentWeek;

  const load = useCallback(() => {
    getMeasures(program._id).then(({ measures: m }) => {
      setMeasures(m);
      const current = m.find(x => x.week === week);
      const prev = [...m].reverse().find(x => x.week <= week);
      setForm({ ...(prev?.metrics || {}), ...(current?.metrics || {}) });
      setNote(current?.note || '');
    }).catch(() => {});
  }, [program._id, week]);
  useEffect(() => { load(); }, [load]);

  // Celebration hint: metric with the biggest positive move vs the previous week.
  const prevWeek = measures.filter(m => m.week < week).pop();
  let hint = null;
  if (prevWeek) {
    let best = 0;
    for (const m of program.pack.metrics) {
      const delta = (Number(form[m.key]) || 0) - (Number(prevWeek.metrics[m.key]) || 0);
      if (delta > best) { best = delta; hint = `${m.label}: up ${delta} this week — name the strategy, not the talent.`; }
    }
  }

  const saveNumbers = async () => {
    setBusy(true);
    try {
      const metrics = {};
      for (const m of program.pack.metrics) if (form[m.key] !== '' && form[m.key] !== undefined) metrics[m.key] = Number(form[m.key]);
      await putMeasure(program._id, week, { metrics, note });
      toast.success(`Week ${week} numbers saved`);
      load();
    } catch (err) { toast.error(err.message || 'Save failed'); }
    setBusy(false);
  };

  const captureBrag = async () => {
    if (!brag.trim()) return;
    setBusy(true);
    try {
      await apiFetch('/api/journey/admin/achievements', {
        method: 'POST',
        body: JSON.stringify({
          userId: childId,
          title: brag.trim().slice(0, 160),
          date: new Date().toISOString().slice(0, 10),
          category: 'other',
          description: `${program.pack.title} — week ${week}`,
        }),
      });
      toast.success('On the trophy shelf! 🏆');
      setBrag('');
    } catch { toast.error('Could not save achievement'); }
    setBusy(false);
  };

  const bump = async () => {
    setBusy(true);
    try {
      if (week >= program.totalWeeks) {
        await patchProgram(program._id, { status: 'done' });
        toast.success('Pack complete! 🎓');
      } else {
        await patchProgram(program._id, { currentWeek: week + 1 });
        toast.success(`Advanced to week ${week + 1}`);
      }
      onChanged();
    } catch (err) { toast.error(err.message || 'Failed'); }
    setBusy(false);
  };

  const togglePause = async () => {
    setBusy(true);
    try {
      await patchProgram(program._id, { status: program.status === 'paused' ? 'active' : 'paused' });
      onChanged();
    } catch (err) { toast.error(err.message || 'Failed'); }
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-bold text-slate-800">{program.pack.title}</h2>
          <p className="text-xs text-slate-400">Week {week}/{program.totalWeeks} · {program.week?.theme} · {program.status}</p>
        </div>
        <button onClick={togglePause} disabled={busy} className="p-2 rounded-full text-slate-400 hover:bg-slate-100">
          {program.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>

      {/* 1. Numbers */}
      <div className="space-y-2 mb-3">
        {program.pack.metrics.map(m => (
          <div key={m.key} className="flex items-center gap-2">
            <label className="flex-1 text-xs text-slate-500">{m.label}</label>
            <Sparkline points={measures.map(x => Number(x.metrics[m.key]) || 0)} max={m.max} />
            <input type="number" min={m.min} max={m.max}
              value={form[m.key] ?? ''}
              onChange={e => setForm(f => ({ ...f, [m.key]: e.target.value }))}
              className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-sm text-right" />
          </div>
        ))}
        <input type="text" placeholder="Note for the week (optional)" value={note} onChange={e => setNote(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
        <button onClick={saveNumbers} disabled={busy}
          className="w-full py-2 rounded-xl bg-slate-800 text-white text-xs font-bold disabled:opacity-40">
          Save week {week} numbers
        </button>
      </div>

      {/* 2. Celebrate */}
      {hint && <p className="text-xs text-violet-700 bg-violet-50 rounded-lg px-3 py-2 mb-3">🎉 {hint}</p>}

      {/* 3. Brag capture */}
      <div className="flex gap-2 mb-3">
        <input type="text" placeholder="Real win this week? → trophy shelf" value={brag} onChange={e => setBrag(e.target.value)}
          className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
        <button onClick={captureBrag} disabled={busy || !brag.trim()}
          className="px-3 rounded-lg bg-amber-500 text-white disabled:opacity-40"><Trophy size={14} /></button>
      </div>

      {/* 4. Bump */}
      <button onClick={bump} disabled={busy || program.status !== 'active'}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-40">
        {week >= program.totalWeeks ? 'Mark pack complete 🎓' : `Advance to week ${week + 1}`} <ArrowRight size={15} />
      </button>
    </div>
  );
}

export default function SundayReview() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState('');
  const [programs, setPrograms] = useState(null);

  const reload = useCallback(() => {
    if (!childId) return;
    listPrograms({ childId }).then(({ programs: p }) => setPrograms(p.filter(x => x.status !== 'done')))
      .catch(() => setPrograms([]));
  }, [childId]);

  useEffect(() => {
    apiFetch('/api/capabilities/children')
      .then(list => { setChildren(list); if (list.length) setChildId(String(list[0].childUserId)); })
      .catch(() => setChildren([]));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  if (!user?.isAdmin) return <Navigate to="/today" replace />;

  return (
    <div className="px-4 pb-12 pt-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <Link to="/skills" className="p-1.5 rounded-full hover:bg-slate-100"><ChevronLeft size={20} className="text-slate-500" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Sunday review</h1>
          <p className="text-xs text-slate-400">Numbers → celebrate → brag → bump. 15 minutes.</p>
        </div>
      </div>

      {children.length > 1 && (
        <div className="flex gap-2 mb-4">
          {children.map(c => (
            <button key={c.childUserId} onClick={() => setChildId(String(c.childUserId))}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${String(c.childUserId) === childId ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {programs === null ? <p className="text-center text-slate-400 py-10">Loading…</p>
        : programs.length === 0 ? <p className="text-center text-slate-400 py-10">No running programs for this kid. Start one from the Skills dashboard.</p>
        : programs.map(p => <ProgramReview key={p._id} program={p} childId={childId} onChanged={reload} />)}
    </div>
  );
}
```

- [ ] **Step 10.2: `App.jsx`** — import `SundayReview`, add route:

```jsx
<Route path="/skills/sunday" element={<SundayReview />} />
```

- [ ] **Step 10.3: `Skills.jsx`** — inside the admin-only block (next to the parent-baseline card, `src/pages/Skills.jsx:54-65` region), add a nav card linking to `/skills/sunday`, matching the existing card markup (NavLink + icon + title "Sunday review" + caption "Weekly numbers, brag capture, week bump").

- [ ] **Step 10.4: Verify** `npm run build` + `npm run lint` — green
- [ ] **Step 10.5: Commit**

```bash
git add src/components/ProgramsCard.jsx src/pages/SkillsDashboard.jsx src/pages/SundayReview.jsx src/App.jsx src/pages/Skills.jsx
git commit -m "feat(skills): parent enrollment + guided Sunday review"
```

---

# Phase 6 — Hardening + end-to-end verification (commit)

### Task 11: Hardening sweep

- [ ] **Step 11.1:** Server: `cd server && npm test` — full suite green
- [ ] **Step 11.2:** Client: `npm run build` and `npm run lint` — green, no new warnings introduced by these files
- [ ] **Step 11.3:** Review checklist against spec §5 (each item must be observably true in code): duplicate-enroll 409 + disabled button; week bounds; kid metric whitelist; future-week 400; pause archives habit; habitMissing flag rendered; loading/error/empty states present in DosePlayer, ProgramsCard, SundayReview

### Task 12: E2E verify (run the real app)

- [ ] **Step 12.1:** Start server (`cd server && npm run dev`) + client (`npm run dev`); if ports are blocked, kill the stale processes and restart (user pre-authorized)
- [ ] **Step 12.2:** Walk the flow with the real admin account: Skills dashboard → Start pack (points 100) → habit appears on kid Today (verify via admin tools or kid login) → open dose player from ▶ → check steps, run timer briefly, save a score → Done for today → confirm `GET /api/capabilities/rollup` reps include the tagged domain → `/skills/sunday`: enter numbers, save, brag capture → verify it shows in `/journey/admin` list → Advance week → dose player shows week 2
- [ ] **Step 12.3:** Negative checks: start same pack again (button gone / 409 toast), kid PUT of a parent-only metric via devtools fetch → 400
- [ ] **Step 12.4:** Final commit of any hardening fixes:

```bash
git add -A -- src server docs
git commit -m "chore(skills): training engine hardening + verified e2e flow"
```

- [ ] **Step 12.5:** Note in final report: Vercel auto-deploys the UI on push; the server needs a manual SAM deploy (`cd server && npm run deploy:update`) — do not run without the user.

---

## Self-review notes (done at write time)

- Spec coverage: every §1–§6 spec item maps to a task (registry→T1/2, models→T3, API→T4/5/6, kid UI→T7/8, parent UI→T9/10, hardening/E2E→T11/12). Brag capture reuses journey admin endpoint (T10). R7: no points writes anywhere outside the habit engine.
- `authorizeChild` import: circular-require risk (capabilities.js ← programs router) is nil — capabilities.js does not require the programs router.
- Type consistency: `packKey`/`currentWeek`/`habitId` names identical across models, routes, client wrappers; `scoreMetric` key matches `metrics[].key` (integrity-tested).
- Express 5 mounts `/api/capabilities/programs` before `/api/capabilities`, so `router.get('/packs')` cannot be shadowed by capabilities' param-less routes.
