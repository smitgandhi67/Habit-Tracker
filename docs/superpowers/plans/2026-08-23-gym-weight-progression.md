# Gym — Weight Progression Coach

**Status:** in progress · started 2026-08-23
**Branch:** master

> Live task board. `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked.
> (The TodoWrite tool is not available in this session, so this file is the task
> board and is updated at every phase transition.)

---

## 1. Goal

Turn the Gym module from a passive log into an active progressive-overload coach.

**User requirements:**

1. Recommend when to try the next weight.
2. Rep-range rule:
   - 8-10 range → all 3 sets at 10 reps ⇒ suggest next weight.
   - 12-15 range → all 3 sets at 15 reps ⇒ suggest next weight.
3. After moving up, show the **new weight together with the rep target**.
4. Expect a **minimum of 4 reps** at the new weight, climbing over sessions to
   10 / 15 respectively.
5. Must be able to track **more than 3 sets** (current hard cap is 3).
6. Everything already present stays: last session for that exercise, all-time PRs,
   weekly coverage, plan tab, progress tab, health export.

---

## 2. Domain model / algorithm

### 2.1 Vocabulary

| Term | Meaning |
| --- | --- |
| **working set** | A logged set that is not flagged as a warm-up and has reps > 0. |
| **top weight** | Max weight across the working sets of one session. |
| **top sets** | Working sets performed at the top weight. |
| **target** | `{ repsMin, repsMax, sets }` — the prescription for this exercise. |
| **step** | Smallest weight increment for this exercise (2.5 / 5 lb, 1.25 / 2.5 kg). |

### 2.2 Rep/set target resolution (priority order)

1. Per-user, per-exercise override (`ExerciseSetting`) — `source: 'setting'`
2. Active workout plan entry for that exercise — `source: 'plan'`
3. Any visible plan (master first) — `source: 'plan'`
4. Body-part default — `source: 'default'`
   - chest / back / legs / full_body → 8-10 x 3 (compounds)
   - arms / shoulders / core → 12-15 x 3 (isolation)
   - cardio → 8-10 x 3 (nominal; weight progression is not meaningful)

The resolved `source` is surfaced in the UI so a wrong inference is visible and
one tap away from being corrected.

### 2.3 Weight step default

| Unit | Compound (chest/back/legs/full_body) | Isolation (arms/shoulders/core) |
| --- | --- | --- |
| lb | 5 | 2.5 |
| kg | 2.5 | 1.25 |

Overridable per exercise per user via `ExerciseSetting.weightStep`.

### 2.4 Decision table (evaluated against the most recent session)

Let `q` = number of top sets that reached `repsMax`, `maxTopReps` = best reps at
top weight, `targetSets` = target.sets, `MIN_REPS_NEW_WEIGHT = 4`.

| Condition | Status | Recommended weight | Rep target |
| --- | --- | --- | --- |
| no prior session | `no_history` | — | `repsMin`-`repsMax` |
| top weight = 0 (bodyweight/timed) | `bodyweight` | 0 | `repsMax` |
| `maxTopReps < 4` | `deload` | previous top weight, else `topWeight - step` | `repsMax` |
| `q >= targetSets` | `ready` | `topWeight + step` | `4+` climbing to `repsMax` |
| else, top weight rose vs. session before | `climb` | `topWeight` (hold) | `repsMax` (unlock `topWeight + step`) |
| else | `hold` | `topWeight` | `repsMax` (unlock `topWeight + step`) |

Nothing is persisted: the recommendation is **derived** from history every time,
so ignoring a suggestion, deloading, or editing an old entry all self-correct.

### 2.5 Worked example (the user's own scenario)

```
Bench Press · plan says 3 x 8-10 · step 5 lb

Session 1   50 x 10, 50 x 10, 50 x 9    -> hold   "1 more set at 10 to unlock 55 lb"
Session 2   50 x 10, 50 x 10, 50 x 10   -> ready  "Move up to 55 lb - aim 4+ reps, build to 10"
Session 3   55 x  6, 55 x  5, 55 x  5   -> climb  "Stay at 55 lb - build 6 -> 10"
Session 4   55 x  8, 55 x  8, 55 x  7   -> climb  "Stay at 55 lb - build 8 -> 10"
Session 5   55 x 10, 55 x 10, 55 x 10   -> ready  "Move up to 60 lb"
Session 6   60 x  3, 60 x  3, 60 x  2   -> deload "Too heavy - back to 55 lb"
```

---

## 3. Phases

### Phase 0 — Pre-flight & blockers  `[x]`
- [x] Read every gym file (models, routes, hooks, components, pages, utils).
- [x] `npm ci` — **BLOCKER FOUND**: ERESOLVE, `@emoji-mart/react@1.1.1` peers cap
      at React 18 while the project runs React 19. Install fails outright.
- [x] Fix: add `.npmrc` with `legacy-peer-deps=true` (documented in-file).
- [x] Install root + server dependencies.
- [x] Baseline `npm run lint` — **BLOCKER FOUND**: 776 errors; ~761 are bogus
      `no-undef` on `require` / `module` / `process` because `server/**`
      (CommonJS + Node globals) is linted with browser globals. Lint is unusable
      as a quality gate.
- [x] Record: 15 genuine pre-existing `src/` errors, none in gym files
      (math / parenting / decode modules). Out of feature scope — reported, not
      silently rewritten, because those modules have no test coverage.
- [x] Note: no `server/.env` in the repo (gitignored) → the Express server cannot
      be booted locally. Verification is via `node --test`, smoke scripts,
      `eslint`, and `vite build`.

### Phase 1 — Tooling & lint gate  `[x]`
- [x] eslint config: Node/CommonJS override for `server/**`, `*.config.js`,
      `*.mjs` scripts; ignore `node_modules`, `dist`, `server/.aws-sam`.
- [x] Add `lint:src` / `lint:server` scripts + root `test` script that runs the
      server test suite.
- [x] Verify server lint is clean; verify `src` lint shows only the 15 known
      pre-existing errors.
- [x] Commit.

### Phase 2 — Data model  `[x]`
- [x] `GymEntry.setSchema`: add `isWarmup: Boolean` (default false).
- [x] `GymEntry.sets` validation: `1..3` → `1..12`, with a named validator +
      message so the 400 is legible.
- [x] `GymEntry`: index `{ userId, exerciseName, date: -1 }` for the
      "last N sessions per exercise" read path.
- [x] `WorkoutPlan.planExerciseSchema.sets`: max `10` → `12` (parity with logs).
- [x] New model `ExerciseSetting` — per-user, per-exercise overrides:
      `{ userId, nameKey, exerciseName, weightStep, repsMin, repsMax, targetSets }`,
      unique compound index `{ userId, nameKey }`.
- [x] Confirm additive-only: existing documents stay valid, no migration needed.
- [x] Commit.

### Phase 3 — Progression engine (pure, server)  `[ ]`
- [ ] `server/utils/progression.js`:
      - `MIN_REPS_NEW_WEIGHT`, `DEFAULT_TARGET_SETS`, `MAX_SETS`
      - `workingSets`, `topWeightOf`, `topSetsOf`, `summarizeSession`
      - `defaultWeightStep({ weightUnit, bodyPart })`
      - `defaultRepTarget(bodyPart)`
      - `resolveTarget({ bodyPart, setting, planExercise })`
      - `resolveStep({ weightUnit, bodyPart, setting })`
      - `recommendNext({ sessions, target, step })` → structured, prose-free
      - `roundWeight`
- [ ] `server/utils/progression.test.js` — node:test, covering the whole decision
      table, the six-session worked example, warm-up exclusion, bodyweight,
      float safety, deload floor, and target/step resolution precedence.
- [ ] Run `node --test`; all green.
- [ ] Commit.

### Phase 4 — Server API  `[ ]`
- [ ] `GET /api/gym/exercise/:name/history?planId=&recent=` — now also returns
      `recent[]`, `target`, `step`, `recommendation`, `setting`.
      Back-compatible: `last` and `pr` keep their existing shape.
- [ ] `GET /api/gym/recommendations?planId=&dayLabel=&names=` — bulk; one
      aggregation for the last 3 sessions of each requested exercise.
- [ ] `GET /api/gym/exercise-settings` — list overrides.
- [ ] `PUT /api/gym/exercise-settings/:name` — upsert; `null` clears a field;
      full range validation (step > 0, repsMin <= repsMax, sets 1..12).
- [ ] `DELETE /api/gym/exercise-settings/:name` — reset to inferred defaults.
- [ ] `server/routes/gym.progression.routes.test.js` — HTTP + authz + validation
      against stubbed models.
- [ ] Commit.

### Phase 5 — Client: more than 3 sets  `[ ]`
- [ ] `GymEntryModal`: `MAX_SETS = 12`, add/remove up to the cap, per-set warm-up
      toggle, prefill honours the plan's set count.
- [ ] Copy the previous set's weight into a newly added set (fewer taps).
- [ ] Gym log card: warm-up sets rendered muted with a `W` marker.
- [ ] `PlanEditor`: sets `max` 10 → 12.
- [ ] Commit.

### Phase 6 — Client: the recommendation UI  `[ ]`
- [ ] `src/lib/progression.js` — presentation + live preview only
      (`summarizeDraftSets`, `describeRecommendation`, `statusTone`,
      `formatWeight`). The authoritative decision stays server-side.
- [ ] `src/components/NextTargetCard.jsx` — status-driven card: headline, rep
      target, "why", `Use <weight>` apply button, and an inline settings popover
      for step / rep range / sets.
- [ ] Wire into `GymEntryModal` above the sets editor; keep the existing
      last-session + PR panel intact.
- [ ] Live unlock preview under the sets editor as the user types.
- [ ] `src/lib/progression.smoke.mjs` for the pure client helpers.
- [ ] Commit.

### Phase 7 — Recommendations across the Gym tabs  `[ ]`
- [ ] `useGym`: `fetchRecommendations`, `fetchExerciseSettings`,
      `saveExerciseSetting`, `resetExerciseSetting`; pass `activePlanId` through.
- [ ] Plan tab: per-exercise target chip (`55 lb x 4+`) beside each planned
      exercise, driven by the bulk endpoint.
- [ ] Log tab: `Next: 55 lb` / `Ready` chip on each entry card.
- [ ] Commit.

### Phase 8 — Docs, hardening, verification  `[ ]`
- [ ] `Coaching.jsx`: document the real progression rules the app now enforces
      (4-rep floor, climb, deload, warm-up sets) so copy matches behaviour.
- [ ] Health export: warm-up markers, `> 3` sets.
- [ ] Full verification: `node --test`, all smoke scripts, `eslint` on new files,
      `vite build`.
- [ ] Commit + push.

---

## 4. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Wrong rep range inferred → wrong advice | `target.source` shown in the UI; one-tap override persisted per user. |
| Wrong step for a machine's stack | `weightStep` override per exercise per user. |
| Warm-up sets dragging the recommendation down | Explicit `isWarmup` flag; engine only reads working sets. |
| Float drift (2.5 kg steps) | All weights pass through `roundWeight` (2 dp). |
| Old entries with 1-3 sets | Widening the cap is additive; every existing document stays valid. |
| Bulk endpoint N+1 | Single `$sort` + `$group` + `$slice` aggregation over an indexed match. |
| Server unbootable locally (no `.env`) | Route tests stub the models; no DB needed. |

## 5. Out of scope (reported, not changed)

15 pre-existing eslint errors in `src/` — `useMath.js` (refs during render),
`ComboCelebrate`, `useDecode`, `useParentingQuiz`, `useParentingResults`,
`Family`, `ParentingAdmin`, `ParentingGap`, `ParentingKidQuiz`, `StepMul`,
`Zigzag`, `decode/FreeGen`. None are gym code and none have test coverage;
rewriting them alongside this feature would risk silent regressions in the math
and parenting modules.
