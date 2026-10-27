# Campus edition

The visual system uses warm beige #edece6, cobalt #1546d9, orange #f98318, sage #dce4d7, ivory #faf9f5 and charcoal #202923, with adapted dark surfaces and readable blue text.

## Interface
- Cobalt/sage split hero with existing pointer parallax and layered artwork.
- Curated collections, three new catalogue highlights, and a campus wishlist feature section.
- Refined Explore filters, profile surfaces, request cards, and five-destination mobile navigation.
- Reduced motion follows device preference and the existing motion toggle.

## Catalogue
20 distinct demo item types with 20 distinct bundled photos. Nine original listings remain. Eleven new items replace repetitive fixtures: laptop, keyboard, mouse, speaker, backpack, watch, shoes, mug, plant, sunglasses and desktop computer.
New fixtures use IDs 21–31 so old demo booking IDs are never reassigned to unrelated products. Historical demo links to removed fixtures 10–19 show the existing missing-item page. User-created listings and photos are unchanged.
The tent remains outside the default 5 km radius; increase the radius to see all 20 items.
Photos are representative samples, not verified condition evidence. Source URLs are recorded separately.

## Request board
Open Requests in navigation, the homepage wishlist link, or Item request board in Profile.
Post a rent/buy/free-borrow request with a category, budget, needed-by date, public pickup area and details. My requests supports editing, marking found, reopening and confirmed deletion. Search and Open/My filters help browse the board.
Offer an available owned listing to a seeded demo request, attach a note, and update that offer later. Dates must still be checked on the listing. Requests and offers persist in localStorage under dormmart-wanted-v1. Storage failure leaves the prior state intact.
This is a browser-local demo. There are no notifications, real recipients, remote database or live multi-user request matching. Production requires authenticated ownership and server-side validation.

## Validation
Run node --test tests/domain.test.cjs tests/rental-dates.test.cjs.
Browser tests accept a Playwright module path argument and DORMMART_URL for the preview URL. tests/campus.cjs checks request CRUD, offers, storage persistence/failure, escaped text, the unique catalogue and responsive light/dark routes.
