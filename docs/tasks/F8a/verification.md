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

`pnpm verify` (2026-10-06, after the last code commit `a335d6a`), dev server reused (`next dev`, healthy;
`/terminal` and the terminal host answered as the unit tests expect before the run):

| Check                                     | Result | Detail                                                                                                                    |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`, `pnpm lint`, `prettier` | PASS   |                                                                                                                           |
| `pnpm test` (vitest)                      | PASS   | 70 files, 1465 tests (before: 69 files, 1446 — plus 5 config, 8 proxy, 6 build-check tests)                               |
| `pnpm api:check`                          | PASS   | Generated API types match `contracts/openapi.yaml`                                                                        |
| `contract-sync --check`                   | PASS   | `contracts/` and `docs/backend/` match the backend                                                                        |
| `pnpm build`                              | PASS   | `/terminal` prerendered (○); `ƒ Proxy (Middleware)`; matcher in the functions manifest as written                         |
| `node scripts/check-host-split.mjs`       | PASS   | "19 player routes load nothing from (terminal); 1 terminal route(s) load nothing from the player's layout (54 manifests)" |
| `pnpm ui` (Playwright)                    | PASS   | 575 passed (before: 570 — plus 5 host checks), 0 flaky (the baseline had 2 flaky auth tests; none this time)              |

```
 Test Files  70 passed (70)
      Tests  1465 passed (1465)
Generated API types match contracts/openapi.yaml.
contracts/ matches the backend.
docs/backend/ matches the backend.
Host split holds: 19 player routes load nothing from (terminal); 1 terminal route(s) load nothing from the player's layout (.next/server/app, 54 manifests).
  575 passed (5.8m)
```

## Acceptance criteria

| AC   | Status                    | Evidence                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | PASS                      | `pnpm verify` above: unit + component 1446 → 1465 (only new tests added: server-config +5, proxy +8, host-split-build +6); screens 544 → 544 (136 × 4); Playwright 570 → 575 (+5 `hosts.spec.ts`)                                                                                                                                                                               |
| AC-2 | PASS (differences listed) | See "Screens before and after" below: 544/544 same dimensions; 335 byte-identical to a baseline; every other difference is in a class that also appears between two baseline runs of unchanged code                                                                                                                                                                             |
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

The placeholder check first asserted "no button" with `getByRole`, which also finds the dev server's
tools button inside its shadow root once an issue has been shown (seen after the mutation runs). It now
counts the page's own DOM; 15 runs (`--repeat-each=3`) green.
| host-split-build › finds a terminal route that loads the player layout's code | terminal routes not checked | failed |
| host-split-build › finds a terminal route that loads the player layout's code | chunk paths not normalised (`/_next/static/…` vs `static/…`) | failed |
| host-split-build › finds a terminal route that references a module of (player) | module references not checked | failed |
| host-split-build › finds a player route that references (terminal) | player routes not checked | failed |
| host-split-build › finds a route under both root layouts | a route under both layouts not reported | failed |
| host-split-build › fails when there is nothing to check | passes with no terminal route | failed |
| host-split-build › fails when there is nothing to check | passes with no client module of the player's layout | failed |

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
