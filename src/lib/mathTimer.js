// Per-question countdown (hidden from the kid). When it expires the question is
// treated as answered incorrectly and the multiple-choice hint is shown.
// Durations are per-kid: one kid gets a tighter 5s, everyone else 10s.

export const DEFAULT_TIMER_SECONDS = 10;
export const TIMER_OVERRIDES = {
  'mitgandhi67@gmail.com': 5,
};

export function timerSecondsFor(email) {
  if (!email) return DEFAULT_TIMER_SECONDS;
  const key = email.toLowerCase();
  return Object.prototype.hasOwnProperty.call(TIMER_OVERRIDES, key)
    ? TIMER_OVERRIDES[key]
    : DEFAULT_TIMER_SECONDS;
}
