---
id: B7
title: C10 settlement from fake-feed results, rollbacks; accumulator bonus funding (C11)
status: todo
depends_on: [B6]
components: [C10, C11]
contract_tags: []
touches_money: true
---

# B7 — Settlement

## Goal
Results from the fake feed settle every open bet correctly — win, loss, void, half results, rollbacks — with
exact ledger postings and the accumulator bonus funded from `HOUSE_BONUS_COST`.

## Read first
- `docs/design/components/c10-settlement.md`, `c11-bonuses.md` (accumulator bonus part)
- `docs/engineering-decisions.md` D1 (preview vs settlement, voids, bonus tiers), D2 (postings)
- `docs/design/components/c03-wallet-ledger.md` §6 (BET_WIN, BET_LOSS, BET_VOID, ACCA_BONUS)

## Scope
In: `settlement.outcome_result` (global), settlement worker consuming result events, per-bet settlement using
`slipcalc.quote(settled=True)` with the bet's stored `rules_version`, postings via ledger templates,
resettlement/rollback with clawback to `PLAYER_DEBT` when cash is short, events `bet.settled`/`bet.resettled`/`bet.voided`.
Out: bonus campaigns, wagering (later C11 work), manual settlement UI (B10).

## Acceptance criteria
- [ ] **AC-1** Win, loss, void, half-win, half-lose and all-void bets settle to the exact golden-CSV numbers for the same inputs.
- [ ] **AC-2** A rollback of a settled result reverses the postings and re-settles; a clawback larger than cash creates `PLAYER_DEBT`, never negative cash.
- [ ] **AC-3** Settlement is idempotent: replaying the same result event changes nothing (db test).
- [ ] **AC-4** Bets settle under their stored `rules_version`, even after the tenant activates new rules.
- [ ] **AC-5** After settling 1,000 random bets, `HOUSE_OPEN_STAKES` equals the net stakes of still-open bets (invariant test).
