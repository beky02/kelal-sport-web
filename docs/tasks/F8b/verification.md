# F8b — verification

## Review brief

- **Route handlers** (`src/app/api/terminal/{activate,status,token}`, `lib/server/terminal.ts`): activation
  is unsigned and needs CSRF and a strict body. Status and rotation forward the browser's
  `X-Device-Timestamp`/`-Signature` after checking their shape and ±20 s, and add `X-Device-Id` and the
  bearer from the cookie. Every handler 404s off a terminal host. `Retail - terminal` is refused in
  `API_REAL_TAGS` until 004 (`config.ts`).
- **Cookie** (`terminal-session.ts`, `seal.ts`): the session's AES-GCM sealing moved into `seal.ts`
  under a purpose; the terminal cookie has its own key. It is `__Host-`, Strict, and lasts the token's
  life plus 30 days. The session's bytes are unchanged (pinned by a pre-move cookie).
- **Browser** (`features/terminal/**`): a non-extractable P-256 key in IndexedDB; `terminalRequest`
  signs `METHOD\nPATH\nTS\nhex(sha256(body))` for the API call (from `calls.ts`) and re-signs once on
  `CLOCK_SKEW`. The status hook reads every 5 min and rotates once per read (the mutation cache
  remembers). Screens show both languages; the blocked screens have no controls.
- **Risk**: security (cookie, signature pass-through, CSRF on a bodiless POST, host guard); the signing
  encodings are an assumption (contract request 014, approved at the plan gate); `problemError` moved
  out of `apiClient` (player path).
- **User's decisions** (plan gate): plan approved as written; sync the contract first; assume the
  encodings and file request 014.
- **Not done**: the kiosk, slip codes, idle reset, language, `features.retail` (F8c); verifying
  signatures ourselves; a technician reset on the revoked screen.

## Self-review

- Money moves: none (`touches_money: false`). Activation and rotation invalidate the status query;
  nothing is patched in the browser.
- New values: `rotateDue` is computed only in `loadTerminalStatus` and read only in the hook's effect.
  `terminalId` → `X-Device-Id` only in `deviceHeaders`. The clock offset is set and read only in
  `terminalRequest`. `retryAfter` → minutes only in `refusalOf`. The shop's name and label are shown
  only in `TerminalShell`.
- Async tests: component tests wait with `findBy*` or the fake-clock `tick` before asserting. The
  rotation test captures the heading after the status has landed and checks it during a 1 s rotation.
- Personal data: none. No player is on a terminal and `terminalKeys` holds only the terminal's status.
  No session watcher applies (written in `keys.ts`).
- Route handlers: a terminal cookie is required for status and rotation (no cookie → `inactive` / 401).
  Inputs are validated before any upstream call (body Zod, header shapes, clock). `no-store` is on every
  `respond()` answer and on the device-header 400s. `Prefer` is forwarded only under `next dev` (route
  test, dev vs test) and never to the real API (`upstream()`; the tag can't be real). Each has a test.
- Screens: every state has a phone and desktop screenshot, except two activation errors that only a
  broken browser or network produces ("couldn't reach", "can't keep the key"). Both are covered by
  component tests.
- Docs: the plan's Files and AC → tests match the code (updated after implementing: `blocked` state,
  `code.ts`, `compactCrockford`, `TerminalScreens.tsx`, the mutation-cache guard). Done: 10-terminal
  (new), 00-overview, 01-screens, 09-security, design README, TRANSLATION-NOTES, the README status, and
  contract request 014.

## Automated gate

| Check                                             | Result                                                                                                                                                 | Command                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| Typecheck, lint, Prettier, unit + component tests | PASS — 75 files, 1531 tests                                                                                                                            | `pnpm check`                        |
| Generated types                                   | PASS — "Generated API types match contracts/openapi.yaml."                                                                                             | `pnpm api:check`                    |
| Contract drift                                    | PASS — "contracts/ matches the backend. docs/backend/ matches the backend."                                                                            | `pnpm contract:sync --check`        |
| Production build                                  | PASS — "Compiled successfully"                                                                                                                         | `pnpm build`                        |
| Host split                                        | PASS — "19 player routes load no module or chunk of (terminal); 1 terminal route(s) load no module of (player) nor a chunk holding one (57 manifests)" | `node scripts/check-host-split.mjs` |
| UI                                                | PASS — 600 passed (4.4 m), none flaky, none retried                                                                                                    | `pnpm ui`                           |

Final `pnpm verify` after the review fixes (`d94a399`, `8609adb`): exit 0 — 1531 tests, types, drift,
build, host split (19 player routes, 1 terminal route, 57 manifests), 600 UI tests. In that build no chunk
the terminal loads contains a player schema (Q3). Before the review, the gate needed three fixes:

1. The drift check failed: the backend had changed its contract during the session (error responses on
   the catalogue operations, `minimum: 1` on popular's `limit`). It was synced as its own commit
   (`b6f1b58`), the same way the user approved for the first sync; nothing in it touches the terminal.
2. The host-split check failed. With its own providers, the terminal shares library chunks (React,
   React Query, `lib/query`) with the player's providers. The check counted every chunk a player-layout
   module _needs_ as "the player layout's". F8a's comment left this decision to F8b. The check now counts
   the chunks that _define_ a layout module, found by module id in the chunk's code, and falls back to
   every chunk when none does. Confirmed on the real build: the player's providers and preferences store
   are defined in a chunk the terminal never loads, and planting that chunk in the terminal route is
   caught. New unit tests cover the shared library, the defining chunk, and the fallback.
3. A type error in that test (the JS default parameter's inferred type) was fixed with a JSDoc type.

## Acceptance criteria

| AC   | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-2 | MET    | `terminal-signing.test.ts` (4 + 3 tests: non-extractable P-256, the signed string pinned, verify with the public key; route/time/method/body changes fail); `terminal-route.test.ts` › forwards the device id, timestamp, signature and token; names the device from the sealed cookie; refuses bad headers; answers a skewed clock (all pass); `TerminalStatus.test.tsx` › signs the status read for the API's path; corrects a skewed clock (pass); `terminal.spec.ts` › ready: activates against Prism and signs the status read with a non-extractable key (pass, phone + desktop, real Chrome: IndexedDB key `extractable: false`, `exportKey` fails, cookie httpOnly + Strict) |
| AC-4 | MET    | `terminal-route.test.ts` › activation cookie and pass-through tests; blocked/lapsed tests (pass); `TerminalActivation.test.tsx` 14 tests: wrong code, expired, too many (with minutes / later), format, unreachable, unsupported, lapsed, revoked and device-not-allowed with nothing to press, no form after a successful activation (pass); `terminal.spec.ts` › revoked after a reload too (Prism's 401, pass); screenshots `test-results/ui/terminal-{activate,activate-format,activate-wrong-code,activate-expired,activate-too-many,lapsed,revoked,device-not-allowed}-{phone,desktop}.png`                                                                                    |
| AC-5 | MET    | `TerminalStatus.test.tsx` › reads at 0, 5:00, 10:00 and not at 4:59.999; rotates once without touching the screen (same heading node, no loading); once across strict-mode remounts; failed rotation retried at the next read; stops when blocked; keeps the screen on a failed read (all pass, fake timers); `terminal-route.test.ts` › rotation due under 7 days; rotation replaces the cookie from a signed call (pass)                                                                                                                                                                                                                                                           |

## Review findings

| ID      | Reviewer      | Severity | Summary                                                                                                                                    | Decision                                                                                                                                                                                                                                                                                           |
| ------- | ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1      | quality       | MAJOR    | After a successful activation, a failed status read showed the form again; a second press replaced the device key the terminal is bound to | Fixed in `d94a399`: the status query is reset (not invalidated) after activation, so a failed read shows "Can't reach the server" + Try again. Test › never shows the form again once activated…: fails with `invalidateQueries`, passes with `resetQueries`                                       |
| S1      | spec          | MINOR    | The "lapsed" reason vanished at the next 5-minute read (the cookie had been cleared)                                                       | Fixed in `d94a399`: the cookie is never cleared; the next activation replaces it. Test › keeps saying the activation lapsed, read after read: fails when the route clears the cookie, passes now                                                                                                   |
| S2 / Q7 | spec, quality | MINOR    | Any non-`ApiError` (a `ContractError`) said "this browser can't keep the key"                                                              | Fixed in `d94a399`: `DeviceKeyError` wraps key creation and storage only; everything else says the server couldn't be reached. Test › …when the activation's answer doesn't parse: fails with the old mapping, passes now                                                                          |
| Q2      | quality       | MINOR    | The refined host-split check no longer guarded player code the terminal could pull in indirectly (the preferences store, realtime)         | Fixed in `d94a399`: `src/stores/` and `src/lib/websocket/` count as the player's layout (by defining chunk and by reference); `definesModule` exported and unit-tested. Tests fail with the old folder list / with the factory part of the regex removed. An ESLint import boundary is a follow-up |
| Q3      | quality       | MINOR    | The kiosk shipped every player Zod schema (≈82 KB raw)                                                                                     | Fixed in `d94a399`: `lib/api/terminal-schemas.ts`; nothing under `features/terminal` or `app/(terminal)` imports `lib/api/schemas`                                                                                                                                                                 |
| Q4 / U1 | quality, ui   | MINOR    | No visible focus on the code field                                                                                                         | Fixed in `d94a399`: `outline-none` removed, so the site's focus ring shows (`terminal-activate-wrong-code-desktop.png`)                                                                                                                                                                            |
| Q5      | quality       | MINOR    | The alert region toggled its role, was polite, and didn't re-announce a repeated refusal                                                   | Fixed in `d94a399`: one `role="alert"` region, always present; the message is re-keyed per press. Test › announces a refusal said again: fails without the key                                                                                                                                     |
| Q6      | quality       | MINOR    | Upper-casing on every key moved the caret                                                                                                  | Fixed in `d94a399`: the value is kept as typed; normalised on send                                                                                                                                                                                                                                 |
| U2      | ui            | MINOR    | The form jumped ~9 px when a two-line message appeared                                                                                     | Fixed in `d94a399`: the message slot reserves two lines (`min-h-12`)                                                                                                                                                                                                                               |
| U3      | ui            | MINOR    | Try again barely looked like a button                                                                                                      | Fixed in `d94a399`: filled (`bg-raised`) with a hover (`terminal-offline-*.png`)                                                                                                                                                                                                                   |
| U4      | ui            | MINOR    | The lapsed message read like a field hint                                                                                                  | Fixed in `d94a399`: a warning notice above the field (`terminal-lapsed-*.png`)                                                                                                                                                                                                                     |
| Q9      | quality       | MINOR    | `waitForTimeout(200)` before each e2e screenshot                                                                                           | Fixed in `d94a399`: waits for `document.fonts.ready`                                                                                                                                                                                                                                               |
| SEC1    | security      | MINOR    | "A stolen token is useless without the PC" claimed more than a non-extractable key gives (a copied Chrome profile holds both)              | Fixed in `d94a399`: the claim narrowed in `signing.ts`; 10-terminal "What the device key protects against" names OS hardening and revocation; 09-security points to it                                                                                                                             |
| Q8      | quality       | MINOR    | The two terminal component test files duplicate their harness and don't render through the app's query client (retry policy)               | Follow-up: one `tests/component/terminal.tsx` helper rendering through `TerminalProviders`' client (> 5 minutes, touches both files' structure)                                                                                                                                                    |

Notes (no decision needed):

- money: PASS, no findings; `compactCrockford` extraction and the `problemError` move are behaviour-identical (48 ticket tests run).
- security: every probe held live against the dev server (host guard, CSRF incl. `Sec-Fetch-Site: same-site`, header validation, spoofed `X-Device-Id`/`X-Tenant-Id`, tampered cookie, `Prefer` only in dev). The 09-security "13 digits" now matches the code (`^\d{13}$`). Refusals made with `problemResponse` carry no `no-store`; their bodies are static (as the player's).
- ui: in the too-many state Activate stays pressable; the server enforces the limit, and whether a press during the lockout extends it is the backend's (contract request 014's examples).
- spec/security: any 401 other than `AUTH_TOKEN_EXPIRED` shows "switched off"; a signature the backend rejects (encodings still assumed) or a web-server/API clock gap over 10 s would too, failing closed — see Gaps.

## Gaps

- **The signing string is unverified against the backend.** Prism only checks the three device headers are present; the encodings (hex SHA-256, P1363 `r‖s` base64, PATH with query) are an assumption until contract request 014 is answered and B9 runs. Risk: every terminal shows "switched off" against the real API until the one function (`canonicalRequest` / `signRequest`) matches. `Retail - terminal` can't be pointed at the real API before 004 anyway.
- **Clock gap between this server and the API.** The route corrects the browser to _this_ server's clock (±20 s); the API allows ±30 s of _its_ clock. If the two servers drift more than ~10 s apart, signed calls may be refused and shown as switched off. Ops: NTP on both.
- **A lost rotation answer** leaves the old token (valid 5 more minutes): that PC then needs a new code (10-terminal, known limits).
- **Real IndexedDB** is exercised only in Playwright (Chrome); jsdom has none, so unit and component tests use an in-memory store.

## Tests proven

Each acceptance test was seen failing against a deliberate break of the behaviour it guards, then the code
was restored (a scratch script swaps one string, runs the test, puts it back).

| Test                                                                                                                         | What was broken                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `session.test.ts` › still opens a cookie sealed before the sealing moved into seal.ts (F8b)                                  | The session's HKDF info changed (`kelal.session.v1x`)                                                                                       |
| `server-config.test.ts` › refuses to send terminal activations to the real API before contract request 004                   | Seen failing before the refusal existed                                                                                                     |
| `terminal-route.test.ts` › says rotation is due when fewer than 7 days of the token remain, and not before                   | `<` flipped to `>` in `rotateDue`                                                                                                           |
| › forwards the device id, timestamp, signature and token to the API                                                          | `X-Device-Signature` dropped from the upstream headers                                                                                      |
| › answers a skewed clock with the server's time instead of calling the API                                                   | The ±20 s check disabled                                                                                                                    |
| › refuses a status read without valid device headers, and calls nothing                                                      | The shape checks reduced to "a timestamp is present"                                                                                        |
| › says blocked for a revoked status and for AUTH_INVALID_CREDENTIALS, and keeps the cookie                                   | Revoked made to clear the cookie                                                                                                            |
| › refuses a malformed code, another site and a player host before calling the API                                            | `terminalOnly` made to pass every host                                                                                                      |
| › rotates: the new token replaces the cookie, from a signed call made with the old one                                       | The new cookie not set                                                                                                                      |
| › activates: the token goes into a sealed httpOnly cookie, never the answer                                                  | The mapper made to add the token to the answer                                                                                              |
| `terminal-signing.test.ts` › makes a device key whose private half can't be exported                                         | The key made with `extractable: true`                                                                                                       |
| › signs the API's method, path, timestamp and body hash, verifiable with the public key                                      | PATH replaced with `/` in the signed string                                                                                                 |
| › covers the exact body bytes it was given                                                                                   | The body's hash replaced with the empty body's                                                                                              |
| › hashes the body as lowercase hex SHA-256, and no body as zero bytes                                                        | Hash encoded as base64                                                                                                                      |
| `TerminalStatus.test.tsx` › reads the status on boot and every 5 minutes                                                     | Interval set to 6 minutes                                                                                                                   |
| › rotates the token when it is due, once, without touching the screen                                                        | Rotation when _not_ due; no status re-read after rotating; the screen swapped for the loader while fetching (each separately)               |
| › rotates once when a screen mounts with a due status already read, however often it mounts                                  | The once-per-read check removed (the first version, a `useRef`, was not caught: it was replaced by the mutation-cache check this test pins) |
| › tries a failed rotation again at the next read                                                                             | The once-per-read check made to match every read, not just this one                                                                         |
| › stops reading once the terminal is revoked                                                                                 | `refetchInterval` kept at 5 min when blocked                                                                                                |
| › keeps the screen when a read fails after the terminal is up                                                                | The error screen preferred over the data held                                                                                               |
| `TerminalStatus.test.tsx` › corrects a skewed clock from the server's answer and signs again, once                           | The re-sign disabled                                                                                                                        |
| › signs the status read for the API's path, not its own route                                                                | The client made to sign `call.route`                                                                                                        |
| `TerminalActivation.test.tsx` › says the code is wrong when the API answers 404, and keeps it to correct                     | `NOT_FOUND` unmapped                                                                                                                        |
| › says the code has expired when the API answers 410 RETAIL_ACTIVATION_EXPIRED                                               | Mapped on `BOOKING_EXPIRED` instead                                                                                                         |
| › says too many tries, with the minutes to wait, on 429                                                                      | Minutes rounded down                                                                                                                        |
| › checks the code's format before sending it                                                                                 | Format check bypassed                                                                                                                       |
| › says it is revoked / device_not_allowed and offers nothing to press                                                        | A button added to the blocked screen                                                                                                        |
| › says the browser can't keep the key, and sends nothing, when storing it fails                                              | Key stored after activating instead of before                                                                                               |
| › asks for a new code when the terminal's activation lapsed                                                                  | `lapsed` always false                                                                                                                       |
| `TerminalActivation.test.tsx` › never shows the form again once activated, even when the status read that follows fails (Q1) | `resetQueries` back to `invalidateQueries`                                                                                                  |
| › says the server couldn't be reached, not the browser, when the activation's answer doesn't parse (S2/Q7)                   | Non-`ApiError` mapped to `unsupported` again                                                                                                |
| › announces a refusal said again, as a new message in the same alert region (Q5)                                             | The per-press key removed                                                                                                                   |
| `terminal-route.test.ts` › keeps saying the activation lapsed, read after read, when the token has expired (S1)              | The route made to clear the cookie                                                                                                          |
| `host-split-build.test.ts` › finds the terminal loading the chunk that holds the player's stores or realtime code (Q2)       | The player-only folders reduced to `(player)/`                                                                                              |
| › reads which chunk defines a module from Turbopack's output, not from a use of it                                           | The factory part of the regex removed (first stayed green; a data-list case was added, then it failed)                                      |
| › lets the terminal share a library chunk the player's layout needs                                                          | Seen failing before `defines` existed                                                                                                       |
