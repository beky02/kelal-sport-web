---
id: B13
title: C11 promotions and promo codes; C14 inbox and devices; banners and CMS pages
status: todo
depends_on: [B5, B7]
components: [C11, C14, C15]
contract_tags: [Promotions, Inbox]
touches_money: true
---

# B13 — Promotions, inbox and content

## Goal
Players see promotions and their bonuses, redeem promo codes, get in-app inbox messages and register devices
for push; the home page's banners and static pages come from the API.

## Read first
- `docs/design/components/c11-bonuses.md`, `c14-notifications.md`, `c15-back-office-trading.md` (CMS part)
- `docs/engineering-decisions.md` D2 (BONUS_GRANT, BONUS_CONVERT postings)
- `contracts/openapi.yaml`: tags `Promotions` (`/v1/promotions`, `/v1/me/bonuses`, `/v1/promo-codes/redeem`),
  `Inbox` (`/v1/inbox`, `/v1/inbox/unread-count`, `/v1/inbox/read`, `/v1/devices`), and `GET /v1/banners`,
  `GET /v1/pages/{slug}` (tag `Config`)

## Scope
Plan should split this (B13a promotions + bonuses, B13b inbox + devices + push log adapter, B13c banners + pages).
In: bonus rules and grants with wagering tracking, promo-code redemption, ledger postings via templates,
inbox messages from notification events, device registration (FCM adapter logs only), banners and CMS pages
read endpoints. Out: admin editing of campaigns, banners and pages (B10 admin APIs).

## Acceptance criteria
- [ ] **AC-1** All listed operations implemented; `make conformance` passes for them.
- [ ] **AC-2** Promo code: invalid → `PROMO_INVALID`, second use → `PROMO_ALREADY_USED`, redemption idempotent; grant posts `BONUS_GRANT` exactly per D2.
- [ ] **AC-3** Wagering progress updates on settled bets; conversion posts `BONUS_CONVERT` once.
- [ ] **AC-4** Inbox unread count and mark-read are per player (no cross-player access test).
