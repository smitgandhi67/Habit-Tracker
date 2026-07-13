// Word Decoder grading + scheduling engine — the server is the authority (it never
// trusts a client verdict, and it performs the Datamuse realness check itself so points
// can't be spoofed). Mirrors the math module's applyMastery, but roots move along TWO
// axes: a rung (`stage`: learning -> decoding -> mastered) and a Leitner rest `level`
// that only kicks in after mastery. A root is `mastered` ONLY by decoding a NOVEL word.

const DATA = require('../data/roots.json');

const ROOTS = DATA.roots;
const ROOT_BY_ID = new Map(ROOTS.map(r => [r.id, r]));

// ---- schedule constants (roots-local; kept independent of the math schedule) --------
const PROMOTE_AT = 2;                                  // distinct-day successes to advance a rung
const MAX_LEVEL = 7;
const DEMOTE_STEP = 2;
const INTERVAL_WEEKS = [0, 1, 2, 3, 4, 6, 12, 26];     // index = level; level 0 = due now

// ---- point weights (credited to the shared math wallet) -----------------------------
const POINTS = {
  first_exposure: 2,   // meeting a new root
  free_gen: 3,         // generating real words containing it (word_family review)
  keyword_recall: 3,   // recalling meaning from the image cue (keyword review)
  decode_challenge: 5, // cracking a NOVEL word — the transfer win (graduation)
  maintenance: 2,      // a mastered root's spaced refresher
};

// ---- session cap (the "small fixed daily dose") -------------------------------------
const NEW_ROOTS_PER_DAY = 2;   // at most N never-seen roots introduced per day
const DAILY_ITEM_GOAL = 12;    // target interactions/day (drives the ring); soft cap below

const isIso = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// 'YYYY-MM-DD' that is INTERVAL_WEEKS[level] weeks after dateStr (UTC-safe).
function dueDateAfter(dateStr, level) {
  const weeks = INTERVAL_WEEKS[Math.min(level, MAX_LEVEL)] || 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + weeks * 7));
  return dt.toISOString().slice(0, 10);
}

function getRoot(id) { return ROOT_BY_ID.get(id) || null; }

// The interaction a root should fire, given its current mastery row (or null = brand new).
// Never returns a rung the learner can't reach: a new/unexposed root always starts at the
// guided first-exposure scaffold.
function interactionFor(root, mastery) {
  if (!mastery || !mastery.exposed) return 'first_exposure';
  if (mastery.stage === 'learning') return root.type === 'word_family' ? 'free_gen' : 'keyword_recall';
  return 'decode_challenge'; // decoding + mastered(maintenance)
}

// A root is due when it has no mastery row, or its dueDate is null / today-or-earlier.
function isDue(mastery, date) {
  if (!mastery) return true;
  return !mastery.dueDate || mastery.dueDate <= date;
}

// "Ready" = the root has cleared the learning rung, so a decode success may graduate it.
function isReady(mastery) {
  return !!mastery && (mastery.stage === 'decoding' || mastery.stage === 'mastered');
}

// ---- word realness (Datamuse), used only for free-generation grading ----------------
const stemsOf = (root) => String(root.root).split('/').map(s => s.trim().toLowerCase()).filter(Boolean);
const containsRoot = (root, word) => { const w = word.toLowerCase(); return stemsOf(root).some(s => w.includes(s)); };

// Is `word` a real English word? Returns true / false / null(unknown, on API failure).
// Datamuse `sp=` is a spelling lookup; we require an exact match on the top result.
async function isRealWord(word) {
  const w = String(word).trim().toLowerCase();
  if (!/^[a-z][a-z'-]*$/.test(w)) return false; // single alphabetic token only
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(w)}&max=1`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json) && json.length > 0 && String(json[0].word).toLowerCase() === w;
  } catch {
    return null; // network/timeout — caller degrades leniently
  } finally {
    clearTimeout(timer);
  }
}

// Validate one child-generated word for a root: must contain the root AND be real. If the
// realness API is unreachable (null), degrade leniently — a word that contains the root is
// accepted so the child is never dead-ended (matches the "never dead-end" rule).
async function validateGeneratedWord(root, word) {
  const w = String(word || '').trim().toLowerCase();
  if (!w || /\s/.test(w)) return { valid: false, reason: 'blank' };
  if (!containsRoot(root, w)) return { valid: false, reason: 'no-root' };
  const real = await isRealWord(w);
  if (real === true) return { valid: true };
  if (real === false) return { valid: false, reason: 'not-a-word' };
  return { valid: true, lenient: true }; // API down -> accept (root already present)
}

// Grade + advance a root given one interaction result. Pure: takes the current mastery
// snapshot (plain object or null) + context, returns { patch, points, correct, newRoot,
// graduated, addedWord }. The route persists `patch` onto the RootMastery doc.
//   ctx = { interaction, correct, firstTry, date, word? }
// `correct` is the SERVER's verdict (already computed for the interaction type).
function applyResult(mastery, ctx) {
  const { interaction, correct, firstTry, date, word } = ctx;
  const m = mastery || { exposed: false, stage: 'learning', level: 0, streakCount: 0, lastCorrectDate: null, dueDate: null, lapses: 0, decodedWords: [] };
  const patch = {};
  let points = 0, newRoot = false, graduated = false, addedWord = false;
  const distinctDay = firstTry && correct && m.lastCorrectDate !== date;

  if (interaction === 'first_exposure') {
    if (!m.exposed) { patch.exposed = true; points = POINTS.first_exposure; newRoot = true; }
    patch.stage = 'learning';
    patch.streakCount = 0;
    patch.lastCorrectDate = date; // counts as today's touch — first review lands tomorrow
    patch.dueDate = date;         // due, but hidden for the rest of today by lastCorrectDate
    return { patch, points, correct: true, newRoot, graduated, addedWord };
  }

  if (interaction === 'free_gen' || interaction === 'keyword_recall') {
    if (correct && firstTry) {
      if (distinctDay) {
        const streak = (m.streakCount || 0) + 1;
        patch.lastCorrectDate = date;
        points = POINTS[interaction];
        if (streak >= PROMOTE_AT) { patch.stage = 'decoding'; patch.streakCount = 0; }
        else { patch.streakCount = streak; }
      }
      // same-day repeat: correct but already credited today — no streak/points change
    }
    // learning misses are gentle: no demotion, just try again next session
    patch.dueDate = date;
    return { patch, points, correct, newRoot, graduated, addedWord };
  }

  // decode_challenge — for stage 'decoding' (graduation) or 'mastered' (maintenance)
  const wl = String(word || '').toLowerCase();
  const alreadyDecoded = (m.decodedWords || []).map(x => x.toLowerCase()).includes(wl);

  if (m.stage === 'mastered') {
    if (correct && firstTry) {
      if (wl && !alreadyDecoded) { patch.decodedWords = [...(m.decodedWords || []), wl]; addedWord = true; }
      const level = Math.min((m.level || 1) + 1, MAX_LEVEL);
      patch.level = level;
      patch.lastCorrectDate = date;
      patch.dueDate = dueDateAfter(date, level);
      points = POINTS.maintenance;
    } else {
      patch.lapses = (m.lapses || 0) + 1;
      patch.stage = 'decoding'; // forgot -> must re-earn mastery
      patch.level = 0;
      patch.streakCount = 0;
      patch.dueDate = date;
    }
    return { patch, points, correct, newRoot, graduated, addedWord };
  }

  // stage 'decoding' -> graduate only on a NOVEL word
  if (correct && firstTry && wl && !alreadyDecoded) {
    patch.decodedWords = [...(m.decodedWords || []), wl]; addedWord = true;
    patch.stage = 'mastered';
    patch.level = 1;
    patch.streakCount = 0;
    patch.lastCorrectDate = date;
    patch.dueDate = dueDateAfter(date, 1);
    points = POINTS.decode_challenge;
    graduated = true;
  } else {
    // wrong, or a word already used before — no graduation, stays decoding, try a fresh one
    patch.dueDate = date;
  }
  return { patch, points, correct, newRoot, graduated, addedWord };
}

module.exports = {
  DATA, ROOTS, ROOT_BY_ID, getRoot,
  interactionFor, isDue, isReady, containsRoot, stemsOf,
  isRealWord, validateGeneratedWord,
  applyResult, dueDateAfter,
  PROMOTE_AT, MAX_LEVEL, DEMOTE_STEP, INTERVAL_WEEKS, POINTS,
  NEW_ROOTS_PER_DAY, DAILY_ITEM_GOAL,
};
