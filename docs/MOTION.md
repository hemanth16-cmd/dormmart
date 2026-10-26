# Motion and depth

DormMart keeps its warm beige (#edece6), cobalt blue (#1546d9) and orange (#f98318) palette with CSS-built decorative depth: a dimensional ring, sphere and cube, floating photo cards, layered shadows and raised buttons. Product photos remain unchanged.

Fine-pointer devices get a restrained card tilt and a moving photo highlight. Touch devices keep normal scrolling and taps. Sections and new listing cards reveal once on entering the viewport, with no content hidden before JavaScript runs.

The footer's Motion switch persists on this browser. System reduced-motion settings take priority. Decorative movement pauses off-screen and when the browser tab is hidden. No framework, 3D engine, remote dependency or image download is added.

Files: dist/motion.css and dist/motion.js, loaded by dist/index.html.

Validation: tests/motion.cjs checks the scene, tilt, saved items, modal access, motion preference persistence, reduced motion, responsive widths from 320 to 1440 pixels and profile access. Existing browser, profile/messages and 11 domain/date checks also pass.

Local update only. No commit, push or deployment performed.
