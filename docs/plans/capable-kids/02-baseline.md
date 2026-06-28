# Day 2 — Baseline assessment instruments

Reuses the parenting instrument engine (`server/parenting/scoring.js`); the entry point of the module.

## Tasks

- **2.1** `parent_baseline` instrument: 20 items (2/domain, §8a wording), Likert 1–5,
  `audience:'parent'`, subscales = 10 domains, dimensions = 10 domains (higher-better). `subjectUserId`
  = the child rated.
- **2.2** `kid_baseline` instrument: 10 items (1/domain, §8b wording), faces 1–3, `audience:'child'`,
  `format:'faces'`, `subjectUserId` = self.
- **2.3** Parallel capabilities instrument registry that imports `scoreInstrument`/`gapReport` (do not
  fork the engine).
- **2.4** RISK R1: `buildBaselineGap(parentId, childId)` — parent attempt (`userId=parent,
  subjectUserId=child`) vs kid attempt (`userId=child, subjectUserId=child`), run `gapReport`.
- **2.5** Dedicated `CapabilityAttempt` model (R8) mirroring `ParentingAttempt`; routes in
  `server/routes/capabilities.js`: list/get instrument, submit (server re-scores), get result, gap.
- **2.6** Frontend runner reusing `useParentingQuiz` pattern + `LikertScale`/`KidFaceScale`; pages
  `SkillsBaselineQuiz`, `SkillsBaselineKidQuiz`.
- **2.7** Tests: full-set scoring, missing-item rejection, gap math.

## Verify
Submit both quizzes end-to-end against running server; attempt persists; gap returns.

## Commit
`feat(capabilities): 10-domain baseline (parent + kid) on the instrument engine`
