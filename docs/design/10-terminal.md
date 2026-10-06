# 10 — Shop terminal

The self-service PC in a shop (C19, C18 §5). It runs this app's `(terminal)` route group on its own host,
`terminal.{brand}` (FD1, F8a), in Chrome kiosk mode. No player signs in, and no money is shown or
handled. F8b builds what the terminal runs on: activation, the device key, signed calls, its status, and
the token's rotation. F8c builds the kiosk on top: browsing, the slip, slip codes and the idle reset.

## Lifecycle

```
new PC ──activation code──▶ active ──every 5 min──▶ active (rotates its token when < 7 days remain)
                              │  ▲
                 shop closes  ▼  │  shop opens
                            closed
active/closed ──revoked / 401 AUTH_INVALID_CREDENTIALS──▶ switched off (no way forward on screen)
active/closed ──403 RETAIL_DEVICE_NOT_ALLOWED──────────▶ not allowed (no way forward on screen)
active/closed ──401 AUTH_TOKEN_EXPIRED / token past expiry──▶ activation, "lapsed"
```

1. **Activation (C19 §4.1).** A technician types the one-time code that the back office or agent portal
   gave for this terminal (8 Crockford characters; case, spaces, hyphens, O for 0 and I/L for 1 are
   forgiven). The browser makes an ECDSA P-256 key pair with `extractable: false` and keeps it in
   IndexedDB (`kelal-terminal` / `keys` / `device`). Then `POST /api/terminal/activate` sends the code
   and the public half (SPKI, base64). The API's 90-day terminal token goes into the terminal cookie, and
   the screen shows the shop.
   Once activation succeeds the status is read afresh with the new key. If that read fails, the
   screen is "Can't reach the server" with Try again, never the form again, so a second activation
   can't replace the key the terminal is now bound to.
2. **Every boot and every 5 minutes**, the terminal reads `GET /api/terminal/status`. This goes on in the
   background as well; a blocked terminal stops until it is reloaded.
3. **Rotation.** When the status says fewer than 7 days of token remain (`rotateDue`), the browser posts a
   signed `POST /api/terminal/token` in the background. It does this once per status read, however many
   screens mounted the hook (the mutation cache remembers). The new token replaces the old one in the
   cookie. The API keeps the old token valid for 5 minutes. The screen never changes for it. A failed
   rotation is tried again at the next read.
4. **Revocation** from the back office takes effect on the next read. The terminal shows "switched off"
   and nothing to press. Its cookie is kept, so every reload asks the API again and is told the same.
   **To re-use a revoked PC**, clear the browser's site data for the terminal host (an installation
   step), then activate it with a new code.

## Screens and states

Every message is shown in Amharic, then English, until F8c gives the kiosk a language
(`features/terminal/components/Bilingual.tsx`). Text is at least 14 px and targets at least 48 px.
Screenshots are `test-results/ui/terminal-<state>-{phone,desktop}.png`, from `tests/e2e/terminal.spec.ts`.

| State                   | When                                                                                                 | Shows                                                                                       | Screenshot                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------ |
| Loading                 | Before the first status answer                                                                       | "Starting the terminal…"                                                                    | `terminal-loading`             |
| Activation              | No device key in this browser, or no terminal cookie                                                 | Code field, Activate                                                                        | `terminal-activate`            |
| … code not 8 characters | Checked before sending (no attempt spent)                                                            | "The code has 8 letters and digits."                                                        | `terminal-activate-format`     |
| … wrong code            | `404 NOT_FOUND`                                                                                      | "No terminal has this code. Check it and try again." The code stays to correct              | `terminal-activate-wrong-code` |
| … expired code          | `410 RETAIL_ACTIVATION_EXPIRED`                                                                      | "This code has expired. Ask for a new one."                                                 | `terminal-activate-expired`    |
| … too many tries        | `429 RATE_LIMITED` (5 per IP per hour)                                                               | "Too many tries. Try again in {minutes} min." from `Retry-After`, or "later" without one    | `terminal-activate-too-many`   |
| … other failure         | Network, 5xx, anything else                                                                          | "Couldn't reach the server. Try again."                                                     | —                              |
| … key can't be kept     | WebCrypto or IndexedDB refused                                                                       | "This browser can't keep the terminal's key. Use Chrome in kiosk mode." Nothing is sent     | —                              |
| Activation, lapsed      | `401 AUTH_TOKEN_EXPIRED`, or the sealed expiry has passed (the cookie stays, so the reason does too) | The activation screen with "This terminal's activation has lapsed. Type a new code."        | `terminal-lapsed`              |
| Ready                   | Active, shop open                                                                                    | Shop name and terminal label in the top bar; "This terminal is ready" (F8c's sportsbook)    | `terminal-ready`               |
| Closed                  | Active, `shop.open_now: false` (C19 §14: closed or suspended)                                        | Top bar; "This shop is closed"; it comes back by itself at a later read when the shop opens | `terminal-closed`              |
| Switched off            | `status: revoked`, or `401 AUTH_INVALID_CREDENTIALS`                                                 | "This terminal has been switched off … Ask the shop staff." **No controls**                 | `terminal-revoked`             |
| Not allowed             | `403 RETAIL_DEVICE_NOT_ALLOWED`                                                                      | "This PC can't run the terminal … Ask the shop staff." **No controls**                      | `terminal-device-not-allowed`  |
| Offline                 | The first read failed (network, 5xx)                                                                 | "Can't reach the server"; Try again (and the 5-minute read keeps trying)                    | `terminal-offline`             |
| A later read fails      | After any answer                                                                                     | Nothing changes on screen; the next read tries again                                        | —                              |

"Disabled" in the task means the shop is closed or suspended: the contract's terminal status is only
`active` or `revoked`, and C19 §14 says a closed shop's terminals show "closed". The tenant's
`features.retail` switch belongs to F8c.

## Signed calls (D3)

The browser holds the device key but never calls the API, so it signs **the API call that the route
handler will make**: its method, its contract path and the exact body bytes. One table,
`features/terminal/lib/calls.ts`, pairs each route with its API call, and both sides read it.

| Route                         | API call                             | Signed | CSRF header | Body                          |
| ----------------------------- | ------------------------------------ | ------ | ----------- | ----------------------------- |
| `POST /api/terminal/activate` | `POST /v1/retail/terminals/activate` | no     | yes         | code + public key (4 KiB cap) |
| `GET /api/terminal/status`    | `GET /v1/retail/terminal`            | yes    | —           | —                             |
| `POST /api/terminal/token`    | `POST /v1/retail/terminal/token`     | yes    | yes         | none read or sent             |

- **What is signed:** `METHOD\nPATH\nTIMESTAMP\nSHA256(body)`, with the SHA-256 as lowercase hex (of zero
  bytes when there is no body). The signature is WebCrypto's 64-byte `r‖s` in standard base64. The
  browser sends `X-Device-Timestamp` and `X-Device-Signature`. The route adds `X-Device-Id` (the
  terminal id sealed in its cookie, never one the browser names) and `Authorization: Bearer <token>`. The
  contract leaves the encodings open; [contract request 014](../contract-requests/014-device-signature.md)
  asks the backend to settle them. Until then they are an assumption, kept in `canonicalRequest` and
  `signRequest` (`features/terminal/lib/signing.ts`). Prism only checks that the headers are present.
- **Clock.** The route handler checks the timestamp against its own clock (±20 s; the API allows
  ±30 s). If it is outside that, it answers `400 VALIDATION_FAILED` with
  `errors: [{ field: "X-Device-Timestamp", code: "CLOCK_SKEW", current: "<server ms>" }]` instead of
  calling the API. The browser learns the offset and signs again, once, and signs every later call with
  the corrected time. Without this, a shop PC with a wrong clock could be shown as switched off.
- **Language.** Calls go out with `Accept-Language: am`. The screens show both languages.

## What the terminal loads

Its own root layout and providers: a query client (`createQueryClient`) and nothing of the player's. No
preferences store, session, realtime channel or player layout. It shares pure code: the schemas in
`lib/api/schemas.ts`, `lib/i18n`, `lib/api/errors.ts`, and the Crockford forgiveness from
`features/tickets/lib/number.ts`. `scripts/check-host-split.mjs` checks the split on every
`pnpm verify`. The page is static. What the terminal is depends on this browser's key and cookie, so it
is decided after the first paint (C18 §5).

## What the device key protects against

`extractable: false` means no script on the page, this app's included and any injected script, can
export the private key. It can only ask WebCrypto to sign. So a copied cookie (the token) is useless
without the PC. It does **not** protect against someone with the PC's own files. Chrome keeps the key
in the profile's IndexedDB next to its cookies, so a copy of the kiosk user's Chrome profile carries
both. Against device theft and cloning, the controls are the shop PC's own hardening and revocation from
the back office: a locked-down kiosk account with no access to the profile directory, and disk
encryption. These belong in the installation checklist (C19 §15).

## Known limits

- A rotation whose answer is lost (the network drops after the API rotated) leaves the old token. It is
  refused 5 minutes later, so the terminal then needs a new code.
- Clearing the browser's site data deletes the device key; the terminal must then be activated again.
  IndexedDB that can't be read looks the same as no key.
- Through this server the API sees one address for every shop. That is why `Retail - terminal` is
  refused in `API_REAL_TAGS` until contract request 004 lands (09-security).
