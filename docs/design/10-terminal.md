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

An active terminal of an open shop is **the player's sportsbook without what needs a player** (the user's
direction, 2026-10-06). It has the same home board, league page, match page, sidebar, search and slip, at
the same sizes and widths, in the kiosk's own frame. There is no Log in, Register, My bets, Wallet,
Responsible gaming or Favourites, and no player watchers (session, reality check, deposits). F8cb adds the
stake and the figures; F8cc adds Get code.

```
┌ K KelalSport  Adama Kebele 04 · PC 3 ──────────── [search] [አማ|EN] ┐
│ Top competitions │ Football  EAT  [Top][Upcoming][Today]  │ Bet slip 2 │
│ Sports           │ [Today 6 Oct][Wed 7 Oct] …            │ pick 1.52 ×│
│ Countries A–Z    │ England · Premier League   1 X 2 │ 1X …│ pick 1.62 ×│
│                  │ Liverpool / Brighton  1.52 4.60 … +58›│  Clear all │
└──────────────────┴───────────────────────────────────────┴────────────┘
```

| Address on a terminal host              | Page                          | The player's view                                                      |
| --------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `/` (shows `/terminal`)                 | Home: sports, days, the board | `SportsbookView`                                                       |
| `/terminal/competition/[competitionId]` | A league's board              | `CompetitionView`, from the sidebar's Top competitions and from search |
| `/terminal/event/[eventId]`             | A match's whole book          | `EventDetailView`, from a row's "+N" and from search; Back goes home   |

**How one set of pages serves both sites.**

- **The site-specific parts come from `SportsbookChrome`** (`features/sportsbook/chrome.tsx`), a static
  context of hooks and components, never state:
  - `Shell`, the frame around a page;
  - realtime topics;
  - data saver;
  - the price lock (offline, a break);
  - what a pick does after;
  - favourites (or none);
  - the leagues drawer;
  - open countries;
  - links.

  The player provides `PLAYER_CHROME` (`(player)/sportsbook-chrome.tsx`), from its stores, as every
  component read them before. The kiosk provides `KIOSK_CHROME`
  (`features/terminal/components/kiosk/chrome.ts`): `KioskShell`, links under `/terminal`, no realtime
  (Release 2), no data saver, no favourites, no drawer, prices polled every 30 s, a lock only while
  offline. Each hook subscribes as narrowly as before. Without a provider, `useSportsbookChrome` throws
  rather than run a page with no price lock.

- **The data goes to the terminal's routes.** `apiClient` re-roots `catalogue/` paths, and only those, to
  `/api/terminal/` when the page's `<html data-api>` is exactly that (the terminal's root layout says so);
  any other value is ignored, so no markup can send a call elsewhere. So the player's fetchers, hooks and keys run unchanged on
  the kiosk against the terminal's mirror routes (below). The host split and the proxy are unchanged.
- **The language** is the customer's tap, else the tenant's `default_language` (Amharic for `demo`,
  FD2). It is switched with the player's `EN | አማ` control, in that order, among the tenant's `languages` (none with
  one).
  - The choice lives in `features/terminal/stores/kiosk.store.ts`. It is never persisted, so a reload and
    F8cc's idle reset both return to the default. `kioskLanguage(chosen, config)` is the one rule, and
    nothing of the config is copied into the store.
  - A choice the tenant no longer offers gives way to its default.
  - `KioskLocale` sets `<html lang>`, from which the text hooks (through `LocaleProvider`) and
    `apiClient`'s `Accept-Language` both read.
  - F8b's own calls (status, rotation) ask in Amharic, since their answers are states.
- **Before kick-off only** (D8). The terminal's routes drop in-play and ended matches from the board and
  search, and an in-play match's book reads as `null` ("This match isn't available"). Prism lists none;
  only the simulated board does.
- **Prices poll every 30 s on the kiosk** (D5), whatever the build's realtime setting
  (`KIOSK_CHROME.pricePollMs`). The kiosk has no realtime channel, so a match that kicks off leaves the
  board at the next read. The player polls only while realtime is off.
- **Prices lock while the PC is offline** (`navigator.onLine`, the kiosk's `useOnline`): what is on
  screen may already be wrong, as on the player's site. There is no break lock; a kiosk has no player.
- **One bar.** `KioskBar` (brand and shop) frames the config's loading and unreadable states; with search
  and the language switch it is `KioskHeader`. Nothing jumps when the board arrives.
- **The footer's notices, without its links.** The licence line, 21+ and the helpline sit at the foot of
  every kiosk page, as on the player's (SRS RG-05: responsible-gambling information and a helpline on every
  page; `FooterBar` and `FooterNotices` from `AppFooter`). Terms, Privacy, Responsible gaming, Help and
  Telegram are left out: they are the player's pages, which a terminal host doesn't serve.
- **No leagues drawer.** Terminals are PC screens (C19 §11), and the sidebar is there from `lg`. Below
  `lg` the kiosk has the sport tabs and the board, and below `xl` no search, as the player's.
- **A 401 on any read** makes the terminal's query client read its status again
  (`createTerminalQueryClient`), which then says what the terminal is (lapsed, switched off).
- **The slip** is the player's slip store and parts (`BetSlipHeader`, `EmptySlip`, `BetSelectionRow`), with
  two picks of one match marked. The odds are those at the tap. From `xl` up it is the right-hand column;
  narrower, a bar (once there is a pick) opens it in the player's `Sheet`.

| State                         | When                                       | Shows                                                                                 | Screenshot                                     |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Config loading                | Before `/api/terminal/config` answers      | The terminal's bar; "Starting the terminal…" (bilingual)                              | `terminal-kiosk-config-loading`                |
| Config unreadable             | The config read failed (network, 5xx)      | The terminal's bar; "Can't reach the server" + Try again (bilingual)                  | `terminal-kiosk-config-offline`                |
| Home board                    | Config read, shop betting on               | The player's home, without what needs a player                                        | `terminal-kiosk-board-{am,en}-{phone,desktop}` |
| Picks                         | Prices tapped                              | The picks in the slip; prices pressed; rows tinted                                    | `terminal-kiosk-picks-…`                       |
| A league                      | `/terminal/competition/[id]`               | That league's board                                                                   | `terminal-kiosk-league-…`                      |
| A match                       | `/terminal/event/[id]`                     | Every market of the match; Back                                                       | `terminal-kiosk-match-…`                       |
| Search                        | Something typed (`xl` up, as the player's) | Leagues and matches found, each opening on the kiosk                                  | `terminal-kiosk-search-{am,en}-desktop`        |
| Board loading / empty / error | The player's board states                  | Skeleton; "No matches right now" + Show football; "Couldn't load matches" + Try again | `terminal-kiosk-{loading,empty,error}-…`       |
| Sports unreadable             | The sports read failed                     | No tabs; read again every 30 s (`useSports`, both sites)                              | — (component test)                             |
| A match in play               | The terminal's route answers `null`        | The player's "match not found"                                                        | — (component test)                             |

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
refuse anything else with 401 before calling anything. They forward no `Prefer`. The board takes `competition` too (a league's page).

| Route                                                         | API calls (anonymous)                                             | Query, checked before anything goes upstream                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/terminal/config`                                    | `GET /v1/config/public` (cached 60 s)                             | —                                                                                                                                                                                                                                                                           |
| `GET /api/terminal/catalogue/sports`                          | `GET /v1/sports`, `GET /v1/dictionary` (am, en)                   | —                                                                                                                                                                                                                                                                           |
| `GET /api/terminal/catalogue/board`                           | `GET /v1/events` (am, en), `GET /v1/dictionary`                   | `sport` `s_` + URL-safe characters (required), `date` a real `YYYY-MM-DD`, `filter` `top\|upcoming\|today`, `competition` an opaque id; nothing else, each once (400 `VALIDATION_FAILED` naming the field, or `query` for an odd key). Answers before-kick-off matches only |
| `GET /api/terminal/catalogue/competitions/top`, `…/countries` | `GET /v1/sports`, `GET /v1/dictionary` (am, en)                   | —                                                                                                                                                                                                                                                                           |
| `GET /api/terminal/catalogue/events/[id]`                     | `GET /v1/events/{id}` (am, en), `GET /v1/dictionary`              | `id` opaque, URL-safe, up to 64, not dots alone; no query. `null` for a match in play                                                                                                                                                                                       |
| `GET /api/terminal/catalogue/search`                          | `GET /v1/search` (am, en), `GET /v1/sports`, `GET /v1/dictionary` | `q` trimmed, 2 to 50 (the contract's), once; nothing else. Under 2 asks nothing. Before-kick-off matches only                                                                                                                                                               |

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

The terminal has its own root layout and providers: a query client (`createTerminalQueryClient`), and
nothing of the player's (no preferences store, session, realtime channel or player layout).

The kiosk (F8ca) shares the player's sportsbook pages and components, which reach the player's store, its
session and its realtime only through `SportsbookChrome`. The terminal provides its own, so none of that
loads.

The terminal also shares:

- its own schemas (`lib/api/terminal-schemas.ts`) and the catalogue's (`lib/api/catalogue-schemas.ts`), never
  `lib/api/schemas.ts` (F8b review Q3);
- `lib/i18n` and its text hooks, through the kiosk's `LocaleProvider`;
- `apiClient`, whose `catalogue/` calls go to `/api/terminal/` by `<html data-api>` (that value only);
- `lib/api/errors.ts`, and the Crockford forgiveness from `features/tickets/lib/number.ts`.

The terminal's own calls go through `terminalRequest` and `terminalRead`. `scripts/check-host-split.mjs`
checks the split on every `pnpm verify`. The page is static. What the terminal is depends on this browser's key and cookie, so it
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
