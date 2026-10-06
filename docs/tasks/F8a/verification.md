# F8a — verification

## Review brief

- **Move (no content change):** pages, root layout, `providers.tsx` → `src/app/(player)/` (`b0d8dd2`, `git mv`;
  only the `globals.css` import moved). `src/app/api/`, `globals.css`, `favicon.ico` stay shared; fonts → `src/app/fonts.ts`.
- **Terminal shell:** `src/app/(terminal)/layout.tsx` (own `<html>`, dark, `noindex`) + bilingual placeholder `/terminal`.
- **Hosts:** `TERMINAL_HOST_MAP` in `src/lib/server/config.ts` (`isTerminalHost`; shared host refused; none in production).
- **Risk — `src/proxy.ts`:** now on every page and handler (matcher by path); terminal host = `/`→`/terminal`,
  `/terminal/*`, `/api/terminal/*` only; player host 404s those; 404 = rewrite to `/_not-found`; host via `requestHost`.
  `next.config.ts` `proxyClientMaxBodySize: "32kb"` (the proxy now buffers handler bodies; chunked >32 KiB arrive cut).
- **AC-4:** `scripts/check-host-split.mjs` on the build's client manifests, in `pnpm verify`.
- **User's calls:** contract synced first; unmatched-URL 404 now in Next's bare page (accepted; branded 404 = follow-up).
- **Not done:** the terminal (F8b/F8c), a branded 404, a run on `next start` (gap).

## Automated gate

Final `pnpm verify` (2026-10-06, after the review fixes and a second user-approved `contract:sync`,
`002298c`, which only added four feed event schemas the backend published during the session), dev server
reused (`next dev`, healthy). The first full run (before review) also passed: 1465 / 575.

| Check                                     | Result | Detail                                                                                                                                               |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`, `pnpm lint`, `prettier` | PASS   |                                                                                                                                                      |
| `pnpm test` (vitest)                      | PASS   | 70 files, 1470 tests (before: 69 files, 1446)                                                                                                        |
| `pnpm api:check`                          | PASS   | Generated API types match `contracts/openapi.yaml`                                                                                                   |
| `contract-sync --check`                   | PASS   | `contracts/` and `docs/backend/` match the backend (it failed once, mid-session, on the backend's new feed events: synced with the user's agreement) |
| `pnpm build`                              | PASS   | `/terminal` prerendered (○); `ƒ Proxy (Middleware)`; matcher in the functions manifest as written                                                    |
| `node scripts/check-host-split.mjs`       | PASS   | "19 player routes load no module or chunk of (terminal); 1 terminal route(s) load no module of (player) nor a chunk holding one (54 manifests)"      |
| `pnpm ui` (Playwright)                    | PASS   | 576 passed (before: 570 — plus 6 in `hosts.spec.ts`), 0 flaky                                                                                        |

```
 Test Files  70 passed (70)
      Tests  1470 passed (1470)
contracts/ matches the backend.
docs/backend/ matches the backend.
Host split holds: 19 player routes load no module or chunk of (terminal); 1 terminal route(s) load no module of (player) nor a chunk holding one (.next/server/app, 54 manifests).
  576 passed (4.2m)
exit 0
```

## Acceptance criteria

| AC   | Status                    | Evidence                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | PASS                      | `pnpm verify` above: unit + component 1446 → 1470 (server-config +5; proxy 13 → 25: 13 new and 1 replaced — the old test asserting the four-path matcher, whose job the "runs on every page and route handler" test now does; host-split-build +7); screens 544 → 544 (136 × 4); Playwright 570 → 576 (+6 `hosts.spec.ts`)                                                      |
| AC-2 | PASS (differences listed) | See "Screens before and after" below: 544/544 same dimensions in both runs after the move; 335 (first run) and 340 (final run) byte-identical to a baseline; every other difference is in a class that also appears between two baseline runs of unchanged code                                                                                                                 |
| AC-3 | PASS                      | proxy unit tests (both hosts, spellings, forwarded host, matcher over every route and public file) and `hosts.spec.ts` on `localhost` and `terminal.localhost`, all green and proven (below); `curl` on the dev server: player `/terminal`, `/api/terminal/x`, `/%74erminal` 404; terminal `/` 200 placeholder, `/profile`, `/login`, `/wallet`, `/api/me`, `/no-such-page` 404 |
| AC-4 | PASS                      | `check-host-split.mjs` on the real build (above); cross-check: the 6 scripts `terminal.html` loads contain none of `kelal.ui`, `QueryClientProvider`, `RealtimeProvider`, `DocumentPreferences`, while the home page's chunks do (so the markers are findable)                                                                                                                  |
| AC-5 | PASS                      | `git log --follow --oneline -- 'src/app/(player)/layout.tsx'` → `cb98f01` (fonts), `b0d8dd2` (the move), `207b2c8 feat(shell): app layout…`, `e7a6201 Initial commit from Create Next App`                                                                                                                                                                                      |

## Screens before and after (AC-2)

Method: `pnpm ui` run twice before any code change (after the contract sync only) and once in the final
`pnpm verify`; every screen PNG compared byte for byte, then pixel by pixel, with a scratch script (not
committed). Two baseline runs of the same code already differ in 195 of 546 PNGs, so "identical" means
identical to either baseline, and the rest is classified by where the pixels differ:

| Class                                                                    | PNGs | Cause, and where it also shows between the two baselines                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Byte-identical to a baseline                                             | 335  | —                                                                                                                                                                                                                                                                                                                                           |
| No more than the two baselines differ from each other                    | 45   | —                                                                                                                                                                                                                                                                                                                                           |
| The live simulation below the board (desktop x≥357 y≥2300, phone y≥3800) | 55   | Match minutes, scores and odds move with the clock (`home-slip-event-started-en-desktop` differs by 6,866 px between baselines, same box)                                                                                                                                                                                                   |
| The sportsbook behind a dialog (home, login, register, verify)           | 20   | The same live simulation under the dialog                                                                                                                                                                                                                                                                                                   |
| The booking-code input's caret (desktop x 1339–1349, y 361–407)          | 29   | Caret blink (`deposit-confirm-en-desktop` between baselines)                                                                                                                                                                                                                                                                                |
| 1–3 px anti-aliasing flicker                                             | 33   | Same pixels between baselines (phone x 41 y 781, desktop y 39)                                                                                                                                                                                                                                                                              |
| Small scattered diffs (7–825 px)                                         | 27   | Rounded corners of inputs, buttons and switch knobs caught at another frame of their transition (diff masks of `responsible-gaming-raised-en-desktop` and `profile-am-phone` checked by eye); between baselines, `responsible-gaming-*` 60–120 px, `profile-en-desktop` 345 px, `withdrawal-approved-am-desktop` 28 px in the same flag box |

The final run (after the review fixes) again: 544/544 same dimensions; 340 byte-identical, 48 within the
baselines' own difference, 81 live simulation, 20 behind a dialog, 23 caret, 8 flicker, 24 small scattered
(7–207 px; several are the same files as in the first run, e.g. `profile-language-unsaved-en-phone` 207 px,
`withdraw-accounts-failed-am-desktop` 9 px — corners and transitions).

All 544 PNGs have exactly the baseline's dimensions, so no full-page screen moved. The only visible change
is the one the user accepted: a URL that matches no page shows Next's built-in 404 in its own bare page
(no player fonts or ground) instead of inside the player's layout; no screen in `pnpm ui` shows it.

## Tests proven

Each new acceptance test, green, then run against the behaviour broken once, then restored.

| Test                                                                                                           | What was broken                                                                                                                        | Result |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| server-config › maps a terminal host to its tenant and marks it as a terminal                                  | `isTerminalHost` always false                                                                                                          | failed |
| server-config › maps a terminal host to its tenant and marks it as a terminal                                  | `tenantForHost` skips `TERMINAL_HOST_MAP`                                                                                              | failed |
| server-config › maps a terminal host to its tenant and marks it as a terminal                                  | map lookups take inherited keys (`toString`)                                                                                           | failed |
| server-config › refuses to start with a host in both TENANT_HOST_MAP and TERMINAL_HOST_MAP                     | the refinement always passes                                                                                                           | failed |
| server-config › has no terminal host in production unless one is configured, and terminal.localhost elsewhere  | `terminal.localhost` in production too                                                                                                 | failed |
| server-config › has no terminal host in production unless one is configured, and terminal.localhost elsewhere  | a configured map ignored                                                                                                               | failed |
| server-config › decides by the host tenants are read from: a forwarded host counts only behind a trusted proxy | `requestHost` believes a client's `X-Forwarded-Host` (a first try, dropping `hops === 0`, was an equivalent mutation and stayed green) | failed |
| server-config › never makes a player link on a terminal host                                                   | `publicOrigin` counts terminal hosts as the tenant's                                                                                   | failed |
| server-config › never makes a player link on a terminal host                                                   | `ownedOrigin` counts terminal hosts                                                                                                    | failed |
| proxy › answers /terminal and /api/terminal/x with a 404 on a player host                                      | the player host's terminal-path check removed                                                                                          | failed |
| proxy › shows /terminal at / on a terminal host, keeping the query                                             | `/` not rewritten on a terminal host                                                                                                   | failed |
| proxy › answers /profile, /login, /wallet and /api/me with a 404 on a terminal host                            | a terminal host passes every path                                                                                                      | failed |
| proxy › serves /terminal/* and /api/terminal/* on a terminal host                                              | a terminal host refuses every path                                                                                                     | failed |
| proxy › refuses the other site's paths in any spelling                                                         | the decoded path not checked on a player host (`/%74erminal`)                                                                          | failed |
| proxy › refuses the other site's paths in any spelling                                                         | dot segments allowed on a terminal host (`/terminal/x%2F..%2F..%2Fwallet`)                                                             | failed |
| proxy › refuses the other site's paths in any spelling                                                         | prefix match without a segment boundary (`/terminals`)                                                                                 | failed |
| proxy › reads the host as tenants are read: a forwarded host counts only behind a trusted proxy                | the proxy reads `X-Forwarded-Host` itself                                                                                              | failed |
| proxy › runs on every page and route handler and on no public file                                             | matcher skips `/api`                                                                                                                   | failed |
| proxy › runs on every page and route handler and on no public file                                             | matcher runs on `public/flags`                                                                                                         | failed |
| proxy › skips Next's own files, and decides by path, never by extension                                        | matcher excludes `.png` by extension                                                                                                   | failed |
| proxy › skips Next's own files, and decides by path, never by extension                                        | matcher excludes only `/_next/static` (runs on the image optimiser and HMR)                                                            | failed |
| proxy › buffers no more of a body for the proxy than the largest handler accepts, with room                    | `proxyClientMaxBodySize: "10mb"`                                                                                                       | failed |
| proxy › buffers no more of a body for the proxy than the largest handler accepts, with room                    | `proxyClientMaxBodySize: "8kb"` (below the 16 KiB bets cap)                                                                            | failed |
| e2e hosts › answers /profile, /login, /wallet and /api/me with a 404 on the terminal host                      | a terminal host passes every path (dev server)                                                                                         | failed |
| e2e hosts › shows the terminal placeholder at / on the terminal host (phone, desktop)                          | `/` not rewritten on a terminal host (dev server)                                                                                      | failed |
| e2e hosts › answers /terminal and /api/terminal/x with a 404 on the player host                                | the player host's terminal-path check removed (dev server)                                                                             | failed |

| host-split-build › finds a terminal route that loads the player layout's code | terminal routes not checked | failed |
| host-split-build › finds a terminal route that loads the player layout's code | chunk paths not normalised (`/_next/static/…` vs `static/…`) | failed |
| host-split-build › finds a terminal route that references a module of (player) | module references not checked | failed |
| host-split-build › finds a player route that references (terminal) | player routes not checked | failed |
| host-split-build › finds a route under both root layouts | a route under both layouts not reported | failed |
| host-split-build › fails when there is nothing to check | passes with no terminal route | failed |
| host-split-build › fails when there is nothing to check | passes with no client module of the player's layout | failed |
| proxy › guards the account pages it always guarded and no more, now it runs everywhere (review S1) | `/wallet` and `/transactions` guarded with what is below them again | failed |
| proxy › looks only at /t/{one segment}, as before it ran everywhere (review S1) | the ticket check takes any depth again | failed |
| proxy › (whole file, review Q3) with `TRUSTED_PROXY_HOPS=1 TERMINAL_HOST_MAP=kiosk.example=demo` in the shell | the file as it was, environment not pinned: 5 failed; pinned: 23 passed | failed |
| host-split-build › finds a player route that references a module of (terminal) (review Q5) | module references not checked | failed |
| server-config › maps a terminal host… and proxy › treats a terminal host spelt with its root dot (review SEC3) | before the fix (no root-dot strip): 2 failed | failed |
| proxy › lets the image optimiser, which skips the proxy, fetch no app path (review SEC6) | `images.localPatterns` removed | failed |
| proxy › runs on every page and route handler and on no public file (review SEC5) | a temporary `src/app/(player)/[lang]/wallet/page.tsx`: `/flags/wallet` unmatched | failed |
| e2e hosts › an oversized login… is refused, and goes nowhere, when it is sent chunked (review Q1) | not a mutation: a chunked login of the usual size answers 200 in the same test, so the refusal is the size, not chunking | — |

The placeholder check first asserted "no button" with `getByRole`, which also finds the dev server's
tools button inside its shadow root once an issue has been shown (seen after the mutation runs). It now
counts the page's own DOM; 15 runs (`--repeat-each=3`) green.

What Next does before the proxy (plan decision 7), on the dev server: `//terminal` and `/terminal/` answer
308 to `/terminal` on both hosts, which the proxy then answers (404 on a player host, the page on a
terminal host); `/%74erminal` reaches the proxy as written and is refused on both.

## Review findings

Panel: spec-verifier, quality-reviewer, security-reviewer, ui-checker (no money-reviewer: no money path
touched). All four: PASS, no BLOCKER or MAJOR.

| id   | reviewer | severity | summary                                                                                                                                                     | decision                                                                                                                                                                                                                                          |
| ---- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1   | spec     | MINOR    | Running everywhere, the proxy's prefix guard sent a guest on `/wallet/x` or `/transactions/x` to log in (was Next's 404), and `/t/a/b` got the ticket's 404 | fixed in `345a2f1` (tests first, proven)                                                                                                                                                                                                          |
| S2   | spec     | MINOR    | "Only new tests added" — one proxy test (the old exact-matcher assertion) was replaced                                                                      | fixed: AC-1 row says so                                                                                                                                                                                                                           |
| S3   | spec     | MINOR    | F1's "Read first" names `src/app/layout.tsx`                                                                                                                | fixed in `d0beebd` (file added to the plan's list)                                                                                                                                                                                                |
| S4   | spec     | MINOR    | Build-check proofs fell outside the table; decision 7's note on `//terminal` and `/terminal/` missing                                                       | fixed (this file)                                                                                                                                                                                                                                 |
| Q1   | quality  | MINOR    | The 1 MB e2e test sends a Content-Length, so it can't show the chunked case; `next.config` comment claimed 413 for it                                       | fixed in `4a37012`: chunked case with a same-size control; comment corrected                                                                                                                                                                      |
| Q2   | quality  | MINOR    | The build check only knows modules under `(player)/`; its success line claimed more                                                                         | fixed in `4a37012`: header and success line say exactly what is checked; which libraries the terminal may share is F8b's (follow-up)                                                                                                              |
| Q3   | quality  | MINOR    | Proxy tests depended on the shell's `TERMINAL_HOST_MAP` / `TRUSTED_PROXY_HOPS`                                                                              | fixed in `4a37012` (stubbed before import; proven)                                                                                                                                                                                                |
| Q4   | quality  | MINOR    | `handlerCaps` finds caps by a source regex; a cap written differently is missed                                                                             | fixed (follow-up): `BODY_CAPS` in `lib/server/body.ts` is the only cap `readJson`/`readForm` type-check with; the test reads it, no source scan (proven: `readJson(request, 64 * 1024)` fails tsc, a 64 KiB cap or an `8kb` limit fails the test) |
| Q5   | quality  | MINOR    | Test named "references (terminal)" only exercised the chunk branch                                                                                          | fixed in `4a37012` (renamed + reference case; proven)                                                                                                                                                                                             |
| Q6   | quality  | MINOR    | `DEFAULT_TENANT ?? "demo"` read twice                                                                                                                       | fixed in `4a37012`                                                                                                                                                                                                                                |
| SEC1 | security | MINOR    | Bodies are now read to their end for the proxy before any handler (only 32 KiB kept); docs said "refused before it is read"                                 | fixed in `d0beebd`: docs and comment corrected; an edge body cap is a go-live requirement in 09-security                                                                                                                                          |
| SEC2 | security | MINOR    | `/` is two prerendered documents by host; a shared cache keyed without Host could swap them                                                                 | fixed in `d0beebd`: go-live requirement in 09-security (cache key on the client's Host)                                                                                                                                                           |
| SEC3 | security | MINOR    | `terminal.kelalsport.et.` (root dot) was in neither map → full player site on a shop's host name                                                            | fixed in `d0beebd` (one root dot stripped; tests first, proven; checked on the dev server)                                                                                                                                                        |
| SEC4 | security | MINOR    | `.env.example` set `TERMINAL_HOST_MAP=terminal.localhost=demo`; copied to production it makes a forgeable terminal host                                     | fixed in `d0beebd` (left blank; production example in the comment)                                                                                                                                                                                |
| SEC5 | security | MINOR    | A future dynamic first segment (`[lang]`) named `flags` would skip the proxy                                                                                | fixed in `d0beebd`: the matcher test also tries `flags` in every dynamic segment (proven with a temporary `[lang]` page); 09-security notes F2a must refuse non-languages                                                                         |
| SEC6 | security | MINOR    | `/_next/image` skips the proxy and could fetch any app path                                                                                                 | fixed in `d0beebd`: `images.localPatterns: []` (nothing uses `next/image`); unit test with Next's matcher                                                                                                                                         |
| U1   | ui       | MINOR    | The placeholder's body lines were spaced like title-to-body, not as a pair                                                                                  | fixed in `e043376` (screenshot re-taken and looked at)                                                                                                                                                                                            |
| U2   | ui       | MINOR    | The Amharic body looks lighter than the English                                                                                                             | rejected: same body style as every Amharic line in the player app (06-language); the kiosk's typography is F8c's                                                                                                                                  |
| U3   | ui       | MINOR    | No brand mark on the placeholder                                                                                                                            | rejected: tenant branding comes from `/v1/config/public` (F1) and the terminal's own screens (F8b); a hardcoded mark would be the raw brand the design system forbids                                                                             |

Notes: the spec-verifier noted AC-4's "player route loads nothing from (terminal)" half has nothing to
compare yet (the terminal has no client code); the ui-checker counted 546 PNGs per run — 544 from the
136 screens plus `booking-not-found-en-desktop` and `ticket-check-not-found-en-desktop`, written by the
booking and ticket specs, compared the same way; the security-reviewer's ~70 probes (encodings, dot
segments, RSC header and `.rsc`, `X-Forwarded-Host`, `x-middleware-subrequest`) found no way across.

## Gaps

- **`next start` not run.** The split, the `/_not-found` rewrite and the body buffer were seen under
  `next dev` and in unit tests; the build's manifests show the proxy on Node with the matcher as written
  and `/_not-found` as an app route. Running `hosts.spec.ts` against a production server needs a launch
  configuration in `.claude/` (the user's to approve) — recommended before F8b.
- **The image optimiser on this dev server** answers `/_next/image?url=/api/me` with 500, not 400: a VS
  Code extension's hook (Console Ninja) injected into `next dev` throws while the refusal is logged. The
  unit test proves the configuration refuses it with Next's own matcher.
- **Flaky:** none in the final run; the baseline run had 2 flaky auth tests (`auth.spec.ts` › logs in
  through the dialog…, › logging out clears the session…), not touched here.

## Self-review

- **Money moves:** none in this task; no query, mutation or money path touched.
- **New values:** `TERMINAL_HOST_MAP`/`isTerminalHost` used only by the proxy; `tenantForHost` reads both
  maps; `publicOrigin`/`ownedOrigin` still read only `TENANT_HOST_MAP` (test: never a player link on a
  terminal host). `routes.terminal`, `terminalApi`, `notFound` used only by the proxy.
- **Async tests:** the Playwright checks wait for the response and for the heading's text before asserting;
  the unit tests are synchronous.
- **Personal data:** nothing new is shown or cached; no query keys added.
- **Route handlers:** none added or changed. The proxy now sees every handler's request: it reads no body
  and opens no cookie (only `has(SESSION_COOKIE)` on the player's account pages, as before); the body
  buffer is capped (unit test + 1 MB login still 413 in Playwright). `no-store` and Prism's `Prefer` are
  unchanged in the handlers.
- **Screens:** the placeholder has one state (static, no data); screenshots at 375 and 1440 px. Every
  player screen compared with the baseline (AC-2).
- **Docs:** plan Files list matches `git diff --name-only main...HEAD` (03-session added and noted); design
  pages 00, 03, 07, 08, 09 updated; TRANSLATION-NOTES has the two strings; README status current.
- **`.claude`:** only `src/app/api/**` is named there, and it didn't move — nothing to change.
