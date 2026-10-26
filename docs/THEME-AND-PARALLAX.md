# Hero parallax and theme

Move the mouse across the home hero to shift the camera, chair, ring, sphere, cube, sticker and labels at different depths. Leaving the hero, scrolling or changing pages resets the layers. Touch devices, the Motion off setting and system reduced-motion preference disable cursor parallax.

The Dark mode / Light mode button is in the top demo bar, visible both before and after sign-in. Theme choice persists locally. Before an explicit choice, the system theme is followed. The theme is set before styles load to avoid a light flash on reload.

Light mode keeps the original warm beige. Dark mode uses charcoal surfaces, readable light text and cobalt/orange accents. Photos are unchanged. Forms, dialogs, profile, inbox and listing controls have matching dark surfaces.

Validation: tests/theme-parallax.cjs covers movement/reset, reduced motion, theme persistence, system theme, profile/inbox/modal navigation and widths 320–1440px. Run with Playwright and set DORMMART_URL to the preview address.

Local changes only. No commit, push or deployment.
