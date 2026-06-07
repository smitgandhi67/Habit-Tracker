// Pure Markdown builder for the health export. No DB and no wall-clock
// (generatedAt is passed in) so output is deterministic and unit-testable.

function pad2(n) { return String(n).padStart(2, '0'); }

// milliseconds → "Xh YYm"; 0/falsy → "-"
// Output is ASCII-only on purpose: the Markdown travels through API Gateway /
// serverless-express and is opened in arbitrary editors, where non-ASCII glyphs
// get re-encoded to mojibake. ASCII sidesteps that entirely.
function formatDurationMs(ms) {
  if (!ms || ms <= 0) return '-';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${pad2(m)}m`;
}

// numeric cell or "-" for null/undefined/NaN
function cell(v) {
  return (v === null || v === undefined || Number.isNaN(v)) ? '-' : String(v);
}

// "repsxweightunit"; weight omitted when 0/falsy (bodyweight)
function formatSet(set, weightUnit) {
  const reps = set?.reps ?? 0;
  if (!set || !set.weight) return `${reps}`;
  return `${reps}x${set.weight}${weightUnit}`;
}

// round to 1 decimal, drop trailing ".0"
function round1(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// Collapse raw sleep sessions + night-quality docs into one row per night.
// Returns rows sorted by nightDate descending. Pure.
function aggregateSleepNights(sessions = [], nights = []) {
  const map = new Map();
  const ensure = (d) => {
    if (!map.has(d)) map.set(d, { nightDate: d, durationMs: 0, segments: 0, quality: null });
    return map.get(d);
  };
  for (const s of sessions) {
    const row = ensure(s.nightDate);
    row.segments += 1;
    if (s.endAt) row.durationMs += new Date(s.endAt).getTime() - new Date(s.startAt).getTime();
  }
  for (const n of nights) ensure(n.nightDate).quality = n.quality;
  return [...map.values()].sort((a, b) => b.nightDate.localeCompare(a.nightDate));
}

function buildSummary({ units, gymEntries, body, sleepNights }) {
  const lines = [];

  const trainDates = new Set(gymEntries.map(e => e.date));
  const totalSets = gymEntries.reduce((n, e) => n + (e.sets?.length || 0), 0);
  const exNames = new Set(gymEntries.map(e => e.exerciseName));
  const prs = gymEntries.filter(e => e.isPersonalRecord).length;
  lines.push(`- Training days: ${trainDates.size} | sets logged: ${totalSets} | distinct exercises: ${exNames.size} | PRs: ${prs}`);

  const weights = body
    .filter(b => b.weight !== null && b.weight !== undefined)
    .map(b => ({ date: b.date, weight: b.weight }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (weights.length) {
    const f = weights[0];
    const l = weights[weights.length - 1];
    const delta = round1(l.weight - f.weight);
    const signed = delta > 0 ? `+${delta}` : `${delta}`;
    lines.push(`- Body weight: ${f.weight} ${units.weight} (${f.date}) -> ${l.weight} ${units.weight} (${l.date}) | change ${signed} ${units.weight}`);
  }

  if (sleepNights.length) {
    const withDur = sleepNights.filter(n => n.durationMs > 0);
    const withQual = sleepNights.filter(n => n.quality !== null && n.quality !== undefined);
    const avgDur = withDur.length ? withDur.reduce((s, n) => s + n.durationMs, 0) / withDur.length : 0;
    const avgQual = withQual.length ? withQual.reduce((s, n) => s + n.quality, 0) / withQual.length : null;
    const qualStr = avgQual === null ? '-' : `${avgQual.toFixed(1)} / 5`;
    lines.push(`- Sleep: ${sleepNights.length} nights tracked | avg duration ${formatDurationMs(avgDur)} | avg quality ${qualStr}`);
  }

  return lines.join('\n');
}

function buildTrainingLog(gymEntries, weightUnit) {
  if (!gymEntries.length) return '_No data in this range._';
  const order = [];
  const byDate = new Map();
  for (const e of gymEntries) {
    if (!byDate.has(e.date)) { byDate.set(e.date, []); order.push(e.date); }
    byDate.get(e.date).push(e);
  }
  const blocks = order.map(date => {
    const items = byDate.get(date);
    const label = items.find(i => i.planDayLabel)?.planDayLabel;
    const heading = label ? `### ${date} | ${label}` : `### ${date}`;
    const lines = items.map(e => {
      const sets = (e.sets || []).map(s => formatSet(s, weightUnit)).join(', ');
      const pr = e.isPersonalRecord ? ' | [PR]' : '';
      return `- **${e.exerciseName}** [${e.bodyPart}] | ${e.feel} | ${sets}${pr}`;
    });
    return `${heading}\n${lines.join('\n')}`;
  });
  return `_Grouped by date, newest first._\n\n${blocks.join('\n\n')}`;
}

function buildBodyTable(body) {
  if (!body.length) return '_No data in this range._';
  const head = '| Date | Weight | Chest | Waist | Abdomen | Hips |\n|------|-------:|------:|------:|--------:|-----:|';
  const rows = body.map(b =>
    `| ${b.date} | ${cell(b.weight)} | ${cell(b.chest)} | ${cell(b.waist)} | ${cell(b.abdomen)} | ${cell(b.hips)} |`);
  return [head, ...rows].join('\n');
}

function buildSleepTable(sleepNights) {
  if (!sleepNights.length) return '_No data in this range._';
  const head = '| Night | Duration | Segments | Quality |\n|-------|---------:|---------:|--------:|';
  const rows = sleepNights.map(n =>
    `| ${n.nightDate} | ${formatDurationMs(n.durationMs)} | ${n.segments} | ${n.quality == null ? '-' : `${n.quality}/5`} |`);
  return [head, ...rows].join('\n');
}

function buildHealthMarkdown({ from, to, generatedAt, units, gymEntries = [], body = [], sleepNights = [] }) {
  return [
    '# Health Export\n',
    `- **Range:** ${from} -> ${to}`,
    `- **Units:** weight = ${units.weight}, length = ${units.length}`,
    `- **Generated:** ${generatedAt}\n`,
    '## Summary',
    buildSummary({ units, gymEntries, body, sleepNights }) + '\n',
    '## Gym - Training Log',
    buildTrainingLog(gymEntries, units.weight) + '\n',
    '## Gym - Body Measurements',
    buildBodyTable(body) + '\n',
    '## Sleep',
    buildSleepTable(sleepNights),
  ].join('\n');
}

module.exports = { buildHealthMarkdown, aggregateSleepNights, formatDurationMs };
