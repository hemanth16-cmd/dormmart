# Listing management

Open Demo account > My listings.

- Edit listing pre-fills the existing details and photos. Save updates the same listing ID; closing cancels unsaved edits. Selecting new photos adds to the existing set, up to three total. Remove individual photos or choose Make cover to move a photo first. At least one photo is required. Changes apply only when saved.
- Availability offers Available / Sold for sales and Available / Rented out for rentals. Free sharing uses On loan.
- Unavailable listings remain visible with their status and disable new request submission. Switching back to Available enables requests again.
- Changing a listing's sale/rental mode resets its status to Available. Existing listings without a status default to Available.
- Updates persist in this browser only. Failed storage writes preserve the prior saved state. Status changes do not complete, cancel or otherwise modify existing requests.

Tests: listing-edit.cjs and listing-status.cjs use Playwright with installed Microsoft Edge, a local server at port 4176, and an optional Playwright module path argument. Domain tests remain framework-free: node --test tests/domain.test.cjs.

