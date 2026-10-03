# F5 — plan

F5 is split (see **Sub-tasks**). This plan covers **F5a — place a bet**; F5b (My bets, the ticket
detail and `/t/[ticket]`) gets its own plan when it starts. Plan gate: approved 2026-10-02 (mode: interactive) — with the three-way odds-policy select (question 2) and contract request 007 (question 3).

## Understanding

Today Place never leaves the browser: `place-bet.ts` re-prices the slip with slipcalc, waits 650 ms and
makes up a `KS-…` ticket number, so no `Idempotency-Key` exists, nothing reaches the betting engine and
the confirmation repeats the preview's own figures. F5a sends the slip to `POST /v1/bets` through a new
`/api/bets` route handler on the F4 session and shows what the engine answers. One tap of Place is one
intent with one `Idempotency-Key`; the key goes again only with the same request after an attempt that
had no definitive answer, so a dropped connection makes the engine return the same ticket rather than
take a second stake (C08 §2). A price that moved comes back as 409 `BET_ODDS_CHANGED`: the changed picks
show old → new from `errors[].current`, slipcalc re-prices the preview, and accepting places again as a
new intent with a new key. Every other refusal the contract lists for placing says what happened, in both
languages, and offers the fix (`errors[].limit`, Deposit, Verify, View limits). The confirmation shows
the API's `PlacedBet` figures with a real Code 128 barcode, and the wallet and bets are re-read, never
adjusted in the browser.

## Spec conflicts and decisions

| #   | Question                                                                                                                                                                                                  | Decision and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | F5 is ~5,000 changed lines over four areas: placement and its refusals, My bets, the public ticket page, barcodes.                                                                                        | Split into **F5a** (placement, 409, refusals, the placed ticket, Code 128: AC-1, AC-2, AC-3 on the placed ticket, AC-6, AC-7, AC-8) and **F5b** (My bets, ticket detail, `/t`: AC-3 on My bets, AC-4, AC-5, AC-9), as F3 and F4 were. Placement first: it is the money path, and F5b reuses its barcode. AC-6 to AC-9 were added to F5 so every scope item (odds policy, the listed refusals, Code 128, Open Graph) has an observable criterion.                                                                                                                                                                                                  |
| 2   | AC-3 says "`net_payout`". `Bet` / `PlacedBet` have no `net_payout`: they carry `potential_payout` (and `payout` once settled). C08 §7 builds the bet from the engine's own quote.                         | The placed ticket shows `potential_payout`, labelled "Potential payout" (`bets.potentialPayout`, the label F5b's ticket uses for an open bet). The label claims nothing about tax the contract does not say. Contract request 007 (question 3 below) asks the contract to describe the field.                                                                                                                                                                                                                                                                                                                                                     |
| 3   | Today's confirmation shows the preview's winnings tax; `PlacedBet.win_tax` is `null` at placement.                                                                                                        | No winnings-tax row on the confirmation. Before Place the slip shows the D1 breakdown as a preview; afterwards only the API's figures.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 4   | Odds policy: the contract has `none` / `higher` / `any` and the tenant's `RuleSet.default_odds_policy` (required; `higher` in the example). The slip has one switch, "Accept any odds changes".           | A three-way setting **"When odds change: Ask me (`none`) · Accept higher (`higher`) · Accept any (`any`)"**, a labelled native `<select>` where the switch is (Amharic labels are long; a 44 px target), starting at the tenant's default (C08 §9, docs/design/04). Sent as `odds_policy`. Reset by Clear and by loading a booking, as the switch was (F3b: a loaded slip starts without standing consent). Not persisted across visits (follow-up if wanted). Question 2 below.                                                                                                                                                                  |
| 5   | The slip's own prompt asks about every observed move unless the switch is on.                                                                                                                             | It follows the policy: `none` asks about every move, `higher` only about drops, `any` about none — the slip asks exactly where the engine would refuse. Accepting makes the shown price the agreed one (`initialOdds := currentOdds`), so a later move asks again (today an accepted pick stays accepted however far it moves). `BookingFlow.test.tsx`'s "2.05 → 2.10 ▲ to accept" runs under Ask me; under the tenant's `higher` a loaded rise is taken without a prompt (new test).                                                                                                                                                             |
| 6   | "Odds the user saw" (`LegInput.odds`).                                                                                                                                                                    | Each live pick's current odds — the price on screen after any acceptance. Moves still pending under the policy block Place, so nothing unaccepted is sent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7   | Stake and the optional fields.                                                                                                                                                                            | The total as typed, normalised (`"100"` → `"100.00"`), as the booking request does; the engine splits it per line exactly as slipcalc did (D1.3), so the preview and the ticket agree. `stake_is_per_line` not sent. `use_bonus: false` and `free_bet_id: null` sent explicitly, as in the contract's request example (bonuses: F7). `booking_code` not sent: the slip forgets the loaded code once its notice is dismissed (follow-up).                                                                                                                                                                                                          |
| 8   | When is a key reused? CLAUDE.md: "created once per user intent and reused on retry"; docs/design/04: a retry after a drop reuses it, accepting new odds gets a new one.                                   | A key belongs to one request body. It is reused only while that attempt has had **no definitive answer**: no response, a 5xx other than `REAL_MONEY_DISABLED`, or a 2xx this app could not read. Any definitive answer — 201, any 4xx, `REAL_MONEY_DISABLED` — spends it; a different body is a new intent. So a second bet on the same slip after Keep selections gets a new key (reusing the first would make the engine replay the first ticket, and the second bet would silently not exist), and so does accepting new odds. Keys from `crypto.randomUUID()`, with a `getRandomValues` fallback: plain-HTTP LAN testing has no `randomUUID`. |
| 9   | Where the attempt lives.                                                                                                                                                                                  | In the slip store with its request, as F3b keeps the booking key. The slip is mounted twice (the desktop aside, hidden by CSS, and the phone sheet), and closing the sheet mid-request unmounts its slip. The store's attempt makes every mounted slip show the pending state and refuse a parallel tap; the receipt goes in the store too, so a bet that completes after the sheet closed is shown when it reopens. Today it is lost with the component's state, the player sees an unplaced slip — and taps again.                                                                                                                              |
| 10  | No answer.                                                                                                                                                                                                | "We couldn't confirm your bet. It may have gone through — try again, and if it did you'll see the same ticket." Try again re-sends the **stored** request with its key (not the slip as it is now, whose prices may have moved). Wallet and bets are re-read. Changing the slip drops the attempt: the next Place is a new intent.                                                                                                                                                                                                                                                                                                                |
| 11  | A 409's `errors[].field` (`legs[1].odds`, `legs[0].outcome_id`) indexes the request's `legs`.                                                                                                             | The attempt keeps the request, so `legs[i]` is the outcome sent at position i. `BET_ODDS_CHANGED`: that pick's agreed price becomes what was sent, its current price `errors[].current` (checked against the contract's `Odds` pattern); the prompt shows old → new and slipcalc re-prices. A leg without a usable `current`, or no longer in the slip, is left alone; if no pick could be updated, a plain "not placed: the odds changed" alert stands in until the next price refresh.                                                                                                                                                          |
| 12  | `BET_EVENT_STARTED` / `BET_MARKET_SUSPENDED`.                                                                                                                                                             | The named pick is marked suspended — the slip's existing state: out of the price, Remove offered. The alert says which (the match has started / betting on it is paused). Without a usable field, the alert alone.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 13  | How refusals are shown.                                                                                                                                                                                   | One alert list in `SlipAlerts`, most severe first. For odds changed and closed picks, the existing alerts take a "your bet wasn't placed" wording; every other refusal is its own alert with its fix. Our copy per `code` in both languages (Prism's titles are English, docs/design/05), the API's `detail` as its own line when present; an unknown code shows the API's `title` and Try again (a new intent). A refusal stays until the slip changes or Place is tapped again.                                                                                                                                                                 |
| 14  | The fixes.                                                                                                                                                                                                | `BET_STAKE_TOO_HIGH` / `_TOO_LOW`: Set {amount} from `errors[field=stake].limit`. `BET_LIMIT_EXCEEDED`: the limit when `errors[].limit` gives one. `WALLET_INSUFFICIENT_FUNDS`: Deposit. `KYC_REQUIRED`: Verify (the auth dialog's `verify` entry, as Profile and Wallet use). `RG_LIMIT_REACHED`: View limits, with the API's `detail`. `RG_SELF_EXCLUDED` / `RG_COOLING_OFF`: betting is paused (until `flags.excluded_until` when `/api/me` has it), no action; `/api/me` and the RG status re-read. `REAL_MONEY_DISABLED`: no action. `RATE_LIMITED`: wait, with `Retry-After` when sent. Slip-shape codes: the slip's own copy.              |
| 15  | 401 from placing.                                                                                                                                                                                         | The route handler has already refreshed once, so the session is gone: `/api/me` is re-read and F4a's session-ended dialog and Log in to bet take over; the slip is kept; nothing to retry.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 16  | `REAL_MONEY_DISABLED`: docs/design/05 says F1 shows the notice up front from `real_money_enabled`, which is `false` in Prism's config example.                                                            | F5a does not read `real_money_enabled` (F1 does): placing against Prism must work. A 503 `REAL_MONEY_DISABLED` is shown as "real-money betting isn't available yet", no retry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 17  | Prism: `Prefer: code=409` answers `odds_changed` (the first named example); `example=event_started` alone is looked up under the 201 and fails.                                                           | `mockPreference` also accepts `code=NNN, example=name` — still `next dev` only, still never sent to the real API.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 18  | RG 403s, `BET_STAKE_TOO_HIGH`, `BET_MARKET_SUSPENDED` and `BET_LIMIT_EXCEEDED` have no Prism example (`Forbidden`'s is `KYC_REQUIRED`; the 422s are `stake_too_low`, `insufficient_funds`, `validation`). | Proven with the contract's `Problem` shape in component tests and one `pnpm ui` screen answered in the browser, as F4b did for `AUTH_OTP_INVALID`. Contract request 007 proposes named examples (question 3).                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 19  | Carried over (F3a money review M2): "real tickets carry `rules_version` … recompute only with the bet's own rule version". The contract's `Bet` has no `rules_version`.                                   | Contract wins: nothing is recomputed on a placed ticket, so no rule version is needed here; F5b shows the API's figures only. Contract request 007 proposes `rules_version` on `Bet` for the ticket's record.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 20  | Code 128: C18 §5–6 names JsBarcode (for the POS).                                                                                                                                                         | The player web draws it with its own encoder (code set B; ~110 lines with the table) as one SVG path: no dependency, deterministic in the server render, about 2 KB on the home page's first load where the slip lives (C18 §8: < 150 KB). Proven by the symbology's own invariants (107 patterns of 11 modules, bars even / spaces odd, all distinct), the Start B and Stop patterns, the mod-103 check character and a decode round trip. No scanner is at hand: a gap for verification.                                                                                                                                                        |
| 21  | What the barcode encodes.                                                                                                                                                                                 | The ticket number without hyphens (`K7Q2M9XPM`), the form C19's retail barcode carries before its `.MAC`, so a shop scanner (F9) reads one format; the hyphenated number is printed beside it and is the accessible name. Booking codes as they are. Black on white in every theme (scanner contrast) from two tokens, replacing the component's raw hex; a 10-module quiet zone each side.                                                                                                                                                                                                                                                       |
| 22  | The placed confirmation.                                                                                                                                                                                  | As today — ticket number large, barcode, Copy — with `PlacedBet`'s figures: type (Single / Multiple · n picks / n bets / System), stake, stake tax, accumulator bonus when above zero, total odds when single-line, potential payout. Focus moves to its heading so the result is announced. `balance` stays on the server: the wallet is re-read (F6 owns the wallet). Share on Telegram is left as it is until F5b gives it `/t/{ticket}` to share. "3 bets" is built by concatenation today: a `{n}` key instead.                                                                                                                              |

## Design

**Contract → loader → mapper → route → api → hook → components**

- `src/lib/server/bets.ts` (server only): `placeBet(ctx, session, request, key)` →
  `withSession(ctx, session, auth => upstream("Bets", { ...ctx, authorization: auth }).POST("/v1/bets", { body: toPlaceBetRequest(request), headers: { "Idempotency-Key": key } }))`
  → `toBetReceipt`. An expired access token is refreshed and the POST sent again once, with the **same**
  key (F4a's `withSession`).
- `src/lib/api/mappers/bets.ts` (pure): `toPlaceBetRequest(PlaceBetRequest)` → the contract's
  `PlaceBetRequest`; `toBetReceipt(PlacedBet)` → `BetReceipt` (strings untouched; `legCount`,
  `systemSizes ?? []`, `totalOdds ?? null`). F5b adds `toBet` here.
- `src/app/api/bets/route.ts` `POST`: `assertSameOrigin` (403/415) → `Idempotency-Key` a UUID (400) →
  `readJson` ≤ 16 KiB (413) → `placeBetRequestSchema` (422) → a session for this tenant (401 via
  `SessionGoneError`) → `respond(…, { status: 201 })`. Nothing goes upstream before every check passes;
  API Problems pass through with their status, `code`, `errors[]` and `Retry-After` (`respond`).
- `src/lib/api/schemas.ts`: `placeBetRequestSchema` — strict; `betType`; `systemSizes` integers 1–30, at
  most 30, only for a system; `legs` 1–30 of `{ outcomeId (1–64 chars), odds (the contract's Odds
pattern) }`, distinct outcomes; `stake` the contract's Money pattern, above zero; `oddsPolicy`.
  `betReceiptSchema`. Both `satisfies z.ZodType<…>`. `bettingRulesSchema` gains `defaultOddsPolicy`.
- `src/features/bet-slip/api/place-bet.ts`: `placeBet(request, key)` →
  `apiClient.post("/bets", betReceiptSchema, request, { headers: { "Idempotency-Key": key } })`. The
  in-browser engine goes.
- `src/features/bet-slip/lib/placement.ts` (pure): `placeRequestFrom({ selections, totals, stake,
oddsPolicy })` (null unless placeable); `signatureOf`; `keyFor(attempt, request)`;
  `newIdempotencyKey()`; `placementOutcome(error)` → `unanswered | session | refused`;
  `refusalOf(ApiError)`; `legChanges(refusal, request)` (the `legs[i]` mapping of decision 11).
- `bet-slip.store.ts`: `oddsPolicy: OddsPolicy | null` (null = the tenant's) and
  `placement: { attempt: { request, key, status: "sending" | "unanswered" } | null; refusal; receipt }`,
  with `setOddsPolicy`, `placementSent`, `placementUnanswered`, `placementRefused(refusal, changes)`
  (applies new odds or closed picks), `placementPlaced(receipt)`, `dismissReceipt`. Accepting makes the
  shown price the agreed one; `acceptedIds` and `acceptAnyChange` go. Every action that changes the slip
  (pick, remove, clear, load a booking, stake, mode, system size, policy, accept) clears a refusal and an
  unanswered attempt — never one in flight. Realtime price updates do not (they are not the player's).
- `calculate.ts`: `BetSlipInput.oddsPolicy` replaces `acceptedIds` / `acceptAllOddsChanges`;
  `pendingOddsChanges` by policy (decision 5). No money changes.
- `use-bet-slip.ts`: the effective policy (`store ?? rules.defaultOddsPolicy ?? "none"`), the request,
  `placing` from the store.
- `use-place-bet.ts`: `useMutation` with every store update in the hook-level callbacks (they run even
  when the slip that asked has unmounted). `place(request)` does nothing while an attempt is sending and
  takes its key from `keyFor`; `retry()` re-sends the stored attempt. Success: receipt into the store;
  `walletKeys.all` and `betKeys.all` invalidated. Error, by `placementOutcome`: `unanswered` keeps the
  attempt and re-reads wallet and bets; `session` re-reads `/api/me`; `refused` stores the refusal and
  its leg changes (RG codes also re-read `/api/me` and `rgKeys.all`).
- Components: `BetSlip` (confirmation from the store; `OddsPolicySetting` where the switch was; the
  place-error block moves into `SlipAlerts`), `SlipAlerts` (refusal and no-answer alerts with their
  fixes; the "wasn't placed" wording on the odds and suspended alerts), `PlaceBetButton` (pending from
  the store), `BetPlacedConfirmation` (the `BetReceipt`), new `OddsPolicySetting`.
- `src/lib/barcode/code128.ts` (pure: text → bar/space module widths, set B, check character, stop) and
  `components/ui/Barcode.tsx` (one SVG `<path>`, `role="img"`, the same props; tokens
  `--color-barcode-ink` / `--color-barcode-paper` in `globals.css`).
- `src/lib/server/upstream.ts`: `mockPreference` accepts `code=NNN, example=name` (decision 17).

**Domain types** (`features/bet-slip/types`): `OddsPolicy`; `PlaceBetRequest { betType, systemSizes,
legs: { outcomeId, odds }[], stake, oddsPolicy }`; `BetReceipt { id, ticketId, placedAt, betType,
systemSizes, lines, legCount, stake, stakeTax, totalOdds, accaBonus, potentialPayout }`;
`PlaceRefusal { status, code, title, detail, errors, retryAfter }`. `BettingRules.defaultOddsPolicy`
(`features/config/types`).

**Query keys**: none new. `walletKeys.all` and `betKeys.all` after a ticket or a lost answer;
`sessionKeys.me()` after a 401 or an RG refusal; `rgKeys.all` after an RG refusal.

**Error codes → what the UI offers**

| Code                                                                | Status  | Shown                                                                 | Fix                                      |
| ------------------------------------------------------------------- | ------- | --------------------------------------------------------------------- | ---------------------------------------- |
| `BET_ODDS_CHANGED`                                                  | 409     | Old → new on each changed pick; "your bet wasn't placed"; new preview | Accept (per pick or all), Place: new key |
| `BET_EVENT_STARTED` / `BET_MARKET_SUSPENDED`                        | 409     | The pick marked; "the match has started" / "betting on it is paused"  | Remove it                                |
| `BET_STAKE_TOO_HIGH` / `BET_STAKE_TOO_LOW`                          | 422     | The limit                                                             | Set {limit}                              |
| `BET_LIMIT_EXCEEDED`                                                | 422     | Over the limit for this bet; the limit when given                     | Set {limit} when given                   |
| `WALLET_INSUFFICIENT_FUNDS`                                         | 422     | Balance too low                                                       | Deposit                                  |
| `BET_RELATED_SELECTIONS`, `BET_TOO_MANY_LEGS`, `BET_TOO_MANY_LINES` | 422     | The slip's own copy                                                   | — (the player chooses)                   |
| `IDEMPOTENCY_MISMATCH`, `VALIDATION_FAILED`, unknown                | 4xx     | Not placed; the API's `title` for an unknown code                     | Try again (a new intent)                 |
| `KYC_REQUIRED`                                                      | 403     | Verify your ID to place bets                                          | Verify                                   |
| `RG_LIMIT_REACHED`                                                  | 403     | A limit you set is reached; the API's `detail`                        | View limits                              |
| `RG_SELF_EXCLUDED`, `RG_COOLING_OFF`                                | 403     | Betting is paused (until {date} when known)                           | —                                        |
| `RATE_LIMITED`                                                      | 429     | Too many bets; wait {n} s when `Retry-After` says                     | —                                        |
| `REAL_MONEY_DISABLED`                                               | 503     | Real-money betting isn't available yet                                | —                                        |
| `AUTH_TOKEN_EXPIRED` (session gone)                                 | 401     | F4a's session-ended dialog; Log in to bet                             | Log in                                   |
| no answer: network, other 5xx, an unreadable 2xx                    | 0 / 5xx | We couldn't confirm your bet; it may have gone through                | Try again (same request, same key)       |

**i18n** (en + am; composed Amharic listed in `TRANSLATION-NOTES.md`): `betSlip.oddsPolicy.{label,
none, higher, any}`, `betSlip.betCount`, `betSlip.placing`, `betSlip.refused.*` (title, odds changed,
event started, market suspended, limit exceeded with and without the limit, insufficient funds, KYC,
RG limit, RG break with and without its end, real money off, rate limited with and without seconds,
unknown), `betSlip.unconfirmed.{title, body}`. Reused: `betSlip.setMax`, `betSlip.alerts.deposit`,
`system.viewLimits`, `auth.verify`, `common.retry`, `bets.potentialPayout`. `betSlip.acceptAnyChange`
goes.

**Feature flags**: none. Cash out untouched.

## Files

| File                                                                                                                                               | Why                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `docs/tasks/F5-place-bet-my-bets.md`, `F5a-place-bet.md`, `F5b-my-bets-ticket-check.md`, `README.md`                                               | The split; AC-6 to AC-9; statuses                                                        |
| `docs/tasks/F5/plan.md`, `docs/tasks/F5/verification.md`                                                                                           | This plan; phase 3                                                                       |
| `src/app/api/bets/route.ts` (new)                                                                                                                  | `POST /api/bets`                                                                         |
| `src/lib/server/bets.ts` (new)                                                                                                                     | `placeBet` loader on the session                                                         |
| `src/lib/api/mappers/bets.ts` (new)                                                                                                                | `toPlaceBetRequest`, `toBetReceipt`                                                      |
| `src/lib/api/schemas.ts`                                                                                                                           | `placeBetRequestSchema`, `betReceiptSchema`, `defaultOddsPolicy`                         |
| `src/lib/api/mappers/config.ts`, `src/features/config/types.ts`                                                                                    | `defaultOddsPolicy` from `RuleSet.default_odds_policy`                                   |
| `src/lib/server/upstream.ts`                                                                                                                       | `mockPreference`: `code=NNN, example=name`                                               |
| `src/lib/barcode/code128.ts` (new), `src/components/ui/Barcode.tsx`, `src/app/globals.css`                                                         | Code 128; barcode tokens                                                                 |
| `src/features/bet-slip/types/index.ts`                                                                                                             | `OddsPolicy`, `PlaceBetRequest`, `BetReceipt`, `PlaceRefusal`                            |
| `src/features/bet-slip/lib/placement.ts` (new)                                                                                                     | Request, keys, outcomes, refusal → leg changes                                           |
| `src/features/bet-slip/lib/calculate.ts`                                                                                                           | Pending moves by policy                                                                  |
| `src/features/bet-slip/stores/bet-slip.store.ts`                                                                                                   | Policy, attempt, refusal, receipt; accept = agree to the shown price                     |
| `src/features/bet-slip/api/place-bet.ts`                                                                                                           | `POST /api/bets` with the key; mock removed                                              |
| `src/features/bet-slip/hooks/use-place-bet.ts`, `use-bet-slip.ts`                                                                                  | Intents, outcomes, invalidations; the effective policy                                   |
| `src/features/bet-slip/components/BetSlip.tsx`, `SlipAlerts.tsx`, `PlaceBetButton.tsx`, `BetPlacedConfirmation.tsx`, `OddsPolicySetting.tsx` (new) | The flow on screen                                                                       |
| `src/features/bookings/lib/to-slip.ts`                                                                                                             | Only if the store's `replaceSlip` contract changes (it should not)                       |
| `src/config/env.ts`                                                                                                                                | `useMocks` comment: placing no longer mocked                                             |
| `src/lib/i18n/messages/en.json`, `am.json`, `TRANSLATION-NOTES.md`                                                                                 | New strings; composed Amharic for review                                                 |
| `tests/unit/bets-route.test.ts`, `bets-mappers.test.ts`, `placement.test.ts`, `code128.test.ts` (new)                                              | Route, mapper, placement logic, symbology                                                |
| `tests/unit/slip-store.test.ts` (new)                                                                                                              | Accepting agrees to the shown price; the policy resets on Clear and on loading a booking |
| `tests/unit/calculate.test.ts`, `booking-slip.test.ts`, `config-mappers.test.ts`                                                                   | Policy input; `defaultOddsPolicy`                                                        |
| `tests/component/PlaceBet.test.tsx` (new), `BetSlip.test.tsx`, `BookingFlow.test.tsx`                                                              | Placement flows; moved placement tests; prompts by policy                                |
| `tests/e2e/screens.spec.ts`                                                                                                                        | Placed, odds changed, event started, an RG refusal                                       |
| `docs/design/01-screens.md`, `02-journeys.md`, `04-slip-and-money.md`, `05-errors-and-states.md`                                                   | The slip as built                                                                        |
| `docs/contract-requests/007-bet-figures-and-refusal-examples.md` (new, if approved)                                                                | `rules_version` on `Bet`, `potential_payout` described, named refusal examples           |

## Acceptance criteria → tests

As built after review round 2; `verification.md` has the results. Names are the tests' own.

| AC   | Test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | How it proves it                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | `PlaceBet.test.tsx`, block "a bet that had no answer": "sends the same Idempotency-Key again from the alert's Try again, which shows its amount"; "gives up waiting after 30 s…"; "turns Place into Try again with the bet's amount, which a 5xx keeps owed too"; "keeps it through a tap that changes nothing, and through an edit and back"; "keeps Try again under a price that moves without asking…"; "sends the bet as it was sent, not the slip as edited while it was on its way"; "stays unconfirmed when the session ends on a retry…"; plus "gives a second bet on the same slip, after Keep selections, a new key (AC-1)" | Request log of `/api/bets`: the same key and body on every Try again; a new key only for a new intent or the player's "Place as a new bet"                      |
| AC-1 | `bets-route.test.ts` "forwards the browser's Idempotency-Key unchanged on every attempt, and never makes one (AC-1)"; "sends the POST again with the same key after refreshing an expired token (AC-1)"; "refuses a POST without an Idempotency-Key, or with one that is not a UUID"                                                                                                                                                                                                                                                                                                                                                  | Upstream request log: the browser's key on each attempt and on the refresh retry; no key → 400, nothing sent                                                    |
| AC-1 | `slip-store.test.ts` "the slip store: a bet that had no answer" (6 tests); `placement.test.ts` "slipIsThatBet…" (3 tests)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | The unconfirmed bet's lifecycle in the store; when the slip still is that bet                                                                                   |
| AC-2 | `PlaceBet.test.tsx` "shows the old and new odds from a 409 and places the accepted price with a new key (AC-2)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | The contract's `odds_changed` example: 3.05 struck, ▼ 1.55, the payout re-priced to a literal ETB 300.82, Accept → Place: `legs[1].odds` `"1.55"` and a new key |
| AC-2 | `placement.test.ts` "maps legs[1] in a 409 to the pick sent second… (AC-2)"; `bets-route.test.ts` "passes a 409 BET_ODDS_CHANGED through with its errors[] (AC-2)"; `pnpm ui` `home-slip-odds-changed`                                                                                                                                                                                                                                                                                                                                                                                                                                | Index mapping; the Problem reaches the browser intact; the Prism exchange on screen                                                                             |
| AC-3 | `PlaceBet.test.tsx` "shows the API's ticket and figures, not the preview's (AC-3)"; "counts the bets of a several-line ticket…"; `bets-mappers.test.ts` "maps the contract's PlacedBet example without touching a figure"; `pnpm ui` `home-slip-placed`                                                                                                                                                                                                                                                                                                                                                                               | The API's 14.00 / 12.34 / 321.09 shown, the preview's 15.00 / 14.83 / 594.40 absent                                                                             |
| AC-6 | `PlaceBet.test.tsx` "starts at the tenant's own odds policy and sends the player's choice (AC-6)"; "sends the contract's request… (AC-6)"; `calculate.test.ts` (prompts by policy); `config-mappers.test.ts` (the tenant's default)                                                                                                                                                                                                                                                                                                                                                                                                   | The request's `odds_policy` from the tenant default and from the player's choice                                                                                |
| AC-7 | `PlaceBet.test.tsx` block "when the engine refuses" (started, market suspended, stake too high, the 10.02 minimum, `BET_LIMIT_EXCEEDED`, Deposit, View limits, break, self-exclusion, Verify, rate limit, real money, unknown code, Amharic); `refusals.test.ts` (18 tests, per code); `pnpm ui` `home-slip-event-started`, `-limit-reached`, `-insufficient`, `-stake-too-high`, `-verify`, `-unconfirmed-refused`                                                                                                                                                                                                                   | Each refusal's message and fix, from the contract's examples where they exist and its `Problem` shape otherwise; a refused Try again titled as one              |
| AC-8 | `code128.test.ts` (5 tests); `PlaceBet.test.tsx` the barcode labelled with the ticket                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | The symbology, independent of the drawing; the confirmation draws it                                                                                            |

Also kept green: `BetSlip.test.tsx` (odds prompts by policy), `BookingFlow.test.tsx` (the accept flow
under Ask me; the policy reset on load), `golden.test.ts` (all 366 rows, untouched).

## Risks

| Risk                                                                                                                                    | Cover                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Money: a bet placed twice** — a retry with a new key, a second tap from another mounted slip, a receipt lost with an unmounted sheet. | Decisions 8–10: the key per request body, reused only without an answer; the attempt and the receipt in the store; Place refused while one is sending; Try again re-sends the stored request. AC-1 tests at the browser and the route; money-reviewer.                                                                                                                                                                                                             |
| **Money: a bet at a price never agreed to.**                                                                                            | Odds sent are the shown odds (decision 6); the prompt follows the policy, accepting rebases the agreed price so a later move asks again (decision 5); the engine re-prices under the same policy anyway (C08 §7).                                                                                                                                                                                                                                                  |
| **Money: the screen shows a figure the engine did not decide.**                                                                         | The confirmation renders only `BetReceipt` (AC-3); nothing optimistic — no ticket and no balance change before the 201; the wallet is re-read, not adjusted. The slip's preview stays slipcalc's (golden rows untouched). No `parseFloat` / `Number` on money (lint rule).                                                                                                                                                                                         |
| **Security.**                                                                                                                           | `POST /api/bets` runs the same checks as every mutating route (origin, `X-Requested-With`, JSON, 16 KiB cap, strict schema, session, UUID key) before anything goes upstream — each with a route test that also asserts nothing was sent; the key is forwarded, never invented; `Prefer`'s new form is still `next dev` and Prism only (test); Problems are cut to the contract's fields; `balance` and the bet's internals stay on the server. security-reviewer. |
| **Accessibility.**                                                                                                                      | Refusals are `role="alert"`, the no-answer notice too; every fix is a button with a 44 px target; the odds-policy select is labelled; the confirmation's heading takes focus; status is never colour alone.                                                                                                                                                                                                                                                        |
| **Performance.**                                                                                                                        | No new dependency; the Code 128 table is ~2 KB in the slip's bundle; one request per Place; nothing polls.                                                                                                                                                                                                                                                                                                                                                         |
| **i18n.**                                                                                                                               | Every new string in both catalogues (parity test); composed Amharic in `TRANSLATION-NOTES.md`; the select keeps long Amharic labels inside the slip at 375 px and in the 312 px aside (screens).                                                                                                                                                                                                                                                                   |
| **Behaviour change in F3b's flow.**                                                                                                     | Under the tenant's `higher` a rise is no longer prompted (decision 5); `BookingFlow.test.tsx` keeps the design's prompt under Ask me and gains a test for the default.                                                                                                                                                                                                                                                                                             |

## Out of scope

- F5b: My bets and the ticket detail from `/v1/bets`, cursor paging, `/t/[ticket]`, sharing a ticket.
- `use_bonus`, `free_bet_id` (F7); `booking_code` on placement (follow-up); remembering the odds policy
  across visits (follow-up).
- F1's real-money notice; F7's slip lock during a break; the offline lock on Place (docs/design/05) —
  offline placing fails safely as "no answer" meanwhile.
- Cash out (Release 2).

## Sub-tasks

- [F5a — place a bet](../F5a-place-bet.md): this plan.
- [F5b — My bets and the ticket check](../F5b-my-bets-ticket-check.md): AC-3 on the ticket in My bets,
  AC-4, AC-5, AC-9; depends on F5a.

## Changes during implementation

- **A 30 s limit on waiting for Place** (`place-bet.ts`): a request that hangs ends as "no answer"
  (Try again, same request, same key) instead of a spinner that never stops. Asserted in
  `PlaceBet.test.tsx`.
- **The stand-in for a 409 with no pick waiting** (decision 11) says "check the prices and place it
  again", not that new prices will come: Prism's canned `odds_changed` can re-price a pick upwards, which
  the tenant's `higher` takes without a prompt. Test "still says the bet wasn't placed when the new price
  is a rise the policy takes without asking"; the `home-slip-odds-changed` screen sets Ask me first so
  it always shows old → new with Accept.
- **The API's `detail`** is shown as its own line on a refusal, except where the slip's copy already
  states the same limit (stake too low / high), following docs/design/05.
- **Files added beyond the list**: `tests/unit/slip-store.test.ts` (listed above),
  `src/features/bets/lib/ticket-number.ts` (the contract's `TicketNo` pattern, for the receipt schema;
  F5b adds normalising there), `src/features/bet-slip/components/BookingCode.tsx` (its barcode lost the
  fake pattern's props).
- **Contract request 007** written (question 3): `docs/contract-requests/007-bet-figures-and-refusal-examples.md`.

### Review round 1 (2026-10-03) — what changed in the design

- **Decisions 8–10 replaced by "the unconfirmed bet"** (SEC1, M1, S1, U1, Q2). A bet with no answer
  that settles it is _unconfirmed_ and stays so through any change to the slip (even edit-and-revert or
  a tap that changes nothing), a price move, a refusal of a retry (the engine caches a key only after
  commit, C08 §7, so a refused retry proves nothing about the first try) and a lost session. While it
  is, the main button is Try again — that very request with its key — and a different bet goes only
  through the alert's explicit "Place as a new bet", offered once the slip differs. Only the ticket for
  its key ends it. `keyFor` is gone: `place` always mints a key, and nothing but Try again re-sends one.
- **Placement belongs to one player** (SEC2, Q1). `Placement.owner` is the `/api/me` player it was made
  for; the slip shows and acts on it only for them (`ownPlacement`), hides it from a guest, and drops it
  when another player signs in. An answer lands only on the attempt still on its way (`sending.key`), so
  a late answer after a hand-over changes nothing. Owner-scoping rather than clearing in `forgetPlayer`
  keeps an unconfirmed bet for the same player across a lost session (M1(b)).
- **Refusal copy moved to `lib/refusals.ts`** (Q6), pure and unit-tested per code: `BET_LIMIT_EXCEEDED`
  offers a limit only from `errors[field=stake]` (M2); the engine's minimum is split across the lines
  with the slip's own `smallestStake` (M3); a non-Problem answer never shows the app's technical message,
  a stake refusal without a figure has its own copy (Q5).
- **Decision 13 corrected** (S7): an unknown code has no separate Try again; the main Place button is
  the retry (a new intent), as docs/design/05 says ("Place again").
- **Accessibility**: the odds-changed refusal is `role="alert"` (S6); Place stays focusable while
  sending (`aria-disabled`, `aria-busy`, "Placing…", Q8); the per-pick Accept has a 44 px target (U4);
  tinted alert text reaches AA in the light theme (U5).
- **Smaller**: the contract's patterns live once in `lib/api/patterns.ts` and the route uses `readForm`'s
  new size option (Q7); the dead `AbortSignal.timeout` fallback went (Q3); Share on Telegram is hidden on
  the confirmation until F5b (U6); the select has spacing and a chevron (U2, U3); the odds-changed copy
  drops its count (Q11).
- **Files added in this round**: `src/lib/api/patterns.ts`, `src/features/bet-slip/lib/refusals.ts`,
  `tests/unit/refusals.test.ts`; changed beyond the list: `BetSelectionRow.tsx` (moved prices, the 44 px
  Accept — S7), `src/lib/server/body.ts` (`readForm` size), `src/lib/api/mappers/bookings.ts` (shared
  Odds pattern); removed: `src/features/bets/lib/ticket-number.ts`.
- **Screens**: the RG screen is `home-slip-limit-reached` (S7); added `home-slip-insufficient`,
  `-stake-too-high`, `-verify` and `-unconfirmed-changed` (U8); the dev badge is hidden in shots (U9).

### Review round 2 (2026-10-03) — what changed in the design

- **The main button acts on the slip shown above it** (M7, N1, U10, SEC6, R2-2). Round 1 made it Try
  again whenever a bet was unconfirmed, so once the slip was edited it sat under a preview of another
  bet and charged an amount shown nowhere. Now it is Try again only while the slip still is that bet —
  the same picks, bet type and stake (`slipIsThatBet`; a price that moved since doesn't make it another
  bet, so a realtime tick never turns the button into a new bet) — and otherwise it is the slip's own:
  "Place as a new bet" with the slip's amount, or Accept / Remove first. Try again lives in the alert,
  which names the bet ("Try again sends that bet as it was: Multiple · 3 picks") and says placing this
  slip as well makes two. Every Try again shows the bet's own amount: `PlaceAttempt` keeps slipcalc's
  total stake and line count from when it was placed (`PlaceIntent`). The alert's second button went:
  the main button is that choice.
- **A refused Try again is said as one** (N2, M8): "Try again didn't go through" with the reason and the
  code's fix — including odds changed and a closed pick, which said nothing before — never "Bet not
  accepted". A refusal of the bet's prices or picks marks it `stale`: the same Try again would meet it
  again, so only the very same prices still make the slip that bet, and the main button follows the
  slip (Accept, Remove, then Place as a new bet) instead of looping. The alert keeps Try again, to find
  out whether the first try went through. A refusal stores the key it answered (`refused.key`), which
  tells a Try again's refusal from a first try's.
- **A bet placed as new no longer drops the unconfirmed one** (N4): it stays while the new bet goes and
  through its refusal; any ticket ends it; no answer to the new bet makes that the unconfirmed one (the
  slip tracks the latest).
- **Try again reads `/api/me` afresh first** (SEC7) and sends nothing if the player isn't the bet's
  owner — another tab may have signed someone else in within `/api/me`'s 60 s.
- **Smaller**: a stake limit is used only when it is an amount (`MONEY_PATTERN`), so an odd `limit`
  can't crash the slip (SEC5); an emptied slip's alert doesn't mention "this slip" (U11); the odds alert
  is count-neutral (N5); `PLACE_TIMEOUT_MS` is no longer exported (N5); a first-try 401 is tested (N3).
- **Files changed beyond round 1's list**: none new; `src/features/auth/api/auth.ts` is now read by
  `use-place-bet.ts` (`getMe`).
- **Screens**: added `home-slip-unconfirmed-refused` (a Try again answered 429).

### Review round 3 (2026-10-03) — what changed

- **One deadline for the whole attempt** (P1, MAJOR): round 2's check of who is signed in before a Try
  again had no time limit of its own, so a hanging `/api/me` left the slip on "Placing…" for good.
  `placementDeadline()` (30 s) is made once per attempt and bounds both the `/api/me` read and the POST;
  past it the bet is unanswered and stays unconfirmed with its key. The read goes to `getMe` directly,
  not through the query cache, so a read already in flight can't outlast it; a different player
  invalidates `/api/me` so the slip follows.
- **A respelled price is the same price** (P2): `samePrices` compares with `compareOdds`, as the slip
  does, so `"3.050"` can't make the unconfirmed bet look like another one.
- **The alert says "as it was" whenever Try again sends what the slip doesn't show** (M9): other prices,
  or another odds setting. `SlipAlerts` takes `unconfirmedNote` (`asItWas` / `changed` / none) from
  `BetSlip` instead of `slipIsThatBet`; the key `unconfirmed.cleared` is now `unconfirmed.asItWas`.
- **The bet's name doesn't break across lines** (U12): `kindOf` joins it with non-breaking spaces.
- **Not done**: holding Try again until a rate limit's `Retry-After` has passed (U13, optional) — a
  follow-up.
