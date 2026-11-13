# Hero parallax and theme

The home hero is a dimensional campus display: a cobalt shelf holding a camera print and a chair card, with a folded price tag in the foreground. Each object has a visible edge and a contact shadow on the shelf.

On a fine pointer, moving across the hero eases the objects toward the cursor by depth. The tag travels farthest, then the chair card, then the camera print, and the contact shadows move least. The shelf, headline, search field and Explore button stay fixed. Leaving the hero eases everything back to rest; changing pages snaps it back. Touch devices, the Motion off setting and system reduced-motion preference show the scene at rest. The tag's slow sway is the only continuous effect, and it pauses while the hero is offscreen or the tab is hidden.

Styles live in dist/dimension.css (loaded last); the easing loop is in dist/motion.js and runs only while the scene is moving.

The Dark mode / Light mode button is in the top demo bar, visible both before and after sign-in. Theme choice persists locally. Before an explicit choice, the system theme is followed. The theme is set before styles load to avoid a light flash on reload.

Light mode reads as warm beige paper: a #E8E2D6 page, cream #F2ECDF cards, navigation and dialogs, and soft sand #EBE4D7 inputs and inset panels. Dark mode uses a deep #101419 page, #1A2129 cards and #141A20 inputs, so the page is always the deepest tone. The palette variables and the component overrides live at the end of dist/dimension.css. Photos are unchanged. The homepage search bar is a single dark surface in dark mode, with a transparent input and high-contrast placeholder and typed text. Forms, dialogs, profile, inbox and listing controls have matching dark surfaces.

Validation: tests/theme-parallax.cjs covers movement/reset, reduced motion, theme persistence, system theme, profile/inbox/modal navigation and widths 320–1440px. Run with Playwright and set DORMMART_URL to the preview address.

Local changes only. No commit, push or deployment.
