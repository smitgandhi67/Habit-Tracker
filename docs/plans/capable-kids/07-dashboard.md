# Day 7 — Parent dashboard (system of record)

- **7.1** `SkillsDashboard` — per-kid single view: radar + target domains + activity cadence + snapshot
  of existing math/builder/journey signals. Kid switcher reuses the `ParentingGap`/admin-link pattern.
- **7.2** Admin gating: parent-only; kid sees their own read-only profile (mirrors journey/trophies
  "kid sees achievements not targets").

## Verify
Dashboard aggregates correctly for a linked child; kid login sees read-only view only.

## Commit
`feat(capabilities): parent dashboard (system of record)`
