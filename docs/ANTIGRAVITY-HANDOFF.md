# Stitch → Antigravity → functional vanilla frontend

## What is ready

Open `dist/index.html` directly for the buildless app, or serve `dist` with a static server. No package install, framework, transpiler or backend is required. Home and Explore are hash routes in one shared document; listing dialogs have `#item-ID` links. Saved IDs and demo requests use localStorage with in-memory fallback. Product fixtures and pure filtering/quote functions live in `data.js`; interaction code is in `app.js`; shared styles are in `styles.css`.

## Export and translate

1. Design Home first with the prompts in DESIGN-AND-STITCH.md. Approve mobile and desktop before generating Explore from it.
2. In Stitch, use the export/handoff capability available in your account. Google documents an Antigravity export path. If available, send approved screens directly; otherwise download available screen images, design specifications and generated source into `design-references/`. Export contents and UI labels may vary. Screenshots plus design tokens are sufficient to rebuild a screen.
3. In Antigravity, create a project and add this `dormmart` folder. Keep reference exports separate from `dist`; they are design evidence, not production source.
4. Give the agent the implementation prompt below. Even if an export includes Tailwind utilities or framework markup, translate those styles into ordinary CSS classes; do not import a CDN or framework to make the export run.
5. Implement shared tokens, header, controls and card once. Integrate one page at a time. Preserve working event handlers, accessibility, fixture schema and tested quote logic while matching approved visuals.
6. Review at 390, 768 and 1440 px; test keyboard-only navigation, Escape/close focus, empty search, filters combined, save/reload, and booking dates and security alternatives. Enable reduced motion and verify no animated movement remains.
7. Run `node --test tests/domain.test.cjs` and `node --check dist/app.js`. Serve `dist`, inspect browser errors and check the complete request flow. Static hosting publishes a frontend demo; backend integration is a separate implementation phase.

## Copy-paste implementation prompt

> Implement the approved Stitch designs in this DormMart project using ONLY semantic HTML5, standard CSS and vanilla JavaScript. No React, Vue, Angular, Tailwind, Bootstrap, JSX, CSS utility framework or build requirement. Read docs/DESIGN-AND-STITCH.md, dist/index.html, dist/styles.css, dist/data.js and dist/app.js first. Use exported screenshots and specifications as visual references. Translate any generated utility classes into named reusable CSS classes. Preserve the exact palette #edece6, #1546d9, #f98318. Keep Home and Explore on the existing hash routes, shared navigation and reusable listing cards. Preserve search, combined filters, sorting, saved persistence, no-results/reset, listing details, validation, cost breakdown, conditional guarantor alternative, demo request creation/cancellation and reduced-motion support. Do not fabricate authentication, verification, payment success or owner acceptance. Distances and trust data are simulated. Use accessible native controls, dialog semantics, focus restoration and safe text rendering. Rework layout at 390, 768 and 1440 px. Test the existing domain logic and all modified user flows. Report any unimplemented behavior explicitly. Never overwrite approved reference exports.

## Contract for a future backend

The current fixture schema includes id, title, category, mode, price, deposit, distance, owner, verified, student, reviews, rating, condition, description and alternative. A production API should use owner IDs and explicit verification evidence/status instead of booleans, prices in integer paise, geospatial coordinates on the server, and availability intervals.

Replace synchronous fixture reads with a repository/API adapter when a backend exists. Proposed operations: search listings with paginated filters; retrieve detail; save/remove favourite; request a quote; create/cancel request; list own requests. These names describe required behavior, not existing endpoints.

Server responsibilities: authentication and authorization; verification evidence privacy; distance computation; rate/deposit policy; authoritative date validation and availability; transactionally accepting and locking bookings; consent snapshots; protected messages; payment integration if later approved. Never trust localStorage as identity, acceptance, security approval, payment, or availability. Request creation should be idempotent; failed API calls should preserve user input and offer retry. Show loading, offline and server-error states when introducing async data.

MVP omissions: no real accounts, chat, listing publication, owner inbox, payment, guaranteed inventory, geolocation or proof uploads. The “List an item” button explains the next phase. The implemented request history is browser-local, with cancellation; it does not simulate owner acceptance. Free sharing uses a 1–7 day borrowing window; rental uses 1–30 days with no same-day rental. These are prototype policies, not final business rules.

## Official references checked 23 October 2026

- Google Stitch update and Antigravity export: https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/
- Google Stitch introduction and frontend export: https://developers.googleblog.com/en/stitch-a-new-way-to-design-uis/
- Antigravity project setup: https://www.antigravity.google/docs/getting-started?tab=ide

The workflow above is deliberately independent of exact export menu labels or generated code format.
