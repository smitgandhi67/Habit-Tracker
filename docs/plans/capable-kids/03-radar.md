# Day 3 — Radar profile + target-domain flagging

- **3.1** `src/components/CapabilityRadar.jsx` — dependency-free SVG radar (10 axes), single series +
  optional second overlay (parent vs kid). No new chart dependency (R3).
- **3.2** `SkillsBaselineResult` page — radar from the attempt's 10 dimensions; list the **1–3 lowest
  foundational domains** as target domains (§8 scoring→action).
- **3.3** Parent-vs-kid gap overlay on one radar; surface divergence as a self-awareness conversation
  prompt, not a correction.
- **3.4** Ethics copy: "self-tracking, not a clinical assessment; re-take ~quarterly" (R5).

## Verify
Radar geometry correct for known vectors; target-domain selection matches a hand-computed example;
mobile layout holds.

## Commit
`feat(capabilities): radar profile + target-domain flagging`
