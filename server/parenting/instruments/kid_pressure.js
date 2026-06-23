// How things feel at home (Child) — the kid's side of the Strictness & Pressure
// axes, for ages 7–10. Same axis keys as the parent version so the gap report
// compares them. Plus a kid-only "felt pressure" read that answers the very
// question parents ask: is my child quietly pressured, or do they ask-then-forget?
//
// NO-BIAS / kid-appropriate design: questions are neutral and not leading; the
// set deliberately mixes items where "A lot" is GOOD (explains rules, lets me
// choose) with items where "A lot" is a CONCERN (acts disappointed, gets cold),
// so a child can't produce a uniformly rosy or grim picture by tapping the same
// face every time. Reverse-worded items are avoided — they confuse young kids.

const BC = 'behavioral_control';
const AS = 'autonomy_support';
const PC = 'psychological_control';
const CR = 'conditional_regard';
const FP = 'felt_pressure';

// id, text (child-facing), subscale
const RAW = [
  ['kp1',  'There are clear rules at my house.', BC],
  ['kp2',  'My parent knows what I am doing.', BC],

  ['kp3',  'My parent explains why we have a rule.', AS],
  ['kp4',  'I get to choose some things for myself.', AS],
  ['kp5',  'My parent listens to how I feel, even when the answer is still no.', AS],

  ['kp6',  'When I make a mistake, my parent acts disappointed in me.', PC],
  ['kp7',  'My parent reminds me how much they do for me to make me feel bad.', PC],
  ['kp8',  'My parent gets cold or quiet with me when I upset them.', PC],

  ['kp9',  'My parent seems happier with me when I do well.', CR],
  ['kp10', 'When I don’t do well, it feels like my parent likes me less.', CR],

  ['kp11', 'I feel like I never get a say in what I do for fun.', FP],
  ['kp12', 'When my parent says no to something fun, I stay upset for a long time.', FP],
  ['kp13', 'I wish I could do more things my own way.', FP],
];

const items = RAW.map(([id, text, subscale]) => ({ id, text, subscale }));
const responseScale = { min: 1, max: 3 };

module.exports = {
  key: 'kid_pressure',
  version: 1,
  audience: 'child',
  format: 'faces',
  title: 'How Things Feel at Home',
  description: 'A few questions about home and rules. There are no wrong answers!',
  source: 'Child-report items for behavioral/psychological control, autonomy support, and conditional regard (Barber 1996; SDT; Assor et al. 2004)',
  responseScale,
  options: [
    { value: 1, label: 'Never' },
    { value: 2, label: 'Sometimes' },
    { value: 3, label: 'A lot' },
  ],
  items,
  subscales: [
    { key: BC, label: 'Rules & structure' },
    { key: AS, label: 'Gets a say' },
    { key: PC, label: 'Guilt / coldness' },
    { key: CR, label: 'Love-with-conditions' },
    { key: FP, label: 'Feeling pressured', hidden: true },
  ],
  dimensions: [
    { key: BC, from: [{ subscale: BC }], combine: 'mean' },
    { key: AS, from: [{ subscale: AS }], combine: 'mean' },
    { key: PC, from: [{ subscale: PC }], combine: 'mean' },
    { key: CR, from: [{ subscale: CR }], combine: 'mean' },
    { key: FP, from: [{ subscale: FP }], combine: 'mean' }, // kid-only signal (no parent counterpart)
  ],

  interpret(_m, dims) {
    return {
      kidSummary: 'Thanks for sharing! Your answers help your family understand each other better.',
      bands: { feltPressure: dims[FP] },
    };
  },
};
