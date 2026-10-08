# F8cc — verification

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
