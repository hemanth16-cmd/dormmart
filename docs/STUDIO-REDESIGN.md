# DormMart studio redesign

The frontend remains vanilla HTML, CSS and JavaScript with the original beige, cobalt and orange palette.

- Rebuilt homepage hierarchy, layered hero artwork, collection shortcuts and listing call to action.
- Refined cards, dark theme surfaces and responsive layouts.
- Compare up to three items using each card's Compare item button. The selection persists locally. Rental prices are per day; sale prices and deposits are shown separately.
- Open quick search with the header search button or `/` when outside a form field.
- Mobile bottom navigation provides Home, Explore, Messages and Profile.
- Existing reduced-motion preferences remain supported.

Authentication, messages, distances and marketplace transactions remain demonstrations. No backend service was added.

Validation covered responsive widths from 320 to 1440 pixels, both themes, comparison limits/persistence, search, mobile navigation and existing listing/profile/message/item-page flows. Run `tests/studio.cjs` with the Playwright module path as its argument and `DORMMART_URL` pointing at your local preview server.

Changes are local until explicitly committed and pushed.
