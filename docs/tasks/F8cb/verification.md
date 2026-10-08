# F8cb — verification

## Review brief

- **Config** (`mappers/config.ts`, `terminal/types.ts`, `terminal-schemas.ts`, new `rules-schema.ts`):
  `TerminalConfigView.rules` from `retail_betting` only, null without it. `aa30414` is a contract sync.
- **Shared slip parts, moved not changed:** `AlertList.tsx` (alert markup and builders out of
  `SlipAlerts.tsx`); `StakeLines`, `QuickStakes` out of `StakeInput.tsx`.
- **Kiosk:** `KioskSlip` priced (modes, alerts, `KioskStake` keypad, summaries, Book bet with the stake
  and the server's fix); `Kiosk` starts the stake empty; `KioskShell`'s slip column scrolls. Four strings.
- **Risk:** money (slipcalc on `retail_betting` only; the hint sent only when accepted, never without
  rules); the player's slip through the split; the host split.
- **The user decided (gate):** the no-rules line, an empty start, a code's hint as the stake; the sync.
- **Not done:** Get code, idle reset, 429 (F8cc); moving odds after the tap; signed reads (015).

## Automated gate

Final run, 2026-10-08, at `20281f6`, against the running `next dev` (simulated board) and Prism on :4010.
`pnpm verify` exit 0:

```
 Test Files  80 passed (80)
      Tests  1619 passed (1619)
Generated API types match contracts/openapi.yaml.
contracts/ matches the backend.
docs/backend/ matches the backend.
Host split holds: 19 player routes load no module or chunk of (terminal); 3 terminal route(s) load no module of (player) nor a chunk holding one (.next/server/app, 68 manifests).
  652 passed (7.0m)
```

| Check                                   | Result | Command                                      |
| --------------------------------------- | ------ | -------------------------------------------- |
| Typecheck, lint, format, unit/component | PASS   | `pnpm check` (1,619 tests)                   |
| Generated types                         | PASS   | `pnpm api:check`                             |
| Contract drift                          | PASS   | `node scripts/contract-sync.mjs --check`     |
| Build, host split                       | PASS   | `pnpm build`, `scripts/check-host-split.mjs` |
| Screens                                 | PASS   | `pnpm ui` (652, none on retry)               |
| Golden rows                             | PASS   | `tests/unit/golden.test.ts`, unchanged       |

The two runs before it:

1. `ticket-check-failed` (F5b's screen) failed in all four: the contract synced in `aa30414` gives
   `checkTicket` a 503, and the screen allowed only the 404 an older Prism answered. Two Prisms answer
   `localhost:4010` here — this repo's `pnpm mock` on 127.0.0.1 (the synced contract: 503) and the
   backend's Docker one on ::1 (loaded before the backend's change: 404) — so the screen now accepts
   either log (`c78aa42`). One flaky: `auth.spec.ts` › "refuses a cross-origin POST…" timed out in its
   `afterEach` (`browser.newContext: Test ended`), then passed.
2. The drift check: the backend had added `429` to `placeBet` since. Synced (`20281f6`), on the user's
   standing answer at Phase 0 ("sync on the task branch").

## Self-review

- **Money moves:** none. Book bet creates a booking (no balance, history or bets to invalidate), as in
  F8ca; nothing is placed and nothing is patched in the browser.
- **New values:** `rules` is read only in `KioskSlip`: `rules.calc` → `calculateBetSlip`,
  `PayoutSummary` and the warnings; `rules.quickStakes` → `KioskStake`. The stake priced, shown and sent is
  one value whenever there are rules (`stake = rules ? typed : ""`), and nothing is shown or sent without
  them (test). The booking refusal's `fixStake` goes to `setStake` and its message's `{amount}`.
- **Async tests:** each kiosk test taps a price only once the board is up (`homeWin()` resolves after the
  config and board answer), so the rules are there before the keypad is looked for; the refusal test
  waits for the alert (`findByRole`), the booking tests for the dialog.
- **Personal data:** none; no player, no query of a player's.
- **Route handlers:** none changed; `/api/terminal/config` answers the public rule set too (route test).
- **Screens:** priced, too low and no shop rules, each in en/am × phone/desktop; the slip's empty and
  loading states are F8ca's (`terminal-kiosk-board-*`, `terminal-kiosk-config-loading-*`), now with the
  priced slip's parts. Looked at: `kiosk-slip-{am,en}-{phone,desktop}`, `kiosk-slip-too-low-am-phone`,
  `kiosk-slip-no-rules-{en-desktop,am-phone}` (Amharic readable at 12 px, no uppercase, nothing
  overflowing at 375 px).
- **Docs:** the plan's Files list (two test files and `KioskShell` added while implementing) and AC → test
  names match the code; 10-terminal and 04-slip-and-money updated; translation notes; README status.

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
