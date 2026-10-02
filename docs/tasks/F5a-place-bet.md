---
id: F5a
title: Place a bet with an Idempotency-Key per intent, the 409 flow and every refusal's fix; Code 128
status: verifying
depends_on: [F3a, F3b, F4]
contract_tags: [Bets]
touches_money: true
touches_ui: true
---

# F5a — Place a bet

Split from [F5](F5-place-bet-my-bets.md) (2026-10-02): the placing half. My bets, the ticket detail and
the public ticket check are [F5b](F5b-my-bets-ticket-check.md), which builds on this.

## Goal

A signed-in player places singles, multiples and system bets through `POST /v1/bets`. One tap of Place
is one intent with one `Idempotency-Key`, sent again only when that same request has had no answer, so
a dropped connection never places a bet twice. A price that moved comes back as old → new with the
preview recomputed, and accepting places again as a new intent. Every other refusal says what happened
and offers the fix. The ticket the player then sees carries the API's figures and a real Code 128
barcode.

## Read first

As F5: `docs/decisions.md` FD4; `docs/backend/engineering-decisions.md` D1.3, D1.10, D3 (ticket
numbers); `c08-bet-placement-risk.md` §2, §6, §7, §9, §10; `c18-client-apps.md` §4.2, §8;
`td-01-api-standards.md` §4 (error registry); `contracts/openapi.yaml` `POST /v1/bets`
(`PlaceBetRequest`, `PlacedBet`, `OddsPolicy`, 409 `odds_changed` / `event_started`, 403, 422, 503) and
`RuleSet.default_odds_policy`; `docs/design/04-slip-and-money.md` and `05-errors-and-states.md`;
existing `src/features/bet-slip/*`, `src/lib/server/session.ts`, `csrf.ts`, `body.ts`,
`src/components/ui/Barcode.tsx`.

## Scope

In:

- `POST /api/bets`: same-origin and CSRF checks, `Idempotency-Key` required and forwarded unchanged,
  a capped JSON body checked by a strict schema, the session required; answers 201 with the ticket.
- The request from the slip: live picks with the odds on screen, bet type and system size, the total
  stake as typed, the odds policy.
- One key per intent, kept in the slip store with the request: reused only while that request has had
  no definitive answer; a new key for anything else (a changed slip, accepted odds, a second bet on the
  same slip).
- The odds policy as a slip setting (`none` / `higher` / `any`), starting at the tenant's
  `default_odds_policy`; the slip's own accept-changes prompt follows it.
- 409 `BET_ODDS_CHANGED` (old → new from `errors[].current`, preview recomputed, accept → new key),
  `BET_EVENT_STARTED`, `BET_MARKET_SUSPENDED`; 422 `BET_STAKE_TOO_HIGH` / `_TOO_LOW` and
  `BET_LIMIT_EXCEEDED` (offer the limit), `WALLET_INSUFFICIENT_FUNDS` (Deposit), the slip-shape codes,
  `IDEMPOTENCY_MISMATCH`; 403 `RG_LIMIT_REACHED`, `RG_SELF_EXCLUDED`, `RG_COOLING_OFF`, `KYC_REQUIRED`;
  503 `REAL_MONEY_DISABLED`; 429; 401 (session ended); no answer (network, 5xx) → Try again, same key.
- The placed ticket from the API's `PlacedBet`: ticket number, Code 128 barcode, Copy, stake, stake tax,
  total odds, accumulator bonus, potential payout. Wallet and bets queries re-read.
- `components/ui/Barcode.tsx` draws real Code 128.

Out (do not build here):

- My bets, the ticket detail and `/t/[ticket]` from the contract (F5b), and sharing a ticket (F5b, with
  `/t/{ticket}`).
- Bonus stakes and free bets (`use_bonus`, `free_bet_id`, F7); `booking_code` on placement (follow-up).
- The real-money-off notice from config (F1); the slip lock during a break (F7).
- Cash out (Release 2).

## Acceptance criteria

- [ ] **AC-1** Placing twice with the same key (retry) sends the same `Idempotency-Key` (request log test).
- [ ] **AC-2** `Prefer: code=409` shows old and new odds and accepting re-places with a new key.
- [ ] **AC-3** The placed ticket shows the API's figures (`potential_payout`, `stake_tax`, `total_odds`,
      `acca_bonus`), not the preview's.
- [ ] **AC-6** The `odds_policy` sent is the slip's setting (`none` / `higher` / `any`), which starts at
      the tenant's `betting.default_odds_policy`.
- [ ] **AC-7** Each refusal in scope says what happened and offers its fix: `BET_EVENT_STARTED` /
      `BET_MARKET_SUSPENDED` mark the pick and offer Remove; `BET_STAKE_TOO_HIGH` offers `errors[].limit`;
      `WALLET_INSUFFICIENT_FUNDS` offers Deposit; `RG_LIMIT_REACHED` offers View limits; `RG_SELF_EXCLUDED`
      and `RG_COOLING_OFF` say betting is paused; `KYC_REQUIRED` offers Verify.
- [ ] **AC-8** Ticket barcodes are Code 128 (symbol table, check character and stop pattern under test).

## Verification

- `pnpm verify` passes
- `curl -H 'Prefer: code=409' …/api/bets` (with a session cookie, `X-Requested-With` and a key) → 409
  `BET_ODDS_CHANGED` with `errors[].current`
- `pnpm ui` screens: the placed ticket, odds changed, event started, an RG refusal

## Notes

- 2026-10-02: split from F5.
- 2026-10-03 (review): the key rule as built is stricter than "reused only while that request has had no
  definitive answer". A bet with no answer stays _unconfirmed_, and Try again resends it with its key,
  through slip changes, price moves, a lost session and any refusal of a retry: the engine caches a key
  only once a bet commits (C08 §7), so a refused retry says nothing about the first try. Only a ticket
  ends it — its own, or one for a bet the player explicitly placed as new. See `F5/plan.md`, "Review
  round 1" and "Review round 2", and docs/design/04 "Placing a bet".
