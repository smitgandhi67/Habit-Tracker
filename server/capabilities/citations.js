// Citation / reference registry — the evidence anchors from handover_1.md §4, as
// data. Drives the Day 6 reference layer (the "why" behind each domain/recommendation).
//
// MIRROR: src/lib/capabilities/citations.js holds the identical data (ESM). Keep in sync.
//
// strength:
//   'VERIFIED' — confirmed via source check in the session that produced the handover.
//   'KNOWN'    — well-established canonical reference from training; MUST be re-verified
//                before it surfaces as fact in the app (handover §10.5). Every KNOWN entry
//                carries needsReverify: true until Day 6 confirms it.
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
  },
  {
    key: 'diamond_lee2011',
    domainKeys: ['executive_function'],
    cite: 'Diamond & Lee (2011), Science',
    finding: 'Executive function is trainable through targeted programs in children aged 4–12.',
    strength: 'KNOWN',
    needsReverify: true,
  },
  {
    key: 'durlak2011',
    domainKeys: ['emotional', 'social'],
    cite: "Durlak et al. (2011), Child Development — meta-analysis, 213 programs, 270,000+ students",
    finding: 'Social-emotional learning produced an ~11-percentile-point academic gain plus better behavior and less distress; effects moderated by implementation quality.',
    strength: 'VERIFIED',
    needsReverify: false,
  },
  {
    key: 'eef_metacognition',
    domainKeys: ['metacognition'],
    cite: 'Education Endowment Foundation — Metacognition & Self-Regulation toolkit/guidance',
    finding: 'High-impact, low-cost: ~+8 months additional progress. Works best embedded in real subject content, not taught as standalone "thinking skills."',
    strength: 'VERIFIED',
    needsReverify: false,
  },
  {
    key: 'dunlosky2013',
    domainKeys: ['cognitive', 'metacognition'],
    cite: 'Dunlosky et al. (2013), Psychological Science in the Public Interest',
    finding: 'Practice testing (active recall) and distributed/spaced practice rated highest-utility learning techniques; rereading/highlighting low-utility.',
    strength: 'KNOWN',
    needsReverify: true,
  },
  {
    key: 'dresler2017',
    domainKeys: ['cognitive'],
    cite: 'Dresler et al. (2017), Neuron',
    finding: 'Mnemonic training (method of loci / memory palace) reshapes brain networks to support superior memory.',
    strength: 'KNOWN',
    needsReverify: true,
  },
  {
    key: 'hillman2014',
    domainKeys: ['physical'],
    cite: 'Hillman et al. (2014), Pediatrics — FITKids RCT, 221 children aged 7–9',
    finding: 'A 9-month afterschool aerobic program improved executive control (attentional inhibition + cognitive flexibility) and brain function vs. wait-list controls.',
    strength: 'VERIFIED',
    needsReverify: false,
  },
  {
    key: 'duckworth_seligman2005',
    domainKeys: ['character'],
    cite: 'Duckworth & Seligman (2005), Psychological Science',
    finding: 'Self-discipline outpredicted IQ for adolescent academic performance. (The broader "grit" construct is contested in later replications — present cautiously.)',
    strength: 'KNOWN',
    needsReverify: true,
  },
  {
    key: 'cunningham_stanovich',
    domainKeys: ['communication'],
    cite: 'Cunningham & Stanovich; print-exposure research',
    finding: 'Volume of reading is strongly associated with vocabulary and comprehension growth. Largely correlational.',
    strength: 'KNOWN',
    needsReverify: true,
  },
  {
    key: 'kidd_castano2013',
    domainKeys: ['social'],
    cite: 'Kidd & Castano (2013), Science',
    finding: 'Reading literary fiction associated with theory-of-mind gains. Replication contested — do not overstate.',
    strength: 'KNOWN',
    needsReverify: true,
  },
  {
    key: 'kaiser_finlit',
    domainKeys: ['agency'],
    cite: 'Kaiser et al. — financial-education meta-analysis',
    finding: 'Financial education produces real but modest effects on financial behavior; stronger when delivered "just in time."',
    strength: 'KNOWN',
    needsReverify: true,
  },
  {
    key: 'sala_gobet2017',
    domainKeys: ['creative', 'cognitive'],
    cite: 'Sala & Gobet (2017), Current Directions in Psychological Science — far-transfer meta-analyses',
    finding: 'Music and chess instruction do NOT reliably transfer to general intelligence or academics once active control groups are used. Value these for their own sake.',
    strength: 'VERIFIED',
    needsReverify: false,
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
