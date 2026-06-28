# Capable Kids — Roadmap

Parent-facing **Capabilities ("Skills") module** layered onto HabitTracker, built from
`Downloads/handover_1.md` (research-grounded strategy + app spec §9). Source of truth for the
research is that handover; this folder holds the build plan, one file per day.

## Why this is a module, not a new app

~80% of the §9 app concept already exists here under different names:

| §9 wants | Reuse |
|---|---|
| Baseline (parent + kid report → profile, quarterly) | Parenting **instrument engine** — `server/parenting/scoring.js`, registry, `useParentingQuiz`, gap report, scale components |
| Activity library (master templates, tagged, cloneable) | Meals **library** master-template/clone pattern |
| Tracker (log, streaks, cadence) | `Habit` + `HabitLog`; math daily stats; builder |
| Per-kid profile | `User` (+ new `birthdate`) |
| Domain rollup | math→cognitive, builder→problem-solving/agency, gym→physical |

New surface: domain registry, 10-domain baseline instruments, radar, activity library + tracker
tagged by domain, reference/citation layer, approach/coaching layer.

## Guardrails (every phase)

- Foundations first (EF=D2, metacognition=D3, emotional=D4).
- Citations carry `VERIFIED|KNOWN`; KNOWN re-verified (Day 6) before surfacing as fact.
- Baseline = self-tracking, **not clinical**; quarterly re-assessment; gap = conversation.
- Approach rule is first-class data on every activity.

## Conventions

TodoWrite each day · no shortcuts/bypass/defer · sequential only · commit per phase · restart app
(force-kill blocked ports) when needed · verify before "done" · keep `scoring.js` server/client
mirrors in sync.

## Days

- **01** Foundation — domain registry, citation registry, profile age, nav/route scaffold
- **02** Baseline — parent + kid 10-domain instruments on the engine; baseline gap
- **03** Radar — dependency-free SVG radar + target-domain flagging
- **04** Library — evidence-based activity library tagged by domain/tier/approach
- **05** Tracking — activity logging + cross-track domain rollup
- **06** Reference + coaching — re-verify KNOWN citations; reference layer; parent operating guide
- **07** Dashboard — per-kid system-of-record view
- **08** Hardening — risk register sweep, robustness, full-flow verification

## Risk register

R1 baseline gap subject=child both sides → dedicated `buildBaselineGap` (Day 2).
R2 no age on User → add `birthdate` (Day 1).
R3 no chart lib → SVG radar, no new dep (Day 3).
R4 `scoring.js` mirrored → edit both, test both.
R5 homemade baseline read as clinical → label "self-tracking" (Day 2/3).
R6 KNOWN citations unverified → re-verify before surfacing (Day 6).
R7 rollup double-count → read-only aggregation, never writes ledger (Day 5).
R8 mixing capability attempts into parenting collection → dedicated `CapabilityAttempt` (Day 2).
