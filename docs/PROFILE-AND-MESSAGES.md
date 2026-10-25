# My profile and demo messages

Choose **My profile** in the header to view your own listings. The page includes editable display name, campus/locality and bio, counts and filters for Rent / Sale / Sharing, plus booking-request and message shortcuts.

Each owned listing shows its photo, price, condition, locality, dates and status. Use **Edit item** to update it or **Delete item** to open the confirmation dialog. **My pickup address** expands private demo pickup details on this page only. Listings created on another browser, port or origin are not available here because storage is local.

To start a conversation, open another owner's item in Explore and choose **Message [owner]**. The **Messages** navigation link opens the inbox. Messages are saved locally per listing; **Simulate reply** explicitly generates a sample owner response. No message is transmitted and no real owner is contacted. Real messaging requires a backend and real accounts.

Sign-in contact details/passwords remain unsaved. Profile fields are separate, optional, and stored only on this browser. All demo sessions in the same browser share the same local profile and listings.

Responsive layouts, reduced-motion support, escaped text, storage failure handling, profile navigation and deletion are covered by the browser checks in tests/profile-messages.cjs and the existing listing tests. Run with Playwright installed; set DORMMART_URL to the local preview address.

This update is local only; no commit, push or deployment was performed.
