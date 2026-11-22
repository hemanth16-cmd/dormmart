## Live-check repair (2026-11-23)

The user's live run returned 39/65, with listing creation failing because the RPC's
`owner` variable conflicts with Supabase's legacy `storage.objects.owner` column.
The minimal test fixture did not include that column. A regression now reproduces
that error and verifies the repair, retry safety and ownership protections.

Apply `supabase/004-fix-listing-owner-ambiguity.sql` in the SQL Editor after 003.
It replaces only the save function, keeps SECURITY INVOKER and existing policies,
changes no data, and preserves contract version 4. It is safe to rerun.
This repair is prepared locally, not yet confirmed applied live.

The live checker now accepts contract 4, rejects unexpected errors as proof of denial,
stops after essential setup failures, and uses the rental UUID directly. The original
missing-function errors omitted product parameters because creation had failed; they
do not by themselves prove that the booking functions are missing. Likewise, the photo
reported as referenced had no committed listing reference after the failed save.
Rerun the full live check after applying 004; messaging and bookings remain unverified.

## Three ways the app runs

| Mode | How to build | Data | Accounts |
| --- | --- | --- | --- |
| **Live, optional accounts (recommended)** | `npm run build` with `DORMMART_GUEST_MODE=false` | Live Supabase under RLS | Browsing is public. "Sign in" opens only for private actions. |
| **Accounts paused** | `npm run build` with `DORMMART_GUEST_MODE=true` | Live Supabase, **read-only** | None; sign-in is hidden |
| **Isolated demo** | `npm run build:demo` → `build-demo/` | This browser only (localStorage), demo inventory | Demo sign-in; nothing is sent anywhere |

**Optional accounts.** Visitors land on the marketplace without signing in. They can browse
listings, item pages, booked dates and estimates, saved items, comparison and the request
board. These actions open the existing sign-in panel instead:

- publishing a listing
- My profile
- messages and "Message owner"
- posting a request or making an offer
- requesting dates
- My bookings

The sign-in panel has a "Keep browsing without an account" link. Signing out returns to public
browsing and clears all private state. Signed-out visitors use the anonymous key, so RLS still
limits them to public rows.

**Accounts paused** uses a separate non-persisting anonymous client and never restores a saved
session. Owner names show as "Campus neighbour" because anonymous visitors cannot read profiles.

The demo build contains no Supabase URL, key or SDK, so it cannot reach the database. It is
labelled "Demo · no real transactions", and its booking, request-board and message flows say
they are local demos.

# Supabase integration

Status (2026-11-23): the user reports applying migrations 001, 002 and 003 in the
Supabase SQL Editor (contract version 4) and checking guest browsing and the request board.
The public tables and functions answer, and anonymous visitors are refused (checked live with
the public key). Authenticated live workflows have not yet been verified. Accounts are now
optional (see above).
Run `npm run check:live` with dedicated test accounts for live verification; mock browser
and local PostgreSQL tests do not establish production readiness.

## Authentication

### What the errors mean

Supabase checks the password before it checks email confirmation:

| Error | Meaning |
| --- | --- |
| `invalid_credentials` | Wrong password **or** no account with that email. It never means "unconfirmed". |
| `email_not_confirmed` | Password is correct; the email address is not confirmed yet. |
| `over_email_send_rate_limit` | The project's email quota is used up. No email was sent. |
| `email_address_not_authorized` | The built-in mailer will not send to this address (custom SMTP needed). |

Signing up again with an unconfirmed email does **not** change its password. It only sends
another confirmation email, which uses up the quota and makes older links stop working.
So a "Confirmation sent / not Confirmed" user that gets `invalid_credentials` was signed in
with a different password than the one used at signup.

### Flows in the app (live mode)

The existing sign-in panel is reused with the same styles:

- **Sign in.** Wrong-password and unconfirmed cases get different, accurate messages.
- **Create an account.** Shows a "check your email" step. Supabase hides whether an email
  is already registered; that case says no new account was created.
- **Resend confirmation** and **Forgot password?** Both use email only, with a 60-second
  per-address cooldown in the browser. Server rate-limit errors are explained.
- **Password reset link.** Opens a "New password" form. Private data stays hidden until the
  new password is saved. "Cancel and sign out" is available.
- **Expired or used email links** (`#error_code=otp_expired`) show a clear message, and the
  URL is cleaned.
- Buttons are disabled while a request runs, so a request cannot be sent twice. Raw server
  error text is never shown, only a known error code.
- The session is restored on reload. Signing out or switching accounts clears all private
  in-memory state and the realtime subscription.

### Dashboard settings to check (Authentication → URL Configuration)

- **Site URL:** `https://dormmart.vercel.app`. Supabase falls back to this when a redirect is
  not allowed, so a wrong value sends confirmation links to the wrong site.
- **Redirect URLs:** add `http://127.0.0.1:4173/**` (local preview) and
  `https://dormmart.vercel.app/**`. Add a Vercel preview pattern only if you test there.

### Email delivery

The built-in Supabase mailer is for development only. It allows very few emails per hour
and may only deliver to your project's team members, and its emails often land in spam. For
real students, configure **custom SMTP** (Authentication → Emails → SMTP Settings) with a
transactional provider such as Resend, Brevo, Postmark or Amazon SES. The provider needs a
verified sender domain. After that, raise the email rate limit under Authentication → Rate
Limits. Do not disable "Confirm email" to work around delivery.

To see why an email did not arrive, check Logs → Auth in the dashboard. Look for the
`/signup`, `/resend` or `/recover` request and any mailer error.

### Test accounts without email

Go to Authentication → Users → **Add user → Create new user**. Enter the email and a
password, and tick **Auto Confirm User**. Only that test user is confirmed; the project
setting is unchanged. The signup trigger still creates the profile row. Create three test
users: A (seller), B (buyer) and C (outsider).

## Database migrations

| File | Status | Purpose |
| --- | --- | --- |
| `001-align-existing-schema.sql` | Applied (contract 2) | Columns, constraints, policies and RPCs. Do not rerun. |
| `002-server-timestamps-and-upload-report.sql` | User-reported applied (contract 3) | Server timestamps, unreferenced-upload report. |
| `003-requests-offers-bookings.sql` | User-reported applied (contract 4) | Request board, offers, booking requests. |
| `proposed-functions.sql` | Retired | Do not run. |

**002** is additive and transactional, and it refuses to run unless the contract is 2:

1. Triggers set `created_at` on the server for messages, conversations, products and
   product images. Without them, a client could send a back-dated message or push its
   listing to the top of "newest" through the REST API. Existing rows are not touched.
2. `dormmart_unreferenced_uploads(grace)` is a read-only report of photo files that no
   listing references. It is callable only from the SQL Editor or the service role.
3. The contract version becomes 3.

To apply it: paste the whole file into a new SQL Editor query and run it once. The final
result should be `contract_version = 3`.

**003** is additive and transactional. It refuses to run unless the contract is 3, and it ends
with `contract_version = 4`. It only creates new objects; no existing row changes when it runs.

- **`item_requests`** (the public request board):
  - Anyone, including guests, can read requests that are not archived.
  - Signed-in users can create requests. Only the requester can edit, close, reopen or archive.
  - The server sets the requester, the initial status, timestamps and the archive time.
  - Archived requests cannot be edited or restored. There is no delete privilege.
- **`request_offers`**: a seller points one of their own active listings at an open request.
  - Only the offerer and the requester can see an offer.
  - One offer per request and listing; offering again updates it.
  - The requester follows up with the normal "Message owner" conversation.
- **`booking_requests`** (rental and free-borrow requests): no direct writes. Everything goes
  through two functions:
  - `dormmart_request_booking` checks the date window and blocked dates, limits rentals to 30
    days and sharing to 7, refuses your own listing, and allows at most 3 pending requests per
    item. Retrying with the same client id does not create a duplicate.
  - `dormmart_decide_booking`: the owner accepts or declines pending requests, the requester
    can cancel before pickup, and the owner marks a booking completed from the pickup day.
  - Accepting locks the listing row. An **exclusion constraint** makes two overlapping
    accepted bookings impossible, even when accepts happen at the same time.
- **`dormmart_booked_ranges(listing)`**: public accepted date ranges, with no identities.
- Archiving a listing declines its pending requests ("Listing removed by owner") and withdraws
  any offers of that listing. Accepted and past bookings stay as history.
- **Money:** a booking stores the daily price, the listing's deposit and `days × price` as an
  **estimate** only. Nothing is charged, held or refunded; the deposit is agreed in person.
- The file installs the `btree_gist` extension into the `extensions` schema, which the
  exclusion constraint needs.

## Photos and abandoned uploads

- Photos are compressed to JPEG in the browser and must be 5 MiB or smaller. The bucket
  also enforces 5 MiB and JPEG/PNG/WebP. Paths are `<user id>/<listing id>/<random>.jpg`,
  and storage policies only allow uploads into your own folder.
- Listing and photo rows are saved in one transaction (`dormmart_save_product`). Photo order
  is `position`, and position 0 is the cover.
- A file referenced by a listing cannot be deleted, even by its owner. Archived listings
  keep their photo rows, so their files are never "unreferenced".
- Files are uploaded before the transaction. If the save fails, or the connection drops
  after commit, a file may be left unreferenced. The app never deletes such files right
  away, because the save may in fact have committed.
- Cleanup (manual, after 002): run
  `select * from public.dormmart_unreferenced_uploads('7 days');` in the SQL Editor. Then
  delete only those files in Storage → product-images. Files younger than one hour are never
  listed.
- If an old image path is not in `<uuid>/...` format, the app hides that one photo instead
  of failing to load the catalogue.

## Build and preview

```powershell
npm ci
npm run build          # live; guest mode follows DORMMART_GUEST_MODE in .env.local
python -m http.server 4173 --bind 127.0.0.1 --directory build

npm run build:demo     # isolated demo
python -m http.server 4175 --bind 127.0.0.1 --directory build-demo
```

Open `http://127.0.0.1:4173`. The URL and publishable key come from the ignored `.env.local`.
Output goes to the ignored `build/`, and the tracked `dist/backend-config.js` stays in demo
mode. The build only accepts `sb_publishable_` keys. For Vercel, set the same four variables
in the project environment, plus `DORMMART_GUEST_MODE=true` while accounts are paused, with
build command `npm run build` and output directory `build`.

## Live verification

1. Create the three auto-confirmed test users (see above).
2. Create `.env.test.local` next to `package.json`. Git ignores it. It holds
   `DORMMART_TEST_A_EMAIL`, `DORMMART_TEST_A_PASSWORD`, and the same two for `B` and `C`.
3. Run `npm run check:live -- --sign-in-only` to diagnose sign-in for each account.
4. Run `npm run check:live -- --confirm-writes` for the full run, which takes about a minute.

The full run uses only the publishable key, so the same RLS applies as in the app. It covers:

- Profiles: trigger, persistence and cross-account edits.
- Uploads: own folder, other folder, more than 5 MiB, wrong MIME type, overwrite.
- Listings: sale, rent and share listings, reorder, status changes, invalid values, retry
  without duplicates.
- Attacks through the API by B on A's listing, images, archive and files.
- Conversations: reuse, self-chat and a forged seller.
- Messages: send, idempotent retry, realtime delivery, sender spoofing, blank text, history
  order.
- Isolation: the outsider C and anonymous visitors.
- Archive: history is preserved and new chats are blocked. Sign-out ends access.

After 003 is applied, the same run also covers:

- Bookings: idempotent requests, blocked dates, refusal of your own listing, privacy, refusal
  of direct writes, refusal of an overlapping accept, public date ranges, cancel and decline.
- Request board: guest reads, refusal of guest writes, refusal of edits by other users,
  private offers, and close/reopen/archive.

It writes test data only to the test accounts. Listings are archived at the end, and the
test conversation is kept.

## Behaviour and limits

- Mapping: `sale→buy`, `rent→rent`, `share→share`. Existing `both` listings show a
  sale-or-rent note and keep `both` when saved as Sell. Status: `active→available`,
  `reserved→rented`, `sold`, `inactive`.
- Removing a listing archives it (`deleted_at`, `inactive`). Conversations and messages
  remain.
- Messages: a stable client UUID makes retries safe. Realtime triggers a refresh. There is
  also a 15-second poll while the page is visible, plus a refresh on focus or when the
  connection returns.
- The catalogue loads all visible rows in pages of 200, with a cap of 20,000. A large
  deployment needs server-side filtering.
- Live listings have no distances, reviews or verification badges. Live and guest mode
  therefore hide the radius filter, "Nearest first", "Email verified owners" and review text.
- Saved items and the comparison tray are kept in this browser only, separately for the guest
  and for each account. The UI says "Saved on this browser".
- The catalogue, shared item links and the request board show loading, empty and error
  states, with a retry button on errors.
- Only the requester can start a conversation about a listing (existing conversation rules).
  Owners reply in Messages once the requester has written.
- Until 003 is applied, the request-board check returns a 404, which shows as one line in
  the browser console.

## Still not implemented (needs separate approval)

- Payments, deposits collected through DormMart, refunds and guarantor verification. The
  guarantor option is hidden in live mode; the demo keeps it labelled as a demo.
- Notifications (email or push) for new booking requests and offers. For now, owners see
  them in My bookings and on the request board.
- Owner-initiated conversations with requesters. This would need a conversation-policy
  change.

## Test evidence

- `npm test`: domain rules, auth error mapping, payload allowlists, error mapping and the
  config guard. It also runs PGlite (real PostgreSQL) tests of 001, 002 and 003 against the
  reported schema and policies, including hostile callers and the overlap exclusion constraint.
- `npm run test:browser`: headless Edge with a mock SDK. It covers live auth, guest mode and
  the workflow screens (read-only guest access, signed-in bookings and request board, and demo
  isolation).
- The older demo browser tests (the other `tests/*.cjs` files) run against a static server of
  `dist/` on port 4174. `DORMMART_URL` overrides the address.
- `npm run test:backend`: headless Edge with a **mock SDK**. It covers the auth flows
  (wrong password, unconfirmed, resend cooldown, email limit, existing email, expired link,
  password recovery), listing, messaging retry, account switching and mobile layout. It
  shows UI behaviour only, not live Supabase behaviour.
- Verified live (read-only, no account): guest mode loads the real, empty catalogue, makes
  only public reads, stores no auth session, and shows the "being set up" board before 003.
- User reports applying 002 and 003 and successfully checking guest browsing after rebuilding.
- Not yet verified live: authenticated workflows in `check:live` (need test accounts),
  real email delivery, and redirect URLs.
