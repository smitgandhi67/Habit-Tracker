// Identity + parent↔child authorization helpers.
//
// The app is multi-family. A parent's access to a child is granted by an APPROVED
// AccountLink (see models/AccountLink). `ADMIN_EMAIL` is retained as a hidden global
// superuser (break-glass) that bypasses link checks everywhere.
const mongoose = require('mongoose');
const AccountLink = require('../models/AccountLink');

// Single source of truth for the superuser identity. Reads from env; falls back to the
// historical default email so existing deploys keep working without config.
// Set ADMIN_EMAIL in the server env (.env / SAM template) to change.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'amitgandhi23@gmail.com';

// Superuser check — the one global admin. Kept as break-glass; families use links.
function isAdmin(req) {
  return !!(req?.user?.email && req.user.email === ADMIN_EMAIL);
}
// Back-compat alias with clearer intent at call sites.
const isSuperuser = isAdmin;

// Express middleware: 403s non-superusers. Use after requireAuth. Reserved for the few
// still-global admin consoles (parenting/journey/capabilities) until they are link-scoped.
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Not authorised' });
  next();
}

// The child user ids a parent may act on: every child of an APPROVED link where they are
// the parent. The superuser may act on ALL users (null sentinel = "no restriction").
async function linkedChildIds(parentId) {
  const links = await AccountLink.find({ parentId, status: 'approved' }).select('childId').lean();
  return links.map(l => String(l.childId));
}

// True if `parentReq` is allowed to act on `childId` — an approved link exists, or the
// requester is the superuser. `childId` is coerced to string for comparison.
async function assertParentOf(req, childId) {
  if (!childId || !mongoose.isValidObjectId(String(childId))) return false;
  if (isSuperuser(req)) return true;
  const link = await AccountLink.exists({
    parentId: req.user._id, childId: String(childId), status: 'approved',
  });
  return !!link;
}

// Middleware factory: 403s unless the requester is an approved parent of the target
// child (or the superuser). `getChildId(req)` extracts the target child id from the
// request (body/query/params); return a falsy value to 400.
function requireParentOf(getChildId) {
  return async (req, res, next) => {
    try {
      const childId = getChildId(req);
      if (!childId || !mongoose.isValidObjectId(String(childId))) {
        return res.status(400).json({ error: 'valid child id required' });
      }
      if (!(await assertParentOf(req, childId))) {
        return res.status(403).json({ error: 'Not authorised for this child' });
      }
      next();
    } catch (err) { next(err); }
  };
}

module.exports = {
  ADMIN_EMAIL,
  isAdmin,
  isSuperuser,
  requireAdmin,
  linkedChildIds,
  assertParentOf,
  requireParentOf,
};
