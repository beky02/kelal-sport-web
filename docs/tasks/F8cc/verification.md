# F8cc — verification

## Review brief

- **Route** — `POST /api/terminal/slip-codes` (`src/app/api/terminal/slip-codes/route.ts`,
  `lib/server/terminal.ts` `createSlipCode`, `lib/server/body.ts` `readText`, `lib/api/terminal-schemas.ts`,
  `lib/api/mappers/terminal.ts`). It checks host → origin → cookie → `Idempotency-Key` → signature → body
  (16 KiB, strict UTF-8, strict ASCII `SlipCodeCreate`, `JSON.stringify`'s own spelling), then forwards the
  text read, byte for byte, with `X-Device-Id` from the cookie. There is a mock-only expiry fix.
- **Browser** — the contract body is built and signed in `features/terminal/api/slip-codes.ts`, with
  `terminalRequest` taking a key. The rules are in `lib/slip-code.ts`: the request (Book bet's rule plus
  the odds shown), refusals by `code`, the idle time. Each slip's key and code are kept in
  `hooks/use-slip-code.ts` (the kiosk store's `codes`).
- **Kiosk** — Book bet makes the slip code (`BookBet.tsx`, `KioskSlip.tsx`). The code shows in the player's
  `BookingCodeDialog`, with no QR and no timer (the user's review). The idle reset (`use-idle.ts`,
  `use-start-over.ts`) re-keys the page by `round` (`Kiosk.tsx`). The chrome's `pricePollMs` →
  `usePricePollMs()`, off while idle.
- **Removed** — `POST /api/terminal/bookings` and `apiClient`'s POST mirror. The QR, `qrcode` and `jsqr`
  were added, then removed in the rework.
- **Risk** — the signed bytes and the route's checks (security). The stake hint and its refusal fix (money,
  display only). The idle reset re-making the page, and the fake-timer tests.
- **The user's decisions** — at the gate: Book bet's place, `qrcode`, the copy (decisions 1–3, 15). In
  their review: Book bet's text, the old dialog, no QR, no timer (plan "Rework", RW-1 to RW-4). Docs synced
  on main first.
- **Not done** — the POS (F9); signed catalogue reads (015 part 1); keeping the wait across a reload;
  checking the signature here (the API's job).

## Automated gate

| Check                                     | Result                                                            | Command                              |
| ----------------------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| Typecheck, lint, format, unit + component | PASS (2 lint warnings, pre-existing on main: `BetSlipHeader.tsx`) | `pnpm check` (1,693 tests, 83 files) |
| Generated types                           | PASS                                                              | `pnpm api:check`                     |
| Contract and docs drift                   | PASS                                                              | `pnpm contract:sync --check`         |
| Build                                     | PASS                                                              | `pnpm build`                         |
| Host split                                | PASS                                                              | `node scripts/check-host-split.mjs`  |
| Screens                                   | PASS (3 flaky, Gaps)                                              | `pnpm ui` (673 passed)               |

`pnpm verify` (first run, before review and the user's rework): exit 0.

`pnpm verify` (final, after the rework and the review fixes, at `3100900`): exit 0. 1,694 unit and
component tests; contract and docs in sync; build; host split.

```
  2 flaky
    auth.spec.ts:170 › logging in on another device takes the language saved on the account (F7b AC-8)
    terminal.spec.ts:883 › terminal kiosk · am · desktop › kiosk-code-prism-429 …
  674 passed (9.2m)
```

```
  3 flaky
    terminal.spec.ts:257 › terminal · desktop › ready: activates against Prism …
    terminal.spec.ts:319 › terminal · desktop › revoked: a revoked terminal says so …
    terminal.spec.ts:343 › terminal · desktop › device-not-allowed: …
  673 passed (8.9m)
```

## Tests proven

Each new acceptance test, green, then failed once against the behaviour it guards broken, then restored.
Tests removed in the user's rework are struck through; the rework's own come after them.

- ~~`qr.test.ts` › "draws a QR that decodes to the code's qr" — each run drawn one module short: jsqr reads
  nothing~~ (removed with the QR).
- ~~`qr.test.ts` › "draws exactly the dark modules, inside a quiet zone of four" — rows and columns swapped
  in `qrPath`~~ (removed with the QR).
- `terminal-mappers.test.ts` › "never shows other digits than the code's" — `display` always taken as sent.
- `terminal-route.test.ts` › "forwards the body byte for byte …" — `bodySerializer` dropped, so
  openapi-fetch re-serialised the checked body.
- `terminal-route.test.ts` › "gives the mock's past example a code's life …" — the mock-only expiry rule
  switched off.
- `terminal-route.test.ts` › "refuses another host, … before calling the API" — the `Idempotency-Key` check
  skipped.
- `terminal-route.test.ts` › "forwards Prism's Prefer under next dev only" — the browser's `Prefer` forwarded
  in any build.
- `slip-code.test.ts` › "closes the picks a started or suspended leg names, by their place in the request" —
  `legs[i]` read as the next leg.
- `slip-code.test.ts` › "offers the server's stake from the contract's example (field stake) and from request
  015's (field stake_hint)" — `stake_hint` not read.
- `slip-code.test.ts` › "counts the wait in whole minutes, rounded up" — rounded down.
- ~~`KioskCode.test.tsx` › "shows 4829 1735 with its QR … then starts over after the terminal's display time" —
  the code screen's timer 5 s late~~ (no timer since the rework).
- `KioskCode.test.tsx` › "starts over after 90 s without a touch: the slips, the filters, the language, the
  search and an open sheet" — no navigation home; then, separately, the page not re-keyed by `round`.
- `KioskCode.test.tsx` › "puts the reset back by the whole idle time at every touch" — a touch not noted.
- `KioskCode.test.tsx` › "stops reading prices while idle, reads them again at the first touch, and keeps
  reading the status" — prices polled while idle; then, separately, no read on waking.
- `KioskCode.test.tsx` › "says when the terminal can make the next code after a 429, and Get code waits until
  then" — no wait stored; then, separately, both guards against a tap during the wait removed (fails at
  "a tap while it waits sends nothing": 2 calls, not 1 — re-proven after `settle()`, self-review).
- `KioskCode.test.tsx` › "keeps the wait through an idle reset" — `startOver` clearing the wait.
- `KioskCode.test.tsx` › "sends one Idempotency-Key per Get code — the same on a retry, a new one for a
  changed slip" — a new key on every tap.
- `KioskCode.test.tsx` › "marks a started match from legs[i] …" — the refused pick not marked.
- `KioskCode.test.tsx` › "lets the status decide on a 401 …" — the status not read again.
- ~~`KioskCode.test.tsx` › "keeps the other slips when one becomes a code …" — always starting over~~ (nothing starts over on a code since the rework).
- `KioskCode.test.tsx` › "signs the API call over the exact body it sends" — signed over no body.
- `KioskCode.test.tsx` › "shows 4829 1735 with its barcode and when it expires, and keeps it until it is
  closed — no timer" — a 60 s timer closing the dialog.
- `KioskCode.test.tsx` › "closes on Done and on a tap outside, leaves the slip as it is, and Booked opens the
  same code again" — closing starting the slip over; then, separately, both guards against booking a booked
  slip again removed (one alone is not enough: the button and the hook each guard).
- `KioskCode.test.tsx` › "closes a code left open, and takes it away, after the idle time" — `startOver`
  keeping the codes.
- `KioskCode.test.tsx` › "books a changed slip anew" — any slip's code taken as this slip's.
- `slip-code.test.ts` › "offers a refused minimum that clears every line …" (M1) — the limit offered as is.
- `slip-code.test.ts` › "offers no stake that isn't an amount, or that is a leg's limit" (M2 rows) — the
  above-zero check removed.
- `terminal-route.test.ts` › "refuses another host, … before calling the API" (SEC1 rows) — the
  `JSON.stringify` check removed: a duplicated key got 201.
- `KioskCode.test.tsx` › U1 (board read again), Q2 (wait dropped once over), Q4 (refusal in the sheet) —
  each written before its fix and seen failing for its reason: no board read, `codesPausedUntil` still set,
  "Set 20.00" not found in the sheet.

## Self-review

- **Money moves:** none. Get code stores picks and a stake hint; nothing is placed, deposited or withdrawn,
  so no query root needs invalidating, and nothing is patched in the browser. The slip's figures are F8cb's,
  untouched.
- **New values:**
  - `codesPausedUntil` is set in `useGetCode` (from `Retry-After`), shown and counted in `GetCode`
    (`useCountdown`), and compared in `getCode`'s guard; nowhere else.
  - `shownCode.slip` is read only by `useCloseCode`.
  - `receipt.display`, `.qr` and `.expiresAt` are each shown once, in `SlipCodeScreen`.
  - `idleResetSeconds` / `codeDisplaySeconds` reach `kioskTimings` only, through `Kiosk`'s `terminal` prop.
  - `stake_hint` is `bookingRequestFrom`'s stake, unchanged.
- **Async tests:** each component test waits for what it asserts (`until`, yielding real macrotasks for
  WebCrypto). The two "sent nothing" checks now `settle()` first; before, they waited one fake tick, which
  a real signature can outlast (re-proven). F8b's signing test in `TerminalStatus.test.tsx` had the same
  flaw, flaked under load in this branch's gate, and now waits for its read.
- **Personal data:** none. The kiosk has no player. The code on screen and Get code's key are in the kiosk
  store, dropped when the kiosk starts over.
- **Route handlers:** `POST /api/terminal/slip-codes` is tested in `terminal-route.test.ts`:
  - it checks host, origin, cookie, key, signature and body before any call, each refusal with `no-store`;
  - every answer is `no-store`;
  - `Prefer` goes only under `next dev`, and `upstream()` never sends it to a real tag.

  Removing `POST /api/terminal/bookings` leaves the kiosk one write, the signed one.

- **Screens:** `kiosk-code`, `kiosk-code-paused` and `kiosk-code-refused` were each looked at in en/am ×
  phone/desktop. Prism's own 429 is an assertion with no picture. The slip's existing screens now show Get
  code. Not pictured, but covered by component tests: Get code sending (its spinner), "Couldn't get a
  code", "can't be made into a code", the status-decides path (it lands on F8b's pictured screens).
- **Docs:**
  - the plan's Files list is updated, with the two files added while implementing and why;
  - the AC → test names match;
  - `10-terminal.md` has a new section, the signed-calls row and Book bet → Get code;
  - `TRANSLATION-NOTES.md` has an F8cc section;
  - the README status is `verifying`.

## Review findings

The panel reviewed commit `193c306`, before the user's rework. Findings about the QR and the code screen
went with them.

| ID   | Reviewer     | Severity | Summary                                                                                                                                                                              | Decision                                                                                                                    |
| ---- | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| M1   | money        | BLOCKER  | A refused minimum was offered as the server's limit; on a slip of several lines it must clear every line (D1.3), as the player's slip offers it                                      | Fixed in `12c1d3b`: `smallestStake(limit, lines)`; test with 3 lines → 5.01 (the kiosk is multiple only, so one line today) |
| S1   | spec (UI U2) | MAJOR    | A started match shows the slip's "Selection suspended" alert, while plan decision 10 says "Match started"; the shared "started" body says "Your bet wasn't placed", wrong on a kiosk | **Asked of the user** (copy is theirs): keep "Selection suspended", or approve new words for a started match                |
| M2   | money        | MINOR    | A zero or negative limit could be offered                                                                                                                                            | Fixed in `12c1d3b`                                                                                                          |
| M3   | money        | MINOR    | No test of "over the maximum, the picks go without a hint" through `slipCodeRequestFrom`                                                                                             | Fixed in `12c1d3b` (test)                                                                                                   |
| SEC1 | security     | MINOR    | A duplicated JSON key's first copy went upstream unchecked                                                                                                                           | Fixed in `12c1d3b`: only `JSON.stringify`'s own text is forwarded                                                           |
| S2   | spec         | MINOR    | The plan's AC → test names didn't match                                                                                                                                              | Fixed: the table is rewritten with the current names                                                                        |
| S3   | spec         | MINOR    | The route's caps (64-character ids, 30 system sizes, 32-character `display`) are not the contract's                                                                                  | Recorded in the plan's Rework section as this app's guards                                                                  |
| U1   | ui           | MINOR    | After a refused pick, the board still showed it open beside the slip that marked it                                                                                                  | Fixed: the board reads its prices again                                                                                     |
| Q1   | quality      | MINOR    | `until`/`settle` bounded by turns, not time; "sent nothing" could prove nothing                                                                                                      | Fixed: `until` has a 5 s real-time limit; the negative checks also assert nothing started (`aria-busy`)                     |
| Q2   | quality      | MINOR    | A wait never cleared kept a countdown ticking all day                                                                                                                                | Fixed: dropped once over                                                                                                    |
| Q3   | quality      | MINOR    | Starting over re-keys the page before the address is home, so the old page reads once more                                                                                           | Follow-up: at most one read per idle reset; navigating first and re-keying after needs the router's completion              |
| Q4   | quality      | MINOR    | A refusal lived in one mount's observer, so the phone's sheet lost it                                                                                                                | Fixed: read from the shared mutation cache                                                                                  |
| Q5   | quality      | MINOR    | The code screen didn't announce the code                                                                                                                                             | Gone with the code screen; the player's dialog is unchanged                                                                 |
| Q6   | quality      | MINOR    | `refused: "started" \| "suspended"` worked out but unused                                                                                                                            | Kept until S1 is answered: it is what "Match started" would read                                                            |
| Q7   | quality      | MINOR    | `reset()` unused                                                                                                                                                                     | Fixed: removed                                                                                                              |
| Q8   | quality      | MINOR    | No component test of the 90 s fallback                                                                                                                                               | Fixed: a test with no idle time (the display-time test went in the rework)                                                  |
| Q9   | quality      | MINOR    | The "revoked" control count was taken once                                                                                                                                           | Fixed: `expect.poll`                                                                                                        |

Notes: the security reviewer suggests request 015 say whether a key reused after a 429 replays the 429, and
tie `qr` to `code` (moot without the QR). The money reviewer notes the player's Book bet on main offers a
refused minimum without the line rule (`bookings/lib/errors.ts`), outside this task.

## Acceptance criteria

| AC    | Status | Evidence                                                                                                                      |
| ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| AC-1  | PASS   | `KioskCode.test.tsx` dialog, Booked, idle-reset tests (pass); `terminal-kiosk-code-*` screens                                 |
| AC-6  | PASS   | `KioskCode.test.tsx` 429 tests; `terminal-route.test.ts` Retry-After; `kiosk-code-paused`, `kiosk-code-prism-429`             |
| AC-c1 | PASS   | `terminal-route.test.ts` byte-for-byte and refusals; `KioskCode.test.tsx` signature and key tests; `kiosk-code` against Prism |
| AC-c2 | PASS   | `KioskCode.test.tsx` › "stops reading prices while idle …"                                                                    |
| AC-c3 | PASS   | `KioskCode.test.tsx` refusal tests; `slip-code.test.ts`; `kiosk-code-refused`                                                 |

## Gaps

- **Flaky in the final gate (passed on retry).** `kiosk-code-prism-429` (am, desktop): the shared
  `activate()` helper's 5 s wait for the kiosk after activation, as in the first gate, not the 429 itself.
  `auth.spec.ts:170` (F7b), outside this task.

- **Flaky in the gate run (passed on retry).** Three F8b screens, which activate against Prism on desktop,
  ran concurrently. First error, the same for each: the kiosk's heading was not visible 5 s after
  activation. They took 13–17 s, retries 12–17 s; the phone runs took 4 s. Run alone, they pass in about
  3 s. The same happened to the first three tests of a later screen run right after source edits: the dev
  server compiling on first request, not the kiosk.
- **Flaky alone, once.** `terminal.spec.ts` › "revoked …" (desktop) failed twice in a row in a lone rerun:
  `expect(await controls(page)).toBe(1)` got 17, with the "switched off" heading already shown; the
  snapshot taken right after shows 1 control. It then passed 10 out of 10 (`--repeat-each=5`, both widths).
  It is not reproduced. The quality reviewer's reading: after a reload `next dev` shows the kiosk
  starting (17 controls) until the status answers, and a full reload can land between the heading check
  and the count. The count now retries (Q9).
- **Prism can't make a real wait** (`Retry-After: 0`), a named 422 or a closed shop's refusal. Those
  screens and tests answer the kiosk's own route with request 015's shapes. Prism's real 429 is asserted
  through the dev server.
- **No scanner** has read the slip code's Code 128 barcode (as for F5's).
- **Signing interoperability** with the real API stays a gap until B9 and request 014: Prism checks only
  that the headers are present.
