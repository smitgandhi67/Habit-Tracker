// Kid self-report capability baseline — handover_1.md §8b. One item per domain on a
// kid-friendly 3-point "how much is this like me?" scale, read aloud for younger kids.
// Same 10 domain keys as the parent version so the baseline gap compares them
// (where parent and kid diverge is itself signal — a self-awareness conversation,
// not a correction, §8b).
//
// The child never sees scores — results are parent-facing. Items are phrased in the
// first person and kept neutral so a kid can answer honestly.

const { DOMAINS } = require('../domains');

// domainKey -> child-facing item (§8b wording).
const ITEMS = {
  cognitive: 'I can figure out tricky problems by myself.',
  executive_function: 'When I plan to do something, I finish it.',
  metacognition: "I know when I don't understand something.",
  emotional: 'When I get frustrated, I can calm myself down.',
  social: 'I can tell how my friends are feeling.',
  communication: 'People understand me when I explain things.',
  character: 'I tell the truth even when it is hard.',
  physical: 'I love running, playing, and moving around.',
  agency: 'I can do things on my own, like ordering or buying something.',
  creative: 'I like making up new things and ideas.',
};

const items = DOMAINS.map(d => ({ id: `kb_${d.key}`, text: ITEMS[d.key], subscale: d.key }));

const responseScale = { min: 1, max: 3 };

module.exports = {
  key: 'kid_baseline',
  version: 1,
  audience: 'child',
  subjectMode: 'self',            // the kid rates themselves (subject = taker)
  format: 'faces',
  title: 'My Skills Check-in',
  description: 'A few questions about you. There are no wrong answers — just pick what feels true!',
  source: 'Kid self-report inventory, handover_1.md §8b (1 item/domain, 3-point scale)',
  responseScale,
  options: [
    { value: 1, label: 'Not like me' },
    { value: 2, label: 'A little like me' },
    { value: 3, label: 'A lot like me' },
  ],
  items,
  subscales: DOMAINS.map(d => ({ key: d.key, label: d.name })),
  dimensions: DOMAINS.map(d => ({ key: d.key, from: [{ subscale: d.key }], combine: 'mean' })),

  interpret() {
    return {
      kidSummary: 'Thanks for sharing! Your answers help your family see what to work on together.',
      baseline: true,
    };
  },
};
