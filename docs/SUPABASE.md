# Supabase integration — draft, disabled by default

## Inspection and implementation plan

Inspected GitHub on 22 November 2026. `main` at `31ca00d67f35bf55f61eecb9b95b97598fe4832c` contains the latest frontend. `combined-frontend` at `7aa625bbffdd8133fa66ee437576f5f66abd6d01` is an ancestor (0 ahead, 12 behind); `local-prototype` also exists. The README's instruction to switch to `combined-frontend` was stale. This branch starts from `main`; no production branch or database was modified.

| Existing file | Before | Integration |
| --- | --- | --- |
| `dist/index.html` | Static shell | Same markup/styles, additional scripts |
| `dist/data.js`, `app.js` | Numeric sample IDs, local favourites/bookings | UUID routes and date sorting; live catalogue excludes fixtures |
| `dist/demo.js` | Fake login, browser-local listing/photo CRUD | Existing listing forms await Supabase writes in live mode |
| `dist/community.js` | Local profile/inbox, simulated replies | Existing profile/inbox renderers, real ownership and conversation IDs |
| `dist/item-page.js`, `studio.js` | Numeric detail/compare IDs | UUID support |
| `dist/wanted.js` | Local request board | Disabled with explanation in live mode; no corresponding backend table was provided |
| `dist/backend.js` | New | Explicit database mapping, uploads, transactional RPC calls, message retry IDs |
| `dist/live-ui.js` | New | Auth/session lifecycle, account isolation, inbox Realtime and polling fallback |

Plan: inspect → isolate changes → map existing forms → verify schema/RLS → reconcile the contract → test two accounts and preview → review PR. Inspection, implementation and local mocked tests are done. **Schema reconciliation and real-project tests are blocked pending the publishable key and schema/policy audit.** Table names alone do not establish column names, types, constraints or policy correctness.

## Do not enable yet

No publishable key was found in this checkout or relevant environment configuration. No key, database password or service-role credential is committed. No live Supabase call, migration, trigger change or policy change has been executed. The five reported tables, bucket, RLS and trigger exist according to the task context; their definitions have **not** been independently verified.

Run `supabase/audit.sql` in the existing project's SQL editor and provide all result sets. It reads schema/policy metadata only. Reconcile the mapping below with that output before executing any SQL proposal. Prefer adapting the client mapping to existing columns; do not blindly recreate tables or replace policies.

`supabase/proposed-functions.sql` is a **review proposal, not an automatic migration**. It requires the contract below and must be adjusted if the existing schema differs. The version function is a compatibility marker, not proof that RLS is correct. The build's `DORMMART_SCHEMA_VERIFIED` flag is a manual release gate, not an automated security audit.

## Expected contract (assumptions awaiting verification)

All primary keys are UUIDs. IDs and timestamps need database defaults where the client omits them. Dates are SQL `date`, money is numeric, textual fields are text or compatible constrained types.

| Table | Required columns |
| --- | --- |
| `profiles` | `id`, `full_name`, `university`, `bio` |
| `products` | `id`, `owner_id`, `title`, `description`, `category`, `mode`, `price`, `deposit`, `condition`, `area`, `status`, `available_from`, `available_until`, `blocked_from`, `blocked_until`, `created_at` |
| `product_images` | `product_id`, `storage_path`, `position` (0–2); any other required column must have a default |
| `conversations` | `id`, nullable `product_id`, `buyer_id`, `seller_id`, `created_at` |
| `messages` | `id`, `conversation_id`, `sender_id`, `content`, `created_at` |

Required constraints: product `mode` in `buy/rent/share`, status in `available/sold/rented`, nonnegative price/deposit up to 1,000,000, appropriate zero price/deposit for share/non-rent, lengths matching the form, valid availability/blocked date pairs. Apply equivalent constraints to direct REST writes as well as RPCs. Message content must be nonblank and ≤1000 characters. Profiles have name/campus/bio limits of 60/100/300. Conversation buyer and seller must differ; unique `(product_id,buyer_id,seller_id)`. Product image position is unique per product. Image paths must belong to the product's owner.

Required foreign keys: profile ID → auth user; product owner → profile; images → product **ON DELETE CASCADE**; conversation product → product **ON DELETE SET NULL** (preserve conversation history); conversation participants and message sender → profiles; message conversation → conversation. Do not accept a cascade that destroys buyer/seller messages when an item is deleted. Confirm existing enum literals and ID types before using the proposal.

The existing auth trigger must create one profile per new auth user. The app updates this row; it never inserts a second profile or modifies the trigger. Profile fields used here are public marketplace data; do not expose email/private columns through broad SELECT grants.

## Policy checks required before release

Verify effective grants and **all** permissive policies, not just whether RLS is enabled. A second broad policy can defeat a restrictive one. The frontend ownership checks are usability checks, not the security boundary. All proposed functions are `SECURITY INVOKER` with an empty search path.

| Resource | Required enforcement |
| --- | --- |
| Profiles | Authenticated reads of public profile fields; UPDATE only own ID; no editable verification/privilege fields |
| Products | Authenticated catalogue read; INSERT owner=`auth.uid()`; UPDATE/DELETE old and new owner must remain current user |
| Product images | Read with visible product; write/delete only for an owned product and an owned storage path |
| Conversations | SELECT only buyer or seller; INSERT buyer=`auth.uid()`, seller equals product owner, buyer differs from seller; no direct participant changes |
| Messages | SELECT only conversation participants; INSERT sender=`auth.uid()` and current user is participant; no arbitrary edits/deletes |
| Storage objects | Bucket `product-images`; write only under `auth.uid()/product-uuid/random-uuid.jpg`; prevent overwrites and deletion of referenced images; permit owner metadata reads for transaction validation |
| RPCs | Execute granted only to authenticated users; no security-definer bypass |

This adapter expects **public listing images**, using `getPublicUrl`. Confirm the existing bucket is public and that publication matches the intended product behavior. If it is private, adapt to signed URLs and renewal rather than silently making the bucket public. Enforce MIME `image/jpeg` and file-size limits on the bucket. Client compression accepts JPG/PNG/WebP ≤8 MB, outputs JPEG, and removes original metadata; private pickup addresses never enter product payloads.

Confirm `messages` and `conversations` are in the Realtime publication and that subscriber reads respect RLS. The inbox refreshes on reconnect/focus/online and every 15 seconds while visible, with generation/sequence guards against stale results. Realtime is an invalidation signal; rendered messages are re-read through RLS. Queries paginate in batches of 200, capped at 20,000; larger deployments need server-side catalogue filters and per-conversation message pagination.

## Configure a preview after verification

Run `npm ci`. Build dependencies and SDK versions are pinned in the lockfile. Keep Node 22 or newer available. Configure these environment variables in the **preview** hosting environment or local shell, not source files:

```text
DORMMART_BACKEND=supabase
SUPABASE_URL=https://flwrsjhldghbullanaqz.supabase.co
SUPABASE_PUBLISHABLE_KEY=<sb_publishable_... from project settings>
DORMMART_SCHEMA_VERIFIED=true
```

Run `npm run build`; serve `dist/`. For Vercel configure build command `npm run build` and output directory `dist`. The build bundles the SDK locally into ignored `dist/vendor/` and generates public `dist/backend-config.js`. Secret keys and legacy JWT keys are rejected; only the exact configured project URL is accepted. Do not commit generated preview config: restore `DORMMART_BACKEND=demo` and rebuild before committing. No environment variable other than the explicit public allowlist is serialized.

Without opt-in environment variables, `npm run build` produces demo mode. A broken live connection/configuration fails closed with sign-in disabled or an account-load error; it never silently grants a demo session. SDK sessions use a separate `dormmart-supabase-auth` storage key; demo profile/listing/message stores are not imported. Signout clears rendered private state and subscriptions. Favourites and comparison in live mode are memory-only, cleared on account change.

Set the Supabase Auth site URL and permitted redirect URLs for the preview origin/path. Sign-up uses email/password and shows a confirmation message when no session is returned. Sign-in, session restoration/refresh and local-device signout are supported. Password recovery is not included in this PR. Never use real credentials on the unchanged demo sign-in screen.

## Data integrity and cleanup

Listing metadata and image positions commit in one database transaction. Each form has a stable UUID so retrying an uncertain create cannot create duplicate products. A server timeout may occur after a successful commit: the client preserves the form and tells the user to check their listings. Uploads use unique paths and never overwrite existing files. Retired or failed uploads are **not immediately deleted**, because doing so can remove a file referenced by a committed transaction or another editor. Before sustained public use, implement an owner/admin cleanup job with a grace period that verifies no `product_images` row references a candidate path immediately before deletion. No cleanup job or secret-bearing server code is included here.

Messages have stable client UUIDs for safe same-draft retries; a duplicate ID is accepted only after verifying the stored sender, conversation and content. Drafts are preserved on failed delivery and incoming updates. Ownership derives from the authenticated user; badges and claimed distances are not taken from user-controlled fields. Rental dates remain owner-entered availability, not reservations. Bookings, payments, wishlist and guarantor workflows remain unavailable in live mode because their backend contracts are outside the five supplied tables.

## Validation

`npm test` runs domain/date and backend-boundary tests. `npm run test:backend` runs headless Microsoft Edge against a local server and a controlled SDK double: failed/successful sign-in, UUID details, publishing with photos, failed message retry, profile save errors, account switching, signout and mobile overflow. These tests **do not prove live Supabase/RLS behavior**. Existing browser suites continue to cover demo behavior; run them with a local `dist/` server and `DORMMART_URL`.

Before marking the PR ready, use two dedicated test accounts plus anonymous requests against a preview backend:

1. Sign up, confirm email, verify trigger-created profile, sign in, reload, refresh session and sign out. Check failed login and expired sessions.
2. Account A creates/edits/reorders/status-updates/deletes listings. B can view but cannot mutate A's product or images through direct REST/RPC/storage requests.
3. B starts a conversation on A's listing; A receives it and replies. Duplicate conversation starts converge. A third account and anonymous clients cannot read or write either participant's messages.
4. Attempt spoofed sender, owner, participant and storage-folder IDs, overlong messages, invalid dates/prices, forbidden columns, and non-image uploads. Verify database rejection, not merely hidden buttons.
5. Interrupt uploads and commit responses, retry messages, reload, switch accounts during pending requests and disconnect/reconnect Realtime. Check duplicate prevention and preserved drafts.
6. Verify product deletion preserves chat history, inspect storage cleanup candidates, and compare desktop/mobile layouts and both themes. Confirm preview config has no secret credentials.

References: [Supabase signup](https://supabase.com/docs/reference/javascript/auth-signup), [auth-state callbacks](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [storage access control](https://supabase.com/docs/guides/storage/security/access-control).
