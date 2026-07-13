// Unit tests for the Word Decoder grading + promotion engine (pure, no DB). Covers the
// two-axis state machine (rungs + Leitner), the novel-word graduation gate, and the
// Datamuse-backed free-generation validator (mocked, incl. the lenient fallback).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const e = require('./rootsEngine');

const wf = e.getRoot('bio');   // word_family
const kw = e.getRoot('derm');  // keyword_mnemonic
const D = '2026-07-13', D2 = '2026-07-14';
const base = (over = {}) => ({ exposed: true, stage: 'learning', level: 0, streakCount: 0, lastCorrectDate: null, dueDate: D, lapses: 0, decodedWords: [], ...over });

test('interactionFor picks the rung from mastery', () => {
  assert.equal(e.interactionFor(wf, null), 'first_exposure');
  assert.equal(e.interactionFor(wf, base()), 'free_gen');
  assert.equal(e.interactionFor(kw, base()), 'keyword_recall');
  assert.equal(e.interactionFor(wf, base({ stage: 'decoding' })), 'decode_challenge');
  assert.equal(e.interactionFor(wf, base({ stage: 'mastered' })), 'decode_challenge');
});

test('first exposure marks exposed, awards once, touches today', () => {
  const r = e.applyResult(null, { interaction: 'first_exposure', correct: true, firstTry: true, date: D });
  assert.equal(r.patch.exposed, true);
  assert.equal(r.patch.stage, 'learning');
  assert.equal(r.patch.lastCorrectDate, D);
  assert.equal(r.points, e.POINTS.first_exposure);
  assert.equal(r.newRoot, true);
  // re-exposing an already-exposed root awards nothing new
  const r2 = e.applyResult(base({ exposed: true }), { interaction: 'first_exposure', correct: true, firstTry: true, date: D });
  assert.equal(r2.points, 0);
  assert.equal(r2.newRoot, false);
});

test('learning needs PROMOTE_AT distinct days to reach decoding', () => {
  const day1 = e.applyResult(base(), { interaction: 'free_gen', correct: true, firstTry: true, date: D });
  assert.equal(day1.patch.streakCount, 1);
  assert.equal(day1.patch.stage, undefined); // still learning
  assert.equal(day1.points, e.POINTS.free_gen);
  // same-day repeat: no points, no streak change
  const same = e.applyResult(base({ streakCount: 1, lastCorrectDate: D }), { interaction: 'free_gen', correct: true, firstTry: true, date: D });
  assert.equal(same.points, 0);
  assert.equal(same.patch.streakCount, undefined);
  // second distinct day promotes to decoding
  const day2 = e.applyResult(base({ streakCount: 1, lastCorrectDate: D }), { interaction: 'free_gen', correct: true, firstTry: true, date: D2 });
  assert.equal(day2.patch.stage, 'decoding');
  assert.equal(day2.patch.streakCount, 0);
});

test('learning miss is gentle (no demotion, no points)', () => {
  const r = e.applyResult(base({ streakCount: 1 }), { interaction: 'free_gen', correct: false, firstTry: true, date: D });
  assert.equal(r.points, 0);
  assert.equal(r.patch.stage, undefined);
  assert.equal(r.patch.streakCount, undefined); // unchanged
});

test('decode graduates only on a NOVEL word', () => {
  const grad = e.applyResult(base({ stage: 'decoding' }), { interaction: 'decode_challenge', correct: true, firstTry: true, date: D, word: 'biosphere' });
  assert.equal(grad.patch.stage, 'mastered');
  assert.equal(grad.patch.level, 1);
  assert.equal(grad.graduated, true);
  assert.equal(grad.points, e.POINTS.decode_challenge);
  assert.deepEqual(grad.patch.decodedWords, ['biosphere']);
  // same word again (already decoded) — no graduation, no points
  const repeat = e.applyResult(base({ stage: 'decoding', decodedWords: ['biosphere'] }), { interaction: 'decode_challenge', correct: true, firstTry: true, date: D, word: 'biosphere' });
  assert.equal(repeat.graduated, false);
  assert.equal(repeat.points, 0);
  // wrong decode — no graduation
  const wrong = e.applyResult(base({ stage: 'decoding' }), { interaction: 'decode_challenge', correct: false, firstTry: true, date: D, word: 'biosphere' });
  assert.equal(wrong.graduated, false);
});

test('mastered maintenance levels up on hit, demotes on miss', () => {
  const hit = e.applyResult(base({ stage: 'mastered', level: 1, decodedWords: ['biosphere'] }), { interaction: 'decode_challenge', correct: true, firstTry: true, date: D, word: 'biology' });
  assert.equal(hit.patch.level, 2);
  assert.equal(hit.points, e.POINTS.maintenance);
  assert.ok(hit.patch.dueDate > D); // rests into the future
  const miss = e.applyResult(base({ stage: 'mastered', level: 3 }), { interaction: 'decode_challenge', correct: false, firstTry: true, date: D, word: 'biology' });
  assert.equal(miss.patch.stage, 'decoding');
  assert.equal(miss.patch.level, 0);
  assert.equal(miss.patch.lapses, 1);
});

test('validateGeneratedWord: real word containing the root passes', async () => {
  global.fetch = async () => ({ ok: true, json: async () => [{ word: 'biology' }] });
  assert.deepEqual(await e.validateGeneratedWord(wf, 'biology'), { valid: true });
});

test('validateGeneratedWord: rejects a non-word', async () => {
  global.fetch = async () => ({ ok: true, json: async () => [] });
  const r = await e.validateGeneratedWord(wf, 'biozzq');
  assert.equal(r.valid, false);
  assert.equal(r.reason, 'not-a-word');
});

test('validateGeneratedWord: rejects a word missing the root (no API call needed)', async () => {
  global.fetch = async () => { throw new Error('should not be called'); };
  const r = await e.validateGeneratedWord(wf, 'cat');
  assert.equal(r.valid, false);
  assert.equal(r.reason, 'no-root');
});

test('validateGeneratedWord: degrades leniently when Datamuse is unreachable', async () => {
  global.fetch = async () => { throw new Error('network down'); };
  const r = await e.validateGeneratedWord(wf, 'biology');
  assert.equal(r.valid, true);
  assert.equal(r.lenient, true);
});
