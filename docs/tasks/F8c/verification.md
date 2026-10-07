# F8c — verification (F8ca — kiosk sportsbook)

## Review brief — second user review (2026-10-07)

- **What the user asked:** no shop name, address or PC label on screen; the main page's loading instead of
  the terminal's spinner; English as the terminal's first language; Load booking code on the kiosk.
- **Who built it:** the plan and English first (`de3a715`, `fa380f1`) here; the rest by Codex (`8cd3487`,
  `a42eb20`); a panel review, then fixes (`29b8947`, `6e1ff24`). Diff: `git diff 614fe22..HEAD`.
- **Frame:** one `TerminalBar` (brand, home), no shop or PC. Starting is the real page with its reads
  held (`KioskStarting`), so nothing moves when the kiosk comes up. Activation keeps no bar (F8b AC-4).
- **Booking:** `GET /api/terminal/bookings/[code]` (host, cookie, code checked first, `no-store`, no
  `Prefer`); `apiClient` mirrors exactly `bookings/{code}`. The slip loads the server's re-priced legs.
- **Risk:** the shared booking hook, notice, expiry and schemas (kept to main's behaviour); the startup
  frame's held client. **The user's decisions:** the four changes. Not done: Codex's tooling commit
  `33cd943` sits on this branch, waiting on the user.

## Review brief — rework (the user's review, 2026-10-06)

- **What changed since `39a081a`** (diff `git diff 39a081a..HEAD`): on the user's direction, the kiosk is
  now the player's home, league and match pages, sidebar (no Favourites), search and slip, at the player's
  sizes, with nothing that needs a player. The kiosk's own views are gone.
- **The seam.** `features/sportsbook/chrome.tsx` is a static context: shell, realtime, data saver, lock,
  favourites, drawer, countries, links. The player provides it from its stores
  (`(player)/sportsbook-chrome.tsx`), the kiosk its own (`kiosk/chrome.ts`). It is read by the views,
  `EventRow`, `OddsButton`, `CompetitionSection`, `BoardHeader`, `DateStrip`, `EventMeta`, `EventHeader`,
  `HeaderSearch`, `CountriesCard`, `TopCompetitionsCard` and the data-saver hooks. `apiClient` takes its
  base and language from `<html>`.
- **Server.** New `/api/terminal/catalogue/{competitions/top,competitions/countries,events/[id],search}`;
  the board takes `competition`; all before kick-off only; `lib/server/terminal.ts`.
- **Terminal app.** `(terminal)/terminal/layout.tsx` gates the three pages; there are `KioskShell`,
  `KioskHeader` and `KioskSlip`, and `createTerminalQueryClient` (401 → status).
- **Risk.** Player behaviour through the seam (same stores, same subscriptions); the four new routes; the
  API client's language now from `<html lang>`.
- **The user decided:** reuse the main page minus account items; home, league and match pages and search
  now; the player's sizes (AC-2's 48 px dropped). The first round's decisions stand (split, request 015).
- **Round 2.** The rework's panel found three MAJORs (M1, S1, Q1). They are fixed in `d0088e3` with the
  MINORs below. The kiosk polls prices every 30 s and locks them while offline. The chrome refuses to run
  without a site's. `apiClient` re-roots only the catalogue, to the exact terminal base.

## Review brief — first round

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

As of the rework and its review fixes (`d0088e3`).

- **Money moves:** none in F8ca. Nothing is placed, booked, deposited or withdrawn. The slip store is the
  player's and unchanged; the kiosk shows the odds as tapped (`formatOdds`, display only). Slipcalc and
  the golden files are untouched (money review, both rounds).
- **New values:** grepped where each new or rewired value is read:
  - the kiosk's language: `<html lang>` (`KioskLocale`) → the text hooks (`LocaleProvider`) and
    `apiClient`'s `Accept-Language`;
  - `chrome.pricePollMs`: `useBoard` and `useEvent`'s `refetchInterval`;
  - `chrome.useOddsLocked`: `OddsButton` only;
  - `chrome.links`: `EventRow`'s More, `CompetitionSection`'s header, the sidebar's cards,
    `HeaderSearch`'s options and `EventHeader`'s back link.

  Each place uses its own value.

- **Async tests:** each kiosk test waits for the price, heading or call it asserts on. The 30 s poll and
  midnight tests run on fake timers with Query's scheduler on microtasks. The way home is looked for
  inside the match header, not anywhere on the page (Q1).
- **Personal data:** none. No player signs in on a terminal; a 401 makes the terminal's client read its
  status again, never `/api/me`.
- **Route handlers:** each terminal read checks the host first, then the terminal cookie's
  tenant and expiry (401, nothing called). The board's query, the match id (never dots alone) and the
  search (2 to 50 characters) are checked before they reach an upstream URL. Answers are `no-store`, and
  no `Prefer` goes upstream, even under `next dev`. Each check has a test.
- **Screens:** board, picks (and the phone's collapsed bar), league, match, loading, empty and error, in
  am/en at phone and desktop. Search at desktop, in both languages (the player's search starts at `xl`).
  Unavailable, config loading and config unreadable, bilingual, at both widths. Booking-code screens were
  inspected in both languages and widths; no shop/address or device label appears.
- **Docs:** the plan's Rework section (R1–R8 and round 2), its Files and AC→tests match the code.
  10-terminal, 09-security, 06-language, 00-overview, 01-screens, `AGENTS.md`, the translation notes and
  the README status are current.

## Automated gate

Final run, 2026-10-07, at `90577b0` (after the user's third and fourth reviews: Book bet on the kiosk, the
code in a dialog on both sites, the slip without tax lines, and a contract sync). It ran against the
running `next dev` (simulated board) and Prism on :4010. `pnpm verify` exit 0:

```
 Test Files  80 passed (80)
      Tests  1610 passed (1610)
Generated API types match contracts/openapi.yaml.
contracts/ matches the backend.
docs/backend/ matches the backend.
Host split holds: 19 player routes load no module or chunk of (terminal); 3 terminal route(s) load no module of (player) nor a chunk holding one (.next/server/app, 68 manifests).
  640 passed (5.6m)
```

None on retry. The run before it stopped at the drift check: the backend's contract had moved on
(additive error responses and `Accept-Language`, the `bet.placed` event schema); synced in `90577b0` on the
user's go-ahead.

After the panel (round 3), at the user's request and without a further panel:

- **Book bet on the kiosk** (`fe13e58`): `POST /api/terminal/bookings` (an activated terminal, this site's
  page, one `Idempotency-Key`, a strict body, no `Prefer`, `no-store`); `apiClient` mirrors exactly
  `POST bookings`. Tests: "books the slip as a code through the terminal…", "books a slip for an activated
  terminal…" (each fails with its check taken out).
- **A mock code's expiry** (`6497dae`): Prism's fixed `expires_at` had passed, so every code booked in
  development arrived expired; from the mock only, it now gets C09's 24 h. Tests in `booking-route.test.ts`.
- **The code in a dialog** (`2364fb2`, `7f32ccc`, `485eafa`): `BookingCodeDialog` on both sites; no Copy or
  Telegram on the kiosk; "Booked" opens it again.
- **No tax lines on the slip** (`485eafa`, the user's decision): `SlipSummary` shows total odds, system
  lines and a bonus; the payout is slipcalc's, taxes included, and the placed ticket still itemises them
  (SRS HIS-02).
- **Codex's hook paths** (`fe13e58`): repo-relative.

## Acceptance criteria

F8ca's, as revised by the user's two reviews. Every test named here passes in the final `pnpm verify`.

| AC   | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | PASS   | `TerminalKiosk.test.tsx` › "shows the sports, the days and the board's matches with their prices, read through /api/terminal only"; "offers nothing that needs a player…"; "names no shop and no PC anywhere on the kiosk, as it starts or once it is up (rework 2)"; "starts as the main page does — its bar and the board's rows to come — while the status and then the config are read, and reads nothing else"; "holds a match page's book too while the terminal starts…"; "carries the licence, the age limit and the helpline…"; the empty, error, config-offline, 401, offline-lock, midnight, 30 s and sports-retry tests. `TerminalStatus.test.tsx` › "shows the closed shop until it opens…" (no shop named). `terminal.spec.ts` › "kiosk-config-loading… nothing moves when the kiosk comes up (F8ca, review U1)". Screens: `terminal-loading-*`, `terminal-kiosk-config-loading-*`, `terminal-kiosk-{board,loading,empty,error}-{am,en}-{phone,desktop}` |
| AC-2 | PASS   | Sizes are the player's (the user's decision). › "puts a tapped price in the player's slip…"; "removes one pick and clears the slip"; "returns focus to the slip's bar when its sheet closes". Screens: `terminal-kiosk-picks-*`, `terminal-kiosk-picks-bar-*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| AC-3 | PASS   | › "opens in English and switches to Amharic with one tap" (the contract's tenant defaults to Amharic); "asks in the kiosk's language"; "opens in the tenant's default where it doesn't offer English"; "falls back to English, on screen and in its calls…"; "offers no switch when the tenant has one language". `kiosk-language.test.ts`: 7 rows. Every kiosk screen in `am` and `en`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| AC-4 | PASS   | › "says betting isn't available here, with no board and no slip, when retail is off". Screens: `terminal-unavailable-*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| AC-5 | PASS   | `terminal-route.test.ts`: every kiosk read, the booking route included, 404 + `no-store` on a player host and 401 without a terminal, nothing upstream; "loads a well-formed booking only for an activated terminal and never forwards Prefer" (both languages; a malformed code 422 `VALIDATION_FAILED`, `no-store`, nothing upstream). `api-client.test.ts` › "routes booking detail reads to terminal's guarded mirror…"; "re-roots a booking read only by its code, and nothing with a dot segment (review SEC1)". `BookingFlow.test.tsx` › "shows the code's expiry on the clock and calendar the player chose (F8ca rework 2)". `check-host-split.mjs` holds                                                                                                                                                                                                                                                                                                     |
| AC-6 | PASS   | League tests and `terminal-kiosk-league-*`, unchanged this round                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| AC-7 | PASS   | Match tests and `terminal-kiosk-match-*`, unchanged this round                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| AC-8 | PASS   | Search tests and `terminal-kiosk-search-*`, unchanged this round                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| AC-9 | PASS   | `TerminalKiosk.test.tsx` › "loads a code's picks into the slip through the terminal, at the server's prices, and says what couldn't come" (the pick at 2.10, 2.05 struck through, one pick, no amount, the call `GET /api/terminal/bookings/7KQ2M9X`); "leaves the slip as it was when nothing in the code can be added, and says so"; "rejects a malformed code before calling the booking route"; "does not offer a loader when booking codes are disabled". `terminal.spec.ts` › "kiosk-booking-code…" against the real route and Prism. Screens: `terminal-kiosk-booking-code-{am,en}-{phone,desktop}`                                                                                                                                                                                                                                                                                                                                                             |

## Tests proven — second user review

Each was run with its behaviour broken and failed, then passed restored (2026-10-07). Codex's own notes
here overstated some tests (review Q7, S4); these replace them.

- **English first.** The rewritten kiosk tests ran red against the tenant-default rule before `fa380f1`
  (21 failed). `kiosk-language.test.ts` › "both offered, Amharic the default, nothing chosen → en": the old
  rule (`config.defaultLanguage`) fails it.
- **No shop.** "names no shop and no PC anywhere on the kiosk…" and the closed-shop check in
  `TerminalStatus.test.tsx` were written first and failed against the bar that named the shop.
- **Starting** › "starts as the main page does…": the held client's reads switched on fails it (catalogue
  reads before the config); the page left out (Codex's bare frame) fails it.
- › "holds a match page's book too…": `useEvent`'s `enabled: id.length > 0` back fails it.
- `terminal.spec.ts` › "kiosk-config-loading… nothing moves…": Codex's frame put back fails it at both
  widths (the rows' `y` 68 → 166 on desktop, 64 → 248 on phone). It passed 20 of 20 repeated runs.
- **Booking** › "loads a code's picks into the slip…": `replaceSlip` taken out fails it.
- › "leaves the slip as it was…": `replaceSlip` on every load fails it.
- `api-client.test.ts` › "re-roots a booking read only by its code…": the prefix check back fails it, and
  so does the dot-segment check taken out.
- `terminal-route.test.ts` › "loads a well-formed booking…": the 422 without `no-store` fails it.
- `BookingFlow.test.tsx` › "shows the code's expiry on the clock and calendar the player chose…": the
  clock ignored fails it, and so does the calendar ignored.

## Tests proven

Each new acceptance test was green, then failed once with the behaviour it guards broken on purpose, and
was green again once restored.

### First round

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
- Review fixes, each test failing with its fix undone and passing with it (both runs, 2026-10-06):
  - `TerminalKiosk.test.tsx` › "names each competition with its country, so two Premier Leagues can be
    told apart" (U2) — the country left out of the heading: fails.
  - › "says there are no matches on an empty day and goes back to today" (U6) — the empty state always
    resetting to the start: fails.
  - › "offers the start of the board when today itself is empty" (U6) — the empty state always offering
    today: fails.
  - › "says the sports couldn't load and tries again on a tap" (Q1) — the tabs' error state removed:
    fails.
  - › "falls back to the tenant's default, on screen and in its calls, when the language chosen is no
    longer offered" (Q3, S1) — `kioskLanguage` returning the choice whatever the tenant offers: fails.
  - › "moves focus to the slip when it opens, and back to its bar when it closes" (Q8) — no focus on
    open: fails.
  - › "moves its board and its day strip to the new day at midnight" (Q2) — `useTodayEat`'s midnight
    timer doing nothing: fails.
  - `terminal-route.test.ts` › "keeps in-play and finished matches off the kiosk's board…" (U3) — the
    route without `preMatchBoard`: fails.
  - › "answers the kiosk's reads only on a terminal host (AC-5)" (SEC2) — the 404 without `no-store`:
    fails.
  - › "refuses a board query it doesn't know before calling the API (AC-5)" (SEC3) — the date checked
    for shape only: fails.
  - › "takes any sport id the API might use…" (S4) — the old `[a-z0-9_]{1,40}` pattern: fails.
  - `terminal.spec.ts` › "kiosk-loading" (U1) — the strengthened wait: tapped day pressed, the skeleton in
    `<main>`, no price left. The re-shot `terminal-kiosk-loading-en-desktop.png` shows Wed selected and
    skeleton rows.

### Rework

Each test fails with its behaviour undone and passes with it:

- `TerminalKiosk.test.tsx` › "…read through /api/terminal only": `apiClient` ignoring `<html data-api>`
  fails it.
- › "offers nothing that needs a player…": the kiosk's chrome given favourites shows the stars, and it
  fails.
- › "reads the board for the sport and day in the URL": the home's sport tabs unwired fails it. With
  only the sidebar's list unwired it stays green, because the tap lands on the tabs first.
- › "links the sidebar's leagues and each match to the kiosk's own pages" and "searches through the
  terminal and opens a match on the kiosk's page": the kiosk's links taken out (the player's addresses
  used) fails both.
- › "shows a league's own board on its page (AC-6)": the board fetcher dropping `competition` fails it.
- › "says a match isn't there when the terminal has no book for it…": the match page's not-found state
  taken out fails it.
- › "reads the status again when a kiosk read is refused as not activated": the terminal's client
  asking `/api/me` instead fails it.
- › "puts a tapped price in the player's slip…": the slip always empty fails it.
- › "removes one pick and clears the slip": the slip showing only its first pick fails it.
- › "opens in the tenant's default language…": `<html lang>` pinned to `am` fails it.
- › "asks in the kiosk's language": `apiClient`'s language never `am` fails it.
- › "falls back to the tenant's default…": the choice kept whatever the tenant offers fails it.
- › "offers no switch when the tenant has one language": a one-option switch shown. It **stayed green**,
  because the test only checked for "EN". It was strengthened to check for no language button at all,
  and now fails.
- › "says betting isn't available here…": the sportsbook shown whatever `retail` says fails it.
- › "moves its board and its day strip to the new day at midnight": `useTodayEat`'s timer doing nothing
  fails it.
- › "reads the sports again by itself…": `useSports` without its retry fails it.
- › "says there are no matches on an empty board…" and "says the matches couldn't load…": the player's
  board actions unwired fails each.
- `terminal-route.test.ts` › "reads one competition's board…": `competition` dropped fails it.
- › "reads a match's whole book…, and nothing of a match in play": no pre-match filter fails it.
- › "searches for a terminal, before kick-off only": no filter fails it.
- › "refuses a match id or a search it can't send upstream…": either the id check or the length check
  taken out fails it.

### Rework review fixes (round 2)

For each fix, its test was run with the fix undone and failed (one failing test each), then run again with
the fix restored (2026-10-06):

- `TerminalKiosk.test.tsx` › "reads the board again every 30 s, so a match that has kicked off leaves it
  (D5, D8)" (M1, S3): the kiosk's `pricePollMs: false`.
- › "finds a league through the terminal and opens it on the kiosk's page" (S1): the kiosk's league link
  back to the player's `routes.competition`.
- › "shows a match's whole book on its page, and the way home (AC-7)" (Q1): `EventHeader`'s back link
  pointed elsewhere.
- › "returns focus to the slip's bar when its sheet closes" (Q9): the `Sheet` without `returnFocusTo`.
- › "locks every price while the PC is offline, and opens them when it is back" (Q4, M4): the kiosk's
  lock always open.
- › "reads the status again when the kiosk's config is refused as not activated" (Q7): the query client
  skipping every `terminal` query again.
- `terminal-route.test.ts` › "never puts an id of dots into an upstream path, whatever reaches the route
  (review SEC1)": the old id pattern.
- › "asks nothing for a search under the contract's two characters (review S2)": no minimum.
- `api-client.test.ts` › "re-roots only the catalogue the terminal mirrors, nothing else (review Q8)":
  every path re-rooted.
- › "takes no base it doesn't know, whatever the page says (review SEC2)": any `data-api` value taken.
- `SportsbookChrome.test.tsx` › "refuses to be read without a site's chrome above it, rather than
  unlocking prices" (Q3, M3): no throw.
- `TerminalKiosk.test.tsx` › "carries the licence, the age limit and the helpline, with no link to the
  player's pages (SRS RG-05, review U6)": no footer on the kiosk fails it (no `contentinfo`), and so does
  the player's whole footer with its five links. It was written first and failed before the footer
  existed.

With every fix restored: `TerminalKiosk.test.tsx` and `tests/unit` 1,161 passed, `pnpm check` 1,587
passed, and `pnpm ui --grep terminal` 64 passed.

## Review findings

### Rework 2 (round 3)

Panel: spec-verifier, quality-reviewer, security-reviewer, money-reviewer, ui-checker, on
`git diff 614fe22..a42eb20` (Codex's tooling commit left out). Security and money passed. Spec, quality
and UI failed, on the MAJORs below; fixed in `29b8947` and `6e1ff24`.

| id   | reviewer                       | severity | summary                                                                                                                                     | decision                                                                                                                                                                      |
| ---- | ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1   | spec, quality (Q1), money (M1) | MAJOR    | AC-9's test never checked the slip: it passed with `replaceSlip` gone; the e2e answered the route itself                                    | Fixed: the pick at the server's 2.10 (2.05 struck), one pick, no amount; a code with nothing to add leaves the slip; the e2e goes through the real route to Prism             |
| U1   | ui-checker                     | MAJOR    | The startup frame was a subset of the main page's loading: the board's rows moved 98 px (desktop) and 184 px (phone) when the kiosk came up | Fixed: `KioskStarting` is the real page with its reads held; an e2e measures the rows across the hand-over                                                                    |
| SEC1 | security                       | MINOR    | The mirror took any `bookings/` GET, wider than 09-security said; `..` resolved through `new URL`                                           | Fixed: exactly `bookings/{code}`, no `.`/`..` segment; test                                                                                                                   |
| SEC2 | security                       | MINOR    | Codex's hooks: no "ask" for `.codex/` or `.agents/`, matchers named for Claude Code's tools, absolute paths to this Mac                     | Not F8c: commit `33cd943`; left for the user with S7                                                                                                                          |
| S7   | spec                           | MINOR    | Codex's tooling commit sits on the F8c branch, against one branch per task                                                                  | Asked the user: moving it needs a force-push of the pushed branch                                                                                                             |
| S2   | spec                           | MINOR    | 06-language and 10-terminal still said the tenant's default and "Amharic until a config says"                                               | Fixed                                                                                                                                                                         |
| S3   | spec                           | MINOR    | Request 015 didn't name `getBooking`                                                                                                        | Fixed                                                                                                                                                                         |
| S4   | spec                           | MINOR    | The plan's files, test names and risks weren't what was built                                                                               | Fixed                                                                                                                                                                         |
| S5   | spec, quality (Q2), money note | MINOR    | `useLoadBooking` set the notice twice, with a comment claiming a fix                                                                        | Fixed: main's `else` back                                                                                                                                                     |
| Q3   | quality                        | MINOR    | `BookingNotice`'s `priced` made optional                                                                                                    | Fixed: `PricedAs \| null`, required; the kiosk passes null, and says why                                                                                                      |
| Q4   | quality                        | MINOR    | Two brand bars, drifted (sticky, border)                                                                                                    | Fixed: one `TerminalBar`                                                                                                                                                      |
| Q5   | quality                        | MINOR    | The brand went to `/terminal`, the kiosk's links to `/`                                                                                     | Fixed: `/`; `BrandMark` back to main's                                                                                                                                        |
| Q6   | quality                        | MINOR    | The startup status sat inside `aria-busy`; the frame is mounted from two places                                                             | Fixed: the status outside the inert page, no `aria-busy`. Still mounted by `TerminalApp`, then `Kiosk`: the same page both times, and a frame-by-frame probe saw nothing move |
| Q7   | quality, spec (S6)             | MINOR    | The startup test didn't check the skeleton; the fall-back test can't fail under the old rule                                                | Fixed: skeleton, cards and inertness asserted; the rule's table test fails under the old rule                                                                                 |
| Q8   | quality                        | MINOR    | The booking schemas' move wasn't pure (duplicates, comments lost, `oddsAtCode` changed)                                                     | Fixed: identical to main's; one `moneySchema`                                                                                                                                 |
| Q9   | quality                        | MINOR    | The booking hand-written twice                                                                                                              | Fixed: the component fixture is the contract's, mapped; the e2e reads Prism                                                                                                   |
| Q10  | quality                        | MINOR    | The method type spelt three times                                                                                                           | Fixed                                                                                                                                                                         |
| S8   | spec                           | MINOR    | The route test's 422 and languages loosely asserted                                                                                         | Fixed                                                                                                                                                                         |
| S9   | spec                           | MINOR    | The player's expiry on its chosen clock and calendar untested after the locale move                                                         | Fixed: a `BookingFlow` test                                                                                                                                                   |
| M2   | money                          | MINOR    | A loaded code leaves its stake hint, mode and sizes in the slip; a moved price can't be accepted                                            | Follow-up: in F8cb's Read first                                                                                                                                               |
| U2   | ui-checker                     | MINOR    | The Amharic second line outweighed the English                                                                                              | Fixed: a step down, muted                                                                                                                                                     |
| U3   | ui-checker                     | MINOR    | The bar disappears when activation replaces the startup frame                                                                               | Rejected: F8b AC-4 (a new PC shows its code form and nothing else; `hosts.spec.ts` asserts no header, navigation or link)                                                     |
| U4   | ui-checker                     | MINOR    | A booked leg reads "1X2" and "Arsenal v Chelsea", a tapped one "Match result" and "Arsenal – Chelsea"                                       | Follow-up: the shared slip row, on both sites, before this branch                                                                                                             |

Notes, no decision needed:

- `formatOdds` shows two decimals of the contract's up-to-three (money note); before this branch.
- `test-results/ui/terminal-ready-*.png` are stale, from before F8ca; no test takes them now.
- The kiosk reads a booking anonymously, so at online prices, as its catalogue (request 015).

### Rework (round 2)

Panel: spec-verifier, quality-reviewer, security-reviewer, money-reviewer and ui-checker, on
`git diff 39a081a..HEAD`. Security and UI passed. Spec, quality and money failed, on one MAJOR each, all
fixed in `d0088e3`.

| id   | reviewer                        | severity | summary                                                                                                                                                        | decision                                                                                                                                                                              |
| ---- | ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1   | money-reviewer, spec (S3)       | MAJOR    | The reused board and match hooks polled only while realtime is off. Under `simulate` or `on`, a match that kicked off stayed on the kiosk, priced and tappable | Fixed: `SportsbookChrome.pricePollMs`, always 30 s on the kiosk (D5, D8); fake-timer test                                                                                             |
| S1   | spec-verifier                   | MAJOR    | AC-8: no test or screen showed a league found by search, or where it opens                                                                                     | Fixed: a component test whose answer has a league, opening `/terminal/competition/<id>`                                                                                               |
| Q1   | quality-reviewer                | MAJOR    | "…and the way home (AC-7)" matched the brand's `/` link, so it proved nothing                                                                                  | Fixed: the back link is found inside the match header and its `href` asserted                                                                                                         |
| SEC1 | security-reviewer               | MINOR    | A match or competition id of `.` or `..` passed the check, and openapi-fetch doesn't escape it                                                                 | Fixed: ids of dots alone refused; route test                                                                                                                                          |
| SEC2 | security-reviewer, quality (Q8) | MINOR    | `apiClient` took any `<html data-api>` (DOM clobbering) and re-rooted every path, not only the catalogue the terminal mirrors                                  | Fixed: `catalogue/` paths only, to exactly `/api/terminal/`; unit tests                                                                                                               |
| S2   | spec-verifier                   | MINOR    | Search took 1–64 characters; the contract says 2–50 (D5: at least 2)                                                                                           | Fixed: 2–50, and under 2 asks nothing; route test; 10-terminal                                                                                                                        |
| S4   | spec-verifier, ui (U3)          | MINOR    | Below `lg`, no leagues drawer; below `xl`, no search                                                                                                           | Rejected: terminals are PC monitors or touch screens (C19 §11), and the sidebar is there from `lg`. Recorded in 10-terminal and the plan                                              |
| S5   | spec-verifier                   | MINOR    | The gate and AC sections were the first round's                                                                                                                | Fixed: this file (gate, AC-1 to AC-8)                                                                                                                                                 |
| M2   | money-reviewer                  | MINOR    | A pick keeps its tapped price after kick-off or a price move; nothing on the kiosk updates the slip's odds                                                     | Follow-up: F8cb's Read first asks where a priced slip's odds come from. F8ca shows no figure and places nothing                                                                       |
| M3   | money-reviewer, quality (Q3)    | MINOR    | The default chrome had no price lock, so a player tree without its chrome would fail open                                                                      | Fixed: no default; `useSportsbookChrome` throws; test                                                                                                                                 |
| M4   | money-reviewer, quality (Q4)    | MINOR    | The kiosk never locked prices while offline                                                                                                                    | Fixed: the kiosk's lock is `!useOnline()` (`navigator.onLine`, no player module); test                                                                                                |
| M5   | money-reviewer                  | MINOR    | The match page locks per market, never on `event.suspended`                                                                                                    | Follow-up: the player's match page does the same (before this branch, outside its files). Placing refuses it (`BET_MARKET_SUSPENDED`)                                                 |
| Q2   | quality-reviewer                | MINOR    | Hooks passed as props and called through members, out of the hooks lint's sight                                                                                | Fixed: `FavouriteStar({ eventId })`, `PinnableHeaders({ competition })`; hooks destructured before they are called                                                                    |
| Q5   | quality-reviewer                | MINOR    | `KioskSlip` re-implemented the same-match rule, ignoring the mode                                                                                              | Fixed: `calculateBetSlip(…).conflictEventIds`                                                                                                                                         |
| Q6   | quality-reviewer                | MINOR    | The grid's bands copied; the filters read at the shell, re-rendering the header and slip                                                                       | Fixed: one `SHELL_GRID`; `KioskSidebar` owns `useBoardFilters`                                                                                                                        |
| Q7   | quality-reviewer                | MINOR    | Two mechanisms for "a 401 asks who I am again"                                                                                                                 | Fixed: the query client skips only the who-am-I query itself (`hashKey`); `useStatusOnRefusal` deleted; test                                                                          |
| Q9   | quality-reviewer                | MINOR    | Closing the phone's slip left focus on `<body>`; round 1's focus test was dropped                                                                              | Fixed: the bar stays mounted, `Sheet` takes `returnFocusTo`; test restored                                                                                                            |
| Q10  | quality-reviewer                | MINOR    | Two writers of `<html lang>`                                                                                                                                   | Fixed: `DocumentPreferences` sets only the theme                                                                                                                                      |
| Q11  | quality-reviewer                | MINOR    | `preMatchBoard`'s doc sat above `beforeKickOff`                                                                                                                | Fixed                                                                                                                                                                                 |
| U1   | ui-checker                      | MINOR    | The empty slip's icon tile was invisible on the kiosk's slip column                                                                                            | Fixed: the player's `bg-ground` slip body                                                                                                                                             |
| U2   | ui-checker                      | MINOR    | The switch read "አማ \| EN"; the player's reads "EN \| አማ"                                                                                                      | Fixed: the player's order (`LANGS`)                                                                                                                                                   |
| U4   | ui-checker                      | MINOR    | The selected Amharic "ዋና ጨዋታዎች" is wider than its pill in `Segmented`                                                                                          | Follow-up: the shared `Segmented`; the player's home shows it too (before this branch)                                                                                                |
| U5   | ui-checker                      | MINOR    | The phone's collapsed slip bar was in no screenshot                                                                                                            | Fixed: `terminal-kiosk-picks-bar-{am,en}-phone`                                                                                                                                       |
| U6   | ui-checker                      | MINOR    | No footer (licence line, 21+, helpline) on the kiosk                                                                                                           | Fixed: the footer's licence, 21+ and helpline on every kiosk page, without links to the player's pages (SRS RG-05 decides it; the user's direction kept the main page's footer); test |
| U7   | ui-checker                      | MINOR    | The bar changed when the config arrived                                                                                                                        | Fixed: `KioskBar` frames the config's states                                                                                                                                          |

Notes, no decision needed:

- The player's own `/api/catalogue/events/[id]` sends its id upstream unchecked (security note). That
  predates this branch, and the proxy and Next's path normalisation stop `.` and `..` there.
- `KioskSlip`'s bar shadow is the arbitrary one `MobileBetSlip` uses. A shared shadow token would remove
  both (ui note).
- If data saver ever came on for the kiosk, its routes would refuse `lite=1`. `KIOSK_CHROME.useDataSaver`
  is false.
- The kiosk's open countries are per page (local state).
- The simulated board's rows are dated 28/09 under "Today 6 Oct"; the player's screens show the same mock
  data.

### First round

Panel: spec-verifier, quality-reviewer, security-reviewer, money-reviewer (the diff shows odds and the
slip's picks), ui-checker. Spec, security and money: PASS. Quality and UI: FAIL on the MAJORs below, all
fixed in `F8c: review fixes …`.

| id   | reviewer                    | severity | summary                                                                                            | decision                                                                                                                                |
| ---- | --------------------------- | -------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| U1   | ui-checker                  | MAJOR    | `terminal-kiosk-loading-en-desktop` showed the old board: the e2e wait proved nothing              | Fixed: the wait needs the tapped day pressed, the skeleton in `<main>` and no prices; re-shot                                           |
| U2   | ui-checker                  | MAJOR    | Competition headers without the country: two "Premier League"s                                     | Fixed: flag and country before the name, as the player's board; test                                                                    |
| U3   | ui-checker                  | MAJOR    | In-play matches listed as if before kick-off                                                       | Fixed: `preMatchBoard` in the board route (D8: no in-play in Release 1); route test                                                     |
| Q1   | quality-reviewer            | MAJOR    | A failed `/sports` left no tabs and was never read again                                           | Fixed: error line with Try again; read again every 30 s while failed; test                                                              |
| Q2   | quality-reviewer            | MAJOR    | After midnight EAT the board stayed on yesterday                                                   | Fixed: `useTodayEat` (re-renders at midnight EAT) in `useBoardFilters` and the day strip; fake-timer test                               |
| Q3   | quality-reviewer, spec (S1) | MAJOR    | The config's default copied into Zustand; the screen and the calls worked the language out apart   | Fixed: the store holds only the choice; one pure `kioskLanguage(chosen, config)`; the reads take it from the locale; test               |
| SEC1 | security-reviewer           | MINOR    | 09-security said "only an activated terminal"; the code checks the cookie, not revocation          | Fixed: 09-security and `activeTerminal`'s comment say revocation reaches the kiosk through its status read (and the API once 015 lands) |
| SEC2 | security-reviewer           | MINOR    | `terminalOnly`'s 404 had no `Cache-Control`                                                        | Fixed: `no-store`; test                                                                                                                 |
| SEC3 | security-reviewer           | MINOR    | `date=2026-02-30` passed; an unknown key echoed back at any length                                 | Fixed: a real calendar date; an odd key named back as `query`; tests                                                                    |
| S4   | spec-verifier               | MINOR    | `^s_[a-z0-9_]{1,40}$` isn't the contract's (no pattern; D3: ids opaque)                            | Fixed: `s_` plus URL-safe characters, up to 64; recorded in plan decision 14; test                                                      |
| S2   | spec-verifier               | MINOR    | Plan decision 10 promised double chance and total goals                                            | Fixed: marked "changed while implementing" (the mapper sets both to null until request 001)                                             |
| S3   | spec-verifier               | MINOR    | Plan decision 12 promised price movement; Risks called the switch a toggle named in both languages | Fixed: both corrected                                                                                                                   |
| M1   | money-reviewer              | MINOR    | F8cb didn't read request 015 or the online-price gap                                               | Fixed: in F8cb's Read first, as a plan-gate question                                                                                    |
| M2   | money-reviewer              | MINOR    | The slip said "at the price it was taken" but nothing moves its odds afterwards                    | Fixed: comment, plan decision 12 and 10-terminal say "the odds when tapped"; F8cb decides where a priced slip's odds come from          |
| M3   | money-reviewer              | MINOR    | The online-price gap was half a line                                                               | Fixed: its own entry under Gaps                                                                                                         |
| U4   | ui-checker                  | MINOR    | A suspended `lg` price's lock sat where the outcome code goes                                      | Fixed: a lock alone is centred (also on the player's lined markets)                                                                     |
| U5   | ui-checker                  | MINOR    | Kick-off times without a time-zone label                                                           | Fixed: `clock.eat` beside the heading, as the player's board                                                                            |
| U6   | ui-checker                  | MINOR    | "Show football" on an empty later day of football                                                  | Fixed: "Back to today" (same sport) on a later day; "Show football" only when today is empty; tests                                     |
| U7   | ui-checker                  | MINOR    | The kiosk's bar 64 px, the system screens' 56 px: it jumped                                        | Fixed: the same bar as `TerminalShell`                                                                                                  |
| U8   | ui-checker                  | MINOR    | A 7,228 px loading capture                                                                         | Fixed with U1 (re-shot)                                                                                                                 |
| U9   | ui-checker                  | MINOR    | Clear all and Remove didn't read as buttons                                                        | Fixed: bordered                                                                                                                         |
| Q4   | quality-reviewer            | MINOR    | The harness reset only part of the kiosk store                                                     | No change needed: Q3 removed the part it didn't reset                                                                                   |
| Q5   | quality-reviewer            | MINOR    | Kiosk tests on the real clock                                                                      | Fixed: the date faked at the board's morning, literal dates                                                                             |
| Q6   | quality-reviewer            | MINOR    | Team names asserted anywhere on the page                                                           | Fixed: inside their competition's section                                                                                               |
| Q7   | quality-reviewer            | MINOR    | Every pick re-rendered the whole sportsbook                                                        | Fixed: `KioskSlipBar` alone follows the count                                                                                           |
| Q8   | quality-reviewer            | MINOR    | Focus lost when the slip view opened or closed                                                     | Fixed: to the slip's heading, and back to the bar; test                                                                                 |
| Q9   | quality-reviewer            | MINOR    | A 30-line parser in the route; the filter list spelt three times                                   | Fixed: `boardQuery` in `lib/server/terminal.ts`; `KioskBoardFilters` from `EventFilters`                                                |
| Q10  | quality-reviewer            | MINOR    | `LAYOUT_LANG` copied the layout's `lang="am"`                                                      | Fixed: the cleanup restores the value it found                                                                                          |
| Q11  | quality-reviewer            | MINOR    | The kiosk's pick wiring copies `OddsButton`'s                                                      | Follow-up: a store-free `useToggleOutcome` shared by both means changing the player's `OddsButton`, outside this task's files           |

Notes, no decision needed:

- Under `NEXT_PUBLIC_REALTIME=simulate` the board, the kiosk's included, is the in-repo fixtures. This
  predates the branch, and `env.ts` keeps it a development setting (security note).
- A hand-typed kiosk URL with a malformed date gets the board's error state until reset. The day strip
  never writes one.
- `test-results/ui/terminal-ready-*.png` are left from before this branch; "ready" is now the kiosk.

## Gaps

- **Online prices on the kiosk** (decision 2). The kiosk shows the anonymous catalogue's prices. If a
  shop's prices differ (C19 §9.1), the counter's POS re-prices at sale and shows old and new odds (C19
  §14), so no money is wrong. But F8cb's figures would be computed on prices the shop won't sell at, so
  F8cb waits for request 015 or decides its copy at its plan gate.
- **A pick's odds are the tapped ones** (M2). Nothing on the kiosk updates the slip after a tap; F8cb
  decides where a priced slip's odds come from.
- **One customer's picks stay for the next** until F8cc's idle reset clears the slip.
- **Revocation and the catalogue reads.** A revoked PC whose cookie hasn't lapsed can still read the public
  catalogue through these routes. The kiosk itself shows "switched off" at its next status read. Closed
  when the reads are signed (015).
- **A suspended match's book** (M5). The match page locks per market, on the player's site as on the
  kiosk; if the API ever sent an open market under a suspended event, placing would refuse it.
- **Prism has no in-play or ended events.** The pre-match filter is proven by unit, route and fake-timer
  tests and seen on the simulated board, not against Prism.
- **The dev server's board was the simulated one** for every kiosk screenshot. The component tests use
  Prism's examples.
- **One run failed outside any test**: `auth.spec.ts`'s `/api/me` rewrite was still in flight when its test
  ended. It was fixed in `2892fe2`; the race is gone from that file, and no other e2e file has it.
- **Terms, Privacy and Help aren't reachable from the kiosk.** They are the player's pages, which a terminal
  host doesn't serve. The footer carries the licence, 21+ and helpline (SRS RG-05).
- **Booking codes at online prices** (request 015): a code loaded at the kiosk is re-priced at the online
  odds, like its catalogue.
- **A system code's sizes note** isn't shown on the kiosk (`priced={null}`) until F8cb prices the slip.
- **The startup frame is mounted twice** (status, then config): the same page both times, no visible change
  (Q6).
- **Size.** The branch is about 7,200 added lines across 134 files: about 2,200 in `src`, 2,500 in tests,
  and the rest docs, the sub-task files, request 015 and Codex's tooling (895 lines in `33cd943`). Most of
  the growth is the user's two reviews. F8cb and F8cc remain separate.
