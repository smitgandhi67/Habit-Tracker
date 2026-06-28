# Day 1 — Foundation

Backbone everything else tags against: the 10-domain registry, the citation registry, profile age,
and the nav/route scaffold that mounts the new module end-to-end.

## Tasks

- **1.1 Domain registry** — `server/capabilities/domains.js` (CJS) + mirror `src/lib/capabilities/domains.js`
  (ESM). 10 domains `{ key, num, name, short, foundational, description }`; foundational = EF /
  metacognition / emotional (D2/D3/D4); healthy direction always higher-better.
- **1.2 Citation registry** — `server/capabilities/citations.js` + mirror `src/lib/capabilities/citations.js`.
  §4 anchors as data `{ key, domainKeys[], cite, finding, strength: 'VERIFIED'|'KNOWN', needsReverify }`.
  Every domain has ≥1 anchor; KNOWN ⟹ needsReverify true.
- **1.3 Profile age** — add optional `birthdate` (Date) to `server/models/User.js`; `server/utils/age.js`
  `ageFromBirthdate(birthdate, now)`; expose `birthdate` + computed `age` in `/api/auth/verify` and
  `/api/auth/me`; add `PUT /api/auth/birthdate` (mirrors timezone/unit endpoints).
- **1.4 Route + nav scaffold** — `server/routes/capabilities.js` exposing
  `GET /api/capabilities/domains` and `GET /api/capabilities/citations`; mount in `server/app.js`
  under `requireAuth`. Client: add "Skills" to `Layout.jsx` dropdown (Brain icon); `/skills` route in
  `App.jsx`; `src/pages/Skills.jsx` placeholder rendering the live domain list from the API.
- **1.5 Tests** — `server/capabilities/registries.test.js`: domains shape (10, unique keys, exactly 3
  foundational, nums 1–10), every citation `domainKeys` resolves, strength enum, KNOWN⟹needsReverify,
  every domain covered; `server/utils/age.test.js`: birthday-not-y-passed / passed / null / invalid.

## Verify

`cd server && npm test` green · `npm run build` (client) succeeds · `/skills` renders the 10 domains.

## Commit

`feat(capabilities): domain + citation registries, profile age, nav scaffold`
