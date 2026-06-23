// Presentation metadata for parenting results. Pure content/labels — no scoring
// logic (that lives in the server engine). Keeps the result UI declarative.

// The four Baumrind parenting styles. Tone: direct and evidence-based, but
// framed so a parent can act on it. `research` summarizes the outcome literature.
export const STYLES = {
  authoritative: {
    label: 'Authoritative',
    color: 'emerald',
    summary: 'High warmth paired with firm, reasoned structure.',
    research:
      'Consistently linked in the research to the best child outcomes — higher self-regulation, social competence, and academic achievement (Baumrind, 1991; Steinberg et al., 1994).',
    grow: 'Keep pairing clear expectations with warmth and explanation. Watch for over-scheduling reasoning when a simple, calm boundary is enough.',
  },
  authoritarian: {
    label: 'Authoritarian',
    color: 'amber',
    summary: 'High control and demands with lower warmth and little negotiation.',
    research:
      'Associated with more obedience short-term but higher anxiety, lower self-esteem, and weaker self-direction over time (Baumrind, 1991).',
    grow: 'Rules are a strength — add warmth and the "why." Replace "because I said so" with brief reasons, and protect daily warm, unstructured time.',
  },
  permissive: {
    label: 'Permissive',
    color: 'sky',
    summary: 'Warm and responsive, but with limited structure and follow-through.',
    research:
      'Linked to weaker self-control and difficulty with limits, despite strong parent–child warmth (Maccoby & Martin, 1983).',
    grow: 'Warmth is your strength — add consistency. Set a few clear limits and follow through every time, even when it causes a fuss.',
  },
  uninvolved: {
    label: 'Uninvolved',
    color: 'slate',
    summary: 'Lower engagement on both warmth and structure.',
    research:
      'Associated with the poorest outcomes across domains; often reflects parental stress, overload, or low support rather than indifference (Maccoby & Martin, 1983).',
    grow: 'Small, steady increases in both connection and structure help most. Start with one daily warm routine and one consistent expectation.',
  },
};

// Facet labels for the subscale bars (fallback when the API omits a label).
export const FACET_LABELS = {
  connection: 'Warmth & Connection',
  regulation: 'Reasoning & Structure',
  autonomy: 'Autonomy Granting',
  physical_coercion: 'Physical Coercion',
  verbal_hostility: 'Verbal Hostility',
  non_reasoning: 'Punitive / Non-reasoning',
  indulgent: 'Indulgent / Permissive',
};

// Facets where a HIGHER score is a concern (harsh/permissive), so the bar can
// be tinted differently from the positive parenting facets.
export const CONCERN_FACETS = new Set([
  'physical_coercion', 'verbal_hostility', 'non_reasoning', 'indulgent',
]);

// Parenting Scale (discipline) factors. `high` describes what an elevated score
// means; `grow` is a concrete, research-aligned suggestion.
export const SCALE_FACTORS = {
  laxness: {
    label: 'Laxness',
    high: 'Giving in, not following through, or letting misbehavior go — inconsistent limits.',
    grow: 'Pick a few non-negotiable limits and follow through every time, even when it causes a fuss. Consistency teaches more than the rule itself.',
  },
  overreactivity: {
    label: 'Over-reactivity',
    high: 'Responding to misbehavior with anger, irritability, or harshness that escalates.',
    grow: 'Build in a pause before responding. A calm, brief consequence works better than an angry one and models regulation.',
  },
  hostility: {
    label: 'Hostility',
    high: 'Using physical force, insults, or harsh language during discipline.',
    grow: 'Replace harsh responses with a brief, firm consequence. If anger spikes, step away and return when calm. Consider support if this is frequent.',
  },
};

// Shared dimension labels (used in the gap report).
export const DIMENSION_LABELS = {
  warmth: 'Warmth',
  consistency: 'Consistency',
  responsiveness: 'Responsiveness',
  demandingness: 'Demandingness',
  behavioral_control: 'Structure & limits',
  autonomy_support: 'Autonomy support',
  psychological_control: 'Guilt / shame pressure',
  conditional_regard: 'Love-with-conditions',
  felt_pressure: 'Feeling pressured',
};

// Plain-language meaning of each axis, and which direction is healthy. Used to
// label and color the Strictness & Pressure result. `adaptive`: which pole is
// good ('high', 'low', or 'context' = high is fine, not a concern).
export const AXIS_INFO = {
  behavioral_control: {
    label: 'Structure & limits', adaptive: 'context',
    meaning: 'Clear rules, routines, and knowing what your kids are up to. Healthy — even a lot of it is fine.',
  },
  autonomy_support: {
    label: 'Autonomy support', adaptive: 'high',
    meaning: 'Giving reasons, offering choices within limits, and acknowledging how your kid feels. The healthy way to hold a high bar.',
    lowTip: 'Add the “why” and a small choice when you set a limit, and name their feeling (“I know you wanted games”) even when the answer stays no.',
  },
  psychological_control: {
    label: 'Guilt / shame pressure', adaptive: 'low',
    meaning: 'Guilt, shame, disappointment, or going cold when a kid falls short. This — not high standards — is the part that can quietly harm.',
    highTip: 'Swap “I’m disappointed in you” for “that wasn’t okay, and I still love you.” Correct the behavior, never withdraw warmth.',
  },
  conditional_regard: {
    label: 'Love-with-conditions', adaptive: 'low',
    meaning: 'Affection that rises and falls with how well your kid does. Kids often feel this even when parents don’t mean it.',
    highTip: 'Make love visibly unconditional — warm the same whether they win or lose. Praise effort, not outcomes.',
  },
  felt_pressure: {
    label: 'Feeling pressured', adaptive: 'low',
    meaning: 'How much your child feels one-way pressure / no say — vs. asking, then letting it go.',
    highTip: 'Give a real say in low-stakes choices (which book, when) so limits feel shared, not imposed.',
  },
};

// Alignment between a parent's self-view and the child's experience.
export const ALIGNMENT = {
  aligned: { label: 'Aligned', color: 'emerald', note: 'You and your child see this similarly.' },
  'some-gap': { label: 'Some gap', color: 'amber', note: 'A noticeable difference worth a conversation.' },
  'large-gap': { label: 'Large gap', color: 'rose', note: 'You and your child see this quite differently.' },
};

export const PARENTING_DISCLAIMER =
  'This is a self-reflection tool based on published research questionnaires. ' +
  'It is not a clinical diagnosis and is not a substitute for advice from a ' +
  'qualified professional.';

export function styleInfo(styleKey) {
  return STYLES[styleKey] || {
    label: 'Your Style', color: 'violet', summary: '', research: '', grow: '',
  };
}
