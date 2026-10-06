# F8c — verification (F8ca — kiosk sportsbook)

## Review brief

- **Split.** F8c → F8ca/F8cb/F8cc. This branch is F8ca: an active, open shop's terminal is now the kiosk.
- **Text hooks.** They read a `LocaleProvider`, not `ui.store`; the player still feeds it from the store
  (`lib/i18n/*`, `app/(player)/{locale,providers}.tsx`, `tests/component/render.tsx`). Board schemas:
  `lib/api/catalogue-schemas.ts`.
- **Server.** `app/api/terminal/{config,catalogue/*}`, `lib/server/terminal.ts` (`activeTerminal`),
  `mappers/config.ts`. The kiosk reads anonymously on the player's loaders, for an activated terminal
  only, and validates the board's query.
- **Browser.** `features/terminal/{api,hooks,stores,components/kiosk}` adds large views over the shared slip
  store and URL filters, the language switch and `features.retail`; `OddsButtonView` gains `lg`.
- **Risk.** The player's language now flows through the provider. Security sits in the new routes. Prices
  are online, not retail (request 015).
- **The user decided:** the split, request 015, and fixing F8b's flaky test first. **Not here:** figures and
  keypad (F8cb); codes, QR, idle reset and 429 (F8cc).

## Self-review

- **Money moves:** none in F8ca. Nothing is placed, booked, deposited or withdrawn; the slip store is the
  player's, unchanged, and shows the odds as the board sent them (`t.odds`, display only).
- **New values:** the kiosk's language reaches the locale (`KioskLocale`), `<html lang>` and every terminal
  call's `Accept-Language` (`kioskLanguage()`), grepped. The slip bar's count is `selections.length`. The
  switch offers `config.languages` minus the current one. A chosen language the tenant dropped gives way
  to its default.
- **Async tests:** each kiosk test waits for the price, heading or query it asserts on (`findBy…`,
  `waitFor` on the board query) before acting. One test checked the sport tabs before `/sports` answered;
  it now waits for them. Store-driven changes after a click are synchronous.
- **Personal data:** none. No player is signed in on a terminal; `terminalKeys` hold the shop's config
  and the public catalogue.
- **Route handlers:** each of the three kiosk reads checks the host, then the terminal cookie's tenant and
  expiry (401 before anything is called). The board's query is checked whole before it reaches an
  upstream URL. Answers are `no-store`, and no `Prefer` goes upstream, not even under `next dev`. Each has
  a test.
- **Screens:** board, picks, loading, empty and error, each in am/en at phone and desktop; unavailable,
  config loading and config unreadable, bilingual, at both widths. All looked at.
- **Docs:** the plan's design, keys, files and test names match the code (changes while implementing are
  marked there). 10-terminal, 06-language, 09-security, 00-overview and 01-screens are updated, as are the
  translation notes and the README status.

## Automated gate

| Check                                   | Command                                  | Result                                                                                                                                 |
| --------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, Prettier, unit + comp. | `pnpm check`                             | PASS: 77 files, 1,559 tests                                                                                                            |
| Generated types                         | `pnpm api:check`                         | PASS                                                                                                                                   |
| Contract drift                          | `node scripts/contract-sync.mjs --check` | PASS: "contracts/ matches the backend. docs/backend/ matches the backend."                                                             |
| Build                                   | `pnpm build`                             | PASS: `/api/terminal/{config,catalogue/board,catalogue/sports}` dynamic, `/terminal` static                                            |
| Host split                              | `node scripts/check-host-split.mjs`      | PASS: "19 player routes load no module or chunk of (terminal); 1 terminal route(s) load no module of (player) nor a chunk holding one" |
| Screens                                 | `pnpm ui`                                | PASS: 626 passed (4.9 m), none on retry                                                                                                |

`pnpm verify` (all of the above, in order): exit 0, on 2026-10-06, against the running `next dev` (whose
board is the simulated one, `NEXT_PUBLIC_REALTIME=simulate`) and Prism on :4010.

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
