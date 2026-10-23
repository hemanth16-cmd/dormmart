# DormMart design system and Stitch prompts

## Direction: useful things, good neighbours

A warm, editorial marketplace. Confident oversized typography, playful object illustrations, generous beige space, and clear blue actions. Orange adds energy without becoming a warning colour. Start with Home and Explore; establish one shared system before designing subsequent screens. Design actual responsive website screens, not presentation slides.

Audience: students and nearby residents. A college affiliation is optional. Sample locality: Presidency University neighbourhood; INR, local pickup, illustrative distances. Do not imply nationwide coverage or a live user count.

## Tokens and reusable components

| Token | Value / use |
|---|---|
| Canvas | #edece6 warm beige |
| Primary | #1546d9 cobalt blue; actions, active states, headings |
| Accent | #f98318 orange (the requested “sun yellow”); decorative accents |
| Ink | #202923; use dark text on orange |
| Muted | #62665e |
| Surface | #fafaf5 |
| Border | #d6d7cc |
| Typeface | Arial/Helvetica system stack, no font dependency |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64 px |
| Radius | 8–12 px controls, 18 px cards, pill chips |
| Content | 1280 px max, 90% width |
| Layout | 4 home columns; explore sidebar + 3 columns; 2 columns on narrow screens |
| Motion | 180–250 ms button/card feedback; 600 ms initial reveal; no autoplay carousel |

Components in styles.css: .button, .text-btn, .chip, .search, .card, .item-art, .mode-badge, .seller, .check, .notice, .quote, .empty, .toast and native dialog. Use semantic headings and visible labels. Focus rings are cobalt. All motion is disabled under prefers-reduced-motion. Never encode status in colour alone. Use orange with dark text; white on orange is unsuitable for small text.

Illustrations in this MVP are system emoji; their appearance varies by device. Replace them with consistent, locally licensed product photographs or illustrations when approved assets exist. Maintain aspect ratio and meaningful alt text for real item images.

## Screen sequence

1. Home: promise → search → categories → nearby items → how it works.
2. Explore: search, mode, category, radius, price, email verification, saved items, sorting and empty state.
3. Listing detail: photos, condition, owner, review count, distinct verification badges, price and pickup locality.
4. Booking: dates, item cost, refundable deposit, eligible alternative, total, cancellation/pickup terms and pending result.
5. Next phase: create/edit listing, profile and Trust Passport, request management, owner acceptance, messages, pickup/return evidence and disputes.

Do not mark an owner “safe” or “KYC verified.” Email control and reviewed student affiliation are separate evidence. Zero reviews must remain visible. A submitted request is not a reservation. A guarantor is proposed, not automatically approved. Never request an original identity document as collateral.

## Prompt 1 — establish the project

Copy into a new Stitch project:

> Design DormMart, a hyperlocal rent/buy/sell/share marketplace for students and neighbours. Design responsive web screens, not slides. Use only a vanilla HTML, CSS and JavaScript implementation target: no React, Tailwind, Bootstrap or component frameworks. Palette is warm beige #edece6, cobalt blue #1546d9 and orange #f98318 (our “sun yellow”). Use #202923 ink, #62665e secondary text and #fafaf5 card surfaces. Create an inviting editorial identity: big bold sans-serif headlines, slightly playful object imagery, restrained rounded cards, fine borders, spacious grids. Use cobalt for primary actions and orange for decorative emphasis with dark text. All screens must share the same navigation, design tokens, listing cards and form controls. INR pricing and local pickup. College affiliation is optional. Demo data must be clearly labelled. Provide desktop 1440 px and mobile 390 px screens. Include accessible focus, labels, contrast and touch targets. Avoid gradients, excessive glass effects, exaggerated trust claims and invented live statistics.

## Prompt 2 — Home

> Using the established DormMart design system, design the homepage. Header: DormMart logo, Home, Explore, How it works, Saved count, and List an item. Hero headline: “Big plans. Small budgets. Good neighbours.” Put the final line in cobalt. Supporting text: “Rent it for the weekend. Buy it for the semester. Share it with someone around the corner.” Search field and “Find it nearby” CTA. Show Presidency University neighbourhood as a demo locality. Right side: playful overlapping camera and chair cards, soft green and peach surfaces, orange starburst and a blue circular badge; keep it composed and readable. Below: cobalt strip reading “Rent a little. Save a lot. Keep it local. Pass it on.” Category chips; four nearby cards for camera rental ₹250/day, used chair ₹1,200, cycle rental ₹80/day, free book sharing. Each card includes category, distance, condition on detail, save button, owner and specific email badge plus review count. Finish with three clear steps and a quiet footer. On mobile, stack the hero, preserve search width, use two-column cards and a wrapping header. Do not introduce new brand colours or fake live metrics.

## Prompt 3 — Explore

> Derive the Explore screen from the approved homepage; reuse its exact components and tokens. Heading: “Find your next good thing.” Desktop: full-width search row with sort control, 220 px sidebar, three-column listing grid. Sidebar controls: Rent/Buy/Share, category, 1–10 km radius, maximum price with daily-rental versus total-purchase helper, email-verified owners checkbox, saved-items checkbox and reset. Label distances illustrative in the demo. Show count, local pickup and INR above cards. Sort options nearest, price low to high, newest. Include result-rich, no-results and saved-empty variants. Mobile: search above compact two-column filter panel; no tiny sidebar or horizontal overflow. Preserve visible labels and keyboard focus. Cards open detail; hearts toggle save independently. Use illustrative data, not a map implying precise coordinates.

## Prompt 4 — Detail and booking states

> Reuse the approved system to design an accessible listing detail and booking dialog, 580 px maximum on desktop and nearly full width on mobile, scrollable on small screens. Camera rental: ₹250/day, ₹1,500 refundable deposit; owner Aarav, email verified and student affiliation reviewed as distinct sample badges, 4.8 from 12 demo reviews. Show item condition and approximate pickup area. Dates must be future pickup and return after pickup. Show rental fee, refundable security and total separately. Eligible listings offer “Request a guarantor instead — owner approval needed”; explain that the waiver is conditional. Include invalid date feedback, consent checkbox, pending-owner-acceptance confirmation and close/focus states. No payment collected in this prototype; submitting must never say confirmed or reserved. Design equivalent purchase-interest and free-borrow variants with appropriate cost and date fields.

## Review before exporting

Keep one approved desktop and mobile version per screen. Check alignment, content density, text wrapping, filter semantics, empty states, focus states and visible cost explanations. Reuse components rather than accepting independently generated variations. Record intentional changes in this document before implementation.
