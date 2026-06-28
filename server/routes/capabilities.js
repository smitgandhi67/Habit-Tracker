const express = require('express');
const router = express.Router();

const { DOMAINS, FOUNDATIONAL_KEYS } = require('../capabilities/domains');
const { CITATIONS, citationsForDomain } = require('../capabilities/citations');

// Capabilities ("Skills") module API. Day 1 exposes the read-only registries that
// the rest of the module (baseline subscales, activity tags, reference layer) builds
// on. Mounted under requireAuth in app.js.

// GET /api/capabilities/domains — the 10 capability domains, with the foundational set.
router.get('/domains', (_req, res) => {
  res.json({ domains: DOMAINS, foundational: FOUNDATIONAL_KEYS });
});

// GET /api/capabilities/citations[?domain=key] — evidence anchors, optionally filtered.
router.get('/citations', (req, res) => {
  const { domain } = req.query;
  const items = typeof domain === 'string' && domain ? citationsForDomain(domain) : CITATIONS;
  res.json({ citations: items });
});

module.exports = router;
