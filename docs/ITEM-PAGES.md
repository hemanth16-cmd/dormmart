# Quick previews and full item pages

Hover over a marketplace card with a mouse to open a quick preview after a short delay. The preview shows a representative/uploaded photo, price, condition, availability, description and owner, with a View full details link. Move into the preview to use the link, move away to dismiss it, or press Escape. Saving an item remains a separate action.

Click a card or its preview link to open a full item page at #item-ID. The page includes a large photo area, price, condition, description, trust information, owner messaging and the existing booking form. Back navigation returns to the originating view; reloading a detail link is supported. Missing/deleted items have a clear empty state.

Touch devices go directly to the detail page without a hover preview. Both themes and reduced-motion preferences are supported. Booking confirmations and listing editors still use dialogs.

Validated: hover/Escape/reopen, full-page reload and navigation, bookings, messaging/back links, missing item, 320–1440px layouts, mobile taps, profile editing/deletion, listing creation and date checks. Existing UI tests were updated to expect pages instead of item dialogs.

Local only. No commit, push or deployment.
