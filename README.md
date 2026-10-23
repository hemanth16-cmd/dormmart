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


## Demo update: sign-in, listing creation and photography

Enter any non-empty email/phone text and password to enter. No account is created and neither contact details nor passwords are stored or transmitted. Session state is a sessionStorage flag only. This is a presentation flow, not authentication or access control.

Use **List an item** to sell, rent out or share an item. Add 1–3 JPG/PNG/WebP photographs (8 MB maximum each), condition notes, approximate pickup area and pricing. Rental listings include a refundable deposit. Images are resized to JPEG before browser-local storage. Your listing appears in Explore; select **Demo account → My listings** to remove it. Listings and requests belong to this browser's shared demo catalogue, not to separate verified users. They are not published to other users or devices. Storage failures are shown before a listing is added.

Sample items now use bundled representative photographs; they do not establish the real condition or exact model of an item. Uploaded listings use the user's actual photographs and self-reported condition. See docs/PHOTO-SOURCES.md. Motion includes staggered cards, image hover, saved feedback and dialog entrance, all disabled by reduced-motion preference.

`dist/demo.js` contains demo session and listing creation behavior. For the optional browser tests, install Playwright as a development tool and run a local server on port 4174, then `node tests/browser.cjs`. The test uses installed Microsoft Edge; Playwright is not used by the frontend.
