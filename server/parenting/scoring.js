// Pure parenting-instrument scoring engine — server source of truth.
// MIRROR: src/lib/parenting/scoring.js holds identical logic (ESM) for the
// client-side optimistic preview. Keep the two in sync when editing.
//
// scoreInstrument(config, responses) -> { subscales, dimensions, interpretation }
// gapReport(parentDims, childDims)   -> [{ key, parent, child, delta, alignment }]
//
// A config is data-driven (see server/parenting/instruments/*). Scores never
// trust the client: the server re-runs this on every submission.

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Validate + reverse-adjust + aggregate per subscale; derive normalized
// dimensions; hand subscale means to the instrument's interpret().
function scoreInstrument(config, responses) {
  if (!config || !Array.isArray(config.items) || !config.responseScale) {
    throw new Error('Invalid instrument config');
  }
  if (!Array.isArray(responses)) {
    throw new Error('responses must be an array');
  }

  const { min, max } = config.responseScale;
  const itemById = new Map(config.items.map(it => [it.id, it]));

  // --- validate responses -------------------------------------------------
  const seen = new Set();
  for (const r of responses) {
    if (!r || typeof r.itemId !== 'string') {
      throw new Error('Each response needs an itemId');
    }
    if (!itemById.has(r.itemId)) {
      throw new Error(`Response references unknown item: ${r.itemId}`);
    }
    if (seen.has(r.itemId)) {
      throw new Error(`Duplicate response for item: ${r.itemId}`);
    }
    seen.add(r.itemId);
    if (!Number.isInteger(r.value) || r.value < min || r.value > max) {
      throw new Error(`Response value out of range for ${r.itemId}: ${r.value}`);
    }
  }
  if (seen.size !== config.items.length) {
    const missing = config.items.filter(it => !seen.has(it.id)).map(it => it.id);
    throw new Error(`Incomplete submission, missing items: ${missing.join(', ')}`);
  }

  // --- aggregate per subscale (reverse-adjusted) --------------------------
  const buckets = new Map(); // subscaleKey -> { sum, n }
  for (const r of responses) {
    const item = itemById.get(r.itemId);
    const adj = item.reverse ? (min + max - r.value) : r.value;
    const b = buckets.get(item.subscale) || { sum: 0, n: 0 };
    b.sum += adj;
    b.n += 1;
    buckets.set(item.subscale, b);
  }

  const subscales = config.subscales.map(s => {
    const b = buckets.get(s.key) || { sum: 0, n: 0 };
    const mean = b.n ? b.sum / b.n : 0;
    return { key: s.key, label: s.label, raw: b.sum, n: b.n, mean: round2(mean) };
  });
  const meanByKey = Object.fromEntries(subscales.map(s => [s.key, s.mean]));

  // --- derive dimensions, normalized to 0..1 for cross-instrument compare --
  const span = max - min || 1;
  const normalize = v => round2((v - min) / span);
  const dimensions = (config.dimensions || []).map(d => {
    const parts = d.from.map(src => {
      const m = meanByKey[src.subscale] ?? 0;
      const v = src.invert ? (min + max - m) : m;
      return normalize(v);
    });
    let score;
    if (d.combine === 'sum') {
      score = parts.reduce((a, b) => a + b, 0);
    } else {
      score = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
    }
    return { key: d.key, score: round2(score) };
  });
  const dimByKey = Object.fromEntries(dimensions.map(d => [d.key, d.score]));

  const interpretation = typeof config.interpret === 'function'
    ? config.interpret(meanByKey, dimByKey, subscales)
    : {};

  return { subscales, dimensions, interpretation };
}

// Alignment thresholds on the 0..1 dimension scale.
function alignmentLabel(absDelta) {
  if (absDelta < 0.15) return 'aligned';
  if (absDelta <= 0.30) return 'some-gap';
  return 'large-gap';
}

// Compare parent self-report vs child's-view on shared dimension keys.
function gapReport(parentDims, childDims) {
  const childByKey = new Map((childDims || []).map(d => [d.key, d.score]));
  const out = [];
  for (const p of parentDims || []) {
    if (!childByKey.has(p.key)) continue;
    const parent = p.score;
    const child = childByKey.get(p.key);
    const delta = round2(parent - child);
    out.push({ key: p.key, parent, child, delta, alignment: alignmentLabel(Math.abs(delta)) });
  }
  return out;
}

module.exports = { scoreInstrument, gapReport, round2, alignmentLabel };
