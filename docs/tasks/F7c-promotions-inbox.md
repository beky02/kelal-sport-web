---
id: F7c
title: Split from F7 — promotions, my bonus and free bets, promo codes, the inbox
status: todo
depends_on: [F4]
contract_tags: [Promotions, Inbox]
touches_money: true
touches_ui: true
---

# F7c — Promotions and inbox

Split from [F7](F7-account-rg-inbox.md) (2026-10-03, before planning).

## Goal

Players see the tenant's offers and their own bonus with its wagering progress and free bets, redeem a
promo code exactly once, and read their inbox with an unread badge.

## Read first

- `docs/backend/design/components/c11-bonuses.md` §3, §5, §6, §8; `c14-notifications.md` §5–§7
- `contracts/openapi.yaml`: `GET /v1/promotions`, `GET /v1/me/bonuses`, `POST /v1/promo-codes/redeem`
  (`Idempotency-Key`; `PROMO_INVALID`, `PROMO_ALREADY_USED`), `GET /v1/inbox`,
  `GET /v1/inbox/unread-count`, `POST /v1/inbox/read`

## Scope

In: offers; my bonus (amount, wagering required and done, expiry) and free bets — the API's figures;
redeem with a key per intent; the inbox, its unread badge, marking read.

Out: betting with bonus money or a free bet on the slip (`use_bonus`, `free_bet_id`: a later task);
push notifications.

## Acceptance criteria

- [ ] **AC-11** Offers come from `/v1/promotions`; the active bonus shows the API's wagering required and
      done and its expiry; free bets are listed (mapper and component tests; `pnpm ui`).
- [ ] **AC-12** A promo code is redeemed with one `Idempotency-Key` per intent, reused on a retry after no
      answer; `PROMO_INVALID` and `PROMO_ALREADY_USED` say so (route and component tests).
- [ ] **AC-13** The inbox lists messages; the badge comes from `/v1/inbox/unread-count`; opening messages
      marks them read through `POST /v1/inbox/read` (component test; `pnpm ui`).
