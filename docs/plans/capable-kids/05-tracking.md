# Day 5 — Activity tracking + cross-track domain rollup

- **5.1** `CapabilityActivityLog` — log completions (kid-local date, like `HabitLog`); reuse streak/
  cadence helpers where possible.
- **5.2** `server/capabilities/rollup.js` — per-domain "reps" across activity logs **+ existing tracks**
  (math→cognitive, builder→problem-solving/agency, gym→physical, habits by optional domain tag).
  Read-only aggregation, never writes the ledger (R7).
- **5.3** Optional `domainKeys[]` on `Habit` so EF/emotional/social/communication habits roll in.
- **5.4** `SkillsTracker` page — log an activity, show cadence/streak, per-domain rep counts; quarterly
  re-assessment prompt when last baseline > ~90 days old.

## Verify
Logging an activity increments its domain rollup; math/builder reps appear under their domains;
quarterly prompt triggers on an aged baseline.

## Commit
`feat(capabilities): activity tracking + cross-track domain rollup`
