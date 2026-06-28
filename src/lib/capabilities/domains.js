// Capability domain registry (client mirror).
// MIRROR of server/capabilities/domains.js — keep the data identical when editing.
// Used for labels/order; the server is the source of truth over the API.

export const DOMAINS = [
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

export const DOMAIN_KEYS = DOMAINS.map(d => d.key);
export const FOUNDATIONAL_KEYS = DOMAINS.filter(d => d.foundational).map(d => d.key);

const byKey = new Map(DOMAINS.map(d => [d.key, d]));
export function getDomain(key) {
  return byKey.get(key) || null;
}
