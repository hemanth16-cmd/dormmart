# Motion and depth

DormMart keeps its warm beige (#edece6), cobalt blue (#1546d9) and orange (#f98318) palette with CSS-built depth: a dimensional hero shelf display, tactile listing cards with framed photos, layered shadows and raised buttons. Product photos remain unchanged.

Fine-pointer devices get a restrained card lift and tilt with a moving photo highlight. The card holds still while the pointer is over Save or Compare. Pressing a card's link shows a clear pressed state.

Motion explains actions: a compared item's photo travels into the comparison tray before its miniature settles, the tray slides in when it first appears, and dialogs rise and fade in. The profile form, conversations and other long reading and typing surfaces do not animate. Touch devices keep normal scrolling and taps. Sections and new listing cards reveal once on entering the viewport, with no content hidden before JavaScript runs.

The footer's Motion switch persists on this browser. System reduced-motion settings take priority. Decorative movement pauses off-screen and when the browser tab is hidden. No framework, 3D engine, remote dependency or image download is added.

Files: dist/motion.css, dist/motion.js, dist/dimension.css and the tray animation in dist/studio.js, loaded by dist/index.html.

Validation: tests/motion.cjs checks the scene, tilt, saved items, modal access, motion preference persistence, reduced motion, responsive widths from 320 to 1440 pixels and profile access. Existing browser, profile/messages and 11 domain/date checks also pass.

Local update only. No commit, push or deployment performed.
