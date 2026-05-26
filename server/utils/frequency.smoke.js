// Smoke test for validateFrequency / sanitizeFrequency. Run with:
//   node server/utils/frequency.smoke.js
// Exits 0 if all assertions pass, 1 otherwise. Not wired into CI; for local verification only.

const { validateFrequency, sanitizeFrequency } = require('./frequency');

let failures = 0;
function expect(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${ok ? '' : `→ expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
  if (!ok) failures++;
}
function expectErr(label, freq, mustContain) {
  const err = validateFrequency(freq);
  const ok = typeof err === 'string' && err.includes(mustContain);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${ok ? '' : `→ got ${JSON.stringify(err)}`}`);
  if (!ok) failures++;
}

// Valid cases
expect('daily',                              validateFrequency('daily'),                                            null);
expect("['Mon','Wed','Sat']",                validateFrequency(['Mon', 'Wed', 'Sat']),                              null);
expect('weekly times=1',                     validateFrequency({ type: 'weekly',   times: 1 }),                     null);
expect('weekly times=7',                     validateFrequency({ type: 'weekly',   times: 7 }),                     null);
expect('biweekly times=3 with anchor',       validateFrequency({ type: 'biweekly', times: 3, anchor: '2026-05-25' }), null);
expect('monthly times=15',                   validateFrequency({ type: 'monthly',  times: 15 }),                    null);

// Invalid cases
expectErr('empty array',                     [],                                                                    '1-7 days');
expectErr('duplicates in array',             ['Mon', 'Mon'],                                                        'duplicate');
expectErr('bogus day in array',              ['Mon', 'Funday'],                                                     'invalid day');
expectErr('weekly times=0',                  { type: 'weekly',   times: 0 },                                        'integer');
expectErr('weekly times=8',                  { type: 'weekly',   times: 8 },                                        'integer');
expectErr('weekly times non-integer',        { type: 'weekly',   times: 1.5 },                                      'integer');
expectErr('biweekly without anchor',         { type: 'biweekly', times: 1 },                                        'anchor');
expectErr('biweekly with bad anchor format', { type: 'biweekly', times: 1, anchor: '5/25/2026' },                   'anchor');
expectErr('monthly times=32',                { type: 'monthly',  times: 32 },                                       'integer');
expectErr('unknown period type',             { type: 'yearly',   times: 1 },                                        'invalid');
expectErr('bare string',                     'every-day',                                                           'must be');
expectErr('null',                            null,                                                                  'must be');

// Sanitize strips junk
const s1 = sanitizeFrequency({ type: 'weekly', times: 2, hacker: 'drop tables' });
expect('sanitize weekly drops unknown key',  JSON.stringify(s1), JSON.stringify({ type: 'weekly', times: 2 }));
const s2 = sanitizeFrequency({ type: 'biweekly', times: 1, anchor: '2026-05-25', x: 1 });
expect('sanitize biweekly preserves anchor', JSON.stringify(s2), JSON.stringify({ type: 'biweekly', times: 1, anchor: '2026-05-25' }));
const s3 = sanitizeFrequency(['Mon', 'Wed']);
expect('sanitize array returns copy',        JSON.stringify(s3), JSON.stringify(['Mon', 'Wed']));
expect('sanitize daily returns daily',       sanitizeFrequency('daily'),                                            'daily');

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
