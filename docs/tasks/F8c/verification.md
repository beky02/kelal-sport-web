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
- `TerminalKiosk.test.tsx`, each failed once against its behaviour broken, then passed:
  - "shows the sports, the days and the board's matches with their prices once the terminal is active" —
    a row without its 1X2 market.
  - "reads the board for the sport and day in the URL, and only through /api/terminal" — a day tap that
    sets nothing.
  - "says there are no matches on an empty day and goes back to the start" — the empty state's button
    unwired from `reset`.
  - "says the matches couldn't load and tries again on a tap" — Try again that doesn't refetch.
  - "says the server can't be reached when the config can't be read, and tries again" — the same on the
    config.
  - "reads the status again when a kiosk read is refused as not activated" — the 401 check matching 999.
  - "puts a tapped price in the slip and takes it out on a second tap" — a price that never toggles.
  - "removes one pick and clears the slip" — Remove unwired.
  - "opens in the tenant's default language and switches with one tap" — `<html lang>` pinned to `am`.
  - "asks in the kiosk's language" — the reads' `Accept-Language` pinned to `am`.
  - "starts in English for a tenant whose default is English" — the tenant's default ignored on both of
    its paths (the locale and the store's fallback). Breaking one path alone left it green, because the
    other still carried the default.
  - "offers no switch when the tenant has one language" — the switch offering every language.
  - "says betting isn't available here, with no board and no slip, when retail is off" — the sportsbook
    shown whatever `retail` says.
