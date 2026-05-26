// Determines which calendar date a sleep session "belongs to" for grouping.
// 6pm cutoff: if local hour >= 18 → session belongs to that date.
//             else → session belongs to the previous date.
// Means an 11pm Mon start + a 4am Tue restart both group as "Mon night".
//
// Implemented with Intl.DateTimeFormat (no extra deps) so client + server
// agree byte-for-byte. The 'en-CA' locale renders dates as YYYY-MM-DD.

function nightDateFor(date, tz) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new Error('nightDateFor: invalid date');
  }
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  // Intl reports hour 24 at midnight in some runtimes; normalize.
  const hour = parseInt(parts.hour, 10) % 24;
  if (hour >= 18) return ymd;
  const prev = new Date(`${ymd}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  return prev.toISOString().slice(0, 10);
}

module.exports = { nightDateFor };
