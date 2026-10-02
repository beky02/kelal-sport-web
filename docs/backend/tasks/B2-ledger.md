---
id: B2
title: C03 ledger — post, reverse, balances, invariants
status: todo
depends_on: [B0]
components: [C03]
contract_tags: [Wallet]
touches_money: true
---

# B2 — Ledger (C03)

## Goal
The single source of truth for money: balanced double-entry postings through one `post()` function,
idempotent, never overspending a player, append-only, with the posting templates every later module uses.

## Read first
- `docs/design/components/c03-wallet-ledger.md` (all)
- `docs/engineering-decisions.md` D2 (sign convention, stake-tax posting, accounts, hot accounts, idempotency key format) — wins over C03
- `docs/design/td-02-data-architecture.md` (partitioning of `ledger_entry`)
- `contracts/openapi.yaml`: `GET /v1/wallet`, `GET /v1/wallet/transactions`

## Scope
In:
- Migrations: `ledger.account`, `ledger_txn`, `ledger_entry` (partitioned, DEFAULT + 12 monthly per D6), `adjustment_request`, `recon_run`, `recon_break`; RLS + FORCE on all; trigger blocking UPDATE/DELETE on entries; deferred constraint trigger: each txn sums to zero.
- `LedgerService.post/reverse/balances/open_player_accounts` per C03 §7–8 with D2 rules (ordered `FOR UPDATE` locks on player accounts only; hot house accounts unlocked with `balance_after` null and a roll-up job).
- Posting templates as named builders (`templates.bet_stake(...)`, …) for every row of C03 §6 — retail templates come in B9.
- `GET /v1/wallet`, `GET /v1/wallet/transactions` (cursor pagination per TD-01).
- Nightly internal reconciliation job (cached = sum of entries; every txn sums to zero) writing `recon_break`.

Out: deposits/withdrawals flows (B8), retail templates (B9), adjustments API (B10).

## Acceptance criteria
- [ ] **AC-1** Every C03 §6 template has a test asserting exact entries for a worked amount (e.g. BET_STAKE 100.00 at 15%: +10000 PLAYER_CASH, −8500 HOUSE_OPEN_STAKES, −1500 TAX_PAYABLE_STAKE).
- [ ] **AC-2** Property test (hypothesis, ≥ 10,000 random postings): every txn sums to zero, no player account goes negative, cached balance = sum of entries after roll-up.
- [ ] **AC-3** Replay: same idempotency key 100× → one txn; same key with different lines → `IDEMPOTENCY_MISMATCH`.
- [ ] **AC-4** Concurrency (db test): 200 parallel stakes on one player with balance for 100 → exactly 100 succeed, the rest `WALLET_INSUFFICIENT_FUNDS`, final balance 0.
- [ ] **AC-5** UPDATE/DELETE on `ledger_entry` fails at the database; an unbalanced txn fails at commit.
- [ ] **AC-6** RLS: tenant B cannot see tenant A's accounts or transactions.
- [ ] **AC-7** Wallet endpoints match the contract (schema-validated tests) and only return the caller's own data.

## Verification
- `make verify` (db tests included)
