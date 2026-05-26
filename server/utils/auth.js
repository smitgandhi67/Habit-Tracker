// Single source of truth for admin identity. Reads from env; falls back to the
// historical default email so existing deploys keep working without config.
// Set ADMIN_EMAIL in the server env (.env / SAM template) to change.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'amitgandhi23@gmail.com';

function isAdmin(req) {
  return !!(req?.user?.email && req.user.email === ADMIN_EMAIL);
}

// Express middleware: 403s non-admins. Use after requireAuth.
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Not authorised' });
  next();
}

module.exports = { isAdmin, requireAdmin, ADMIN_EMAIL };
