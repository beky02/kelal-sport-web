---
id: B9
title: C19 retail network (milestone M3)
status: todo
depends_on: [B6, B7]
components: [C19]
contract_tags: [Retail - terminal, Retail - cashier, Agent portal, Admin - retail]
touches_money: true
---

# B9 — Retail shops and agents

## Goal
The shop flow works end to end: terminal slip code → cashier sale → printed receipt model → settlement →
cash payout → Z report, with agents, shops, devices, shifts, settlements and commission.

## Read first
- `docs/design/components/c19-retail-network.md` (all; §7 postings, §10 events, §11 config keys)
- `docs/engineering-decisions.md` D2 (accounts, reference types), D3 (device signatures, retail_staff principal, R-tickets), D4 (retail events)
- `contracts/openapi.yaml`, the four retail tags
- Contract examples: slip code `48291735`, ticket `R7K2-M9XP-K`, barcode `R7K2M9XPK.3F9A0C21B7`, sale stake 50 / tax 7.50 / win 89.25 at odds 2.10 — the contract numbers win over C19 examples

## Scope
Plan must split this (suggested: B9a hierarchy + devices + activation + signatures; B9b slip codes + sale +
receipt; B9c payout + cancel + approvals; B9d shifts + Z report + settlements + commission).
Out: printing hardware integration (web app), virtuals in shops (D8).

## Acceptance criteria
- [ ] **AC-1** Device signature check: missing, stale (> ±30 s), wrong key, or replayed signature → rejected with `RETAIL_DEVICE_NOT_ALLOWED` (tests for each).
- [ ] **AC-2** Every retail posting in C19 §7 has an exact-entries test; `SHOP_CASH` after the contract's example shift equals the contract example (1550.00 → 1460.75 after the payout).
- [ ] **AC-3** A slip code is consumed once (`RETAIL_SLIP_CODE_CONSUMED`) and expires (`RETAIL_SLIP_CODE_EXPIRED`); selling is idempotent per `Idempotency-Key`.
- [ ] **AC-4** Payout: not payable, already paid, wrong shop, daily cap, ID required, and big-win approval paths each return their contract code; a cashier cannot approve their own request (`APPROVAL_SELF_NOT_ALLOWED`).
- [ ] **AC-5** Cancel only inside the window and under the cancel limit.
- [ ] **AC-6** Shift open/close with Z report totals that reconcile to ledger entries for the shift.
- [ ] **AC-7** `make conformance` passes for the four retail tags.
