---
id: F8cb
title: Split from F8c — the kiosk's slip priced with the retail rule set, the player's stake field
status: done
depends_on: [F8ca]
contract_tags: [Config]
touches_money: true
touches_ui: true
---

# F8cb — The kiosk's slip

Split from [F8c](F8c-terminal-slip-code.md) (2026-10-06, while planning). Carries F8c's **AC-3**.

## Goal

The kiosk's slip shows what the customer's picks would cost and pay under the shop's own rules (the
tenant's retail rule set), with a stake typed in the player's stake field (the user removed the on-screen
keypad, 2026-10-08), and never a figure from the online
rule set.

## Read first

- `docs/decisions.md` **FD1**, **FD4** (money)
- `docs/backend/engineering-decisions.md` **D1** (the slip; D1.12: retail uses `retail_betting`)
- `docs/backend/design/components/c19-retail-network.md` §4.2, §11
- `contracts/openapi.yaml`: `PublicConfig.retail_betting` (`RuleSet`)
- `docs/design/04-slip-and-money.md`; `src/features/bet-slip/**`; F8ca's kiosk
- **The user's decision (2026-10-07): no per-shop or per-agent prices or rules.** Every shop and agent
  sells at the brand's prices and under one brand-level shop rule set, the tenant's `retail_betting`
  (option 1: the same in every shop, and allowed to differ from the online `betting`). So the kiosk's
  catalogue prices (read anonymously, F8ca decision 2) are the shop's prices, and nothing waits on request
  015 part 1. This plan still decides where the slip's odds come from after a tap (nothing on the kiosk
  updates them in F8ca; F8ca review M2).
- F8ca's booking-code loader (rework 2; review M2 of its third round): a loaded code leaves its
  `stake_hint` in the shared slip's `stake`, its bet type in `mode` and its sizes in `systemK`
  (`replaceSlip`). This plan decides whether the shop honours a code's stake hint, where the kiosk's stake
  starts, how the kiosk accepts a moved price before pricing (the kiosk passes `pending={false}` today),
  and whether `BookingNotice` gets `priced` for a system code's sizes note (`priced={null}` in F8ca).

## Scope

In: `retail_betting` in `/api/terminal/config` (the brand's one shop rule set; no per-shop lookup); the
slip's modes (single, multiple, system) and figures from `calculateBetSlip` with the retail rules, shown as
the player's slip shows them since 2026-10-07 (`SlipSummary` and `PayoutSummary`: total odds, bonus, the
payout; no tax lines or working); the stake (a hint, optional) in the player's stake field (planned as an
on-screen keypad; removed on the user's review), with the rule set's quick stakes when it
has any; slipcalc's stake fixes (too low, too high) offered as a tap; no balance, no login, no odds-change
consent; a tenant without `retail_betting` shows the picks without figures rather than the online ones
(the wording of that state is a copy-about-money question for this sub-task's plan gate).

Out: slip codes, the idle reset, the rate limit (F8cc).

## Acceptance criteria

- [x] **AC-3** (F8c) The retail rule set is used for slip figures: with the contract's example, a stake
      below the retail minimum (10.00, online 5.00) is refused with its fix, and a multiple shows no
      accumulator bonus (the retail table is empty); figures match slipcalc on the retail rules.
- [x] **AC-b1** The stake is typed in the player's stake field, with the same rules (two decimals at
      most); the slip works without a stake. (The user's review, 2026-10-08: no on-screen keypad; this
      replaces "on an on-screen keypad (digits, decimal point, delete, clear)".)
- [x] **AC-b2** The kiosk's slip shows no balance, no login and no place button; a tenant whose config has
      no `retail_betting` shows the picks without any figure (as the player's slip does before its rules
      load), never the online rule set's.

## Verification

- `pnpm verify` passes; `pnpm vitest run tests/unit/golden.test.ts` unchanged
- `pnpm ui --grep terminal-kiosk-slip`

## Notes

- 2026-10-06: split from F8c while planning.
- 2026-10-08: planned and built. The user's answers at the plan gate: a tenant without `retail_betting`
  says "Ask the shop staff what this slip pays."; the kiosk's stake starts empty; a loaded code's stake
  hint becomes the stake, under the shop's limits. Two contract syncs on the branch (additive error
  responses; `placeBet`'s 429).
- 2026-10-08: verified (`docs/tasks/F8cb/verification.md`): `pnpm verify` passes (1,621 tests, 652
  screens). The panel's one MAJOR (Book bet below the fold at 1440 × 900) is fixed with a pinned footer.
  Follow-ups: a named "start the kiosk's slip" action in F8cc (M2/Q3); a shared booking refusal with the
  player's slip (Q2); one pick under "Multiple" (U5, shared); the stake field's 11 px label, on both sites since the rework (U3).
- 2026-10-08, the user's review: "lets remove this i think it is too much" — the on-screen keypad is gone;
  the kiosk's stake is the player's stake field (plan, "Rework"). AC-b1 reworded. Verified again.
- 2026-10-08, the user's review: the min and max stake are the same on the kiosk and the player site — by
  configuring `retail_betting`'s limits equal to `betting`'s, no code change — and the stake starts at the
  rule set's minimum on both sites (plan, "Rework 2").
