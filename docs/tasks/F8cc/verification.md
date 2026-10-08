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
- `KioskCode.test.tsx` › "shows 4829 1735 with its QR … then starts over after the terminal's display time" —
  the code screen's timer 5 s late.
- `KioskCode.test.tsx` › "starts over after 90 s without a touch: the slips, the filters, the language, the
  search and an open sheet" — no navigation home; then, separately, the page not re-keyed by `round`.
- `KioskCode.test.tsx` › "puts the reset back by the whole idle time at every touch" — a touch not noted.
- `KioskCode.test.tsx` › "stops reading prices while idle, reads them again at the first touch, and keeps
  reading the status" — prices polled while idle; then, separately, no read on waking.
- `KioskCode.test.tsx` › "says when the terminal can make the next code after a 429, and Get code waits until
  then" — no wait stored; then, separately, both guards against a tap during the wait removed.
- `KioskCode.test.tsx` › "keeps the wait through an idle reset" — `startOver` clearing the wait.
- `KioskCode.test.tsx` › "sends one Idempotency-Key per Get code — the same on a retry, a new one for a
  changed slip" — a new key on every tap.
- `KioskCode.test.tsx` › "marks a started match from legs[i] …" — the refused pick not marked.
- `KioskCode.test.tsx` › "lets the status decide on a 401 …" — the status not read again.
- `KioskCode.test.tsx` › "keeps the other slips when one becomes a code …" — always starting over.
- `KioskCode.test.tsx` › "signs the API call over the exact body it sends" — signed over no body.
