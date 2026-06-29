// The evidence-based activity menu — handover_1.md §6. Pure data so it can be
// integrity-tested (activitiesSeed.test.js) and seeded idempotently
// (scripts/seedCapabilityActivities.js) from one source.
//
// Each item names the PRIMARY domain(s) it builds, its tier (1 = highest evidence),
// and — the differentiator — the APPROACH RULE that makes the activity actually
// build the skill (handover: "implementation quality is where the effect lives or
// dies"). citationKey points at the citation registry (null where §6 gives no
// specific anchor). minAge/maxAge null = all ages.
//
// kind 'do' = Tier 1-3 recommendations; kind 'skip' = deprioritize list.

const ACTIVITIES = [
  // ---- Tier 1: highest evidence ------------------------------------------
  {
    slug: 'aerobic-coordination-play',
    title: 'Aerobic + coordination-rich physical activity, most days',
    domainKeys: ['physical', 'executive_function'],
    tier: 1, kind: 'do',
    approachRule: 'Prioritize sustained movement and skill/coordination (soccer, swimming, dance, martial arts, tag) over pure competition. Light supervised bodyweight/strength is safe and good for motor skill; for the brain specifically, the strongest evidence is aerobic.',
    why: 'FITKids RCT: a 9-month aerobic program improved executive control in 7–9-year-olds.',
    citationKey: 'hillman2014',
    minAge: null, maxAge: null,
  },
  {
    slug: 'retrieval-spaced-practice',
    title: 'Retrieval practice + spaced repetition for anything memorized',
    domainKeys: ['cognitive', 'metacognition'],
    tier: 1, kind: 'do',
    approachRule: 'Never let them reread to "study" — make them retrieve. Close-the-book quizzing and flashcards at expanding intervals (day 1 / 3 / 7).',
    why: "Dunlosky's two highest-utility techniques: practice testing and distributed practice.",
    citationKey: 'dunlosky2013',
    minAge: null, maxAge: null,
  },
  {
    slug: 'sleep-protection',
    title: 'Sleep protection',
    domainKeys: ['physical'],
    tier: 1, kind: 'do',
    approachRule: 'Fixed schedule; treat it as non-negotiable infrastructure, not a reward to trade away. One of the largest, most under-used levers on attention, mood, and learning.',
    why: 'Consistent, sufficient sleep underpins attention, mood, and learning.',
    citationKey: null,
    minAge: null, maxAge: null,
  },
  {
    slug: 'emotion-coaching',
    title: 'Emotion-coaching in the moment',
    domainKeys: ['emotional'],
    tier: 1, kind: 'do',
    approachRule: "Name the feeling, validate it, THEN problem-solve — especially during frustration. Don't fix the feeling away; coach through it.",
    why: 'The SEL effect runs through exactly these skills.',
    citationKey: 'durlak2011',
    minAge: null, maxAge: null,
  },
  {
    slug: 'embedded-metacognition',
    title: 'Embedded metacognition',
    domainKeys: ['metacognition'],
    tier: 1, kind: 'do',
    approachRule: 'After learning, ask "what worked, what would you change, how will you study it next time?" Model your own thinking out loud. Works best inside real subject content, not as a standalone "thinking skills" lesson.',
    why: 'EEF: metacognition is high-impact, low-cost when embedded in real tasks.',
    citationKey: 'eef_metacognition',
    minAge: null, maxAge: null,
  },

  // ---- Tier 2: strong, high-value ----------------------------------------
  {
    slug: 'real-responsibility',
    title: 'Real responsibility with real consequences',
    domainKeys: ['executive_function', 'agency', 'emotional'],
    tier: 2, kind: 'do',
    approachRule: 'Hand over something that genuinely matters — plan a trip day, manage a small budget, own a chore system — and let the consequences land. Builds planning, agency, follow-through.',
    why: 'Childhood self-control predicts long-run outcomes; it grows through real reps.',
    citationKey: 'moffitt2011',
    minAge: null, maxAge: null,
  },
  {
    slug: 'productive-struggle',
    title: 'Productive-struggle tasks',
    domainKeys: ['emotional', 'cognitive'],
    tier: 2, kind: 'do',
    approachRule: "Puzzles/builds slightly beyond current reach; DON'T rescue. Pair with growth-mindset language (\"not yet\"; praise the strategy, not the talent). Builds frustration tolerance + problem-solving.",
    why: 'Frustration tolerance and problem-solving grow when the child is allowed to struggle.',
    citationKey: null,
    minAge: null, maxAge: null,
  },
  {
    slug: 'wide-reading',
    title: 'Wide reading, including fiction',
    domainKeys: ['communication', 'social'],
    tier: 2, kind: 'do',
    approachRule: 'Protect volume — reading amount drives vocabulary and comprehension. Fiction supports perspective-taking (hold the theory-of-mind claim loosely; the strong version failed to replicate).',
    why: 'Reading volume is strongly associated with vocabulary and comprehension growth.',
    citationKey: 'cunningham_stanovich',
    minAge: null, maxAge: null,
  },
  {
    slug: 'describe-and-draw',
    title: 'Describe-and-draw / teach-it-back',
    domainKeys: ['communication'],
    tier: 2, kind: 'do',
    approachRule: 'One person describes, the other draws/builds only from the words — brutal, fast feedback on communication precision. Folds neatly into drawing time.',
    why: 'Forces precise expressive language with immediate feedback.',
    citationKey: null,
    minAge: null, maxAge: null,
  },
  {
    slug: 'fermi-define-the-problem',
    title: 'Fermi estimation & "define the real problem"',
    domainKeys: ['cognitive', 'metacognition'],
    tier: 2, kind: 'do',
    approachRule: 'Estimate the un-googleable ("how many piano tuners in the city?") and practice naming the actual problem before solving. Pure problem-solving reps — best once abstract reasoning is opening up.',
    why: 'Builds reasoning and problem-framing for the older child.',
    citationKey: null,
    minAge: 9, maxAge: null,
  },
  {
    slug: 'real-social-reps',
    title: 'Real social reps',
    domainKeys: ['social'],
    tier: 2, kind: 'do',
    approachRule: 'Order own food, ask the librarian, handle a small transaction. Social courage only grows through reps — let them do the talking even when it is slower.',
    why: 'Social courage grows only through real, slightly-uncomfortable practice.',
    citationKey: null,
    minAge: null, maxAge: null,
  },
  {
    slug: 'cook-recipe-end-to-end',
    title: 'Cooking a recipe end-to-end',
    domainKeys: ['executive_function', 'agency'],
    tier: 2, kind: 'do',
    approachRule: 'Sequencing, working memory, and troubleshooting in one task. Let the flop happen and be solved — the troubleshooting is the point, not the dish.',
    why: 'Real-world executive-function and agency practice with genuine stakes.',
    citationKey: null,
    minAge: null, maxAge: null,
  },

  // ---- Tier 3: fine, but for their own sake ------------------------------
  {
    slug: 'chess-music-strategy',
    title: 'Chess, music lessons, strategy games',
    domainKeys: ['cognitive', 'creative'],
    tier: 3, kind: 'do',
    approachRule: 'Genuinely good for focus, discipline, joy, and culture. Keep if loved — just don\'t add them expecting far transfer to IQ or grades.',
    why: 'Music/chess do not reliably transfer to general intelligence once active controls are used.',
    citationKey: 'sala_gobet2017',
    minAge: null, maxAge: null,
  },

  // ---- Skip / deprioritize -----------------------------------------------
  {
    slug: 'brain-training-apps',
    title: 'Commercial brain-training apps / working-memory games',
    domainKeys: ['cognitive'],
    tier: null, kind: 'skip',
    approachRule: '',
    skipReason: 'They improve the trained game, not general ability. Low priority — the time is better spent on aerobic play, retrieval practice, and real-world reps.',
    why: 'No reliable far transfer to general intelligence.',
    citationKey: 'sala_gobet2017',
    minAge: null, maxAge: null,
  },
];

module.exports = { ACTIVITIES };
