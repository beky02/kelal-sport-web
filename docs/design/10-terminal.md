# 10 — Shop terminal

The self-service PC in a shop (C19, C18 §5). It runs this app's `(terminal)` route group on its own host,
`terminal.{brand}` (FD1, F8a), in Chrome kiosk mode. No player signs in, and no money is shown or
handled. F8b builds what the terminal runs on: activation, the device key, signed calls, its status, and
the token's rotation. F8c builds the kiosk on top: browsing and picks (F8ca), the slip's figures with the
retail rule set (F8cb), slip codes and the idle reset (F8cc).

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

The terminal's own screens below show every message in Amharic, then English
(`features/terminal/components/Bilingual.tsx`). They appear before there is a config, or to staff, and a
choice made on them would not outlast the next customer. The kiosk (next section) speaks one language at
a time. Text is at least 14 px and targets at least 48 px. Screenshots are
`test-results/ui/terminal-<state>-{phone,desktop}.png`, from `tests/e2e/terminal.spec.ts`.

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
| Kiosk                   | Active, shop open, shop betting on                                                                   | The sportsbook (next section)                                                               | `terminal-kiosk-*`             |
| Unavailable             | Active, shop open, `features.retail: false` (F8ca)                                                   | Top bar; "Betting isn't available at this terminal · Ask the shop staff." No controls       | `terminal-unavailable`         |
| Closed                  | Active, `shop.open_now: false` (C19 §14: closed or suspended)                                        | Top bar; "This shop is closed"; it comes back by itself at a later read when the shop opens | `terminal-closed`              |
| Switched off            | `status: revoked`, or `401 AUTH_INVALID_CREDENTIALS`                                                 | "This terminal has been switched off … Ask the shop staff." **No controls**                 | `terminal-revoked`             |
| Not allowed             | `403 RETAIL_DEVICE_NOT_ALLOWED`                                                                      | "This PC can't run the terminal … Ask the shop staff." **No controls**                      | `terminal-device-not-allowed`  |
| Offline                 | The first read failed (network, 5xx)                                                                 | "Can't reach the server"; Try again (and the 5-minute read keeps trying)                    | `terminal-offline`             |
| A later read fails      | After any answer                                                                                     | Nothing changes on screen; the next read tries again                                        | —                              |

"Disabled" in the task means the shop is closed or suspended: the contract's terminal status is only
`active` or `revoked`, and C19 §14 says a closed shop's terminals show "closed". The tenant's
`features.retail` switch (C19 §11 `retail.enabled`) is read with the kiosk's config. Only an explicit
`false` turns it off, as for booking codes. The config is read every 5 minutes while the switch is on and
every minute while it is off, so the kiosk comes back by itself.

## The kiosk (F8ca)

What an active terminal of an open shop shows: the shop's matches by sport and day, prices that go into a
slip, and the slip's picks. F8cb adds the stake and the figures; F8cc adds Get code.

```
┌ shop name ───────────────────────────────── PC 3 · [English] ┐
│ Matches                                       │ Bet slip      │
│ [Football] [Basketball]                       │ pick  1.95  × │
│ [Today 6 Oct] [Wed 7 Oct] …                   │ pick  3.40  × │
│ ┌ Premier League ─────────────────────────┐   │               │
│ │ 04/10 · 17:00  Arsenal  [1 2.10][X 3.40][2 3.30]           │
│ │                Chelsea                  │   │    Clear all  │
└───────────────────────────────────────────────┴──────────────┘
```

- **Language.** It opens in the tenant's `default_language` (Amharic for `demo`, FD2). One tap switches
  it, with a button showing the other language's own name (English, አማርኛ). The switch is offered only
  among the tenant's `languages`. `<html lang>` follows, so the Amharic tokens apply, and so does every
  call's `Accept-Language`. The choice lives in `features/terminal/stores/kiosk.store.ts`, is never
  persisted, and goes back to the default on idle (F8cc). The shared text hooks read it through
  `LocaleProvider` (`lib/i18n/locale.tsx`), which the player feeds from its own store.
- **Sport and day** are in the URL (`/?sport=…&date=…` on the terminal host), through the player's
  `useBoardFilters`, as on the player's board. The board's order (`filter`) stays at its default, and
  there is no competition filter and no live board (D8).
- **Rows** show the kick-off (East Africa Time, Gregorian, D7), both teams and the 1X2 prices, the one
  market every board row carries (double chance and total goals wait for contract request 001). There is
  no match detail on the kiosk in F8c. A price is `OddsButtonView` at `size="lg"` (56 px), with the
  outcome's code (1, X, 2) beside it and its full name in the accessible label. It is locked when the
  market is suspended or the API left the price out. Prices poll every 30 s (D5).
- **The slip** is the player's slip store, unchanged. The kiosk shows the picks (match, pick, market,
  odds) with Remove on each, and Clear all. From `lg` up it sits beside the board; narrower, it is a view
  of its own, opened from a bar that counts the picks.

| State              | When                                     | Shows                                                                                 | Screenshot                                     |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Config loading     | Before `/api/terminal/config` answers    | Top bar; "Starting the terminal…" (bilingual)                                         | —                                              |
| Config unreadable  | The config read failed (network, 5xx)    | Top bar; "Can't reach the server" + Try again (bilingual)                             | —                                              |
| Board              | Config read, shop betting on             | Sports, days, competitions and their matches with prices                              | `terminal-kiosk-board-{am,en}-{phone,desktop}` |
| Picks              | Prices tapped                            | The picks in the slip; the rows tinted; prices pressed                                | `terminal-kiosk-picks-{am,en}-…`               |
| Board loading      | A sport or day not read yet              | Skeleton rows                                                                         | `terminal-kiosk-loading-{am,en}-…`             |
| Empty day          | The board is `[]`                        | "No matches right now · Try another sport or day" + Show football (back to the start) | `terminal-kiosk-empty-{am,en}-…`               |
| Board unreadable   | The board read failed, nothing shown yet | "Couldn't load matches" + Try again                                                   | `terminal-kiosk-error-{am,en}-…`               |
| A later poll fails | After a board was shown                  | Nothing changes; the next poll tries again                                            | —                                              |
| Not activated      | A kiosk read answered 401                | The status is read again, and says what the terminal is now (lapsed, switched off)    | —                                              |

## Signed calls (D3)

The browser holds the device key but never calls the API, so it signs **the API call that the route
handler will make**: its method, its contract path and the exact body bytes. One table,
`features/terminal/lib/calls.ts`, pairs each route with its API call, and both sides read it.

| Route                         | API call                             | Signed | CSRF header | Body                          |
| ----------------------------- | ------------------------------------ | ------ | ----------- | ----------------------------- |
| `POST /api/terminal/activate` | `POST /v1/retail/terminals/activate` | no     | yes         | code + public key (4 KiB cap) |
| `GET /api/terminal/status`    | `GET /v1/retail/terminal`            | yes    | —           | —                             |
| `POST /api/terminal/token`    | `POST /v1/retail/terminal/token`     | yes    | yes         | none read or sent             |

The kiosk's reads (F8ca) are not signed. Each route composes several API calls (the board is
`/v1/events` in two languages and `/v1/dictionary`), read **anonymously**, as the contract allows. The
contract lists `terminalAuth` on the catalogue and config operations but declares no device headers on
them, so a signed read isn't in the contract. C19 §9.1 expects the shop's retail prices on a terminal's
read, so the kiosk may show online prices. The POS re-prices at sale and shows any change (C19 §14).
[Contract request 015](../contract-requests/015-terminal-reads-and-slip-codes.md) asks what a terminal's
read is. The routes still answer only an activated terminal of this tenant (its cookie, unexpired), and
refuse anything else with 401 before calling anything. They forward no `Prefer`.

| Route                                | API calls (anonymous)                           | Query, checked before anything goes upstream                                                                                                       |
| ------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/terminal/config`           | `GET /v1/config/public` (cached 60 s)           | —                                                                                                                                                  |
| `GET /api/terminal/catalogue/sports` | `GET /v1/sports`, `GET /v1/dictionary` (am, en) | —                                                                                                                                                  |
| `GET /api/terminal/catalogue/board`  | `GET /v1/events` (am, en), `GET /v1/dictionary` | `sport` `s_…` (required), `date` `YYYY-MM-DD`, `filter` `top\|upcoming\|today`; nothing else, each once (400 `VALIDATION_FAILED` naming the field) |

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
- **Language.** Calls go out with the kiosk's language (`Accept-Language`): Amharic until a config says
  otherwise, then the customer's choice or the tenant's default. The terminal's own screens show both
  languages.

## What the terminal loads

Its own root layout and providers: a query client (`createQueryClient`) and nothing of the player's. No
preferences store, session, realtime channel or player layout. It shares pure code: its own schemas
(`lib/api/terminal-schemas.ts`) and the catalogue's (`lib/api/catalogue-schemas.ts`), never
`lib/api/schemas.ts` (F8b review Q3); `lib/i18n` and its text hooks, through the kiosk's
`LocaleProvider`; `lib/api/errors.ts`; the Crockford forgiveness from `features/tickets/lib/number.ts`;
and, for the kiosk (F8ca), the slip store, the board filters, `OddsButtonView` and `oddsAriaLabel`. Its
data goes through its own client (`terminalRequest`, `terminalRead`), never the player's `apiClient`, which
reads the player's store. `scripts/check-host-split.mjs` checks the split on every
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
