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
| Typecheck, lint, Prettier, unit + component tests | PASS — 75 files, 1526 tests                                                                                                                            | `pnpm check`                        |
| Generated types                                   | PASS — "Generated API types match contracts/openapi.yaml."                                                                                             | `pnpm api:check`                    |
| Contract drift                                    | PASS — "contracts/ matches the backend. docs/backend/ matches the backend."                                                                            | `pnpm contract:sync --check`        |
| Production build                                  | PASS — "Compiled successfully"                                                                                                                         | `pnpm build`                        |
| Host split                                        | PASS — "19 player routes load no module or chunk of (terminal); 1 terminal route(s) load no module of (player) nor a chunk holding one (57 manifests)" | `node scripts/check-host-split.mjs` |
| UI                                                | PASS — 600 passed (4.2 m), none flaky, none retried                                                                                                    | `pnpm ui`                           |

Final `pnpm verify` (exit 0) took five attempts' worth of fixes in three:

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

## Tests proven

Each acceptance test was seen failing against a deliberate break of the behaviour it guards, then the code
was restored (a scratch script swaps one string, runs the test, puts it back).

| Test                                                                                                       | What was broken                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `session.test.ts` › still opens a cookie sealed before the sealing moved into seal.ts (F8b)                | The session's HKDF info changed (`kelal.session.v1x`)                                                                                       |
| `server-config.test.ts` › refuses to send terminal activations to the real API before contract request 004 | Seen failing before the refusal existed                                                                                                     |
| `terminal-route.test.ts` › says rotation is due when fewer than 7 days of the token remain, and not before | `<` flipped to `>` in `rotateDue`                                                                                                           |
| › forwards the device id, timestamp, signature and token to the API                                        | `X-Device-Signature` dropped from the upstream headers                                                                                      |
| › answers a skewed clock with the server's time instead of calling the API                                 | The ±20 s check disabled                                                                                                                    |
| › refuses a status read without valid device headers, and calls nothing                                    | The shape checks reduced to "a timestamp is present"                                                                                        |
| › says blocked for a revoked status and for AUTH_INVALID_CREDENTIALS, and keeps the cookie                 | Revoked made to clear the cookie                                                                                                            |
| › refuses a malformed code, another site and a player host before calling the API                          | `terminalOnly` made to pass every host                                                                                                      |
| › rotates: the new token replaces the cookie, from a signed call made with the old one                     | The new cookie not set                                                                                                                      |
| › activates: the token goes into a sealed httpOnly cookie, never the answer                                | The mapper made to add the token to the answer                                                                                              |
| `terminal-signing.test.ts` › makes a device key whose private half can't be exported                       | The key made with `extractable: true`                                                                                                       |
| › signs the API's method, path, timestamp and body hash, verifiable with the public key                    | PATH replaced with `/` in the signed string                                                                                                 |
| › covers the exact body bytes it was given                                                                 | The body's hash replaced with the empty body's                                                                                              |
| › hashes the body as lowercase hex SHA-256, and no body as zero bytes                                      | Hash encoded as base64                                                                                                                      |
| `TerminalStatus.test.tsx` › reads the status on boot and every 5 minutes                                   | Interval set to 6 minutes                                                                                                                   |
| › rotates the token when it is due, once, without touching the screen                                      | Rotation when _not_ due; no status re-read after rotating; the screen swapped for the loader while fetching (each separately)               |
| › rotates once when a screen mounts with a due status already read, however often it mounts                | The once-per-read check removed (the first version, a `useRef`, was not caught: it was replaced by the mutation-cache check this test pins) |
| › tries a failed rotation again at the next read                                                           | The once-per-read check made to match every read, not just this one                                                                         |
| › stops reading once the terminal is revoked                                                               | `refetchInterval` kept at 5 min when blocked                                                                                                |
| › keeps the screen when a read fails after the terminal is up                                              | The error screen preferred over the data held                                                                                               |
| `TerminalStatus.test.tsx` › corrects a skewed clock from the server's answer and signs again, once         | The re-sign disabled                                                                                                                        |
| › signs the status read for the API's path, not its own route                                              | The client made to sign `call.route`                                                                                                        |
| `TerminalActivation.test.tsx` › says the code is wrong when the API answers 404, and keeps it to correct   | `NOT_FOUND` unmapped                                                                                                                        |
| › says the code has expired when the API answers 410 RETAIL_ACTIVATION_EXPIRED                             | Mapped on `BOOKING_EXPIRED` instead                                                                                                         |
| › says too many tries, with the minutes to wait, on 429                                                    | Minutes rounded down                                                                                                                        |
| › checks the code's format before sending it                                                               | Format check bypassed                                                                                                                       |
| › says it is revoked / device_not_allowed and offers nothing to press                                      | A button added to the blocked screen                                                                                                        |
| › says the browser can't keep the key, and sends nothing, when storing it fails                            | Key stored after activating instead of before                                                                                               |
| › asks for a new code when the terminal's activation lapsed                                                | `lapsed` always false                                                                                                                       |
