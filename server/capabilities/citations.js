// Citation / reference registry — the evidence anchors from handover_1.md §4, as
// data. Drives the Day 6 reference layer (the "why" behind each domain/recommendation).
//
// MIRROR: src/lib/capabilities/citations.js holds the identical data (ESM). Keep in sync.
//
// strength:
//   'VERIFIED' — source-checked: the citation and its finding were confirmed.
//   'MIXED'    — source exists but the effect is replication-contested or only
//                correlational; surfaced WITH the caveat, never as settled fact.
//   'KNOWN'    — canonical-from-training but NOT yet source-checked; carries
//                needsReverify:true and must not surface as fact (handover §10.5).
//
// Day 6 re-verified every previously-KNOWN entry via web source checks (Jun 2026);
// each now carries a verifyNote and needsReverify:false. The KNOWN state remains in
// the enum so future additions start un-verified and are caught by the tests + UI.
//
// Every domain key has at least one anchor (enforced by registries.test.js).

const CITATIONS = [
  {
    key: 'moffitt2011',
    domainKeys: ['executive_function'],
    cite: 'Moffitt et al. (2011), PNAS — Dunedin cohort, n=1,000, birth→age 32',
    finding: 'Childhood self-control predicts adult health, wealth, and criminal outcomes along a gradient; holds in within-family sibling comparisons controlling for IQ.',
    strength: 'VERIFIED',
    needsReverify: false,
    verifyNote: 'Source-checked (handover §4): Moffitt et al. 2011, PNAS, Dunedin cohort. Robust.',
  },
  {
    key: 'diamond_lee2011',
    domainKeys: ['executive_function'],
    cite: 'Diamond & Lee (2011), Science, 333:959–964',
    finding: 'Executive function is trainable through targeted programs in children aged 4–12.',
    strength: 'VERIFIED',
    needsReverify: false,
    verifyNote: 'Re-verified Jun 2026: Science 333:959–964. Many activities improve EF (computerized training, games, aerobics, martial arts, mindfulness, curricula); all require repeated practice with progressively rising challenge. Transfer tends to be narrow / program-specific.',
  },
  {
    key: 'durlak2011',
    domainKeys: ['emotional', 'social'],
    cite: "Durlak et al. (2011), Child Development — meta-analysis, 213 programs, 270,000+ students",
    finding: 'Social-emotional learning produced an ~11-percentile-point academic gain plus better behavior and less distress; effects moderated by implementation quality.',
    strength: 'VERIFIED',
    needsReverify: false,
    verifyNote: 'Source-checked (handover §4): Durlak et al. 2011, Child Development meta-analysis.',
  },
  {
    key: 'eef_metacognition',
    domainKeys: ['metacognition'],
    cite: 'Education Endowment Foundation — Metacognition & Self-Regulation toolkit/guidance',
    finding: 'High-impact, low-cost: ~+8 months additional progress. Works best embedded in real subject content, not taught as standalone "thinking skills."',
    strength: 'VERIFIED',
    needsReverify: false,
    verifyNote: 'Source-checked (handover §4): EEF Metacognition & Self-Regulation guidance.',
  },
  {
    key: 'dunlosky2013',
    domainKeys: ['cognitive', 'metacognition'],
    cite: 'Dunlosky et al. (2013), Psychological Science in the Public Interest, 14(1):4–58',
    finding: 'Practice testing (active recall) and distributed/spaced practice rated highest-utility learning techniques; rereading/highlighting low-utility.',
    strength: 'VERIFIED',
    needsReverify: false,
    verifyNote: 'Re-verified Jun 2026: PSPI 14(1):4–58. Of 10 techniques reviewed, practice testing + distributed practice were the only two rated high-utility; rereading/highlighting rated low.',
  },
  {
    key: 'dresler2017',
    domainKeys: ['cognitive'],
    cite: 'Dresler et al. (2017), Neuron',
    finding: 'Mnemonic training (method of loci / memory palace) reshapes brain networks to support superior memory.',
    strength: 'VERIFIED',
    needsReverify: false,
    verifyNote: 'Re-verified Jun 2026: Neuron 2017. 6 weeks of method-of-loci training moved novices toward memory-athlete performance and shifted brain connectivity to resemble experts; gains persisted at 4-month follow-up.',
  },
  {
    key: 'hillman2014',
    domainKeys: ['physical'],
    cite: 'Hillman et al. (2014), Pediatrics — FITKids RCT, 221 children aged 7–9',
    finding: 'A 9-month afterschool aerobic program improved executive control (attentional inhibition + cognitive flexibility) and brain function vs. wait-list controls.',
    strength: 'VERIFIED',
    needsReverify: false,
    verifyNote: 'Source-checked (handover §4): Hillman et al. 2014, Pediatrics (FITKids RCT).',
  },
  {
    key: 'duckworth_seligman2005',
    domainKeys: ['character'],
    cite: 'Duckworth & Seligman (2005), Psychological Science, 16:939–944',
    finding: 'Self-discipline outpredicted IQ for adolescent academic performance. (The broader "grit" construct is contested in later replications — present cautiously.)',
    strength: 'VERIFIED',
    needsReverify: false,
    verifyNote: 'Re-verified Jun 2026: Psych Science 16:939–944. Self-discipline accounted for ~2× the variance of IQ in 8th-grade GPA, holding under controls. The 2005 self-discipline result is solid; it is the later broad "grit" construct that is contested — keep that caveat.',
  },
  {
    key: 'cunningham_stanovich',
    domainKeys: ['communication'],
    cite: 'Cunningham & Stanovich; print-exposure research',
    finding: 'Volume of reading is strongly associated with vocabulary and comprehension growth. Largely correlational.',
    strength: 'VERIFIED',
    needsReverify: false,
    verifyNote: 'Re-verified Jun 2026: print-exposure work (Cunningham & Stanovich, 1991/1997) predicts vocabulary, knowledge, and comprehension growth even controlling for education. Designs are cross-sectional / correlational — a real association, not proof that reading volume alone causes the gains.',
  },
  {
    key: 'kidd_castano2013',
    domainKeys: ['social'],
    cite: 'Kidd & Castano (2013), Science — replication-contested',
    finding: 'Reading literary fiction was associated with short-term theory-of-mind gains, but large preregistered replications did not reproduce the effect. Treat as not established.',
    strength: 'MIXED',
    needsReverify: false,
    verifyNote: 'Re-verified Jun 2026 → DOWNGRADED. Panero et al. 2016 (n=792) found no advantage for literary fiction, and Kidd & Castano\'s own 2019 three preregistered replications also failed to reproduce the original effect. Do not present as fact; if surfaced, surface the contest.',
  },
  {
    key: 'kaiser_finlit',
    domainKeys: ['agency'],
    cite: 'Kaiser & Menkhoff — financial-education meta-analyses',
    finding: 'Financial education produces real but modest effects on financial behavior; stronger when delivered "just in time."',
    strength: 'VERIFIED',
    needsReverify: false,
    verifyNote: 'Re-verified Jun 2026: Kaiser & Menkhoff meta-analyses (126 studies overall; schools meta-analysis ~+0.25 SD knowledge, ~+0.05 SD behavior). Effects are real but modest and heterogeneous; markedly stronger at a "teachable moment" (just-in-time).',
  },
  {
    key: 'sala_gobet2017',
    domainKeys: ['creative', 'cognitive'],
    cite: 'Sala & Gobet (2017), Current Directions in Psychological Science — far-transfer meta-analyses',
    finding: 'Music and chess instruction do NOT reliably transfer to general intelligence or academics once active control groups are used. Value these for their own sake.',
    strength: 'VERIFIED',
    needsReverify: false,
    verifyNote: 'Source-checked (handover §4): Sala & Gobet 2017, far-transfer meta-analyses.',
  },
];

const byKey = new Map(CITATIONS.map(c => [c.key, c]));

function getCitation(key) {
  return byKey.get(key) || null;
}

// Citations whose primary domain is `domainKey`.
function citationsForDomain(domainKey) {
  return CITATIONS.filter(c => c.domainKeys.includes(domainKey));
}

module.exports = { CITATIONS, getCitation, citationsForDomain };
