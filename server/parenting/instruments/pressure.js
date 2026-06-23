// Strictness & Pressure (Parent) — splits "being strict" into the parts that
// matter, instead of one lump.
//
// Grounded in: Barber (1996) behavioral vs psychological control; Grolnick/Ryan/
// Deci Self-Determination Theory (autonomy support vs pressure); Assor, Roth &
// Deci (2004) parental conditional regard. Items are original, plain-language
// paraphrases of those constructs (not a copyrighted scale verbatim) for private
// family use.
//
// Four axes, each its own dimension (shared keys with the kid version so the gap
// report compares them):
//   behavioral_control  — rules/structure/monitoring. HIGH IS FINE (not a concern).
//   autonomy_support    — reasons + choice + acknowledging feelings. High is good.
//   psychological_control — guilt / shame / love-withdrawal / disappointment. Low is good.
//   conditional_regard  — warmth that depends on success/behavior. Low is good.
//
// NO-BIAS design: items are mixed-keyed (some reverse-scored) so you can't get a
// flattering result by answering everything the same way; scoring is honest and
// the result names a concern when one exists.

const BC = 'behavioral_control';
const AS = 'autonomy_support';
const PC = 'psychological_control';
const CR = 'conditional_regard';

// id, text, subscale, reverse
const RAW = [
  ['pr1',  'I set clear limits on screens, bedtime, and activities.', BC, false],
  ['pr2',  'I keep our family routines consistent.', BC, false],
  ['pr3',  'I know what my kids are doing with their time.', BC, false],

  ['pr4',  'When I set a limit, I explain the reason behind it.', AS, false],
  ['pr5',  'I offer my kids choices within the limits I set.', AS, false],
  ['pr6',  'I acknowledge how my kids feel, even when my answer is still no.', AS, false],
  ['pr7',  'When my kids disagree with me, I shut the conversation down.', AS, true],

  ['pr8',  'I let my kids know I am disappointed in them when they fall short.', PC, false],
  ['pr9',  'I remind my kids how much I sacrifice for them when they don’t listen.', PC, false],
  ['pr10', 'I become less warm toward my kids when they upset me.', PC, false],
  ['pr11', 'I stay emotionally warm even while correcting my kids.', PC, true],

  ['pr12', 'I show more approval when my kids achieve or perform well.', CR, false],
  ['pr13', 'How affectionate I feel toward my kids depends on how well they are doing.', CR, false],
  ['pr14', 'My kids know my love does not change whether they succeed or fail.', CR, true],
];

const items = RAW.map(([id, text, subscale, reverse]) => ({ id, text, subscale, reverse }));
const responseScale = { min: 1, max: 5 };
const MID = 0.5;

module.exports = {
  key: 'pressure',
  version: 1,
  audience: 'parent',
  format: 'likert',
  title: 'Strictness & Pressure',
  description: 'Separates healthy structure from the kind of pressure that can quietly harm — and how you deliver your limits.',
  source: 'Behavioral vs psychological control (Barber, 1996); autonomy support (Self-Determination Theory, Grolnick/Ryan/Deci); conditional regard (Assor, Roth & Deci, 2004)',
  responseScale,
  options: [
    { value: 1, label: 'Never' },
    { value: 2, label: 'Rarely' },
    { value: 3, label: 'Sometimes' },
    { value: 4, label: 'Often' },
    { value: 5, label: 'Always' },
  ],
  items,
  subscales: [
    { key: BC, label: 'Structure & limits' },
    { key: AS, label: 'Autonomy support' },
    { key: PC, label: 'Guilt / shame pressure' },
    { key: CR, label: 'Love-with-conditions' },
  ],
  dimensions: [
    { key: BC, from: [{ subscale: BC }], combine: 'mean' },
    { key: AS, from: [{ subscale: AS }], combine: 'mean' },
    { key: PC, from: [{ subscale: PC }], combine: 'mean' },
    { key: CR, from: [{ subscale: CR }], combine: 'mean' },
  ],

  interpret(_m, dims) {
    // Concern = harmful axes above the midpoint, OR autonomy support below it.
    const concerns = [];
    if (dims[PC] >= MID) concerns.push('guilt/shame pressure');
    if (dims[CR] >= MID) concerns.push('love-with-conditions');
    if (dims[AS] < MID) concerns.push('low autonomy support');
    const summary = concerns.length
      ? `Worth a closer look: ${concerns.join(', ')}. Your structure itself isn’t the problem.`
      : 'Healthy pattern: clear structure delivered with warmth, reasons, and unconditional love. High standards are fine here.';
    return { bands: { summary, concerns, midpoint: MID } };
  },
};
