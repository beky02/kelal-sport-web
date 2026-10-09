---
id: F7ca
title: Split from F7c — offers, my bonus and free bets, promo codes
status: verifying
depends_on: [F4]
contract_tags: [Promotions]
touches_money: true
touches_ui: true
---

# F7ca — Promotions

Split from [F7c](F7c-promotions-inbox.md) (2026-10-09, while planning). Carries F7c's **AC-11** and
**AC-12**. Planned in [`F7c/plan.md`](F7c/plan.md) and built on F7c's branch.

## Goal

Anyone sees the tenant's offers on a Promotions page; a signed-in player also sees their active bonus
with the API's wagering required, wagered so far and expiry, and their free bets, and redeems a promo
code exactly once — one `Idempotency-Key` per intent, the same key on a retry after no answer.

## Read first

- `docs/backend/design/components/c11-bonuses.md` §3, §5, §6, §8
- `docs/decisions.md` **FD4** (money as strings; `percentOf` for a bar)
- `contracts/openapi.yaml`: `GET /v1/promotions`, `GET /v1/me/bonuses`, `POST /v1/promo-codes/redeem`
  (`Idempotency-Key`; `PROMO_INVALID`, `PROMO_ALREADY_USED`; 404, 422)
- Existing: `src/features/wallet/hooks/use-payments.ts` (a key per intent),
  `src/features/responsible-gaming/components/LimitLines.tsx` (`UsedBar`), `src/features/profile/*`

## Scope

In: `/promotions` (offers for everyone; my bonus, free bets and the code form for a player); the route
handlers `/api/promotions`, `/api/me/bonuses`, `/api/promo-codes/redeem`; entry points in the desktop nav
and the phone's Menu, following the tenant's `features.bonuses`.

Out: the inbox (F7cb); betting with bonus money or a free bet on the slip (`use_bonus`, `free_bet_id`: a
later task); forfeiting a bonus (no contract operation); Markdown in an offer's terms (shown as text until
F7d picks a renderer); push notifications.

## Acceptance criteria

- [ ] **AC-11** Offers come from `/v1/promotions`; the active bonus shows the API's wagering required and
      done and its expiry; free bets are listed (mapper and component tests; `pnpm ui`).
- [ ] **AC-12** A promo code is redeemed with one `Idempotency-Key` per intent, reused on a retry after no
      answer; `PROMO_INVALID` and `PROMO_ALREADY_USED` say so (route and component tests).

## Verification

- `pnpm verify` passes
- `pnpm ui --grep promotions`: every state, en/am × 375/1440

## Notes

- Prism has no `PROMO_*` examples: the refusals are exercised by route and component tests and by
  `pnpm ui` screens that answer the route with the Problem.
