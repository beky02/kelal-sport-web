# F3b — plan

## Understanding

Today "Book bet" shows a code hashed in the browser, and the "Load booking code" field does nothing.
F3b makes both real through the contract: booking a slip calls `POST /v1/bookings` and shows the code,
its expiry and a share link; loading a code calls `GET /v1/bookings/{code}`, which re-prices every
leg, and replaces the slip with the legs that can still be backed. Legs that can't (match started,
market closed…) are reported, not added. The shared link `/b/{code}` (FD3, C18 §4.1) is a
server-rendered page showing the booking, with Open Graph tags so Telegram shows a preview, and a button
that loads it into the slip. Expired (410) and unknown (404) codes say so in both languages.

## Spec conflicts and decisions

| #   | Conflict / gap                                                                                                                                                                                                   | Decision                                                                                                                                                                                                                                | Why                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CLAUDE.md and the task: booking POSTs send an `Idempotency-Key`. The contract requires it for money, bets and tickets (info section), and `createBooking` does not declare it                                    | Send it anyway: one key per intent (slip contents), reused on retry. Contract request [005](../../contract-requests/005-booking-idempotency.md) declares it (optional) on `createBooking`                                               | Harmless extra header; satisfies CLAUDE.md without inventing a shape. Whether the backend honours it is the contract owner's call |
| 2   | C09 / BKG-03 rate-limit bookings per device and IP (gateway per IP, td-00). Behind our route handlers (D3) every player shares our server's IP, and the contract has no way to forward the player's IP or device | Don't invent a header. Record as a gap; contract request [004](../../contract-requests/004-client-ip-forwarding.md) proposes `X-Client-IP` / `X-Client-Device`                                                                          | A local workaround would be a made-up contract                                                                                    |
| 3   | The contract's `404` example uses code `NOT_FOUND`; C09 and `ErrorCode` have `BOOKING_NOT_FOUND`                                                                                                                 | Treat both as "no booking with that code"                                                                                                                                                                                               | Prism serves the generic example                                                                                                  |
| 4   | `PricedLeg` carries `odds` (now) and `odds_at_code`                                                                                                                                                              | A loaded selection starts at `odds_at_code` and is priced at `odds`, so the slip's existing accept-changes flow shows any move (2.05 → 2.10 ▲). The direction comes from comparing the strings, not from `changed`                      | One source for "moved"; the player sees what changed since the code was shared                                                    |
| 5   | Unavailable legs (`available: false`, or no valid `odds`)                                                                                                                                                        | Not added; listed in a notice in the slip with the reason (`EVENT_STARTED`, `MARKET_SUSPENDED`, `MARKET_CLOSED`, `NOT_FOUND`, or "no longer available")                                                                                 | Task scope; BKG-02                                                                                                                |
| 6   | Loading into a slip that already has picks                                                                                                                                                                       | A booking is a whole slip, so loading **replaces** it. The `/b` page says so when the slip isn't empty                                                                                                                                  | Merging could create same-match conflicts and mix bet types                                                                       |
| 7   | `system_sizes` may hold several sizes (e.g. a Trixie made in the app); the slip has one system size                                                                                                              | Load with the first size and show a notice naming the sizes                                                                                                                                                                             | Honest about the difference; multi-size systems are out of scope                                                                  |
| 8   | `stake_hint`                                                                                                                                                                                                     | Sets the total stake when present; otherwise the slip keeps its stake                                                                                                                                                                   | Task scope                                                                                                                        |
| 9   | Language for Telegram previews: the URL has no language until F2a, and the server renders `lang="en"`                                                                                                            | OG title/description in the tenant's `default_language` (from `/v1/config/public`)                                                                                                                                                      | FD2: tenant default language                                                                                                      |
| 10  | FD3: unprefixed `/b/{code}` redirects to `/{lang}/b/{code}` — F2a hasn't built `/{lang}` yet                                                                                                                     | `/b/[code]` renders the page itself; F2a turns it into the redirect                                                                                                                                                                     | FD3 records `/b` for F3                                                                                                           |
| 11  | Typed or linked codes in lowercase, or with ambiguous letters                                                                                                                                                    | Normalise with Crockford's rule (uppercase; drop spaces/hyphens; O→0, I/L→1), check against the contract's pattern `^[0-9A-HJKMNP-TV-Z]{7}$`; redirect `/b/7kq2m9x` to the canonical path; reject anything else without calling the API | The contract's alphabet is Crockford base32, which defines that mapping                                                           |
| 12  | App Router pages can't answer 410                                                                                                                                                                                | Expired → 200 page with expired copy; unknown → `notFound()` (404) with booking copy via `app/b/[code]/not-found.tsx`                                                                                                                   | Framework limit                                                                                                                   |
| 13  | Next 16 streams metadata into `<body>` except for "HTML-limited bots". `TelegramBot` isn't on its list; Telegram's UA ("TelegramBot (like TwitterBot)") only matches via `Twitterbot`                            | Keep the default; an e2e test fetches `/b/7KQ2M9X` with Telegram's UA and asserts the OG tags are in `<head>`                                                                                                                           | Guards the preview C18 is built for without overriding framework config                                                           |
| 14  | Task verification uses `curl -H 'Prefer: code=410' localhost:3000/api/bookings/…` but route handlers don't forward `Prefer`                                                                                      | Booking loaders forward `Prefer` to Prism **only when `NODE_ENV !== "production"`**, and only Prism's forms (`code=NNN`, `example=name`)                                                                                                | Lets the 404/410 states be tested end to end and screenshotted; never reaches production                                          |
| 15  | `PublicConfig.features.booking_codes` (open map; key may be absent)                                                                                                                                              | `false` hides Book/Load and 404s `/b/[code]`; absent = on                                                                                                                                                                               | Tenant config decides; core feature (BKG-01)                                                                                      |
| 16  | Who sees "Book bet": the design shows it to guests only; BKG-01 says "without login"                                                                                                                             | Keep the design (guests). Logged-in booking → product follow-up                                                                                                                                                                         | Don't add UI the design doesn't have                                                                                              |
| 17  | 429 carries `Retry-After`; our route handler drops headers                                                                                                                                                       | Copy says "try again later", no time promised; surfacing `Retry-After` → follow-up                                                                                                                                                      | Keeps shared plumbing out of this task                                                                                            |
| 18  | Static "Valid until first kickoff"                                                                                                                                                                               | Show `expires_at` in EAT, 24-hour, Gregorian (D7), with the clock/calendar preferences                                                                                                                                                  | The contract gives the real expiry                                                                                                |
| 19  | Share link                                                                                                                                                                                                       | Use the API's `share_url` (validated http/https) in the Telegram share link                                                                                                                                                             | D7: one link set across web and app; the backend knows the tenant's domain                                                        |
| 20  | `BookingCode` paints Telegram blue with a raw hex (AGENTS: a bug)                                                                                                                                                | Add a `telegram` colour token; use it here. The same hex in `BetPlacedConfirmation`/`BetTicket` → follow-up (F5 touches them)                                                                                                           | Stay in scope                                                                                                                     |
| 21  | A booking leg has `outcome_id` but no market type/line/code                                                                                                                                                      | Loaded selections get `marketType: "other"`, `line: null`, `outcomeCode: ""`. The board highlights them (keyed by outcome ID); Release 2 realtime frames can't address them → follow-up (frames should carry `outcome_id`)              | Contract first; realtime is off (D8)                                                                                              |
| 22  | `outcome_name` is whatever the API sends (the example says `"1"`, the board says "Arsenal")                                                                                                                      | Shown as sent, both languages fetched                                                                                                                                                                                                   | No local name resolution; noted as a gap                                                                                          |

## Design

**Contract → loader → mapper → route → api → hook → components**

- `src/lib/server/bookings.ts` (server only):
  - `loadBooking(tenant, code, prefer?)` → `GET /v1/bookings/{code}` in **both** languages (names come
    back in one language per request), merged by `toBooking`.
  - `createBooking(tenant, request, idempotencyKey)` → `POST /v1/bookings` with `BookingCreate`, sending
    `Idempotency-Key` (decision 1) → `toBookingReceipt`.
  - `prefer` forwarded only outside production (decision 14), through `upstream()`'s new optional
    `prefer` in `RequestContext`.
- `src/lib/api/mappers/bookings.ts` (pure): `toBooking(Bilingual<Booking>)`, `toBookingReceipt`,
  `toBookingCreate(BookingRequest)`. Legs are merged by `outcome_id`; a leg is available only when
  `available` is true **and** `odds` matches the contract's `Odds` pattern.
- `src/lib/api/mappers/config.ts`: `toPublicConfigView` adds `features.bookingCodes` (decision 15).
- Route handlers:
  - `GET /api/bookings/[code]`: normalise, check the code (decision 11), or 422 `VALIDATION_FAILED`
    Problem without calling the API; else `respond()` → `loadBooking`. 404/410 pass through unchanged.
  - `POST /api/bookings`: requires `Content-Type: application/json` (415) and an `Idempotency-Key`
    (400); validates the body with Zod (`bookingRequestSchema`, 422); answers 201 with the receipt.
    `respond()` gains an optional success `status`, and `problemResponse()` is exported.
- Domain types, `src/features/bookings/types.ts`:
  - `Booking { code, betType, systemSizes, stakeHint, expiresAt, legs: BookingLeg[] }`.
  - `BookingLeg { outcomeId, eventId, eventName, marketId, marketName, outcomeName, startTime, odds, oddsAtCode, unavailable }`.
    The names are `Localized | null`. `unavailable` is one of the `PricedLeg` reasons, `UNPRICED`, or null.
  - `BookingReceipt { code, expiresAt, shareUrl }`.
  - `BookingRequest { betType, systemSizes, outcomeIds, stake }`.
  - Zod schemas in `lib/api/schemas.ts` with `satisfies z.ZodType<…>`.
- Browser side, `src/features/bookings/`:
  - `api/bookings.ts`: `getBooking(code)`, `createBooking(request, key)`. `apiClient.post` gains an
    optional `headers`.
  - `hooks/use-bookings.ts`:
    - `useLoadBooking()` is a `useMutation` around `queryClient.fetchQuery(bookingKeys.detail(code))`,
      so it is always fresh.
    - `useCreateBooking()` keeps `{ signature, key }` in a ref: the same slip contents reuse the key on
      retry, a changed slip gets a new one.
  - `lib/code.ts`: `normaliseBookingCode(raw)` (decision 11).
  - `lib/to-slip.ts` (pure): `slipFromBooking(booking)` returns
    `{ selections, mode, systemK, stake, notice: { code, unavailable[], sizes } }`.
  - `lib/request.ts` (pure): `bookingRequestFrom(selections, totals, stake, systemK)`. Live picks only;
    the stake is sent only when it is a valid amount.
- Slip store: `replaceSlip({ selections, mode, systemK, stake, notice })` replaces the contents and
  resets accepted moves. `bookingNotice` is shown in the slip until dismissed or the slip is cleared.
  `BetSlipTotals` exposes `betType` and `calculate.ts` exports `stakeToPrice` (needed for the request).
- Components:
  - `BookingCode`: the real code, the expiry in EAT, Copy code, and a Telegram share link to `share_url`.
  - `LoadBookingCode`: a form that normalises and validates the code before calling, with errors by code.
  - `BookingNotice` (new, in the slip): "Booking 7KQ2M9X is in your slip", the legs not added with
    their reasons, and the system-sizes note.
  - `BetSlip`: Book bet uses `useCreateBooking`; the hashed stand-in is deleted; the code panel shows
    only while the slip matches what was booked; Book is disabled with no live picks, with a same-match
    conflict, or with a leg/line/validation problem.
- `/b/[code]` page (`src/app/b/[code]/page.tsx`, server):
  - Tenant from the request headers (shared `tenantFromHeaders`).
  - `cache()`d `loadBooking` shared by the page and `generateMetadata`. 404 → `notFound()`; 410 →
    expired view; other failures → "couldn't load" view.
  - Renders `BookingView` (client) inside `SportsbookShell`: code, expiry, legs (match · market · pick
    · odds with the move since the code), unavailable legs with reasons, stake hint, and "Load into bet
    slip" (with the "replaces your N selections" note), which loads through `useLoadBooking` and opens
    the slip.
  - `generateMetadata`:
    - Title "Bet slip 7KQ2M9X", with the description listing the picks.
    - `openGraph` carries title, description, url and type `website`.
    - `robots: { index: false }`.
    - Written in the tenant's default language.
  - `not-found.tsx` holds the booking copy.
- Query keys: `bookingKeys = { all: ["bookings"], detail: (code) => [...all, code] }`.
- Errors handled (switch on `code`):

  | Code                                    | What the player sees                                                             |
  | --------------------------------------- | -------------------------------------------------------------------------------- |
  | `BOOKING_EXPIRED` (410)                 | "Code {code} has expired." plus "Ask for a new code or build the slip again."    |
  | `BOOKING_NOT_FOUND` / `NOT_FOUND` (404) | "No booking with code {code}. Check it and try again."                           |
  | `RATE_LIMITED` (429)                    | "Too many booking codes for now. Try again later."                               |
  | `VALIDATION_FAILED` (422) on create     | "This slip can't be booked as it is."                                            |
  | `VALIDATION_FAILED` (422) on load       | "A booking code is 7 letters and numbers, like 7KQ2M9X." (shown before any call) |
  | Anything else                           | "Couldn't reach the bookings service. Try again." with Retry                     |

- i18n keys: a new `booking.*` namespace in both languages (validUntil, shareText, loaded,
  notAddedTitle, reason.\*, sizesNote, loadIntoSlip, replacesSlip, stakeHint, page/expired/not-found
  copy, errors.\*, invalidCode, og.\*). `betSlip.validUntilKickoff` is removed and
  `betSlip.loadCodePlaceholder` becomes the contract example. Composed Amharic goes in
  `TRANSLATION-NOTES.md`.
- `routes.booking(code)` → `/b/{code}`.
- Feature flags: none from D8; the tenant flag `features.booking_codes` (decision 15).

## Files

| File                                                                                                                                                                                    | Why                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/lib/server/bookings.ts` (new)                                                                                                                                                      | Load (both languages) and create through the contract                 |
| `src/lib/server/upstream.ts`                                                                                                                                                            | Optional `prefer`, development only (decision 14)                     |
| `src/lib/server/respond.ts`                                                                                                                                                             | Optional success status; export `problemResponse`                     |
| `src/lib/server/config.ts`                                                                                                                                                              | `tenantFromHeaders(headers)`, shared by `respond()` and the page      |
| `src/lib/server/public-config.ts`                                                                                                                                                       | Return `features` in `PublicConfigView`                               |
| `src/lib/api/mappers/bookings.ts` (new)                                                                                                                                                 | Contract ↔ domain, pure                                               |
| `src/lib/api/mappers/config.ts`                                                                                                                                                         | `features.bookingCodes`                                               |
| `src/lib/api/schemas.ts`                                                                                                                                                                | Booking schemas; config `features`                                    |
| `src/lib/api/client.ts`                                                                                                                                                                 | Optional request headers (for `Idempotency-Key`)                      |
| `src/lib/query/keys.ts`                                                                                                                                                                 | `bookingKeys`                                                         |
| `src/app/api/bookings/route.ts` (new)                                                                                                                                                   | POST                                                                  |
| `src/app/api/bookings/[code]/route.ts` (new)                                                                                                                                            | GET                                                                   |
| `src/app/b/[code]/page.tsx`, `not-found.tsx` (new)                                                                                                                                      | Deep link page with OG metadata                                       |
| `src/features/bookings/{types.ts, api/bookings.ts, hooks/use-bookings.ts, lib/code.ts, lib/to-slip.ts, lib/request.ts, components/BookingView.tsx, components/BookingNotice.tsx}` (new) | The feature                                                           |
| `src/features/config/types.ts`                                                                                                                                                          | `features` on `PublicConfigView`                                      |
| `src/features/bet-slip/components/BookingCode.tsx`                                                                                                                                      | Real code, expiry, share; `LoadBookingCode` wired                     |
| `src/features/bet-slip/components/BetSlip.tsx`                                                                                                                                          | Book via the API; stand-in deleted; notice                            |
| `src/features/bet-slip/stores/bet-slip.store.ts`                                                                                                                                        | `replaceSlip`, `bookingNotice`                                        |
| `src/features/bet-slip/lib/calculate.ts`                                                                                                                                                | Expose `betType`; export `stakeToPrice`                               |
| `src/config/routes.ts`                                                                                                                                                                  | `booking(code)`                                                       |
| `src/app/globals.css`                                                                                                                                                                   | `--color-telegram` token                                              |
| `src/lib/i18n/messages/{en,am}.json`, `TRANSLATION-NOTES.md`                                                                                                                            | Strings                                                               |
| `tests/contract.ts`                                                                                                                                                                     | Examples for any method/status, resolving `components/responses` refs |
| `tests/unit/booking-mappers.test.ts`, `booking-code.test.ts`, `booking-slip.test.ts`, `booking-route.test.ts` (new)                                                                     | Units and route handlers on the contract's examples                   |
| `tests/component/BookingFlow.test.tsx` (new)                                                                                                                                            | Load and book in the slip                                             |
| `tests/unit/config-mappers.test.ts`                                                                                                                                                     | `features`                                                            |
| `tests/e2e/booking.spec.ts` (new), `tests/e2e/screens.spec.ts`                                                                                                                          | OG/head, 404/410, redirect; screens                                   |
| `docs/tasks/F3b*`, `docs/tasks/README.md`                                                                                                                                               | Status                                                                |

## Acceptance criteria → tests

| AC      | Test                                                                                                                                                                                                                          | How it proves it                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| AC-6    | `booking-mappers.test.ts` › "maps the contract's booking 7KQ2M9X in both languages"                                                                                                                                           | Contract example → domain legs                                                                                                 |
| AC-6    | `booking-slip.test.ts` › "puts 7KQ2M9X's open leg in the slip at today's 2.10, showing the move from the code's 2.05"                                                                                                         | `slipFromBooking` on the mapped example                                                                                        |
| AC-6    | `booking-slip.test.ts` › "reports the started match instead of adding it"                                                                                                                                                     | Unavailable leg → notice, not selection                                                                                        |
| AC-6    | `booking-route.test.ts` › "GET /api/bookings/7KQ2M9X returns the booking"; "passes a 410 BOOKING_EXPIRED through unchanged"                                                                                                   | Route handler with the contract's 200 and `Gone` examples                                                                      |
| AC-6    | `BookingFlow.test.tsx` › "loads booking 7KQ2M9X into the slip and reports the leg it could not add"                                                                                                                           | Type `7kq2m9x` → Load → slip has `oc_ac_1` at 2.10 (pending move from 2.05), stake 50, notice for Saint George v Fasil Kenema  |
| AC-6    | `BookingFlow.test.tsx` › "says the code has expired on a 410" / "says no booking has that code on a 404"                                                                                                                      | Visible copy, both codes                                                                                                       |
| AC-6    | `BookingFlow.test.tsx` › "switches the expired message to Amharic"                                                                                                                                                            | Both languages                                                                                                                 |
| AC-6    | `curl -H 'Prefer: code=410' localhost:3000/api/bookings/7KQ2M9X`                                                                                                                                                              | Task's verification command → 410 Problem                                                                                      |
| AC-8r   | `tests/e2e/booking.spec.ts` › "serves /b/7KQ2M9X with Open Graph tags in the head for Telegram's preview bot"                                                                                                                 | Real dev server + Prism; UA `TelegramBot (like TwitterBot)`; `og:title`, `og:description`, `og:url` inside `<head>`; `noindex` |
| AC-8r   | `booking.spec.ts` › "shows the expired page for a 410"; "answers 404 for an unknown code"; "redirects a lowercase code to the canonical path"                                                                                 | States of the deep link                                                                                                        |
| AC-8r   | `booking-code.test.ts` › "normalises with Crockford's rule and rejects anything else"                                                                                                                                         | Decision 11                                                                                                                    |
| Book    | `BookingFlow.test.tsx` › "books the slip and shows the real code with its expiry"; "reuses the Idempotency-Key when retrying the same slip, and makes a new one when the slip changes"; "says to try later when rate-limited" | Create flow, idempotency, 429                                                                                                  |
| Book    | `booking-route.test.ts` › "POST forwards the Idempotency-Key and the contract's body"; "POST without an Idempotency-Key or JSON is refused"                                                                                   | Route handler                                                                                                                  |
| Screens | `pnpm ui` › `booking`, `booking-loaded`, `booking-expired` (en/am, 375/1440)                                                                                                                                                  | Page, page → slip, expired                                                                                                     |

## Risks

- **Security**:
  - The POST route takes only JSON (415 otherwise), so a cross-site form can't post. Its body is
    Zod-validated and mapped field by field, never forwarded raw.
  - The code is validated before it reaches an upstream path.
  - `share_url` must be http(s) before it goes into a link.
  - `Prefer` is never forwarded in production.
  - No session exists yet; F4 adds the CSRF token (C18 §4.4).
  - The `/b` page is `noindex`.
- **Wrong prices**: loading always fetches fresh (no cached booking reused). Moves since the code show
  through the existing accept flow. Unavailable legs never enter the slip.
- **Money**: none computed here. The slip prices loaded legs with slipcalc as before, and the stake hint
  is a decimal string through `lib/money`.
- **Accessibility**:
  - Load is a real `<form>`; errors are `role="alert"` and the notice is `role="status"`.
  - Buttons are at least 44 px; the code is read out as text, not just the barcode.
- **Performance**: a load is two upstream calls (en + am), with the page and its metadata deduped by
  `cache()`. Nothing is added to the first load of other pages.
- **Telegram previews**: guarded by the e2e test (decision 13).

## Out of scope

- Retail slip codes (F8/F9) and sharing a placed bet (`source_bet_id`, F5).
- Booking for logged-in players (decision 16) and `Retry-After` timing (decision 17).
- Multi-size system picking (decision 7) and the `/{lang}` redirect (F2a).
- Forwarding the client IP/device (decision 2, contract request).
- QR codes and a machine-readable barcode (the `Barcode` is artwork until agent shops scan).

## Sub-tasks

None. About 1,300 lines of code plus about 700 of tests, all in one area (bookings). Splitting the page
from the slip flow would leave the page unable to load a booking.

## Changes during implementation and verification

Built across this branch, PR #1 (server half) and PR #2 (the UI, from another session), then reviewed
on `task/F3b-verify`. Differences from the design above:

- **Decision 14 (Prism `Prefer`)**: forwarded only under `next dev` **and** only to the mock
  (`usesRealApi`), not merely outside production.
- **Bookings kept off the real API**: `API_REAL_TAGS` refuses `Bookings` until contract request 004 lands
  (`src/lib/server/config.ts`; F4 AC-7 carries the trusted-proxy part).
- **Idempotency key and code in the slip store** (`bookingIntent`), not a hook ref: the key is the
  player's intent and must survive the sheet closing; the code is dropped when the slip changes or the
  code expires. Not a cache of server data.
- **A code's lifetime is the server's**: the receipt carries the API's issue time (its `Date` header);
  expiry is that lifetime counted on the device from arrival, so a wrong phone clock (or a dated example)
  doesn't drop a fresh code.
- **Loading never empties a slip**: a code with nothing loadable leaves the slip alone and the notice says
  so (decision 6 refined).
- **Legs without `fixture_id` are not added** (`INCOMPLETE`): the slip couldn't check them for a
  same-match conflict.
- **`og:url` from the tenant's own host** (`publicOrigin`), forwarded headers parsed (first value), no OG
  card when booking codes are off or the address isn't canonical.
- **`POST /api/bookings`**: same-origin only (`Sec-Fetch-Site`) and a 16 KB body cap.
- **Accessibility**: Book and Load keep focus (`aria-disabled`), the new code takes focus as a status;
  "Booked" and "Open bet slip" states.
- **Shared component**: `StateMessage` gained link actions and an `h2` title; `both()` moved from
  `lib/server/catalogue.ts` to `lib/server/upstream.ts`.
- **Telegram colour**: `--color-telegram` is `#177ba8` (Telegram's blue a shade darker) so the white label
  passes 4.5:1.
