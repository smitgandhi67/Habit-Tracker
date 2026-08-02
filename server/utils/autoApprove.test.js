// Tests for shared-habit auto-approval, driven through syncHabitAward (the real entry point
// the log route calls). Mongoose model statics are stubbed against in-memory stores, so this
// runs without a DB — same approach as routes/logs.routes.test.js.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId().toString();

const Habit = require('../models/Habit');
const HabitPointAward = require('../models/HabitPointAward');
const AccountLink = require('../models/AccountLink');
const MathReward = require('../models/MathReward');
const MathPointAdjustment = require('../models/MathPointAdjustment');

// --- tiny query-builder + filter matcher -----------------------------------
const q = (val) => ({ select: () => q(val), sort: () => q(val), lean: () => Promise.resolve(val) });

function matches(doc, filter) {
  return Object.entries(filter).every(([k, cond]) => {
    const v = doc[k];
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
    if (cond === null) return v === null || v === undefined;
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('$in' in cond) return cond.$in.some(x => String(x) === String(v));
      if ('$gt' in cond) return Number(v) > cond.$gt;
      return false;
    }
    return String(v) === String(cond);
  });
}
const where = (store, filter) => [...store.values()].filter(d => matches(d, filter));

// --- stores ----------------------------------------------------------------
let habits, awards, links, wallets, ledger;

Habit.find = (f) => q(where(habits, f));
Habit.findOne = (f) => q(where(habits, f)[0] || null);

const awardKey = (habitId, date) => `${habitId}|${date}`;
HabitPointAward.find = (f) => q(where(awards, f).map(d => ({ ...d })));
HabitPointAward.findOne = async (f) => where(awards, f)[0] || null;
HabitPointAward.create = async (doc) => {
  const rec = { _id: doc._id || oid(), status: 'pending', autoApproved: false, ...doc, save: async () => rec };
  awards.set(awardKey(rec.habitId, rec.date), rec);
  return rec;
};
HabitPointAward.deleteOne = async (f) => {
  for (const [k, d] of awards) if (matches(d, f)) { awards.delete(k); return { deletedCount: 1 }; }
  return { deletedCount: 0 };
};
HabitPointAward.updateMany = async (f, u) => {
  const hit = where(awards, f);
  for (const d of hit) Object.assign(d, u.$set);
  return { modifiedCount: hit.length };
};
HabitPointAward.findOneAndDelete = async (f) => {
  for (const [k, d] of awards) if (matches(d, f)) { awards.delete(k); return d; }
  return null;
};

AccountLink.find = (f) => q(where(links, f));

MathReward.bulkWrite = async (ops) => {
  for (const { updateOne } of ops) {
    const id = String(updateOne.filter.userId);
    wallets.set(id, (wallets.get(id) || 0) + updateOne.update.$inc.pointsEarned);
  }
};
MathReward.updateOne = async (f, u) => {
  const id = String(f.userId);
  wallets.set(id, (wallets.get(id) || 0) + u.$inc.pointsEarned);
};
MathPointAdjustment.insertMany = async (rows) => { ledger.push(...rows); };
MathPointAdjustment.create = async (row) => { ledger.push(row); return row; };

const { syncHabitAward } = require('./habitAwards');

// --- fixtures: parent P with kids A and B; both share "Brush teeth" --------
const P = oid(), KID_A = oid(), KID_B = oid();
const DATE = '2026-08-02';
let hA, hB, hSolo;

beforeEach(() => {
  habits = new Map(); awards = new Map(); links = new Map();
  wallets = new Map(); ledger = [];

  const link = (parentId, childId, status = 'approved') => {
    const l = { _id: oid(), parentId, childId, status };
    links.set(String(l._id), l);
  };
  link(P, KID_A); link(P, KID_B);

  const habit = (userId, name, points, extra = {}) => {
    const h = { _id: oid(), userId, name, points, autoApproveWhenAll: true, archivedAt: null, ...extra };
    habits.set(String(h._id), h);
    return h;
  };
  hA = habit(KID_A, 'Brush teeth', 5);
  hB = habit(KID_B, 'Brush Teeth', 5);        // different casing on purpose — still the same habit
  hSolo = habit(KID_A, 'Piano practice', 3);  // only one kid has it
});

const done = (userId, habit, date = DATE) =>
  syncHabitAward({ userId, habitId: habit._id, date, status: 'done' });
const undone = (userId, habit, date = DATE) =>
  syncHabitAward({ userId, habitId: habit._id, date, status: 'not_started' });
const awardFor = (habit, date = DATE) => awards.get(awardKey(habit._id, date));

test('first kid done: award stays pending, nothing credited', async () => {
  await done(KID_A, hA);
  assert.equal(awardFor(hA).status, 'pending');
  assert.equal(wallets.size, 0);
  assert.equal(ledger.length, 0);
});

test('both kids done: whole set auto-approves and credits once each', async () => {
  await done(KID_A, hA);
  await done(KID_B, hB);

  assert.equal(awardFor(hA).status, 'approved');
  assert.equal(awardFor(hB).status, 'approved');
  assert.equal(awardFor(hA).autoApproved, true);
  assert.equal(awardFor(hA).reviewedBy, 'auto-approve');
  assert.equal(wallets.get(KID_A), 5);
  assert.equal(wallets.get(KID_B), 5);
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0].type, 'add');
  assert.match(ledger[0].reason, /Auto-approved \(all kids done\)/);
});

test('re-running done on an already auto-approved set does not double-credit', async () => {
  await done(KID_A, hA);
  await done(KID_B, hB);
  await done(KID_B, hB);
  await done(KID_A, hA);

  assert.equal(wallets.get(KID_A), 5);
  assert.equal(wallets.get(KID_B), 5);
  assert.equal(ledger.length, 2);
});

test('solo habit never auto-approves, even though its only owner is done', async () => {
  await done(KID_A, hSolo);
  assert.equal(awardFor(hSolo).status, 'pending');
  assert.equal(wallets.size, 0);
});

test('flag off on the sibling copy disables auto-approval for the pair', async () => {
  hB.autoApproveWhenAll = false;
  await done(KID_A, hA);
  await done(KID_B, hB);

  assert.equal(awardFor(hA).status, 'pending');
  assert.equal(awardFor(hB).status, 'pending');
  assert.equal(wallets.size, 0);
});

test('a parent-rejected sibling award blocks auto-approval', async () => {
  await done(KID_B, hB);
  awardFor(hB).status = 'rejected';       // parent said no
  await done(KID_A, hA);

  assert.equal(awardFor(hA).status, 'pending', 'a sibling completion must not revive a rejection');
  assert.equal(wallets.size, 0);
});

test('un-doing an auto-approved habit claws the points back and drops the award', async () => {
  await done(KID_A, hA);
  await done(KID_B, hB);
  await undone(KID_A, hA);

  assert.equal(awardFor(hA), undefined, 'award row removed');
  assert.equal(wallets.get(KID_A), 0, 'points deducted');
  assert.equal(wallets.get(KID_B), 5, 'the sibling who did do it keeps theirs');
  const deduct = ledger.filter(r => r.type === 'deduct');
  assert.equal(deduct.length, 1);
  assert.match(deduct[0].reason, /Un-done after auto-approval/);
});

test('re-doing after a claw-back re-approves and credits exactly once', async () => {
  await done(KID_A, hA);
  await done(KID_B, hB);
  await undone(KID_A, hA);
  await done(KID_A, hA);

  assert.equal(awardFor(hA).status, 'approved');
  assert.equal(wallets.get(KID_A), 5);
  assert.equal(wallets.get(KID_B), 5);
});

test('un-doing a PARENT-approved award leaves it and the points alone', async () => {
  await done(KID_A, hA);
  Object.assign(awardFor(hA), { status: 'approved', autoApproved: false, reviewedBy: 'mum@example.com' });
  wallets.set(KID_A, 5);

  await undone(KID_A, hA);
  assert.equal(awardFor(hA).status, 'approved', 'a human approval is final');
  assert.equal(wallets.get(KID_A), 5, 'no claw-back');
  assert.equal(ledger.filter(r => r.type === 'deduct').length, 0);
});

test('un-doing a still-pending award just deletes it (no ledger activity)', async () => {
  await done(KID_A, hA);
  await undone(KID_A, hA);
  assert.equal(awardFor(hA), undefined);
  assert.equal(ledger.length, 0);
});

test('an unlinked kid (no parent) never auto-approves', async () => {
  links.clear();
  await done(KID_A, hA);
  await done(KID_B, hB);
  assert.equal(awardFor(hA).status, 'pending');
  assert.equal(wallets.size, 0);
});

test('kids done on different dates do not approve each other', async () => {
  await done(KID_A, hA, '2026-08-01');
  await done(KID_B, hB, '2026-08-02');
  assert.equal(awardFor(hA, '2026-08-01').status, 'pending');
  assert.equal(awardFor(hB, '2026-08-02').status, 'pending');
  assert.equal(wallets.size, 0);
});
