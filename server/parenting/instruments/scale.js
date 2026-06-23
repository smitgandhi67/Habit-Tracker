// Parenting Scale instrument — Arnold, O'Leary, Wolff & Acker (1993), 30 items.
//
// Source: Arnold, D. S., O'Leary, S. G., Wolff, L. S., & Acker, M. M. (1993).
//   The Parenting Scale: A measure of dysfunctional parenting in discipline
//   situations. Psychological Assessment, 5, 137–144.
//   Factor scoring + clinical cut-offs follow the revised structure of
//   Rhoades & O'Leary (2007): Laxness (LX), Over-reactivity (OR), Hostility (HS),
//   with the remaining items contributing to the Total only. This revised
//   structure replicates better than the original Laxness/Overreactivity/
//   Verbosity split and has published cut-offs.
//
// Format: each item is a stem with a 7-point scale between two anchors. Low = good
// parenting, high = dysfunctional. Items whose "ideal" anchor is on the RIGHT are
// reverse-scored (value -> 8 - value) so that high is dysfunctional throughout.
//   Right-anchor (reverse) items: 2,3,6,9,10,13,14,17,19,20,23,26,27,30.

const LX = 'laxness';
const OR = 'overreactivity';
const HS = 'hostility';
const NF = 'general'; // contributes to Total only (no published sub-factor)

// id, stem, anchorLow (score 1), anchorHigh (score 7), subscale, reverse
const RAW = [
  ['ps1',  'When my child misbehaves…', 'I do something right away.', 'I do something about it later.', NF, false],
  ['ps2',  'Before I do something about a problem…', 'I give my child several reminders or warnings.', 'I use only one reminder or warning.', NF, true],
  ['ps3',  'When I’m upset or under stress…', 'I am picky and on my child’s back.', 'I am no more picky than usual.', OR, true],
  ['ps4',  'When I tell my child not to do something…', 'I say very little.', 'I say a lot.', NF, false],
  ['ps5',  'When my child pesters me…', 'I can ignore the pestering.', 'I can’t ignore the pestering.', NF, false],
  ['ps6',  'When my child misbehaves…', 'I usually get into a long argument with my child.', 'I don’t get into an argument.', OR, true],
  ['ps7',  'I threaten to do things that…', 'I am sure I can carry out.', 'I know I won’t actually do.', NF, false],
  ['ps8',  'I am the kind of parent that…', 'sets limits on what my child is allowed to do.', 'lets my child do whatever he or she wants.', NF, false],
  ['ps9',  'When my child misbehaves…', 'I give my child a long lecture.', 'I keep my talks short and to the point.', NF, true],
  ['ps10', 'When my child misbehaves…', 'I raise my voice or yell.', 'I speak to my child calmly.', OR, true],
  ['ps11', 'If saying no doesn’t work right away…', 'I take some other kind of action.', 'I keep talking and trying to get through to my child.', NF, false],
  ['ps12', 'When I want my child to stop doing something…', 'I firmly tell my child to stop.', 'I coax or beg my child to stop.', LX, false],
  ['ps13', 'When my child is out of my sight…', 'I often don’t know what my child is doing.', 'I always have a good idea of what my child is doing.', NF, true],
  ['ps14', 'After there’s been a problem with my child…', 'I often hold a grudge.', 'things get back to normal quickly.', OR, true],
  ['ps15', 'When we’re not at home…', 'I handle my child the way I do at home.', 'I let my child get away with a lot more.', NF, false],
  ['ps16', 'When my child does something I don’t like…', 'I do something about it every time it happens.', 'I often let it go.', LX, false],
  ['ps17', 'When there’s a problem with my child…', 'things build up and I do things I don’t mean to do.', 'things don’t get out of hand.', OR, true],
  ['ps18', 'When my child misbehaves, I spank, slap, grab, or hit my child…', 'never or rarely.', 'most of the time.', HS, false],
  ['ps19', 'When my child doesn’t do what I ask…', 'I often let it go or end up doing it myself.', 'I take some other action.', LX, true],
  ['ps20', 'When I give a fair threat or warning…', 'I often don’t carry it out.', 'I always do what I said.', NF, true],
  ['ps21', 'If saying “No” doesn’t work…', 'I take some other kind of action.', 'I offer my child something nice so he/she will behave.', LX, false],
  ['ps22', 'When my child misbehaves…', 'I handle it without getting upset.', 'I get so frustrated or angry that my child can see I’m upset.', NF, false],
  ['ps23', 'When my child misbehaves…', 'I make my child tell me why he/she did it.', 'I say “No” or take some other action.', NF, true],
  ['ps24', 'If my child misbehaves and then acts sorry…', 'I handle the problem like I usually would.', 'I let it go that time.', NF, false],
  ['ps25', 'When my child misbehaves…', 'I rarely use bad language or curse.', 'I almost always use bad language.', HS, false],
  ['ps26', 'When I say my child can’t do something…', 'I let my child do it anyway.', 'I stick to what I said.', NF, true],
  ['ps27', 'When I have to handle a problem…', 'I tell my child I am sorry about it.', 'I don’t say I’m sorry.', NF, true],
  ['ps28', 'When my child does something I don’t like, I insult my child, say mean things, or call my child names…', 'never or rarely.', 'most of the time.', HS, false],
  ['ps29', 'If my child talks back or complains when I handle a problem…', 'I ignore the complaining and stick to what I said.', 'I give my child a talk about not complaining.', NF, false],
  ['ps30', 'If my child gets upset when I say “No”…', 'I back down and give in to my child.', 'I stick to what I said.', LX, true],
];

const items = RAW.map(([id, text, anchorLow, anchorHigh, subscale, reverse]) =>
  ({ id, text, anchorLow, anchorHigh, subscale, reverse }));

const responseScale = { min: 1, max: 7 };

// Published clinical cut-offs (Rhoades & O'Leary, 2007). Gendered; we don't
// collect parent gender, so we use the lower (mothers') threshold as the more
// sensitive "worth reflecting on" flag and note this in the UI.
const CUTOFFS = { laxness: 3.6, overreactivity: 4.0, hostility: 2.4, total: 3.2 };

module.exports = {
  key: 'scale',
  version: 1,
  audience: 'parent',
  format: 'anchored',
  title: 'Parenting Scale (Discipline)',
  description: 'How you respond in everyday discipline situations — laxness, over-reactivity, and hostility.',
  source: 'The Parenting Scale — Arnold, O’Leary, Wolff & Acker (1993); revised scoring Rhoades & O’Leary (2007)',
  responseScale,
  options: [1, 2, 3, 4, 5, 6, 7].map(v => ({ value: v })),
  items,
  subscales: [
    { key: LX, label: 'Laxness' },
    { key: OR, label: 'Over-reactivity' },
    { key: HS, label: 'Hostility' },
    { key: NF, label: 'Other discipline items', hidden: true },
  ],
  // consistency (inverse laxness) is shared with style + child_view for the gap report.
  dimensions: [
    { key: 'consistency', from: [{ subscale: LX, invert: true }], combine: 'mean' },
  ],

  interpret(m, _dims, subscales) {
    const r2 = n => Math.round(n * 100) / 100;
    const totalN = subscales.reduce((a, s) => a + s.n, 0) || 30;
    const totalRaw = subscales.reduce((a, s) => a + s.raw, 0);
    const total = r2(totalRaw / totalN);

    const factors = { laxness: r2(m.laxness), overreactivity: r2(m.overreactivity), hostility: r2(m.hostility) };
    const flags = {
      laxness: factors.laxness >= CUTOFFS.laxness,
      overreactivity: factors.overreactivity >= CUTOFFS.overreactivity,
      hostility: factors.hostility >= CUTOFFS.hostility,
      total: total >= CUTOFFS.total,
    };
    const elevated = Object.entries(flags).filter(([k, v]) => v && k !== 'total').map(([k]) => k);

    return {
      // no styleKey — this instrument is a profile, not a typology
      bands: {
        factors,
        total,
        cutoffs: CUTOFFS,
        flags,
        summary: elevated.length
          ? `Worth reflecting on: ${elevated.join(', ')}.`
          : 'All discipline areas are within the typical range.',
      },
    };
  },
};
