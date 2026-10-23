# DormMart

Vanilla HTML, CSS and JavaScript frontend prototype. Start by opening **dist/index.html** in a browser. No installation required. For HTTP preview, from this folder run `python -m http.server 4173 --directory dist`, then open http://localhost:4173.

- `dist/index.html`: shared shell, Home and Explore.
- `dist/styles.css`: responsive tokens and components, reduced-motion support.
- `dist/data.js`: nine mock listings, filter and quote functions.
- `dist/app.js`: routing, filters, saved items, details and demo booking requests.
- `docs/DESIGN-AND-STITCH.md`: design strategy and four copy-ready Stitch prompts.
- `docs/ANTIGRAVITY-HANDOFF.md`: export/translation workflow and implementation prompt.
- `tests/domain.test.cjs`: meaningful filter and pricing checks.

All identity, distance, rating, availability and transaction data are illustrative. Saved items and requests persist only in this browser. Clear site storage to reset the demo. The UI catches unavailable storage and continues in memory. External fonts/images/libraries are not required; emoji artwork varies by platform.

Run checks: `node --test tests/domain.test.cjs` and `node --check dist/app.js`.
