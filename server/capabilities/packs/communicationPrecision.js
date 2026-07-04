// Depth Pack 02 template — machine form of docs/plans/capable-kids/depth/02-communication-precision.md.

const day = (dayNum, title, steps, timerMin = 10, scoreMetric = null) =>
  ({ day: dayNum, title, steps, timerMin, scoreMetric });

// Weeks 3–6: Mon/Wed/Fri recorded retells, Tue/Thu describe-and-draw.
const retellWeek = (week, theme, extra) => ({
  week, theme,
  days: [
    day(1, 'Recorded 1-minute retell', ['Pick anything: recess drama, a chapter, a video', 'Use the 5-finger frame: who/where → problem → tried → ended → zinger', 'Record on the phone, watch it back, self-score /10 (2 pts per element)', 'Re-record ONCE max']),
    day(2, 'Describe-and-draw', ['You describe, someone draws only what your words say', 'No hands, no peeking until done', 'Score = shapes right / total']),
    day(3, 'Recorded 1-minute retell', ['New topic, same frame', 'Watch back: did every finger get its sentence?']),
    day(4, 'Describe-and-draw', ['Add a shape if yesterday’s retell scored ≥8', 'Swap roles once — listen to what a good description sounds like']),
    day(5, extra || 'Retell + score the week', ['One more retell, best effort', 'Enter your best self-score below'], 10, 'retell_score'),
  ],
});

// Weeks 7–12: Mon/Wed teach-backs, Friday review + filler game.
const teachWeek = (week, theme, extra = []) => ({
  week, theme,
  days: [
    day(1, '3-minute teach-back (recorded)', ['Teach dad something you learned this week', 'Hook → structure (first/then/because) → one concrete example → landing', 'Record it; no watching yet', ...extra]),
    day(2, 'Describe-and-draw or retell', ['Your pick — keep the precision muscle warm']),
    day(3, '3-minute teach-back (recorded)', ['New topic or improved take on Monday’s', 'One real question from your audience at the end', ...extra]),
    day(4, 'Practice run', ['Rehearse Friday’s scoring pick', 'Work on ONE mechanic only (pace, pauses, or ending)']),
    day(5, 'Watch + score + filler game', ['Watch Monday’s recording together', 'Score the rubric /20, enter it below', 'Dinner filler-counter game: chart your fillers per minute'], 15, 'teachback_score'),
  ],
});

const PACK = {
  key: 'communication_precision',
  title: 'Communication Precision',
  domainKeys: ['communication'],
  habitDefaults: { name: 'Communication practice (10 min)', emoji: '🎤', frequency: 'daily' },
  metrics: [
    { key: 'dd_accuracy_pct', label: 'Describe-and-draw accuracy %', min: 0, max: 100 },
    { key: 'retell_score',    label: 'Retell rubric /10',            min: 0, max: 10 },
    { key: 'teachback_score', label: 'Teach-back rubric /20',        min: 0, max: 20 },
    { key: 'fillers_per_min', label: 'Fillers per minute',           min: 0, max: 60 },
    { key: 'audience_events', label: 'Audience events',              min: 0, max: 20 },
  ],
  ladder: [
    { level: 0, milestone: 'Baselines recorded and locked away: one describe-and-draw score, one 1-min retell video' },
    { level: 1, milestone: 'Describe-and-draw ≥80% on 5-shape figures; says the 5 story elements from memory' },
    { level: 2, milestone: '1-min retell hits all 5 elements, self-scored from the recording ≥8/10' },
    { level: 3, milestone: '3-min teach-back ≥16/20; under 5 fillers/min' },
    { level: 4, milestone: 'Family demo night delivered; volunteers for a class presentation' },
    { level: 5, milestone: 'Attends a Gavel Club / YLP session and delivers a prepared 2-min speech to non-family' },
  ],
  weeks: [
    { week: 1, theme: 'Baselines + describe-and-draw', days: [
      day(1, 'Baseline day', ['Describe a hidden 4-shape figure; parent draws only your words; write the % down', 'Phone out: retell any movie you like for 1 minute', 'SAVE the video. Nobody critiques it. It’s the week-12 before/after'], 10, 'dd_accuracy_pct'),
      day(2, 'Describe-and-draw', ['You describe a 3-shape figure, parent draws', 'No hands, no peeking until done', 'Score it together']),
      day(3, 'Swap day', ['Parent describes, YOU draw', 'Then one more with you describing — 4 shapes if yesterday was ≥80%']),
      day(4, 'New drawer', ['Sibling or other parent draws', 'Add a shape if you scored ≥80% yesterday']),
      day(5, 'Family round', ['Everyone describes one figure, everyone gets scored', 'You keep the scoreboard'], 10, 'dd_accuracy_pct'),
    ]},
    { week: 2, theme: '5-shape figures + the story frame', days: [
      day(1, 'Describe-and-draw: 5 shapes', ['5-shape figure, target ≥80%', 'Precision words: pointing down, touching, half the size']),
      day(2, 'Learn the 5-finger frame', ['Thumb who/where · index problem · middle tried · ring ended · pinky zinger', 'Say the five from memory, then map a movie you know onto them']),
      day(3, 'Describe-and-draw: 5 shapes', ['New figure, new drawer if possible'], 10, 'dd_accuracy_pct'),
      day(4, 'Frame practice (not recorded)', ['Retell today’s lunch story on the frame, out loud, no phone', 'Which finger was weakest? Do that one again']),
      day(5, 'First recorded retell', ['1 minute, on the frame, recorded', 'Watch it back once. Score /10. That’s your starting number'], 10, 'retell_score'),
    ]},
    retellWeek(3, 'Retell reps'),
    retellWeek(4, 'Retell reps: tighter'),
    retellWeek(5, 'Retell reps: new material'),
    retellWeek(6, 'Demo night week', 'Demo night prep: pick your best retell topic'),
    teachWeek(7, 'Teach-it-back begins'),
    teachWeek(8, 'Teach-back: structure'),
    teachWeek(9, 'Teach-back: mechanics', ['This week’s single mechanic: pauses instead of fillers']),
    teachWeek(10, 'Teach-back: audience', ['Volunteer for anything at school that means standing up front']),
    teachWeek(11, 'Speech prep', ['Draft and rehearse your 2-minute prepared speech']),
    teachWeek(12, 'Gavel Club week', ['Visit a Gavel Club / YLP session, deliver the speech', 'Watch the week-1 baseline video next to this week’s — that pair goes on the brag sheet']),
  ],
};

module.exports = { PACK };
