# F8cc — verification

## Tests proven

Each new acceptance test, green, then failed once against the behaviour it guards broken, then restored.

- `qr.test.ts` › "draws a QR that decodes to the code's qr" — each run drawn one module short: jsqr reads
  nothing. (A transposed drawing still decodes, since scanners read mirrored symbols; the next test
  catches that.)
- `qr.test.ts` › "draws exactly the dark modules, inside a quiet zone of four" — rows and columns swapped
  in `qrPath`.
