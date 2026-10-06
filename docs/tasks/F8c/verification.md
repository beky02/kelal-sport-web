# F8c — verification (F8ca — kiosk sportsbook)

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
| Typecheck, lint, Prettier, unit + comp. | `pnpm check`                             | PASS: 77 files, 1,567 tests (1,559 before the review fixes)                                                                            |
| Generated types                         | `pnpm api:check`                         | PASS                                                                                                                                   |
| Contract drift                          | `node scripts/contract-sync.mjs --check` | PASS: "contracts/ matches the backend. docs/backend/ matches the backend."                                                             |
| Build                                   | `pnpm build`                             | PASS: `/api/terminal/{config,catalogue/board,catalogue/sports}` dynamic, `/terminal` static                                            |
| Host split                              | `node scripts/check-host-split.mjs`      | PASS: "19 player routes load no module or chunk of (terminal); 1 terminal route(s) load no module of (player) nor a chunk holding one" |
| Screens                                 | `pnpm ui`                                | PASS: 626 passed (4.7 m), none on retry                                                                                                |

`pnpm verify` (all of the above, in order): exit 0 on 2026-10-06, before the review and again after its
fixes (`b7fa2ec`), against the running `next dev` (whose board is the simulated one,
`NEXT_PUBLIC_REALTIME=simulate`) and Prism on :4010. The final run's summary:

```
 Test Files  77 passed (77)
      Tests  1567 passed (1567)
contracts/ matches the backend.
docs/backend/ matches the backend.
Host split holds: 19 player routes load no module or chunk of (terminal); 1 terminal route(s) load no module of (player) nor a chunk holding one (.next/server/app, 60 manifests).
  626 passed (4.7m)
```

## Acceptance criteria

| AC   | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | PASS   | `TerminalKiosk.test.tsx`, all passing: "shows the sports, the days and the board's matches with their prices once the terminal is active"; "names each competition with its country…"; "reads the board for the sport and day in the URL, and only through /api/terminal"; "says there are no matches on an empty day and goes back to today"; "offers the start of the board when today itself is empty"; "says the matches couldn't load and tries again on a tap"; "says the sports couldn't load…"; "says the server can't be reached when the config can't be read…"; "moves its board and its day strip to the new day at midnight". `terminal-route.test.ts` › "reads the board for a terminal…", "reads the sports for a terminal", "keeps in-play and finished matches off…". Screens: `terminal-kiosk-{board,loading,empty,error}-{am,en}-{phone,desktop}.png`, `terminal-kiosk-config-{loading,offline}-{phone,desktop}.png` |
| AC-2 | PASS   | `TerminalKiosk.test.tsx` › "puts a tapped price in the slip and takes it out on a second tap"; "removes one pick and clears the slip"; "moves focus to the slip when it opens, and back to its bar when it closes". `terminal.spec.ts` › "kiosk-picks: picks in the slip, and every price, tab and button at least 48 px high (AC-2)" (all 4 variants; no visible button under 48 px). Screens: `terminal-kiosk-picks-{am,en}-{phone,desktop}.png`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| AC-3 | PASS   | `TerminalKiosk.test.tsx` › "opens in the tenant's default language and switches with one tap"; "asks in the kiosk's language"; "starts in English for a tenant whose default is English"; "falls back to the tenant's default, on screen and in its calls, when the language chosen is no longer offered"; "offers no switch when the tenant has one language". `Locale.test.tsx`: 3 tests. `terminal-mappers.test.ts` › "maps the contract's config…". Every kiosk screen in `am` and `en`                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| AC-4 | PASS   | `TerminalKiosk.test.tsx` › "says betting isn't available here, with no board and no slip, when retail is off". `terminal-mappers.test.ts` › "turns retail off only on an explicit false (AC-4)". `terminal-route.test.ts` › "reads the kiosk's config for a terminal…". `terminal.spec.ts` › "unavailable…". Screen: `terminal-unavailable-{phone,desktop}.png`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| AC-5 | PASS   | `terminal-route.test.ts` › "answers the kiosk's reads only on a terminal host (AC-5)" (404, `no-store`); "refuses the kiosk's reads without an activated terminal, and calls nothing (AC-5)"; "refuses a board query it doesn't know before calling the API (AC-5)"; "never sends Prism's Prefer upstream…". `pnpm verify` › `check-host-split.mjs`: "Host split holds". Player: the full component suite (1,567) and the player's `pnpm ui` screens pass; the UI review spot-checked `home-slip-am-desktop` and `home-en-phone`                                                                                                                                                                                                                                                                                                                                                                                                        |

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

## Review findings

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
- **One customer's picks stay for the next** until F8cc's idle reset clears the slip.
- **Revocation and the catalogue reads.** A revoked PC whose cookie hasn't lapsed can still read the public
  catalogue through these routes. The kiosk itself shows "switched off" at its next status read. Closed
  when the reads are signed (015).
- **Prism has no in-play or ended events**, so the pre-match filter is proven by unit and route tests and
  seen on the simulated board, not against Prism.
- **The sports' 30 s retry** is configured but tested only through its Try again button.
- **The dev server's board was the simulated one** for every kiosk screenshot. The component tests use
  Prism's examples.
- **Size.** The branch is about 3,700 changed lines with tests, docs, the sub-task files and request 015,
  over the plan's ~1,400 estimate for the code and tests. F8cb and F8cc remain separate.
- Rework (the user's review), each test failing with its behaviour undone and passing with it:
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
