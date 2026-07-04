// Depth Pack 01 template — machine form of docs/plans/capable-kids/depth/01-learning-to-learn.md.
// Pure data + tiny builders so it can be integrity-tested (packs.test.js). The doc
// stays the human-readable source; edit both together.

const day = (dayNum, title, steps, timerMin = 15, scoreMetric = null) =>
  ({ day: dayNum, title, steps, timerMin, scoreMetric });

// Weeks 3–6 share the community beginner schedule (1 ML attempt/day + palace upkeep).
const mlWeek = (week, theme, extras = []) => ({
  week, theme,
  days: [
    day(1, 'Memory League: 1 Images attempt (palace #1)',
      ['Walk palace #1 once before starting', 'One Images attempt on Memory League', 'Note the level on screen', ...extras]),
    day(2, 'Palace upkeep + review',
      ['Walk both palaces forward and backward', 'Fix any locus that "went dark" — make its image louder', ...extras]),
    day(3, 'Memory League: 1 Images attempt (palace #2)',
      ['One Images attempt using palace #2', 'Two images per locus, make them interact with the location', ...extras]),
    day(4, 'Memory League: 1 Images attempt (palace #1)',
      ['One Images attempt using palace #1', 'Focus on speed of walking, not the images', ...extras]),
    day(5, 'Review + log your level',
      ['Review both palaces (26 loci)', 'One final attempt if you want', 'Enter your Memory League level below'],
      15, 'ml_level'),
  ],
});

// Weeks 7–12: 2 days ML ladder, 2 days school content, Friday calibration.
const schoolWeek = (week, theme, schoolFocus) => ({
  week, theme,
  days: [
    day(1, 'Memory League ladder day', ['Walk a palace, then 1–2 Images attempts', 'Chasing the next level is the fun part']),
    day(2, `School: ${schoolFocus}`, ['Pick material from an actual upcoming test or unit', 'Palace for lists/facts, deck cards for vocabulary/dates', 'PREDICT how many you will get right tomorrow — write it down']),
    day(3, 'Memory League ladder day', ['1–2 Images attempts', 'Try recalling the images backwards after submitting']),
    day(4, `School: ${schoolFocus}`, ['Closed-book self-quiz on Tuesday’s material', 'Compare against your prediction — that gap is your calibration', 'Review deck cards due today (1/3/7 spacing)'], 15, 'retention_pct'),
    day(5, 'Calibration + wrapper check', ['Chart: predicted vs actual for this week', 'Enter your average prediction error below', 'Homework wrapper: how many days this week did you do plan + review questions?'], 10, 'calibration_err'),
  ],
});

const PACK = {
  key: 'learning_to_learn',
  title: 'Learning-to-learn & Memory',
  domainKeys: ['metacognition', 'cognitive'],
  habitDefaults: { name: 'Memory training (15 min)', emoji: '🧠', frequency: 'daily' },
  metrics: [
    { key: 'ml_level',        label: 'Memory League level',    min: 0, max: 10 },
    { key: 'retention_pct',   label: 'Deck retention %',       min: 0, max: 100 },
    { key: 'calibration_err', label: 'Calibration error',      min: 0, max: 100 },
    { key: 'wrapper_days',    label: 'Homework wrapper days',  min: 0, max: 5 },
  ],
  ladder: [
    { level: 0, milestone: 'Walks his 13-locus home palace forwards AND backwards, eyes closed, no hesitation' },
    { level: 1, milestone: '10-item list via linking — 100% recall next morning, order intact' },
    { level: 2, milestone: 'Memory League Images level 3; first school list stored in a palace' },
    { level: 3, milestone: '20-card school deck at ≥85% retention across 2 weeks; ML Images level 5' },
    { level: 4, milestone: 'Calibration error <10% on 4 straight predictions; palace used for a real test' },
    { level: 5, milestone: 'ML Images level 7 or a played Kid-division match; teaches the technique to someone else' },
  ],
  weeks: [
    { week: 1, theme: 'Palace + linking', days: [
      day(1, 'Build your palace', ['Walk the house with paper', 'Pick 13 spots in a fixed route (front door → … → your bed)', 'Number them and draw the map']),
      day(2, 'Own the route', ['Eyes closed: walk the route 3× forward, 3× backward', 'Redraw the map from memory, check against yesterday’s']),
      day(3, 'Linking drill #1', ['Get the 10-item list from a parent', 'Link item 1→2→3… with ridiculous MOVING images', 'The banana CRUSHES the couch — it never just sits there']),
      day(4, 'Recall + linking drill #2', ['At breakfast: recall yesterday’s list out loud, in order', 'Evening: new 10-item list, link it']),
      day(5, 'Backwards day', ['At breakfast: recall list #2', 'Evening: recall it BACKWARDS', 'Walk the palace once, forward + backward']),
    ]},
    { week: 2, theme: 'Palace #2 + first palace list', days: [
      day(1, 'Build palace #2', ['Pick a second location (grandma’s house, school route)', '13 more loci, fixed route, draw the map']),
      day(2, 'Walk both palaces', ['Both palaces forward and backward', 'Any locus you hesitate on: stop and study the real spot']),
      day(3, 'First list IN the palace', ['Take a 10-item list', 'Place items at loci 1–10 of palace #1, two per locus is fine', 'Walk it once, then recall away from the map']),
      day(4, 'Memory League setup', ['Create free Memory League account', 'Play 1 practice Images game — just to see how it works']),
      day(5, 'Review + first attempt', ['Walk both palaces', 'One real Images attempt', 'Enter the level it gave you below'], 15, 'ml_level'),
    ]},
    mlWeek(3, 'Memory League: first levels'),
    mlWeek(4, 'Ladder + first school deck', ['Deck: add/review school cards due today (day 1/3/7 spacing)']),
    mlWeek(5, 'Ladder + spacing', ['Deck: review cards due today — guess first, then check']),
    mlWeek(6, 'Demo night week', ['Prepare: family shouts 15 items, you recall them backwards']),
    schoolWeek(7, 'Aim it at school', 'store a real list in a palace'),
    schoolWeek(8, 'Test-prep palace', 'palace the next test’s facts'),
    schoolWeek(9, 'Calibration focus', 'deck + predict every review'),
    schoolWeek(10, 'Own the system', 'you pick the tool: palace, deck, or problems'),
    schoolWeek(11, 'Match prep', 'light school load, extra ML attempts'),
    schoolWeek(12, 'Memory League match + review', 'match week — play a real match'),
  ],
};

module.exports = { PACK };
