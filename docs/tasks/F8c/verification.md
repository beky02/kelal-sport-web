# F8c — verification (F8ca — kiosk sportsbook)

## Tests proven

Each new acceptance test, green, then failed once against the behaviour it guards broken on purpose, and
green again once restored.

- `TerminalActivation.test.tsx` › "says the server couldn't be reached when activation fails otherwise"
  (the flaky helper, before planning) — the 503 answered 200 ms late: the old `expectAlert` fails every
  time, the new one passes.
- `Locale.test.tsx` › "a text hook reads the nearest locale provider, not the player's store" and
  "without a provider, reads English, East Africa Time and the Gregorian calendar" — both failed against
  the hooks as they were (reading `ui.store`), before the change.
- `Locale.test.tsx` › "the player's provider follows the stored language, clock and calendar" —
  `PlayerLocale`'s memo with no dependencies (frozen on the first value): fails.
- `terminal-mappers.test.ts` › "turns retail off only on an explicit false (AC-4)" — `retail: features.retail
=== true` (a config without the switch read as off): fails.
- `terminal-route.test.ts` › "answers the kiosk's reads only on a terminal host (AC-5)" — the host check
  taken out of `activeTerminal`: fails (a player host with a terminal cookie got a 200).
- › "refuses the kiosk's reads without an activated terminal, and calls nothing (AC-5)" — the expiry check
  taken out: fails (a lapsed cookie read the config).
- › "refuses a board query it doesn't know before calling the API (AC-5)" — unknown parameters let
  through: fails (`live=1` went on).
- › "reads the board for a terminal: the sport, the day and the filter go upstream, the board comes back
  (AC-1)" — the day dropped from the filters: fails.
