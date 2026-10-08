# F8cc — verification

## Review brief

- **Route** — `POST /api/terminal/slip-codes` (`src/app/api/terminal/slip-codes/route.ts`,
  `lib/server/terminal.ts` `createSlipCode`, `lib/server/body.ts` `readText`, `lib/api/terminal-schemas.ts`,
  `lib/api/mappers/terminal.ts`). It checks host → origin → cookie → `Idempotency-Key` → signature → body
  (16 KiB, strict UTF-8, strict ASCII `SlipCodeCreate`), then forwards the text read, byte for byte, with
  `X-Device-Id` from the cookie. There is a mock-only expiry fix.
- **Browser** — the contract body is built and signed in `features/terminal/api/slip-codes.ts`, with
  `terminalRequest` taking a key. The rules are in `lib/slip-code.ts`: the request (Book bet's rule plus
  the odds shown), refusals by `code`, timings. One key per intent is in `hooks/use-slip-code.ts` (kiosk
  store).
- **Kiosk** — Get code replaces Book bet (`GetCode.tsx`, `KioskSlip.tsx`). The code screen
  (`SlipCodeScreen.tsx`, `components/ui/QrCode.tsx`, `lib/qr.ts` on `qrcode`'s matrix). Starting over
  (`use-start-over.ts`) is on idle (`use-idle.ts`) and after a code; the page is re-keyed by `round`
  (`Kiosk.tsx`). The chrome's `pricePollMs` → `usePricePollMs()`, off while idle.
- **Removed** — `POST /api/terminal/bookings` and `apiClient`'s POST mirror.
- **Risk** — the signed bytes, and the new route's checks (security). The stake hint and its refusal fix
  (money, display only). The idle reset re-making the page, and fake-timer tests. The new dependency
  `qrcode` (+ `jsqr`, dev).
- **The user's decisions (gate)** — Get code replaces Book bet; after a code, start over unless another
  slip has picks; `qrcode`; the copy as proposed. Docs synced on main first.
- **Not done** — the POS (F9); signed catalogue reads (015 part 1); keeping the wait across a reload;
  checking the signature here (the API's job); a hardware scanner.

## Automated gate

| Check                                     | Result                                                            | Command                              |
| ----------------------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| Typecheck, lint, format, unit + component | PASS (2 lint warnings, pre-existing on main: `BetSlipHeader.tsx`) | `pnpm check` (1,693 tests, 83 files) |
| Generated types                           | PASS                                                              | `pnpm api:check`                     |
| Contract and docs drift                   | PASS                                                              | `pnpm contract:sync --check`         |
| Build                                     | PASS                                                              | `pnpm build`                         |
| Host split                                | PASS                                                              | `node scripts/check-host-split.mjs`  |
| Screens                                   | PASS (3 flaky, Gaps)                                              | `pnpm ui` (673 passed)               |

`pnpm verify` (first run, before review): exit 0.

```
  3 flaky
    terminal.spec.ts:257 › terminal · desktop › ready: activates against Prism …
    terminal.spec.ts:319 › terminal · desktop › revoked: a revoked terminal says so …
    terminal.spec.ts:343 › terminal · desktop › device-not-allowed: …
  673 passed (8.9m)
```

## Tests proven

Each new acceptance test, green, then failed once against the behaviour it guards broken, then restored.

- `qr.test.ts` › "draws a QR that decodes to the code's qr" — each run drawn one module short: jsqr reads
  nothing. (A transposed drawing still decodes, since scanners read mirrored symbols; the next test
  catches that.)
- `qr.test.ts` › "draws exactly the dark modules, inside a quiet zone of four" — rows and columns swapped
  in `qrPath`.
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
- `KioskCode.test.tsx` › "shows 4829 1735 with its QR … then starts over after the terminal's display time" —
  the code screen's timer 5 s late.
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
- `KioskCode.test.tsx` › "keeps the other slips when one becomes a code …" — always starting over.
- `KioskCode.test.tsx` › "signs the API call over the exact body it sends" — signed over no body.

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

## Gaps

- **Flaky in the gate run (passed on retry).** Three F8b screens, which activate against Prism on desktop,
  ran concurrently. First error, the same for each: the kiosk's heading was not visible 5 s after
  activation. They took 13–17 s, retries 12–17 s; the phone runs took 4 s. Run alone, they pass in about
  3 s.
- **Flaky alone, once.** `terminal.spec.ts` › "revoked …" (desktop) failed twice in a row in a lone rerun:
  `expect(await controls(page)).toBe(1)` got 17, with the "switched off" heading already shown; the
  snapshot taken right after shows 1 control. It then passed 10 out of 10 (`--repeat-each=5`, both widths).
  It is not reproduced, so the cause is unknown; the kiosk's controls under a blocked heading would be a
  bug, so it is flagged for the reviewers.
- **Prism can't make a real wait** (`Retry-After: 0`), a named 422 or a closed shop's refusal. Those
  screens and tests answer the kiosk's own route with request 015's shapes. Prism's real 429 is asserted
  through the dev server.
- **No scanner** has read the QR. `jsqr` decodes the drawn path back to `qr` in a unit test.
- **Signing interoperability** with the real API stays a gap until B9 and request 014: Prism checks only
  that the headers are present.
