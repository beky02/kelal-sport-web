# F5b — plan

My bets and the ticket detail from the contract with cursor paging; the public ticket check
`/t/[ticket]`. The reading half of F5 (see `F5/plan.md`, decision 1). Plan gate: approved 2026-10-03
(mode: interactive) — question 2: the public page shows `payout` for every status; question 3: the link
preview says the status and the matches, no amounts.

## Understanding

My bets, the ticket detail and the aside's open-bet count still read the in-repo mock repository, and
every figure on a ticket is recomputed with slipcalc and today's rule set (`features/bets/lib/figures.ts`)
— numbers the engine never decided. F5b puts them on the contract: `GET /api/bets?status=&cursor=` and
`GET /api/bets/[id]` route handlers on the F4 session call `GET /v1/bets` and `GET /v1/bets/{id}` in both
languages, the domain `Bet` becomes the contract's `Bet`, and the screens show the API's own stake, stake
tax, accumulator bonus, winnings tax, potential payout and payout, with Open / Settled tabs (the
contract's filter) paged by `next_cursor` behind Show more. Anyone can check a ticket number at
`/t/[ticket]`: a server-rendered page on `GET /v1/tickets/{ticket_id}` that works without JavaScript,
redirects a typed number to its canonical `XXXX-XXXX-C` path, answers 404 in the ticket's own words, and
puts Open Graph tags in `<head>` for Telegram — and Share on Telegram, on the ticket and on the placed
confirmation, links to it. The bet mocks go; cash out stays behind its Release 2 flag with no quote.

## Spec conflicts and decisions

| #   | Question                                                                                                                                                                                           | Decision and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | docs/design/04 says a ticket shows `rules_version`; the contract's `Bet` has none.                                                                                                                 | Contract wins: not shown. Nothing is recomputed, so no rule version is needed (contract request 007 item 1 already asks for it).                                                                                                                                                                                                                                                                                                                                                                                              |
| 2   | docs/design/01: "Tabs Open / Settled with counts". `GET /v1/bets` is cursor-paged and carries no totals.                                                                                           | Tabs without counts (007 item 6, which says so for "until it lands"). The aside's My bets count is the task's: the length of the first page of `status=open`, shown as `20+` when that page has a `next_cursor` — a number, not a guessed total.                                                                                                                                                                                                                                                                              |
| 3   | Today: four tabs (Open, Settled, Won, Lost). The contract filters `open` / `settled` only.                                                                                                         | Two tabs. Won/Lost would mean filtering a page in the browser, which breaks paging (a page of 20 could show none).                                                                                                                                                                                                                                                                                                                                                                                                            |
| 4   | Names in both languages: `GET /v1/bets` and `/v1/bets/{id}` declare no `Accept-Language`, but `BetLeg.market_name` is "resolved in the request language" and the upstream client always sends one. | As the catalogue and bookings do (`both()`, frontend-patterns): each read is made in `en` and `am` and merged — bets by `id`, legs by `outcome_id`. Figures and the cursor come from the English read. A bet missing from the Amharic page (placed between the two reads) keeps its English names in both. Two upstream calls per read; FD2's one-language loaders halve it later.                                                                                                                                            |
| 5   | Payout labels. `payout` / `potential_payout` are not described (007 item 2).                                                                                                                       | As F5a (its decision 2): "Potential payout" for an open bet (`potential_payout`), "Payout" once settled (`payout`), "Cashed out" for `cashed_out`. "Net payout" goes — the contract doesn't say net. A settled bet without a `payout` shows "—", never a made-up 0.00. The card's tax line on a won bet ("Tax withheld: … winnings · … stake") uses the API's `win_tax` and `stake_tax`, only when `win_tax` is given.                                                                                                        |
| 6   | The ticket detail's breakdown today: total odds, stake, stake tax, net stake, potential win (gross), bonus, payout taxes, refund — all slipcalc.                                                   | Only the API's figures, in D1's order: total odds (when given), stake, "From bonus balance" (`stake_bonus`, when above zero), stake tax (−), accumulator bonus (+, when above zero), winnings tax (−, once settled: when `win_tax` is given), then potential payout / payout. Net stake, gross and the stake-tax refund go: the contract's `Bet` has none of them, and recomputing them is what AC-3 rules out.                                                                                                               |
| 7   | The LIVE badge on an open bet (`Bet.live`, mock-only).                                                                                                                                             | Goes, with `statusLive`: the contract has no in-play marker for a bet and Release 1 has no live betting (D8).                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 8   | Leg results: the mock had open/live/won/lost/void with free-text results; "Void · match postponed" claims a reason.                                                                                | The contract's six `LegResult`s, each in words beside its dot (never colour alone): Won, Lost, Void, Half won, Half lost; an open leg shows its kick-off (`start_time`, EAT, the player's calendar and clock). Void reads "Void · counted at odds 1.00" (D1.5) — the contract gives no reason. Half results are not explained (their effective odds are D1.5's, not copy).                                                                                                                                                    |
| 9   | Cash out: the panel reads `cashOutValue` / `cashOutBlocked`, which the contract's `Bet` doesn't have; there is no cash-out endpoint.                                                               | The task's "the panel stays behind its flag, with no quote to show": `CashOutPanel` takes a `quote` prop (amount, blocked) that is `null` — the contract has no quote — and renders nothing without one, so turning the flag on shows no false "markets suspended". Its remainder preview reads the contract's leg results. `useCashOut` / `cashOutBet` stay for Release 2 (which needs a contract endpoint first); unreachable without a quote.                                                                              |
| 10  | C18 §9: the ticket-check page is "a plain form (a Server Action with progressive enhancement)".                                                                                                    | A GET form instead — `next/form` with `action="/t"`, input `ticket`: a plain HTML form without JavaScript, a client navigation with it. `/t?ticket=…` redirects to the canonical `/t/{number}` or shows the form again with an error. The result is an address (shareable, Back works), and there is no POST endpoint or CSRF surface. The C18 requirement is "works without JavaScript"; the Server Action was a means.                                                                                                      |
| 11  | Ticket numbers: the contract's `TicketNo` checks the alphabet only; D3 adds a Luhn mod 32 check character over the Crockford alphabet.                                                             | Checked before any call: case, spaces and hyphens forgiven, O read as 0 and I/L as 1 (as booking codes, F3b), then 9 Crockford characters whose last is D3's check character. All three contract examples check (`K7Q2-M9XP-M`, `R7K2-M9XP-K`, `M3HX-7PQA-V`); unit-tested against them. Anything else is not a ticket number: `/t/{x}` answers 404 without repeating it; the form says what a number looks like and doesn't echo the text either (a crafted link could put "call this number to claim" on the brand's page). |
| 12  | The canonical path.                                                                                                                                                                                | `/t/XXXX-XXXX-C`, uppercase with hyphens. Any other spelling of a valid number redirects there (307, as `/b`). Next passes the segment undecoded (`/b/7kq2%20m9x` is a 404 today), so `/t` decodes it first: a number pasted with spaces into a link still redirects.                                                                                                                                                                                                                                                         |
| 13  | What the public page shows. `TicketCheck`: status (8), bet type, placed / settled, stake, `payout`, legs with odds and result; no owner, no potential payout, no system sizes.                     | Status as a badge in words, the ticket number as the heading, bet type, placed / settled times, every leg with its odds and result, stake, and `payout` labelled "Payout" whenever the API gives one ("Cashed out" for `cashed_out`), for every status (question 2, approved). No owner (the API sends none), no barcode (online tickets aren't scanned at shops), Check another ticket below.                                                                                                                                |
| 14  | Prism answers every ticket number with its one example (`K7Q2-M9XP-M`, won).                                                                                                                       | The page shows the API's `ticket_id` — the record, not the key asked for. So `/t/R7K2-M9XP-K` (AC-4) shows the example's number against Prism: a gap, not a bug. Screens use `/t/K7Q2-M9XP-M`.                                                                                                                                                                                                                                                                                                                                |
| 15  | Open Graph for `/t`.                                                                                                                                                                               | As `/b`: title "Ticket {number}" with the tenant's brand, `og:url` the canonical address, `noindex, nofollow`, in the tenant's default language (FD2). Description "{status} · {matches}" — no amounts in a link preview (question 3, approved). Unknown number: "No ticket with this number." A failure: a neutral title and no card, since preview bots cache their first answer. Without JavaScript the body renders in English (the UI store's default) until F2a puts the language in the URL — as `/b` does today.      |
| 16  | The failed state (API down, an unexpected answer).                                                                                                                                                 | "Couldn't check this ticket", Try again as a link to the same address (works without JavaScript), status 200 as `/b`. The loader checks the mapped answer with a Zod schema (`ticketCheckSchema`): it never passes through `apiClient`, and a malformed answer must be "failed", not a broken page. Only `NOT_FOUND` / `RETAIL_TICKET_NOT_FOUND` mean not found; a 404 without one of those codes is a failure (Prism's own errors are such 404s).                                                                            |
| 17  | Share on Telegram: on the old ticket screen a button that did nothing, with a raw hex colour; hidden on the placed confirmation since F5a (U6).                                                    | A link to Telegram's share sheet with `{origin}/t/{number}` and "Ticket {number}", on the My bets ticket and back on the confirmation, beside Copy. `origin` is `window.location.origin` — the tenant's own host; the components only render it in the browser. `telegramShareUrl` moves out of `BookingCode` into `lib/share.ts` for both. The `bg-telegram` token replaces the hex.                                                                                                                                         |
| 18  | Bet ids are opaque (D3), and go into an upstream path; cursors are opaque.                                                                                                                         | `/api/bets/[id]` sends only `[A-Za-z0-9_-]{1,64}` upstream (UUIDv7 and the contract's ULID-like examples fit); anything else answers 404 `NOT_FOUND` with nothing sent. A cursor goes through when it is printable ASCII up to 512 characters, else 422. `status` must be `open` or `settled` (422). Page size: the API's default (20), not sent.                                                                                                                                                                             |
| 19  | The GET routes' checks.                                                                                                                                                                            | A session for this tenant (401 `AUTH_TOKEN_EXPIRED` otherwise, as `POST /api/bets`); no origin / CSRF check on a read, as `/api/me` (the session cookie is `SameSite=Lax` and nothing answers CORS). A 401 reaches the query cache's existing handler, which re-reads `/api/me` (F4a's session-ended dialog).                                                                                                                                                                                                                 |
| 20  | Prism ignores `status`: both example bets come back under Open and under Settled.                                                                                                                  | The app shows what the API returns for each filter — re-filtering in the browser would be a local workaround for a mock. `pnpm ui` shapes the route's own answer by status for readable screens, as F3b's booking screen fixes Prism's fixed expiry. A gap in `verification.md`.                                                                                                                                                                                                                                              |
| 21  | My bets for a guest, and while `/api/me` is pending (docs/design/03).                                                                                                                              | Pending: skeletons, nothing fetched. Guest (a cookie the API no longer honours, or logged out in the open page): "Log in to see your bets" with Log in; the bets query only runs for a player (`enabled`), so a guest never calls `/api/bets` — today the aside asks for every visitor.                                                                                                                                                                                                                                       |
| 22  | The tab in the URL? AGENTS.md puts board filters there.                                                                                                                                            | Stays component state, as today: the same view is the aside on every page, which can't own the URL. Out of scope.                                                                                                                                                                                                                                                                                                                                                                                                             |

## Design

**Contract → loader → mapper → route → api → hook → components**

- `src/lib/server/bets.ts` (server only), beside `placeBet`:
  `loadMyBets(ctx, session, { status, cursor })` →
  `both(lang => withSession({ ...ctx, lang }, session, auth => upstream("Bets", { ...ctx, lang, authorization: auth }).GET("/v1/bets", { params: { query: { status, cursor } } })))`
  → `toBetPage(pair)`; `loadMyBet(ctx, session, id)` the same on `GET /v1/bets/{id}` → `toBet(pair)`.
  Concurrent refreshes already share one call (`refresh()`'s in-flight map) and a rotated cookie is
  remembered, so two reads never replay a refresh token.
- `src/lib/server/tickets.ts` (new, public, no session): `checkTicket(tenant, number, prefer?)` →
  `both(lang => unwrap(upstream("Bookings", { tenant, lang, prefer }).GET("/v1/tickets/{ticket_id}", …)))`
  → `toTicketCheck(pair)`; `lookupTicket(…)` → `{ status: "ok", ticket } | { status: "not_found" } |
{ status: "failed" }` (decision 16), the ticket checked by `ticketCheckSchema`.
- `src/lib/api/mappers/bets.ts`: `toBet(pair)`, `toBetPage(pair)` — figures untouched (strings), optional
  fields to `null` / `[]`, never to a made-up value; names merged as decision 4.
  `src/lib/api/mappers/tickets.ts` (new): `toTicketCheck(pair)`.
- `src/app/api/bets/route.ts`: `GET` beside `POST` — `status` and `cursor` checked (422) → session (401)
  → `respond(…)` → `{ items, nextCursor }`. `src/app/api/bets/[id]/route.ts` (new): `GET` — id checked
  (404 unsent) → session → `respond(…)` → `Bet`. Both forward Prism's `Prefer` under `next dev` only
  (`mockPreference`), as every other route.
- `src/lib/api/schemas.ts`: `betSchema` (the new domain `Bet`; ticket number by the contract's
  `TicketNo`, money and odds by their patterns, legs ≥ 1), `betPageSchema`, `ticketCheckSchema` — each
  `satisfies z.ZodType<…>`. `betListSchema` and the old `betSchema` go.
- `src/features/bets/api/get-bets.ts`: `getBets(status, cursor, signal)` →
  `apiClient.get("/bets", betPageSchema, { params: { status, cursor } })`; `getBet(id, signal)` →
  `/bets/{id}`, `null` on 404 (a ticket not on this account is a state, not a fault). The mock branches
  go; `getTransactions` stays on the mock (F6); `cashOutBet` loses its mock branch.
- `src/features/bets/hooks/use-bets.ts`: `useBets(status, enabled)` → `useInfiniteQuery` (key
  `betKeys.list(status)`, `initialPageParam: null`, `getNextPageParam: page => page.nextCursor`,
  `staleTime` 20 s as today); `useBet(id)` unchanged in shape. A refetch re-reads loaded pages in order
  from the first, so a page never mixes two snapshots of its cursor.
- Components:
  - `MyBetsView`: session-aware (decision 21); Open / Settled (`BetTabs`, two toggle buttons,
    `aria-pressed`); loading skeletons; error ("Couldn't load your bets", Try again → `refetch`); empty
    (per tab, Browse matches as a link); cards; Show more (44 px, `aria-busy` while loading, ignores a
    second tap) and a "Couldn't load more" alert with Try again. `RulesUnavailable` goes from My bets
    and the ticket: nothing on them is priced in the browser any more.
  - `BetCard`: status badge, the bet's kind (`betKindLabel`: Single, Singles · n bets, Multiple · n
    picks, System k/n · c bets — the slip's own labels, F5a), placed time, legs with result or kick-off,
    stake, total odds, `payoutView` (decision 5), the won-bet tax line.
  - `BetTicket`: back, status, kind, the ticket number (`ticketId`, not the API's `id`) with its Code
    128 barcode, placed / settled, every leg (market, pick, match, result or kick-off, odds taken), the
    rows of decision 6, the bottom line, Share on Telegram; states: loading, not found ("This ticket
    isn't on your account."), failed with Try again.
  - `BetStatusBadge` takes a status (the six `BetStatus`es and the ticket check's `paid`, `expired`), in
    words, tone by result; `label-caps` replaces the hard-coded `uppercase` / `tracking-*` (AGENTS.md).
    `LegDot` and a `LegResult` label take the contract's results.
  - `AsidePanel`: `useBets("open", signedIn)`; count = first page's length, `+` with a `next_cursor`.
  - `BetPlacedConfirmation`: Copy and Share on Telegram side by side (decision 17).
- `/t` — `src/features/tickets/` (new, mirrors `features/bookings`): `lib/number.ts`
  (`normaliseTicketNumber`, `checkCharacter` — Luhn mod 32), `lib/metadata.ts` (`ticketMetadata`, pure,
  as `bookingMetadata`), `types.ts`, components `TicketCheckView` (the result), `TicketCheckForm`
  (`next/form`, labelled input, error tied by `aria-describedby`), `TicketUnavailable` (not found /
  failed; actions are links), `TicketNotFound` (reads the path, repeats it only when it is a number).
  - `src/app/t/[ticket]/page.tsx`: decode → normalise → 404 / redirect → `lookup` (`cache()`, shared with
    `generateMetadata`, as `/b`) → `not_found` → `notFound()`; else the view, or failed. Wrapped in the
    shell like `/b`. `not-found.tsx` beside it: the ticket's own 404 with the form.
  - `src/app/t/page.tsx`: the form; `?ticket=` → redirect or the form with its error; metadata with the
    tenant's brand.
- `src/config/routes.ts`: `ticket(number)` → `/t/{number}`, `ticketCheck` → `/t` (D7, FD3: unprefixed
  until F2a). Not behind the proxy.
- `src/lib/share.ts` (new): `telegramShareUrl(url, text)`, `absoluteUrl(path)`.
- Mocks: `listBets`, `getBet`, `cashOut` and `BETS` go from `lib/api/mock`; `mock/bets.ts` becomes
  `mock/transactions.ts` (what is left is the wallet's, F6). `env.useMocks`' comment and the repository's
  header say so.

**Domain types**

- `features/bets/types`: `BetStatus` (`open | won | lost | void | cashed_out | cancelled`),
  `LegResult` (`open | win | lose | void | half_win | half_lose` — slipcalc's own), `BetType`;
  `BetLeg { outcomeId, fixtureId, match, market, pick: Localized; startTime; odds; result }`;
  `Bet { id, ticketId, status, betType, systemSizes, lines, stake, stakeBonus | null, stakeTax,
totalOdds | null, potentialPayout, accaBonus, payout | null, winTax | null, legs, placedAt,
settledAt | null }`; `BetPage { items, nextCursor }`; `BetsTab = "open" | "settled"`. Gone: `live`,
  `cashOutValue`, `cashOutBlocked`, `cashedOutAmount`, `BetCounts`, `displayStatus`.
- `features/bets` cash out: `CashOutQuote { amount, blocked }` (the panel's prop, decision 9).
- `features/tickets/types`: `TicketStatus` (`BetStatus | paid | expired`), `TicketCheck { ticketId,
status, betType, placedAt, settledAt | null, stake, payout | null, legs: { match, market, pick, odds,
result }[] }`, `TicketLookup`.

**Query keys**: `betKeys.list(status)` now holds an infinite query; `betKeys.detail(id)` as before. Still
dropped by `forgetPlayer` whenever the session changes hands, and invalidated after a ticket (F5a).

**Error codes → what the UI offers**

| Where               | Code / status                                         | Shown                                                                                   | Offered                     |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------- |
| My bets, ticket     | 401 `AUTH_TOKEN_EXPIRED` (session gone)               | `/api/me` re-read by the query cache → F4a's session-ended dialog; then the guest state | Log in                      |
| Ticket (My bets)    | 404 `NOT_FOUND`                                       | "Ticket not found — This ticket isn't on your account."                                 | Back to My bets             |
| My bets, ticket     | network, 5xx, `SERVICE_UNAVAILABLE`, unreadable reply | "Couldn't load your bets" / "Couldn't load this ticket"; a failed Show more inline      | Try again                   |
| `/api/bets` (route) | bad `status` / `cursor` → 422 `VALIDATION_FAILED`     | — (the app never sends one)                                                             | —                           |
| `/t/[ticket]`       | 404 `NOT_FOUND`, `RETAIL_TICKET_NOT_FOUND`            | 404 page: "No ticket with this number — Check number {number} and try again."           | Check another ticket (form) |
| `/t/[ticket]`       | not a ticket number (pattern or check character)      | 404 page: "Check the number and try again." (nothing repeated)                          | The form                    |
| `/t/[ticket]`       | anything else (5xx, unreachable, malformed answer)    | "Couldn't check this ticket — It couldn't be checked just now."                         | Try again (link), the form  |
| `/t?ticket=`        | not a ticket number                                   | The form with "A ticket number has 9 letters and numbers, like K7Q2-M9XP-M."            | Fix and check again         |

**i18n** (en + am; composed Amharic in `TRANSLATION-NOTES.md`): `bets.status.*` (open, won, lost,
void, cashed_out, cancelled, paid, expired), `bets.result.*` (win, lose, void, half_win, half_lose,
open), `bets.payout`, `bets.stakeBonus`, `bets.placedAt`, `bets.settledAt`, `bets.kickoff`,
`bets.showMore`, `bets.loadFailedTitle/Body`, `bets.moreFailed`, `bets.emptySettledTitle/Body`,
`bets.guestTitle/Body`, `bets.ticketFailedTitle/Body`, `bets.backToBets`; `ticket.*` (check page title
and body, number label and placeholder, Check, invalid, page title, not found title / body / body
without a number, failed title / body, check another, share text, `og.description`, `og.notFound`).
Changed: `bets.voidLeg` (no reason). Removed when unused: `bets.statusLive`, `netPayout`, `lostPayout`,
`tabWon`, `tabLost`, `netStake`, `potentialWin`, `win`, `stakeTaxRefund`, `single`, `multiple`, the old
`status*` keys. "Placed {date}" replaces "Placed" + concatenation.

**Feature flags**: none new. `features.cashOut` stays off; the panel has no quote.

## Files

| File                                                                                                                                                                                  | Why                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `docs/tasks/F5b-my-bets-ticket-check.md`, `README.md`; at the end `F5-place-bet-my-bets.md`                                                                                           | Status; F5 is done when F5a and F5b are                             |
| `docs/tasks/F5b/plan.md`, `verification.md`                                                                                                                                           | This plan; phase 3                                                  |
| `src/features/bets/types/index.ts`                                                                                                                                                    | The contract's `Bet`, `BetPage`, two tabs                           |
| `src/lib/api/mappers/bets.ts`; `src/lib/api/mappers/tickets.ts` (new)                                                                                                                 | `toBet`, `toBetPage`; `toTicketCheck`                               |
| `src/lib/api/schemas.ts`                                                                                                                                                              | `betSchema`, `betPageSchema`, `ticketCheckSchema`                   |
| `src/lib/server/bets.ts`; `src/lib/server/tickets.ts` (new)                                                                                                                           | `loadMyBets`, `loadMyBet`; `checkTicket`, `lookupTicket`            |
| `src/app/api/bets/route.ts`; `src/app/api/bets/[id]/route.ts` (new)                                                                                                                   | `GET` the list; `GET` one bet                                       |
| `src/features/bets/api/get-bets.ts`, `hooks/use-bets.ts`                                                                                                                              | Real calls, cursor paging; mock branches go                         |
| `src/features/bets/lib/figures.ts`; `src/features/bets/lib/labels.ts` (new)                                                                                                           | `payoutView` from the API; `betKindLabel`, status / result keys     |
| `src/features/bets/components/MyBetsView.tsx`, `BetTabs.tsx`, `BetCard.tsx`, `BetTicket.tsx`, `BetStatusBadge.tsx`, `CashOutPanel.tsx`                                                | The screens on the API's figures; states; cash out without a quote  |
| `src/components/layout/AsidePanel.tsx`                                                                                                                                                | Open count from the first page, for a player only                   |
| `src/features/tickets/` (new): `types.ts`, `lib/number.ts`, `lib/metadata.ts`, `components/TicketCheckView.tsx`, `TicketCheckForm.tsx`, `TicketUnavailable.tsx`, `TicketNotFound.tsx` | The public check                                                    |
| `src/app/t/page.tsx`, `src/app/t/[ticket]/page.tsx`, `src/app/t/[ticket]/not-found.tsx` (new)                                                                                         | `/t` and `/t/[ticket]`                                              |
| `src/config/routes.ts`                                                                                                                                                                | `ticket()`, `ticketCheck`                                           |
| `src/lib/share.ts` (new); `src/features/bet-slip/components/BookingCode.tsx`, `BetPlacedConfirmation.tsx`                                                                             | One Telegram share helper; Share on the confirmation                |
| `src/lib/api/mock/repository.ts`, `src/lib/api/mock/bets.ts` → `mock/transactions.ts`, `src/config/env.ts`                                                                            | The bet mocks go                                                    |
| `src/lib/i18n/messages/en.json`, `am.json`, `TRANSLATION-NOTES.md`; `tests/unit/i18n.test.ts` only if a string is symbolic                                                            | Strings                                                             |
| `tests/unit/bets-mappers.test.ts`, `bets-route.test.ts`                                                                                                                               | `toBet` / `toBetPage` on the contract's examples; the GET routes    |
| `tests/unit/ticket-number.test.ts`, `ticket-page.test.ts` (new)                                                                                                                       | D3's check character; `/t` metadata and lookup                      |
| `tests/unit/bets-figures.test.ts` (deleted)                                                                                                                                           | It tested the slipcalc recomputation that goes                      |
| `tests/component/MyBets.test.tsx` (new); `tests/component/PlaceBet.test.tsx`                                                                                                          | My bets, the ticket, the aside count; the confirmation's share link |
| `tests/e2e/ticket.spec.ts` (new); `tests/e2e/screens.spec.ts`                                                                                                                         | No-JS, Open Graph, 404, redirect; the new screens                   |
| `docs/design/00-overview.md`, `01-screens.md`, `04-slip-and-money.md`, `05-errors-and-states.md`, `08-performance-and-offline.md`                                                     | My bets, the ticket and `/t` as built                               |

## Acceptance criteria → tests

| AC   | Test                                                                                                                                                                                                                      | How it proves it                                                                                                                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-3 | `MyBets.test.tsx` "shows each ticket's potential payout, payout and taxes from the API, not a recomputation (AC-3)"                                                                                                       | The contract's list example with figures slipcalc would not produce (e.g. stake tax 14.00, potential payout 321.09, payout 250.00, winnings tax 12.34): those exact amounts on the cards; slipcalc's preview of the same legs (15.00, 289.17) absent |
| AC-3 | `MyBets.test.tsx` "opens a ticket with every leg's result and the API's stake, stake tax, bonus, winnings tax and payout (AC-3)"                                                                                          | The ticket detail: each row and the bottom line equal the API's strings; leg results in words; the barcode labelled with the ticket number                                                                                                           |
| AC-3 | `bets-mappers.test.ts` "maps the contract's Bet examples without touching a figure, names in both languages"; "keeps optional figures empty, never zero"                                                                  | Mapper on `example("/v1/bets")` and `example("/v1/bets/{id}")`                                                                                                                                                                                       |
| AC-3 | `pnpm ui` `my-bets`, `my-bets-settled`, `ticket`                                                                                                                                                                          | The cards and the ticket on Prism's figures                                                                                                                                                                                                          |
| AC-5 | `MyBets.test.tsx` "pages with next_cursor: Show more asks for the next page and adds it, and goes on the last page (AC-5)"                                                                                                | Request log: `/api/bets?status=open`, then `…&cursor=c2`; page 2's ticket appended under page 1's; no Show more once `nextCursor` is null                                                                                                            |
| AC-5 | `bets-route.test.ts` "forwards status and cursor to /v1/bets with the player's token, in both languages, and answers nextCursor (AC-5)"                                                                                   | Upstream request log: two GETs with `status`, `cursor`, the bearer and `Accept-Language` en / am; `nextCursor` from the API                                                                                                                          |
| AC-5 | `pnpm ui` `my-bets-more`                                                                                                                                                                                                  | Show more under the list                                                                                                                                                                                                                             |
| AC-4 | `ticket.spec.ts` "renders /t/R7K2-M9XP-K's status with JavaScript disabled (AC-4)"; "checks a typed number from the plain form without JavaScript (AC-4)"                                                                 | Playwright `javaScriptEnabled: false`: the status heading and legs in the server's HTML; `/t` form → `/t?ticket=r7k2 m9xp k` → `/t/R7K2-M9XP-K` with its status                                                                                      |
| AC-9 | `ticket.spec.ts` "serves Open Graph tags in the head for Telegram's preview bot (AC-9)"                                                                                                                                   | Telegram's user agent: `og:title`, `og:description`, `og:url`, `robots` before `</head>`                                                                                                                                                             |
| AC-9 | `ticket.spec.ts` "answers 404 for an unknown number, in the ticket's words (AC-9)"; "never repeats text from the address that isn't a ticket number"; "answers 404 for a number whose check character is wrong"           | `Prefer: code=404` → status 404, "No ticket with this number", "Check number K7Q2-M9XP-M and try again."; a crafted address → 404, nothing repeated; `K7Q2-M9XP-X` → 404 with no upstream call                                                       |
| AC-9 | `ticket.spec.ts` "redirects a typed number to its canonical path (AC-9)"                                                                                                                                                  | `/t/k7q2m9xpm` and `/t/k7q2%20m9xp%20m` → `/t/K7Q2-M9XP-M`                                                                                                                                                                                           |
| AC-9 | `ticket-page.test.ts` (metadata: title, description, url, robots, language, not found, no card on failure, no brand without config; lookup: ok, both not-found codes, failure, malformed answer); `ticket-number.test.ts` | The pure parts, without a browser                                                                                                                                                                                                                    |
| AC-9 | `pnpm ui` `ticket-check`, `ticket-check-form`, `ticket-check-invalid`, `ticket-check-failed`; `ticket-not-found-en-desktop.png` from `ticket.spec.ts`                                                                     | Every state of the page                                                                                                                                                                                                                              |

Scope items without their own AC, also tested:

- Share on Telegram links to `/t`: `MyBets.test.tsx` "shares the ticket's /t address on Telegram";
  `PlaceBet.test.tsx` (AC-3 test) the confirmation's link to `/t/K7Q2-M9XP-M`.
- The aside's count: `MyBets.test.tsx` "counts open bets from the first page, with + when there are more,
  and asks nothing for a guest".
- States: `MyBets.test.tsx` loading, empty per tab, error with Try again, a failed Show more, guest, a
  ticket not on this account (404), a ticket that failed to load.
- Routes: `bets-route.test.ts` — no session → 401 with nothing sent; bad `status` / `cursor` → 422 unsent;
  an expired token refreshed once for both language reads; `GET /api/bets/[id]` reads both languages,
  passes a 404 through, sends nothing for an id outside the pattern; `Prefer` only under `next dev`.

Kept green: `golden.test.ts` (366 rows, untouched), `PlaceBet.test.tsx`, `BetSlip.test.tsx`,
`booking.spec.ts`.

## Risks

| Risk                                                           | Cover                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Money: a figure on a ticket the engine didn't decide.**      | `betFigures` and every slipcalc import leave `features/bets`; tickets render only `Bet`'s strings (AC-3 tests use figures slipcalc can't produce); an optional figure the API didn't send shows "—", never 0.00; no `parseFloat` / `Number` on money (lint rule). money-reviewer.                                                                                                                                  |
| **Money: a label that claims more than the contract says.**    | "Payout", not "Net payout" (decision 5); no stake-tax refund or gross rows; public-page `payout` labelled neutrally for every status (question 2); 007 items 1, 2, 6 stay the record of what is missing.                                                                                                                                                                                                           |
| **Security: another player's bets.**                           | The routes read the session for this tenant and the API scopes every read to its token; a bet not on the account is the API's 404; the cache drops bets whenever the session changes hands (`forgetPlayer`, prefix covers the infinite queries); a guest never queries.                                                                                                                                            |
| **Security: inputs reaching upstream paths; the public page.** | Bet id and cursor patterns (decision 18), ticket numbers checked (decision 11) before any call — each with a test that nothing was sent; redirects only to `/t/` + a canonical number; nothing typed or crafted is repeated on the page; names are React text and Next escapes meta content; `Prefer` only under `next dev` to Prism; `no-store` on the routes; the public page shows no owner. security-reviewer. |
| **Without JavaScript.**                                        | A Playwright run with JavaScript off on the page and the form; failed-state Try again and Check another are links / a GET form; nothing in the shell suspends during the server render on a dynamic page (the no-JS test would see a hidden boundary).                                                                                                                                                             |
| **Accessibility.**                                             | Status and every leg result in words (dots are `aria-hidden`); toggle tabs with `aria-pressed`; Show more and every action ≥ 44 px, `aria-busy` while loading; the form's input labelled, its error tied by `aria-describedby`; headings in order on `/t`.                                                                                                                                                         |
| **Performance.**                                               | Two upstream reads per list, ticket or check (both languages; FD2 halves later); an infinite query re-reads only loaded pages; no polling (`staleTime` 20 s as today); `next/form` and the ticket check reuse what the shell already loads. No new dependency.                                                                                                                                                     |
| **i18n.**                                                      | Every string in both catalogues (parity test); composed Amharic in `TRANSLATION-NOTES.md`, including void vs cancelled, which need distinct words; long Amharic labels at 375 px and in the 312 px aside (screens' overflow check).                                                                                                                                                                                |
| **Size.**                                                      | About 2,500–3,000 changed lines with tests over two surfaces sharing the `Bet` leg rendering, the ticket number and Share on Telegram (see Sub-tasks).                                                                                                                                                                                                                                                             |

## Out of scope

- Cash out (Release 2): the panel stays behind its flag with no quote (decision 9).
- Tab counts and `rules_version` (contract request 007, items 6 and 1); `from` / `to` date filters.
- The tab in the URL (decision 22); the transactions view (still the wallet's mock, F6).
- "Check My bets" from the slip's unconfirmed-bet alert (an F5a follow-up, a product decision).
- `/{lang}/t/…` (F2a, FD2/FD3); a barcode on the public page; retail barcode payloads (`.MAC`, C19).

## Sub-tasks

None. F5b is already the reading half of F5's split (F5/plan.md decision 1). It is over the ~1,500-line
guide mostly in tests; splitting My bets from `/t` would put Share on Telegram in one PR and the page it
links to in the other, and both read the same domain `Bet` legs, results and ticket number.

## Changes during implementation

- **No `<Suspense>` around the shell on `/t`, `/t/[ticket]` and its 404.** The first no-JS run failed:
  on a cold render `next dev` loads client modules lazily, React suspended, and the page's boundary
  streamed the whole shell into a hidden `<div>` for a script to reveal — never, without JavaScript.
  These pages are dynamic (they read the request), so they need no boundary; without one the server
  sends the page whole. Re-checked after forcing a recompile. docs/design/08 says so.
- **`BetsGuest.tsx`** (new): the guest state, shared by My bets and the ticket detail, which also only
  reads for a player (`useBet(id, enabled)`).
- **`TicketCheckForm` has two variants** (`start` with the page's `<h1>`, `another` under a ticket or
  its 404) instead of a separate intro component. `toTicketCheck`'s tests live in `ticket-page.test.ts`
  with the page's other server-side parts.
- **Screens**: `my-bets-error` waits for the failure (the app retries a 5xx twice first);
  `ticket-check-failed` allows `next dev`'s replay of the server's log of that failure in the browser
  console; the ticket 404 screenshot settles and hides the dev badge, as `screens.spec.ts` does.
- **Outside the file list**: `tests/unit/session.test.ts` (F4a) — "opens a tampered cookie to nothing"
  failed about 1 run in 64, when the character it "flipped" already was its replacement. It now changes
  the character for certain and asserts it did (40 runs green). It failed once in this task's gate.
