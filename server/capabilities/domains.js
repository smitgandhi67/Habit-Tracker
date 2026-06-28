// Capability domain registry — the 10 domains from handover_1.md §3, the backbone
// the whole Capabilities ("Skills") module tags against (baseline subscales, activity
// tags, domain rollup).
//
// MIRROR: src/lib/capabilities/domains.js holds the identical data (ESM) for the
// client. Keep the two in sync when editing.
//
// Every domain's healthy direction is "higher" — unlike the parenting axes, there
// are no concern-direction domains here. The three FOUNDATIONS (executive function,
// metacognition, emotional) gate the rest (§3) and are targeted first by the baseline.

const DOMAINS = [
  {
    key: 'cognitive', num: 1, name: 'Cognitive', short: 'Thinking',
    foundational: false,
    description: 'Memory, attention, reasoning, problem-solving, creativity, numeracy, pattern recognition.',
  },
  {
    key: 'executive_function', num: 2, name: 'Executive function', short: 'Self-control & planning',
    foundational: true,
    description: 'Working memory, inhibitory control, cognitive flexibility, planning, organization, follow-through.',
  },
  {
    key: 'metacognition', num: 3, name: 'Metacognition & learning-to-learn', short: 'Learning to learn',
    foundational: true,
    description: 'Knowing what you know, self-directed learning, study skills, research/info literacy, question-asking.',
  },
  {
    key: 'emotional', num: 4, name: 'Emotional / intrapersonal', short: 'Emotional regulation',
    foundational: true,
    description: 'Emotional awareness and regulation, frustration tolerance, resilience, growth mindset, self-motivation.',
  },
  {
    key: 'social', num: 5, name: 'Social / interpersonal', short: 'Social',
    foundational: false,
    description: 'Empathy and perspective-taking, conflict resolution, collaboration, reading social cues, assertiveness.',
  },
  {
    key: 'communication', num: 6, name: 'Communication & language', short: 'Communication',
    foundational: false,
    description: 'Expressive precision, listening, vocabulary, writing, persuasion, reading comprehension.',
  },
  {
    key: 'character', num: 7, name: 'Character / moral', short: 'Character',
    foundational: false,
    description: 'Honesty, responsibility, fairness, kindness, courage, gratitude, humility, work ethic.',
  },
  {
    key: 'physical', num: 8, name: 'Physical / health', short: 'Physical',
    foundational: false,
    description: 'Motor coordination, fitness, strength, balance, body awareness, sleep/nutrition/hygiene habits.',
  },
  {
    key: 'agency', num: 9, name: 'Practical life skills & agency', short: 'Agency',
    foundational: false,
    description: 'Financial literacy, real-world navigation, self-care, risk assessment, independent decisions, digital safety.',
  },
  {
    key: 'creative', num: 10, name: 'Creative / expressive', short: 'Creative',
    foundational: false,
    description: 'Visual art, music, storytelling, imagination, design thinking, aesthetic appreciation.',
  },
];

const DOMAIN_KEYS = DOMAINS.map(d => d.key);
const FOUNDATIONAL_KEYS = DOMAINS.filter(d => d.foundational).map(d => d.key);
const byKey = new Map(DOMAINS.map(d => [d.key, d]));

function getDomain(key) {
  return byKey.get(key) || null;
}

function isDomainKey(key) {
  return byKey.has(key);
}

module.exports = { DOMAINS, DOMAIN_KEYS, FOUNDATIONAL_KEYS, getDomain, isDomainKey };
