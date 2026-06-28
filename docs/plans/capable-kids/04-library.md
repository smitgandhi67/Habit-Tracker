# Day 4 — Activity library (§6 evidence-based menu)

- **4.1** `server/models/CapabilityActivity.js` master model: `{ title, domainKeys[], tier(1-3),
  ageFit, approachRule, citationKey, skipReason? }`. Mirrors meals master-template pattern.
- **4.2** Idempotent seed (`server/scripts/`) of the §6 Tier 1/2/3 + skip list, each with primary
  domains + approach rule + citation key.
- **4.3** Routes: list/browse activities filtered by domain, tier, age-fit.
- **4.4** `SkillsLibrary` page — browse tagged by domain/tier/age; **approach rule shown prominently**
  on each card. Reuse meals library list/card patterns + Tailwind tokens.

## Verify
Seed populates; filtering a foundational domain returns the right Tier-1 items; approach rule visible.

## Commit
`feat(capabilities): evidence-based activity library tagged by domain/tier/approach`
