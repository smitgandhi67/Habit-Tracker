// Parenting Style instrument — PSDQ short form (32 items).
//
// Source: Robinson, C. C., Mandleco, B., Olsen, S. F., & Hart, C. H. (1995).
//   Authoritative, authoritarian, and permissive parenting practices:
//   Development of a new measure. Psychological Reports, 77, 819–830.
//   Short version: Robinson, Mandleco, Olsen & Hart (2001), in Perlmutter,
//   Touliatos & Holden (Eds.), Handbook of Family Measurement Techniques.
//
// Three parenting styles built from seven facets, rated 1 (Never) … 5 (Always).
// No items are reverse-scored (each facet is positively keyed to its construct).
//
// Scoring (interpret):
//   authoritative = mean(connection, regulation, autonomy)
//   authoritarian = mean(physical_coercion, verbal_hostility, non_reasoning)
//   permissive    = indulgent
// Baumrind dimensions (normalized 0..1) place the parent in the 2x2 grid:
//   responsiveness (warmth/autonomy) x demandingness (structure/control).
//   high/high = Authoritative, low-R/high-D = Authoritarian,
//   high-R/low-D = Permissive, low/low = Uninvolved.
// `warmth` and `consistency` dimension keys are shared with the child's-view
// instrument so the Phase-4 gap report can compare them directly.

const FACETS = {
  connection: 'connection',
  regulation: 'regulation',
  autonomy: 'autonomy',
  physical_coercion: 'physical_coercion',
  verbal_hostility: 'verbal_hostility',
  non_reasoning: 'non_reasoning',
  indulgent: 'indulgent',
};

// Items interleaved (not grouped by facet) for face validity. Order does not
// affect scoring — each item carries its facet tag.
const items = [
  { id: 's1',  subscale: FACETS.connection,        text: 'I am responsive to my child’s feelings and needs.' },
  { id: 's2',  subscale: FACETS.physical_coercion, text: 'I spank my child when he/she is disobedient.' },
  { id: 's3',  subscale: FACETS.autonomy,          text: 'I take my child’s desires into account before asking him/her to do something.' },
  { id: 's4',  subscale: FACETS.non_reasoning,     text: 'When my child asks why he/she has to do something, I say: “Because I said so,” or “Because I am your parent.”' },
  { id: 's5',  subscale: FACETS.regulation,        text: 'I explain to my child how I feel about his/her good and bad behavior.' },
  { id: 's6',  subscale: FACETS.indulgent,         text: 'I find it difficult to discipline my child.' },
  { id: 's7',  subscale: FACETS.connection,        text: 'I encourage my child to talk about his/her troubles.' },
  { id: 's8',  subscale: FACETS.verbal_hostility,  text: 'I yell or shout when my child misbehaves.' },
  { id: 's9',  subscale: FACETS.autonomy,          text: 'I encourage my child to freely express himself/herself, even when disagreeing with me.' },
  { id: 's10', subscale: FACETS.physical_coercion, text: 'I grab my child when he/she is being disobedient.' },
  { id: 's11', subscale: FACETS.regulation,        text: 'I emphasize the reasons behind rules.' },
  { id: 's12', subscale: FACETS.indulgent,         text: 'I give in to my child when he/she causes a commotion.' },
  { id: 's13', subscale: FACETS.connection,        text: 'I give comfort and understanding when my child is upset.' },
  { id: 's14', subscale: FACETS.non_reasoning,     text: 'I punish by taking privileges away from my child with little if any explanation.' },
  { id: 's15', subscale: FACETS.autonomy,          text: 'I allow my child to give input into family rules.' },
  { id: 's16', subscale: FACETS.verbal_hostility,  text: 'I explode in anger toward my child.' },
  { id: 's17', subscale: FACETS.regulation,        text: 'I explain the consequences of my child’s behavior.' },
  { id: 's18', subscale: FACETS.indulgent,         text: 'I threaten my child with punishment more often than actually giving it.' },
  { id: 's19', subscale: FACETS.connection,        text: 'I have warm and intimate times together with my child.' },
  { id: 's20', subscale: FACETS.physical_coercion, text: 'I use physical punishment as a way of disciplining my child.' },
  { id: 's21', subscale: FACETS.autonomy,          text: 'I take into account my child’s preferences when making family plans.' },
  { id: 's22', subscale: FACETS.non_reasoning,     text: 'I punish by putting my child off somewhere alone with little if any explanation.' },
  { id: 's23', subscale: FACETS.regulation,        text: 'I help my child understand the impact of his/her behavior by encouraging him/her to talk about the consequences of his/her actions.' },
  { id: 's24', subscale: FACETS.verbal_hostility,  text: 'I argue with my child.' },
  { id: 's25', subscale: FACETS.indulgent,         text: 'I state a punishment to my child but do not actually carry it out.' },
  { id: 's26', subscale: FACETS.connection,        text: 'I give praise when my child is good.' },
  { id: 's27', subscale: FACETS.physical_coercion, text: 'I slap my child when he/she misbehaves.' },
  { id: 's28', subscale: FACETS.autonomy,          text: 'I respect my child’s opinion and encourage him/her to express it.' },
  { id: 's29', subscale: FACETS.non_reasoning,     text: 'I use threats as a form of punishment with little or no justification.' },
  { id: 's30', subscale: FACETS.verbal_hostility,  text: 'I scold and criticize to make my child improve.' },
  { id: 's31', subscale: FACETS.regulation,        text: 'I give my child reasons why rules should be obeyed.' },
  { id: 's32', subscale: FACETS.indulgent,         text: 'I spoil my child.' },
];

const responseScale = { min: 1, max: 5 };
const MID = 0.5; // normalized midpoint for hi/lo dimension splits

const STYLE_KEYS = ['authoritative', 'authoritarian', 'permissive', 'uninvolved'];

function mean(...xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

module.exports = {
  key: 'style',
  version: 1,
  audience: 'parent',
  title: 'Parenting Style',
  description: 'Discover your predominant parenting style across warmth and structure.',
  source: 'PSDQ short form — Robinson, Mandleco, Olsen & Hart (1995, 2001)',
  responseScale,
  options: [
    { value: 1, label: 'Never' },
    { value: 2, label: 'Once in a while' },
    { value: 3, label: 'About half the time' },
    { value: 4, label: 'Very often' },
    { value: 5, label: 'Always' },
  ],
  items,
  subscales: [
    { key: FACETS.connection,        label: 'Warmth & Connection' },
    { key: FACETS.regulation,        label: 'Reasoning & Structure' },
    { key: FACETS.autonomy,          label: 'Autonomy Granting' },
    { key: FACETS.physical_coercion, label: 'Physical Coercion' },
    { key: FACETS.verbal_hostility,  label: 'Verbal Hostility' },
    { key: FACETS.non_reasoning,     label: 'Punitive / Non-reasoning' },
    { key: FACETS.indulgent,         label: 'Indulgent / Permissive' },
  ],
  // Normalized 0..1 dimensions. warmth + consistency are shared with child_view.
  dimensions: [
    { key: 'warmth',         from: [{ subscale: FACETS.connection }], combine: 'mean' },
    { key: 'consistency',    from: [{ subscale: FACETS.regulation }, { subscale: FACETS.indulgent, invert: true }], combine: 'mean' },
    { key: 'responsiveness', from: [{ subscale: FACETS.connection }, { subscale: FACETS.autonomy }], combine: 'mean' },
    { key: 'demandingness',  from: [{ subscale: FACETS.regulation }, { subscale: FACETS.physical_coercion }, { subscale: FACETS.verbal_hostility }, { subscale: FACETS.non_reasoning }], combine: 'mean' },
  ],

  interpret(m, dims) {
    // The three PSDQ style scores (1..5). Style is determined from these
    // directly — the standard PSDQ method — rather than a reconstructed 2x2,
    // which would conflate harshness with demandingness.
    const authoritative = mean(m.connection, m.regulation, m.autonomy);
    const authoritarian = mean(m.physical_coercion, m.verbal_hostility, m.non_reasoning);
    const permissive = m.indulgent;

    const scaleMid = (responseScale.min + responseScale.max) / 2; // 3 on a 1..5 scale
    const scores = { authoritative, authoritarian, permissive };

    let styleKey;
    if (authoritative < scaleMid && authoritarian < scaleMid && permissive < scaleMid) {
      // Low engagement across the board → disengaged / uninvolved.
      styleKey = 'uninvolved';
    } else {
      // Predominant style = highest scale score (ties favor authoritative).
      styleKey = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    }

    const r2 = n => Math.round(n * 100) / 100;
    return {
      styleKey,
      bands: {
        scales: { authoritative: r2(authoritative), authoritarian: r2(authoritarian), permissive: r2(permissive) },
        scaleMidpoint: scaleMid,
        // Baumrind dimensions (0..1) for the quadrant visual — illustrative only.
        responsiveness: dims.responsiveness,
        demandingness: dims.demandingness,
        dimensionMidpoint: MID,
      },
    };
  },

  styleKeys: STYLE_KEYS,
};
