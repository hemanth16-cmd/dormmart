# Sell / Rent listing flow (local update)

Click **List an item**, choose **Sell an item** or **Rent out an item**, then add item name, category, photos, condition notes, public locality, pickup address, city and six-digit PIN. The existing free-share option is retained.

Sales use a one-time price. Rentals use a daily price, refundable deposit and the existing guarantor option. Hidden rental fields are disabled for sale/share listings. Going back to change mode keeps the draft and photos.

The public item detail shows locality only. The pickup address is saved in browser storage and shown in My listings. This is demo-only separation, not secure server-side privacy. No information is sent to other users. Existing listings without the new address fields still work.

Verification: browser checks for all three modes, back-navigation draft preservation, price/deposit visibility, PIN validation, uploaded photos, reload persistence, address separation and deletion. Seven existing domain tests passed.

New test: `node tests/listing-flow.cjs` with Playwright and Microsoft Edge installed, serving dist on port 4175 (or set DORMMART_URL). The frontend itself has no dependencies.

Changes are local only; no GitHub push or hosted deployment was performed.
