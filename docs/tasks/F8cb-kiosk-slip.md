---
id: F8cb
title: Split from F8c — the kiosk's slip priced with the retail rule set, stake on a keypad
status: todo
depends_on: [F8ca]
contract_tags: [Config]
touches_money: true
touches_ui: true
---

# F8cb — The kiosk's slip

Split from [F8c](F8c-terminal-slip-code.md) (2026-10-06, while planning). Carries F8c's **AC-3**.

## Goal

The kiosk's slip shows what the customer's picks would cost and pay under the shop's own rules (the
tenant's retail rule set), with a stake typed on an on-screen keypad, and never a figure from the online
rule set.

## Read first

- `docs/decisions.md` **FD1**, **FD4** (money)
- `docs/backend/engineering-decisions.md` **D1** (the slip; D1.12: retail uses `retail_betting`)
- `docs/backend/design/components/c19-retail-network.md` §4.2, §11
- `contracts/openapi.yaml`: `PublicConfig.retail_betting` (`RuleSet`)
- `docs/design/04-slip-and-money.md`; `src/features/bet-slip/**`; F8ca's kiosk
- `docs/contract-requests/015-terminal-reads-and-slip-codes.md`: the kiosk reads online prices until it is
  answered (F8ca decision 2). If a shop's prices differ, the slip's figures would be computed on prices
  the counter won't sell at, so this plan decides whether to wait for 015 or to say so on the slip (copy
  about money: ask at the plan gate). It also decides where the slip's odds come from after a tap
  (nothing on the kiosk updates them in F8ca; F8ca review M2).

## Scope

In: `retail_betting` in `/api/terminal/config`; the slip's modes (single, multiple, system) and figures
(stake tax, gross, bonus, win tax, net payout, the calculation steps) from `calculateBetSlip` with the
retail rules; the stake (a hint, optional) on an on-screen keypad, with the rule set's quick stakes when it
has any; slipcalc's stake fixes (too low, too high) offered as a tap; no balance, no login, no odds-change
consent; a tenant without `retail_betting` shows the picks without figures rather than the online ones
(the wording of that state is a copy-about-money question for this sub-task's plan gate).

Out: slip codes, the idle reset, the rate limit (F8cc).

## Acceptance criteria

- [ ] **AC-3** (F8c) The retail rule set is used for slip figures: with the contract's example, a stake
      below the retail minimum (10.00, online 5.00) is refused with its fix, and a multiple shows no
      accumulator bonus (the retail table is empty); figures match slipcalc on the retail rules.
- [ ] **AC-b1** The stake is typed on an on-screen keypad (digits, decimal point, delete, clear), the same
      rules as the player's stake field (two decimals at most); the slip works without a stake.
- [ ] **AC-b2** The kiosk's slip shows no balance, no login and no place button; a tenant whose config has
      no `retail_betting` shows the picks without any figure (as the player's slip does before its rules
      load), never the online rule set's.

## Verification

- `pnpm verify` passes; `pnpm vitest run tests/unit/golden.test.ts` unchanged
- `pnpm ui --grep terminal-kiosk-slip`

## Notes

- 2026-10-06: split from F8c while planning.
