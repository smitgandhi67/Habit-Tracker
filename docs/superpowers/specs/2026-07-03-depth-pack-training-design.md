# Depth Pack Training Engine — design spec

Date: 2026-07-03
Status: approved (user mandate: full sequential implementation this session)
Content source: `docs/plans/capable-kids/depth/` (00-framework, 01-learning-to-learn, 02-communication-precision)

## Problem

The Depth Pack curricula exist as documents. Kids need the daily training dose, the weekly
measurements, the ladder, and the Sunday ritual to run inside the app — otherwise the program
lives on paper and dies on paper. Decisions made with user:

1. **Surface:** hybrid — each pack enrollment creates a domain-tagged Habit on the kid's Today
   page; tapping it opens a Dose Player with the exact drill for the current program week.
2. **Scheduling:** `currentWeek` on the program; parent bumps it during the Sunday ritual
   (or holds a week). No calendar auto-advance, no mastery gates.
3. **Sunday ritual:** guided parent screen — enter week's numbers, see trends, celebration
   prompt, one-tap brag capture (creates Achievement → kid's /trophies), bump week.
4. **Architecture:** program engine inside the existing capabilities module. Pack content is a
   code-defined template registry (same pattern as `activitiesSeed.js`). Two new models.
   Dose completion flows through the existing habit engine (points/streaks/rollup for free).

## Section 1 — Pack template registry

`server/capabilities/packs/` — pure data + tiny accessors, integrity-tested:

- `learningToLearn.js`, `communicationPrecision.js`, `index.js` (`getPack(key)`, `listPacks()`)

Template shape:

```js
{
  key: 'learning_to_learn',            // stable id
  title: 'Learning-to-learn & Memory',
  domainKeys: ['metacognition', 'cognitive'],   // valid capability domain keys
  habitDefaults: { name: 'Memory training (15 min)', emoji: '🧠', frequency: 'daily' },
  metrics: [                            // the fridge-chart columns
    { key: 'ml_level',        label: 'Memory League level', min: 0, max: 10 },
    { key: 'retention_pct',   label: 'Deck retention %',    min: 0, max: 100 },
    { key: 'calibration_err', label: 'Calibration error',   min: 0, max: 100 },
    { key: 'wrapper_days',    label: 'Homework wrapper days', min: 0, max: 5 },
  ],
  ladder: [ { level: 0, milestone: '…' } … { level: 5, milestone: '…' } ],  // exactly 6
  weeks: [                              // exactly 12
    { week: 1, theme: 'Palace + linking',
      days: [                           // exactly 5 (Mon–Fri)
        { day: 1, title: 'Build your palace', steps: ['…', '…'],
          timerMin: 15, scoreMetric: null },   // scoreMetric: optional metrics key
      ] },
  ],
}
```

Communication pack: `domainKeys: ['communication']`, metrics `dd_accuracy_pct`, `retell_score`
(0–10), `teachback_score` (0–20), `fillers_per_min`, `audience_events`. Week/day content is
transcribed from the two depth-pack docs; docs remain the human-readable source of truth.

## Section 2 — Models

`server/models/TrainingProgram.js`:

```js
{ userId: ObjectId(User, required, index),
  packKey: String (required, must exist in registry),
  status: 'active' | 'paused' | 'done'   (default 'active'),
  currentWeek: Number 1..12 (default 1),
  habitId: ObjectId(Habit, required),
  startedAt: Date, completedAt: Date|null, timestamps }
```

Rule: one non-done program per (userId, packKey) — enforced in route (409), plus a partial
unique index where feasible.

`server/models/WeeklyMeasure.js`:

```js
{ programId: ObjectId(TrainingProgram, required, index),
  userId: ObjectId(User, required, index),      // denormalized for authorizeChild checks
  week: Number 1..12 (required),
  metrics: Mixed   // { metricKey: Number } — keys validated against pack.metrics in routes
  note: String (trim, maxlength 500),
  timestamps }
unique compound index (programId, week)          // Sunday re-edit = upsert
```

No DoseLog model. Dose completion = the linked habit marked done (existing `HabitLog`), which
already produces points, streaks, and domain rollup reps. Measures NEVER award points
(guardrail R7 preserved).

## Section 3 — API

New router `server/routes/capabilityPrograms.js`, mounted at `/api/capabilities/programs`
(keeps `capabilities.js` from growing further). Reuses `authorizeChild` from capabilities
routes (export it) and `requireAdmin` from `utils/auth.js`.

| Method/path | Auth | Behavior |
|---|---|---|
| `GET /packs` | any authed | registry list (key, title, metrics, ladder, week themes — not full day content) |
| `POST /` | admin | `{ childId, packKey, points }` → validate pack + no active dup → create Habit (habitDefaults + sanitized domainKeys + parent-set points) → create program. Returns both. |
| `GET /?childId=` | authorizeChild | programs for child, each hydrated with pack title/ladder/metrics + `week` payload for `currentWeek` (full day cards) + habit done-today flag |
| `PATCH /:id` | admin | `{ currentWeek?, status? }` — week bounds 1..12; `status:'done'` sets completedAt + archives habit; `'paused'` archives habit; `'active'` unarchives |
| `PUT /:id/measures/:week` | admin OR kid-self (restricted) | upsert. Admin: any metric keys + note. Kid: only keys that appear as some `scoreMetric` in the pack (dose-score entry), no note. All values numeric, clamped to metric min/max. Week must be ≤ currentWeek. |
| `GET /:id/measures` | authorizeChild | all weeks ascending (chart data) |

Brag capture reuses existing `POST /api/journey/admin/achievements` from the Sunday screen.
No new trophy plumbing.

## Section 4 — Frontend

**Kid — Dose Player** (`src/pages/DosePlayer.jsx`, route `/skills/train/:programId`):
- Header: pack title, week N + theme, ladder strip (L0–L5, current level highlighted read-only)
- 5 day cards (Mon–Fri); today's weekday pre-selected (weekend → last card, banner "rest day")
- Card detail: steps checklist (local state), countdown timer (`timerMin`, client-only),
  score input when `scoreMetric` set (PUT measure on save)
- "Done for today" button → existing habit-done API (same call Today page uses) → toast
  celebration → back link
- Done-today state visible on entry (from `GET /programs` flag)

**Today page integration:** habit rows whose id matches an active program get a ▶ affordance
linking to the dose player. Today (or `HabitsContext`) fetches `GET /api/capabilities/programs`
once for self; map habitId → programId. Zero change to habit toggle behavior.

**Parent — enrollment** (Skills dashboard, parent view): per kid, "Start pack" card per
un-enrolled pack: points input (default 100) → `POST /programs`. Active programs show pack,
week, status, link to Sunday review.

**Parent — Sunday Review** (`src/pages/SundayReview.jsx`, route `/skills/sunday`, admin-gated
same as JourneyAdmin): kid picker (reuse existing children endpoint) → per active program:
1. Metrics form for `currentWeek`, pre-filled from latest saved values
2. Dependency-free SVG sparkline per metric (same no-dependency approach as the radar)
3. Celebration prompt: metric with biggest positive delta pre-selected, editable line
4. Brag textarea → POST achievement (category from pack, description prefixed with pack title)
5. `Advance to week N+1` (PATCH) — at week 12: `Mark pack complete`; also Pause/Resume

Nav: Skills hub page gets a "Sunday review" card (admin only). Dashboard program section links
there too.

**Kid visibility:** kid sees own programs, ladder, and trend charts (self-tracking ethos —
consistent with existing parentView stripping only targets/milestones/parent-ratings).

## Section 5 — Error handling & edge cases

- Enroll duplicate pack → 409 with message; UI disables Start button for active packs
- Week bump beyond 12 / below 1 → 400; UI never offers it
- Kid PUT with non-scoreMetric key → 400; note from kid → 400
- Measures for week > currentWeek → 400 (can't log the future)
- Pause/done archive the habit so Today stays clean; resume unarchives; deleting programs is
  NOT offered (pause or done only — history preserved)
- Program with missing habit (manually deleted): `GET /programs` flags `habitMissing: true`;
  UI shows repair hint; dose Done button hidden
- All pages: loading / error / empty states per module convention (08-hardening patterns)
- No new permissions surface: kid routes all pass `authorizeChild`; mutations admin-only except
  the restricted kid score entry

## Section 6 — Testing & production readiness

- **Template integrity tests** (`server/capabilities/packs/packs.test.js`, mirrors
  `activitiesSeed.test.js`): both packs — exactly 12 weeks × 5 days, ladder length 6,
  domainKeys ∈ registry, every `scoreMetric` ∈ pack metrics, no empty steps, timers 5–20 min
- **Route tests** (`server/routes/capabilityPrograms.test.js`, same harness as existing route
  tests): auth matrix (kid vs parent vs stranger), enroll → habit created with sanitized
  domainKeys + points, duplicate 409, week bounds, measure upsert idempotency, kid metric
  whitelist, status transitions archive/unarchive habit
- **Full suite** green before each commit; frontend build (`vite build`) green
- **E2E verify before final commit:** run server + UI locally, walk parent-enroll → kid dose →
  habit done → rollup rep visible → Sunday numbers → week bump → brag → /trophies
- Deploy: UI auto-deploys via Vercel on push; server is manual SAM (deploy step documented in
  final commit message; not run without user)

## Out of scope (explicit)

- No auto-trophies from streaks/levels (trophies stay parent-authored)
- No recording/upload of videos (phone stays the tool; app stores scores only)
- No Memory League API integration (manual level entry)
- No changes to points economy, ledger, or rollup logic
