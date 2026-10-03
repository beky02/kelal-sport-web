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
- A price that moved while in the slip is shown with its movement and the old price. "When odds
  change" (built in F5a) is the odds policy the bet is sent with — Ask me (`none`), Accept higher
  (`higher`), Accept any (`any`) — starting at the tenant's `default_odds_policy` and reset by Clear and
  by loading a booking. The slip asks the player to accept exactly the moves the engine would refuse:
  every move under Ask me, a drop under Accept higher, none under Accept any; one by one or all.
  Accepting makes the shown price the agreed one, so a later move from it asks again.
- A suspended market locks the pick: Remove is the button's job until it is gone. Two picks from one
  match cannot be combined (BET-02): the button says which to drop.
- Over `max_legs` or `max_lines` (1,024): the slip says so and the button waits.

## Placing a bet (built in F5a; C08)

1. The player taps Place. The browser sends `POST /api/bets` with each live pick and the odds on
   screen, the bet type and system size, the total stake as typed (the engine splits it per line as the
   preview did, D1.3) and the odds policy, under one `Idempotency-Key` for this request.
2. The route handler checks the request (origin, CSRF header, JSON, 16 KiB, a strict schema, a session)
   and forwards the key unchanged; it never makes one. Nothing in the UI changes until the answer: no
   balance moves, no ticket appears. Place waits, in every mounted slip, until it comes.
3. **The key belongs to one bet.** A bet sent and never answered in a way that settles it — no response,
   a 5xx, a reply the app could not read, or 30 s without one — is **unconfirmed**: "We couldn't confirm
   your bet. It may have gone through — try again, and if it did you'll see the same ticket." Try again
   sends that very request with its key, never the slip as it is now, and every Try again shows that
   bet's own amount (slipcalc's total when it was placed). No change to the slip, no price move, no
   refusal and no lost session drops it: a refusal of a retry says nothing about the first try, which may
   still commit (the engine records a key only once a bet commits, C08 §7). It ends only with a ticket —
   its own, or one for a bet the player chose to place as new; the slip tracks one unconfirmed bet, the
   latest.
   - **The main button acts on the slip shown above it.** While the slip still is that bet — the same
     picks, bet type and stake; a price that moved since doesn't make it another bet — the main button
     is Try again. Once it is another bet, the main button places it as a new bet ("Place as a new bet",
     with the slip's amount), or does whatever the slip needs first (Accept changes, Remove); Try again
     stays in the alert, which names the bet ("Try again sends that bet as it was: Multiple · 3 picks")
     and, while the slip has picks, warns that placing this slip as well makes two bets. The alert
     names it too whenever Try again would send what the slip doesn't show — other prices, another
     odds setting. The same picks at the same prices (`"3.05"` is `"3.050"`) never go under a new key.
   - **A refused Try again is said as one**: "Try again didn't go through", with the reason (the odds on
     that bet have changed, a selection in it is no longer available, the rate limit, the balance…) and
     the fix where there is one — never "Bet not accepted" or "wasn't placed". A refusal of that bet's
     prices or picks (odds changed, started, suspended) means the same Try again would meet it again, so
     from then on only the very same prices make the slip that bet: the main button follows the slip
     (Accept, then Place as a new bet), and the alert keeps Try again to find out whether the first try
     went through.
   - Try again first reads `/api/me` afresh and sends nothing if someone else is signed in now (another
     tab), so a bet is only ever sent for the player who placed it. That read and the POST share the
     attempt's 30 s: past it the bet is unanswered, never left on "Placing…".

   A ticket or a refusal of any other attempt spends its key: a second bet on the same slip, or
   accepting new odds, is a new intent with a new key.

4. `409 BET_ODDS_CHANGED`: `errors[].field` (`legs[i].odds`) names the leg by its place in the request
   sent; its price sent becomes the agreed one and `errors[].current` its price now, so the slip shows
   old → new, slipcalc re-prices the preview, and the odds alert says the bet wasn't placed. Accept, then
   Place: a new key. `BET_EVENT_STARTED` / `BET_MARKET_SUSPENDED` mark the named pick suspended
   ("Match started", Remove).
5. `201`: the ticket number with its Code 128 barcode and Copy, and the API's `PlacedBet` figures —
   stake, stake tax, total odds (single-line), accumulator bonus, potential payout; no winnings tax
   until settlement. The wallet and bets are read again, never adjusted in the browser. The attempt,
   a refusal and the ticket live in the slip store, so a sheet closed mid-request shows the ticket when
   it opens. It is the signed-in player's alone: hidden from a guest, dropped when someone else signs
   in, so a shared phone hands nothing over.

Other refusals and their fixes: 05-errors. `BET_STAKE_TOO_HIGH` offers the limit from `errors[].limit`;
`WALLET_INSUFFICIENT_FUNDS` offers Deposit; `KYC_REQUIRED` offers Verify; RG blocks say a limit is
reached (View limits) or that betting is paused during a break.

## Booking codes (built in F3b; C09)

A booking stores selections only; loading re-prices. The slip can be booked by anyone with an
`Idempotency-Key` per booking intent (contract request 005 asks the API to honour it). The receipt's life
is measured from the API's clock. `/b/[code]` shows every leg with today's price and the price when
booked, marks started or suspended legs, and loads what it can.

## Balances (F6a built; C03, C04)

| Shown                     | Source                                     | Rule                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Balance                   | `/v1/wallet` `cash`, through `/api/wallet` | The header chip, the wallet card and the slip's check, exactly as sent. Read when a player is signed in; fresh for 15 s; read again after any money operation, never adjusted in the browser                                                                                                                                                 |
| Withdrawable              | — (the contract has no such figure)        | By C03 `cash` is the withdrawable money, so no second figure is worked out here (F6a decision 2); whether a withdrawal can start is the API's `can_withdraw`                                                                                                                                                                                 |
| Bonus                     | `/v1/wallet` `bonus`                       | Under the balance when above zero: "for bets only — can't be withdrawn"; never counted by the slip (`use_bonus: false`)                                                                                                                                                                                                                      |
| Pending withdrawals       | `/v1/wallet` `locked`                      | Under the balance when above zero; already out of `cash`                                                                                                                                                                                                                                                                                     |
| Owed                      | `/v1/wallet` `debt`                        | Under the balance when above zero, with C03's rule: "repaid first from your next deposits and wins"; absent means not shown, never 0.00                                                                                                                                                                                                      |
| Each movement             | `/v1/wallet/transactions`                  | The API's signed `amount` and `balance_after`; no status (a ledger movement is posted, C03 §2). The balance-after line is left out for `bonus` and `bonus_converted` (a bonus grant posts only to the bonus account, C03 §6, and the contract doesn't say which balance it reports) and for a kind the contract adds later, shown as "Other" |
| Daily deposit limit       | `/v1/me/limits` (F7)                       | Used and remaining, with Manage — the wallet's card returns with F7; until then the API's `RG_LIMIT_REACHED` is the only limit a deposit meets                                                                                                                                                                                               |
| Potential win on the slip | slipcalc on the current rule set           | A preview; the ticket shows the API's figure                                                                                                                                                                                                                                                                                                 |

The only comparison anywhere near a balance is `lib/money.ts`'s, on strings: which lines show (above
`"0.00"`), the slip's warning when the stake exceeds the balance (it offers Deposit; the API is what
refuses), and amounts the player types against the method's `min`/`max` before anything is sent (F6b, below).

## Deposits (F6b built; C04)

| Shown                | Source                                                 | Rule                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A method's limits    | `/v1/payment-methods` `deposit` (`withdrawal` for F6c) | The API's strings on the tile and the amount step; a typed amount is compared with `min` and `max` through `lib/money.ts` before anything is sent; the API checks again (`PAY_AMOUNT_OUT_OF_RANGE`)                                                    |
| The amount sent      | What the player typed                                  | Digits, one point, two decimals at most, sent in the contract's form (`"500"` → `"500.00"`); a refused amount's fix offers the API's own `errors[].limit` when it gives one, else the method's limit on that side                                      |
| Fee, account         | — (the contract has neither for a deposit)             | Not shown: the provider's own prompt or page says what it charges                                                                                                                                                                                      |
| The deposit's status | `/v1/deposits/{id}`, every 3 s while going             | Shown as the API says it; `completed` invalidates the balance and the history, which are read again — the only way a deposit shows in the balance. Nothing is added up in the browser: with an amount owed, the balance rises by less than the deposit |
| The reference        | The deposit's `id`                                     | The contract has no provider reference yet (DEP-08, contract request 009)                                                                                                                                                                              |

One `Idempotency-Key` per deposit intent, made when the player confirms: with no answer (no response,
30 s, a 5xx without a deciding code, a rate limit, an unreadable reply) Try again sends the same request
with the same key — also after the player left and came back, since the intent is kept outside the flow
(`stores/deposit.store.ts`, per player, memory only). A Try again the API refuses keeps it too: its no
says nothing about the first try. A first try's answer — a 201, a 4xx, `PAY_PROVIDER_ERROR`,
`REAL_MONEY_DISABLED` — ends the intent, and the next Confirm, a fix, or another method or amount is a new
one. A deposit that started is read until the API decides, wherever the player goes
(`DepositFollower`), so the balance moves when the money arrives and only then. The confirm step says
"You deposit {amount}": what goes into the wallet, not what the provider charges, which its own prompt
or page says.

## Tickets and settlement (F5b; C10)

A ticket shows the API's `stake`, `stake_bonus` (when above zero), `stake_tax`, `total_odds`,
`acca_bonus` (when above zero), `win_tax` (once settled), `potential_payout` (open) or `payout`
(settled), `bet_type`, `system_sizes` and `lines`, and every leg with the odds taken and its result —
as built in F5b, nothing on a ticket is recomputed: no net stake, no gross, no refund line, which the
contract's `Bet` doesn't carry. A figure the API didn't send shows "—", never 0.00. "Payout", not "net
payout": the contract doesn't say whether payout taxes are out of it (contract request 007, which also
asks for `rules_version`). Void legs read "counted at odds 1.00" (D1.5); all void refunds the net stake
(SET-02, D1.9) — the API's `payout` says so. Cash out is Release 2: the panel shows nothing until the
server quotes a value (the contract has no quote yet); its preview of what stays on the bet is still
slipcalc on the remaining stake, as the ticket's own type, until the server quotes that too (F3a review
M4).

## Formats (06-language)

"ETB 1,250.00" in English, "1,250.00 ብር" in Amharic (D7); odds as the contract sends them; signed
figures with a real minus ("− ETB 230.00") where a loss is shown.
