# F8cb — verification

## Tests proven

Each new acceptance test, once green, was run against a deliberate break and seen to fail; then the
break was undone.

- `terminal-mappers.test.ts` › "takes the kiosk's rules from retail_betting, never the online betting
  (F8cb AC-3)" — the mapper given `config.betting`: fails (with the contract-shape test).
- › "has no rules without retail_betting, even with betting (F8cb AC-b2)" — the mapper falling back to
  `config.retail_betting ?? config.betting`: fails.
- `TerminalKiosk.test.tsx` › "types the stake on the keypad: digits, one point, two decimals at most,
  delete and clear, with no text box (F8cb AC-b1)" — Delete clearing the whole stake: fails.
- › "starts with no stake and works without one: the figures wait, and Book bet saves the picks alone
  (F8cb AC-b1)" — `Kiosk` no longer starting the stake empty: fails (the player's 100 shows).
- › "refuses a stake under the shop's minimum — 10.00, not the online 5.00 — and offers it as a tap (F8cb
  AC-3)" and › "prices a multiple with the shop's rules: no accumulator bonus, and slipcalc's payout to
  the santim (F8cb AC-3)" — the kiosk's rules mapped from `betting`: both fail.
- › "books the stake typed as the code's hint, and offers the server's stake when it refuses it (F8cb
  AC-b1)" — `BookBet` ignoring the refusal's `fixStake`: fails.
- › "shows no balance, no log in and no place button — only Book bet (F8cb AC-b2)" — "Balance" added
  beside the stake's label: fails.
- › "shows the picks without any figure when the tenant has no shop rule set, never the online one's
  (F8cb AC-b2)" — the typed stake (a loaded code's hint) priced and sent without rules: fails.
- › "loads a code's picks into the slip through the terminal, at the server's prices, and says what
  couldn't come" (F8ca's, updated for the hint) — the kiosk never pricing the stake: fails.
