// Parent-report capability baseline — handover_1.md §8a. Two items per domain on a
// 1–5 frequency scale; the parent rates THEIR CHILD across the 10 capability domains.
// Each domain is its own subscale and its own (higher-better, no-reverse) dimension,
// so the score normalizes 0..1 and is directly comparable to the kid self-report
// for the baseline gap.
//
// NOT a clinical instrument: 2 items/domain is a self-tracking reflection signal to
// find where to focus, re-administered ~quarterly — not an assessment.

const { DOMAINS } = require('../domains');

// domainKey -> [itemA text, itemB text] (§8a wording).
const ITEMS = {
  cognitive: [
    'Figures out problems without being shown every step.',
    'Notices patterns, or asks "why" and "what if".',
  ],
  executive_function: [
    'Can plan a multi-step task and see it through without constant reminders.',
    'Resists an immediate temptation in order to reach a later goal.',
  ],
  metacognition: [
    "Can say what they do and don't understand.",
    "Adjusts their approach when something isn't working.",
  ],
  emotional: [
    'Calms down and keeps going after frustration, without melting down.',
    "Can name what they're feeling.",
  ],
  social: [
    'Reads how others are feeling and responds appropriately.',
    'Resolves a disagreement with a peer without it escalating.',
  ],
  communication: [
    'Explains an idea clearly enough that a listener gets it the first time.',
    'Listens fully before responding.',
  ],
  character: [
    "Tells the truth even when it's costly.",
    'Follows through on a commitment without being chased.',
  ],
  physical: [
    'Is physically active and coordinated for their age.',
    'Gets consistent, sufficient sleep.',
  ],
  agency: [
    'Handles an age-appropriate real-world task independently (orders food, a small purchase, simple navigation).',
    'Makes a reasonable decision when given choices and constraints.',
  ],
  creative: [
    'Generates original ideas, or enjoys making things.',
    'Sticks with a creative project through difficulty.',
  ],
};

const items = [];
for (const d of DOMAINS) {
  const [a, b] = ITEMS[d.key];
  items.push({ id: `pb_${d.key}_a`, text: a, subscale: d.key });
  items.push({ id: `pb_${d.key}_b`, text: b, subscale: d.key });
}

const responseScale = { min: 1, max: 5 };

module.exports = {
  key: 'parent_baseline',
  version: 1,
  audience: 'parent',
  subjectMode: 'rated-child',     // parent rates a specific child (subjectUserId required)
  format: 'likert',
  title: 'Skills Baseline (parent)',
  description: "Rate how your child usually is across ten capability areas. There are no right answers — it's a snapshot to find where to focus.",
  source: 'Parent-report inventory, handover_1.md §8a (2 items/domain across the 10 capability domains)',
  responseScale,
  options: [
    { value: 1, label: 'Rarely / never' },
    { value: 2, label: 'Sometimes' },
    { value: 3, label: 'About half' },
    { value: 4, label: 'Usually' },
    { value: 5, label: 'Almost always' },
  ],
  items,
  subscales: DOMAINS.map(d => ({ key: d.key, label: d.name })),
  dimensions: DOMAINS.map(d => ({ key: d.key, from: [{ subscale: d.key }], combine: 'mean' })),

  interpret() {
    // Targets (weakest foundations first) are computed at render time from the
    // dimensions so they always reflect the latest domain registry. Nothing
    // clinical is derived here.
    return { baseline: true };
  },
};
