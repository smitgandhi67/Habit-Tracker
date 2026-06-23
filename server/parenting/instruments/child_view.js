// Child's-View instrument — adapted from the Alabama Parenting Questionnaire,
// child report (APQ-C).
//
// Source: Frick, P. J. (1991). The Alabama Parenting Questionnaire. Univ. of
//   Alabama. Child report: Shelton, Frick & Wootton (1996), J. Clinical Child
//   Psychology, 25, 317–329. Short forms: Elgar et al. (2007).
//
// Adapted for ages 7–10: simplified grade-2 wording, a 3-point frequency scale
// (Never / Sometimes / A lot), and ONE QUESTION PER SCREEN in the UI.
//
// ETHICS: the APQ Corporal Punishment subscale is intentionally OMITTED — it is
// not appropriate to ask a 7–10 year old, in a habit app, how often they are
// hit. We keep Involvement, Positive Parenting, and (for consistency) Inconsistent
// Discipline. The child rates a specific parent (the "subject" of the attempt).
//
// Dimensions use the SAME keys as the parent instruments (warmth, consistency)
// so the Phase-4 gap report can compare the child's experience to the parent's
// self-report directly.

const INVOLVEMENT = 'involvement';
const POSITIVE = 'positive_parenting';
const INCONSISTENT = 'inconsistent';

// id, text (child-facing), subscale
const RAW = [
  ['cv1',  'Your parent has a friendly talk with you.', INVOLVEMENT],
  ['cv2',  'Your parent plays with you or does something fun with you.', INVOLVEMENT],
  ['cv3',  'Your parent asks you about your day.', INVOLVEMENT],
  ['cv4',  'Your parent helps you with homework or school things.', INVOLVEMENT],
  ['cv5',  'Your parent listens when you tell them about a problem.', INVOLVEMENT],
  ['cv6',  'Your parent tells you that you did a good job.', POSITIVE],
  ['cv7',  'Your parent gives you a hug or a high-five when you do well.', POSITIVE],
  ['cv8',  'Your parent says nice things to you when you behave well.', POSITIVE],
  ['cv9',  'Your parent notices when you do something good.', POSITIVE],
  // Inconsistent-discipline items: "A lot" = more inconsistent. The consistency
  // dimension inverts this subscale, so no per-item reverse is needed.
  ['cv10', 'When you get a time-out or lose something, your parent lets you off early.', INCONSISTENT],
  ['cv11', 'Your parent says you will get a punishment but then does not do it.', INCONSISTENT],
  ['cv12', 'Whether you get in trouble depends on your parent’s mood.', INCONSISTENT],
  ['cv13', 'The rules at your house change a lot.', INCONSISTENT],
  ['cv14', 'Your parent forgets a rule they made before.', INCONSISTENT],
];

const items = RAW.map(([id, text, subscale]) => ({ id, text, subscale }));

const responseScale = { min: 1, max: 3 };

module.exports = {
  key: 'child_view',
  version: 1,
  audience: 'child',
  format: 'faces',
  title: 'How I See My Parent',
  description: 'A few questions about your parent. There are no wrong answers!',
  source: 'Adapted from the Alabama Parenting Questionnaire — child report (Frick, 1991; Shelton et al., 1996)',
  responseScale,
  options: [
    { value: 1, label: 'Never' },
    { value: 2, label: 'Sometimes' },
    { value: 3, label: 'A lot' },
  ],
  items,
  subscales: [
    { key: INVOLVEMENT, label: 'Time together' },
    { key: POSITIVE, label: 'Praise & warmth' },
    { key: INCONSISTENT, label: 'Mixed messages', hidden: true },
  ],
  dimensions: [
    { key: 'warmth', from: [{ subscale: INVOLVEMENT }, { subscale: POSITIVE }], combine: 'mean' },
    { key: 'consistency', from: [{ subscale: INCONSISTENT, invert: true }], combine: 'mean' },
  ],

  // Kid-facing interpretation stays gentle — the child sees a thank-you, not a
  // score. The dimension scores (warmth, consistency) feed the parent gap report.
  interpret(_m, dims) {
    return {
      kidSummary: 'Thanks for sharing! Your answers help your family understand each other better.',
      bands: { warmth: dims.warmth, consistency: dims.consistency },
    };
  },
};
