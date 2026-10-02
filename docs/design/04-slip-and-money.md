# 04 — Slip and money

The frontend never decides money. Every number on the slip comes from the shared calculator
`contracts/golden/ts/slipcalc.ts` (D1), which matches the backend to the santim on all 366 golden rows;
it is a preview, and the betting engine re-prices when the bet is placed. Money and odds are the
contract's decimal strings from the mapper to the screen; the only arithmetic is slipcalc's and
`lib/money.ts`'s BigInt santim (FD4). An ESLint rule bans `parseFloat`, `Number()` and unary `+` on
money and odds fields outside those two places and the display formatters.

## What the slip shows, in player terms (D1)

| Line on the slip   | Meaning                                                                                                                                                 | Rule        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Mode               | Single (one line per pick), Multiple (one line, all picks, at least 2), System k/n (every combination of k among n; at least 3 picks)                   | D1.2        |
| Stake              | The **total** the player types or taps (quick stakes set the total, D7). Lines: `floor(stake / lines)` each; a remainder is not charged and is said so  | D1.3        |
| Stake tax          | Per line, floored, from the tenant's `taxes` with `base: stake`; net stake is what is at risk                                                           | D1.4        |
| Gross return       | Each line: floor(net line stake × product of odds), summed. Open picks count as wins in the preview                                                     | D1.5, D1.10 |
| Accumulator bonus  | Multiples only; qualifying picks are those at or above `acca_bonus_min_leg_odds`; the highest tier whose `min_legs` fits; a share of the profit, capped | D1.6        |
| Max payout reached | Gross + bonus is cut to `max_payout` — bonus first — before tax; the slip says so                                                                       | D1.7        |
| Win tax            | Each payout tax with its base (gross win, net win, profit) applies on the **whole** base once it is strictly above its threshold                        | D1.8, D9    |
| Net payout         | What the player would receive                                                                                                                           |             |
| Total odds         | Display only: product floored to two decimals, single-line bets only                                                                                    | D1.11       |

"How is this calculated?" expands every step in D1's order with the tax names and rates from the rule
set (`betSlip.taxRate` "{tax} · {rate}"). The rule set is the tenant's `betting` section of
`/v1/config/public`, with `rules_version`; while it has not loaded the slip shows "Can't price this
slip" and a retry rather than a number from a guessed rule set.

Copy about money — tax names, thresholds, what is refunded — is never invented here: it names the
rule set's own codes and amounts, and D9's open questions (whole-win tax, cap before tax, stake tax taken
from the stake, void refunds) stay the backend's to answer.

## Selections and prices

- A selection carries the contract's `outcome_id` and the odds as a string. Selecting is optimistic (it
  is only the slip); placing, booking, depositing and withdrawing wait for the server.
- A price that moved while in the slip is shown with its movement and the old price; the player
  accepts changes one by one or all (odds policy `none` / `higher` / `any`, the tenant's
  `default_odds_policy` to start, F5).
- A suspended market locks the pick: Remove is the button's job until it is gone. Two picks from one
  match cannot be combined (BET-02): the button says which to drop.
- Over `max_legs` or `max_lines` (1,024): the slip says so and the button waits.

## Placing a bet (F5; C08)

1. The player taps Place. The browser makes one `Idempotency-Key` (`crypto.randomUUID()`) for this
   intent and sends `POST /api/bets` with the picks, the odds seen, the stake and the odds policy.
2. The route handler forwards the key; it never invents one. Nothing in the UI changes until the
   answer: no balance moves, no ticket appears.
3. `409 BET_ODDS_CHANGED`: each changed leg is shown old → new from `errors[].current`; the preview is
   recomputed with slipcalc; Accept places again with a **new** key (a new intent). A retry of the same
   intent after a network drop reuses the **same** key.
4. `201`: the ticket number with its barcode and Copy, the API's `stake_tax`, `acca_bonus`,
   `potential_payout` — never the preview's — and the wallet and bets queries are invalidated.

Other refusals and their fixes: 05-errors. `BET_STAKE_TOO_HIGH` offers the limit from `errors[].limit`;
`WALLET_INSUFFICIENT_FUNDS` offers Deposit; RG blocks name the limit or the break.

## Booking codes (built in F3b; C09)

A booking stores selections only; loading re-prices. The slip can be booked by anyone with an
`Idempotency-Key` per booking intent (contract request 005 asks the API to honour it). The receipt's life
is measured from the API's clock. `/b/[code]` shows every leg with today's price and the price when
booked, marks started or suspended legs, and loads what it can.

## Balances (F6; C03, C04)

| Shown                     | Source                                                       | Rule                                                                                   |
| ------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Balance                   | `/v1/wallet` `cash`                                          | Read when a player is signed in; cached 15 s; invalidated after any money operation    |
| Withdrawable              | `/v1/wallet` (cash less what bonus terms or locks hold back) | Stated right under the balance: finding out at the withdrawal screen feels like a bait |
| Bonus, locked             | `/v1/wallet`                                                 | Bonus money is not withdrawable; locked is a pending withdrawal                        |
| Daily deposit limit       | `/v1/me/limits`                                              | Used and remaining, with Manage                                                        |
| Potential win on the slip | slipcalc on the current rule set                             | A preview; the ticket shows the API's figure                                           |

The slip warns when the stake exceeds the balance (compared as strings through `lib/money.ts`) and
offers Deposit; the API is what refuses. Amounts the player types are validated against the method's
`min`/`max` the same way before anything is sent.

## Tickets and settlement (F5; C10)

A ticket shows the API's `stake`, `stake_tax`, `total_odds`, `potential_payout` or `payout`,
`acca_bonus`, `win_tax`, `bet_type`, `system_sizes`, `rules_version`, every leg with the odds taken and
its result. A recomputation with slipcalc is only ever a labelled preview with the bet's own type and
rule version. Void legs count as odds 1.00; all void refunds the net stake (SET-02, D1.9). Cash out is
Release 2: when built, its value is the server's quote, never slipcalc on the remaining stake.

## Formats (06-language)

"ETB 1,250.00" in English, "1,250.00 ብር" in Amharic (D7); odds as the contract sends them; signed
figures with a real minus ("− ETB 230.00") where a loss is shown.
