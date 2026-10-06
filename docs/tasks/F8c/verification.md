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
