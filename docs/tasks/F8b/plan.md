# F8b — plan

Plan gate: approved 2026-10-06 (mode: interactive) — plan approved as written; the signing-string
encodings are built on the assumptions in decision 3, and contract request 014 asks the backend to pin
them (with named examples, and 004 extended to terminal routes).

The contract was synced on the branch first (`635dd85`, the backend's revised `feed.settlement_received`
event schema: descriptions and the dead-heat pattern), with the user's agreement. Nothing in it touches
F8b.

## Understanding

A shop PC opens `terminal.{brand}` in Chrome kiosk mode. The first time, a technician types the terminal's
one-time activation code; the browser makes a P-256 key pair whose private half can never be exported,
keeps it in IndexedDB, and sends the public half with the code. The API answers with a 90-day terminal
token, which our route handler seals into an httpOnly cookie on the terminal host — the browser never sees
it (D3). From then on every terminal call is signed in the browser with the device key (over the API
operation's method, path, timestamp and body hash) and forwarded by an `/api/terminal/*` route handler,
which adds the token, the device id and the tenant. On boot and every 5 minutes the terminal reads its
status; when fewer than 7 days of token remain it rotates the token in the background without touching
the screen. A revoked terminal says so and offers nothing else; a closed shop's terminal says so and comes
back by itself when the shop opens. Browsing and slips are F8c.

## Spec conflicts and decisions

| #   | Question                                                                                                                                                                                                                          | Decision and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Where the terminal token lives. C18 §4.4 says "device-bound token in IndexedDB"; D3 says the browser never calls the API and tokens are held server-side; FD1 and the task put it in an httpOnly cookie set by `/api/terminal/*`. | **httpOnly cookie** (D3 outranks C18). Only the **device key** is in IndexedDB (C19 §4.1, which D3 doesn't contradict: a non-extractable key is not a readable secret).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2   | Who signs, when the browser holds the key but never calls the API.                                                                                                                                                                | **The browser signs the upstream request; the route handler forwards it.** The signature covers `METHOD\nPATH\nTIMESTAMP\nSHA256(body)` of the API call, so the browser signs the contract path (`/v1/retail/terminal`), not its own route. One table, `features/terminal/lib/calls.ts`, pairs each route with its API method and path; the browser signs from it and the route handlers call from it, so the two can't drift. The handler adds `X-Device-Id` itself from the sealed cookie (the signature doesn't cover it), so a browser can't name another device. Bodies of signed POSTs are forwarded byte for byte (none in F8b; F8c's slip codes need it). |
| 3   | The signing string's encodings are not in the contract: SHA-256 as hex or base64, the signature as DER or WebCrypto's raw `r‖s`, whether PATH includes a query string, what an empty body hashes to.                              | **Contract question, asked at the plan gate.** Until it is answered: SHA-256 of the exact body bytes as lowercase hex (`e3b0c442…` for none), the signature as standard padded base64 of WebCrypto's 64-byte IEEE P1363 `r‖s`, PATH as sent including any query string, TIMESTAMP as the header's decimal string. All of it in one function (`canonicalRequest`) so a different answer is a one-line change. Prism only checks the headers are present, so nothing here can prove interoperability with the backend: a gap until B9.                                                                                                                              |
| 4   | "Revoked or disabled". The contract's terminal status is `active` or `revoked`; it has no "disabled". C19 §14: "Shop closed or suspended: terminals show 'closed'"; `GET /v1/retail/terminal` carries `shop.open_now`.            | **Revoked** = status `revoked`, or `401 AUTH_INVALID_CREDENTIALS` (C19 §4.1: revoking "logs it out on its next request"). **Disabled** = the shop is not open (`open_now: false`, C19 §14): the "closed" screen, which keeps polling and returns to the terminal when the shop opens. `403 RETAIL_DEVICE_NOT_ALLOWED` (device not allowed, e.g. outside the shop's IP range) is shown like revoked, with its own message. The tenant's `features.retail` switch is F8c's (it loads the config for the retail rule set).                                                                                                                                           |
| 5   | "A revoked terminal offers nothing else" vs. re-provisioning the PC.                                                                                                                                                              | The revoked screen has **no controls at all** and **the cookie is kept**, so a reload asks the API again and shows revoked again — the state is the server's (AGENTS.md: safety state is server state). Re-provisioning a revoked PC means clearing the browser's site data for the terminal host and activating with a new code: an installation step, written in the design page.                                                                                                                                                                                                                                                                               |
| 6   | `401 AUTH_TOKEN_EXPIRED` (a terminal switched off for more than 90 days, past rotation).                                                                                                                                          | Not revoked: the handler clears the cookie and the terminal shows activation with "this terminal's activation has lapsed". The cookie's `Max-Age` is the token's life plus 30 days, so a lapsed token is recognised (and said) without calling the API.                                                                                                                                                                                                                                                                                                                                                                                                           |
| 7   | "5 attempts" on activation.                                                                                                                                                                                                       | **The server counts** (5 per IP per hour, the contract). The screen says "too many tries" on `429 RATE_LIMITED` with the minutes from `Retry-After`; it does not keep its own counter (it can't know the IP's count, and a client counter would disagree with the server). The code's format (8 Crockford characters, the contract's pattern) is checked before sending, so a typo doesn't spend an attempt.                                                                                                                                                                                                                                                      |
| 8   | Activation through our server: the API sees the web server's address, so "5 per IP per hour" would be one bucket for every shop, and C19 §12's optional shop IP range can't work.                                                 | Same problem as contract request 004 (Bookings, Auth). **`Retail - terminal` is refused in `API_REAL_TAGS` until 004 lands**, like Bookings and Auth (`lib/server/config.ts`), and 004's open question is extended to terminal routes in the new request (decision 3). Against Prism nothing changes.                                                                                                                                                                                                                                                                                                                                                             |
| 9   | Clock skew. A shop PC with a wrong clock would have every request refused (±30 s), and might be shown as revoked.                                                                                                                 | The route handler checks `X-Device-Timestamp` against its own clock before calling the API (±20 s). Outside it: `400 VALIDATION_FAILED` with `errors: [{ field: "X-Device-Timestamp", code: "CLOCK_SKEW", current: "<server ms>" }]` — the Problem shape, carrying its fix — and the terminal client corrects its offset and re-signs once. Malformed or missing signature headers: 400 without calling the API.                                                                                                                                                                                                                                                  |
| 10  | Rotation: the API only rotates a signed request, and only the browser can sign; the browser can't read the token's expiry.                                                                                                        | The status answer carries `rotateDue` (fewer than 7 days left, computed by the handler from the sealed expiry). The status hook then posts a signed `/api/terminal/token` in the background, once per status read; the handler seals the new token. The query keeps its data throughout (no loading state), and a failed rotation is tried again at the next 5-minute read.                                                                                                                                                                                                                                                                                       |
| 11  | Language. The kiosk has no language choice until F8c (F8a's placeholder shows both).                                                                                                                                              | **Every F8b screen shows Amharic then English**, as the placeholder does (FD2: Amharic is `demo`'s default), and requests go out with `Accept-Language: am`. So each state has two screenshots (phone, desktop) instead of four. F8c brings the kiosk's language and replaces this.                                                                                                                                                                                                                                                                                                                                                                               |
| 12  | What an activated terminal shows before F8c.                                                                                                                                                                                      | The terminal shell (shop name and terminal label in a top bar) with "This terminal is ready; betting will open on this screen". F8c puts the sportsbook there.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 13  | The terminal cookie.                                                                                                                                                                                                              | Sealed like the session (AES-256-GCM from `SESSION_SECRET`) but with its own HKDF info (`kelal.terminal.v1`), so neither cookie opens as the other. The sealing moves into `lib/server/seal.ts`, shared by both, with the session's bytes unchanged (its tests guard it). `__Host-kelal.terminal` in production, HttpOnly, `SameSite=Strict` (nothing links into a kiosk), `Path=/`, no Domain; tenant and terminal id sealed in.                                                                                                                                                                                                                                 |
| 14  | F8a's note: `/api/terminal/*` handlers must check the host themselves.                                                                                                                                                            | Every terminal handler answers 404 on a non-terminal host before reading anything (`terminalOnly`), so a request that skips the proxy can't reach them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 15  | Prism's `410` example is `BOOKING_EXPIRED`, not `RETAIL_ACTIVATION_EXPIRED`; status has no `revoked` or closed example.                                                                                                           | The UI switches on `code` only (`RETAIL_ACTIVATION_EXPIRED`); the screens for expired, revoked-by-status and closed are made in Playwright by answering our own route with the contract's shapes (as `bookAsGuest` does). Named examples are part of the contract question (decision 3).                                                                                                                                                                                                                                                                                                                                                                          |

## Design

```
browser (terminal.{brand})                          route handler                                API
DeviceKey (IndexedDB, P-256, non-extractable)
terminalRequest(call) ─ sign(call.method, call.api, ts, sha256(body)) ─▶ /api/terminal/<route>
                                                   terminalOnly · assertSameOrigin (POST)
                                                   deviceHeaders(request) → 400 if missing/skewed
                                                   readTerminalSession(cookie) ─ Bearer, X-Device-Id ─▶ call.method call.api
                                                   ◀─ mapper → domain JSON (+ sealed cookie) ◀─────────
```

**Contract operations** (tag `Retail - terminal`): `activateTerminal` (`POST /v1/retail/terminals/activate`,
no auth, 200/404/410/429), `getTerminalSelf` (`GET /v1/retail/terminal`, 200/401), `rotateTerminalToken`
(`POST /v1/retail/terminal/token`, 200/401). Also handled: `403 RETAIL_DEVICE_NOT_ALLOWED` (the
`Forbidden` response lists it).

**Server (`src/lib/server/`)**

- `seal.ts` — `sealJson(info, value)` / `openJson(info, schema, value)`: the session's AES-GCM sealing,
  parameterised by purpose. `session.ts` uses it unchanged in behaviour.
- `terminal-session.ts` — `TerminalSession { tenant, terminalId, token, expiresAt }`; `readTerminalSession`,
  `terminalCookie`, `clearTerminalCookie`, `TERMINAL_COOKIE`.
- `terminal.ts` — `terminalOnly(request)`; `deviceHeaders(request, now)` (validate the two signed headers,
  ±20 s); `activateTerminal(ctx, form)` → `{ result, session }`; `loadTerminalStatus(ctx, session, device)`
  → `TerminalStatus` (401 invalid → revoked; 401 expired → inactive/expired, cookie cleared);
  `rotateTerminalToken(ctx, session, device)` → new `TerminalSession`.
- `config.ts` — `ApiTag` gains `"Retail - terminal"`; refused in `API_REAL_TAGS` until 004.

**Mapper (`src/lib/api/mappers/terminal.ts`)** — pure: `toActivateRequest(form, appVersion)`,
`toTerminalActivation(api)`, `toTerminalInfo(api)` (status 200 → domain; `label`, `idleResetSeconds`,
`codeDisplaySeconds` as `null` when absent).

**Route handlers (`src/app/api/terminal/`)**

| Route                         | Checks before upstream                                                                      | Answers                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `POST /api/terminal/activate` | terminal host; same origin + CSRF header + JSON; body ≤ 4 KiB, Zod (code pattern, SPKI b64) | `{ terminal }`, sets the sealed cookie; 404/410/429 (`Retry-After`) pass through |
| `GET /api/terminal/status`    | terminal host; no cookie → `inactive` (no call); device headers valid and within ±20 s      | `TerminalStatus`; clears the cookie on `AUTH_TOKEN_EXPIRED`                      |
| `POST /api/terminal/token`    | terminal host; same origin + CSRF header (no body); cookie; device headers                  | `{ rotated: true }`, sets the new cookie; 401 → `revoked`/cleared as status does |

All through `respond()` (`no-store`, Problems passed through); Prism's `Prefer` only under `next dev`
(`mockPreference`) and only to the mock.

**Domain (`src/features/terminal/types.ts`)**

```ts
interface TerminalInfo {
  id;
  label: string | null;
  shop: { code; name; openNow: boolean };
  idleResetSeconds: number | null;
  codeDisplaySeconds: number | null;
}
type TerminalStatus =
  | { state: "inactive"; reason: "new" | "expired" }
  | { state: "active"; terminal: TerminalInfo; rotateDue: boolean }
  | { state: "revoked"; reason: "revoked" | "device_not_allowed" };
interface ActivationForm {
  activationCode: string;
  devicePublicKey: string;
}
```

Zod schemas for the route answers (`terminalStatusSchema`, `terminalActivationSchema`, `activationFormSchema`)
in `lib/api/schemas.ts` with `satisfies z.ZodType<…>`.

**Browser (`src/features/terminal/`)**

- `lib/calls.ts` — `TERMINAL_CALLS = { activate, status, token }`: route, method, API path, signed?
- `lib/signing.ts` — `canonicalRequest`, `sha256Hex`, `signRequest(privateKey, call, body, now)` →
  `{ "X-Device-Timestamp", "X-Device-Signature" }`.
- `lib/device-key.ts` — `createDeviceKey()` (P-256, `extractable: false`), `publicKeySpki(pair)`;
  `deviceKeyStore` (IndexedDB `kelal-terminal`/`keys`/`device`, structured-clone of the `CryptoKeyPair`).
- `api/client.ts` — `terminalRequest(call, schema, { body })`: signs when the call is signed, CSRF header
  on POST, `Accept-Language: am`, Problems → `ApiError` (shared `problemError` moved into
  `lib/api/errors.ts`, used by `apiClient` too); on `CLOCK_SKEW` corrects the clock offset and re-signs
  once.
- `api/terminal.ts` — `getTerminalStatus()` (no key in IndexedDB → `inactive` without a request),
  `activateTerminal(code)` (new key → stored → activate), `rotateTerminalToken()`.
- `hooks/use-terminal.ts` — `useTerminalStatus()`: `terminalKeys.status()`, `staleTime` and
  `refetchInterval` 5 min (in background too), no polling once revoked; rotates when `rotateDue`, once per
  status read, then invalidates status. `useActivateTerminal()`: mutation, invalidates status on success.
- `components/` — `TerminalApp` (switch on state), `TerminalShell` (top bar: shop, label),
  `ActivationScreen`, `TerminalReady`, `ClosedScreen`, `BlockedScreen` (revoked / device not allowed, no
  controls), `TerminalOffline` (no status yet and the server can't be reached: Try again),
  `Bilingual` (a key in Amharic then English).
- `app/(terminal)/providers.tsx` — the terminal's own `QueryClientProvider` (`createQueryClient`).

**Query keys** — `terminalKeys.all = ["terminal"]`, `terminalKeys.status()`. Nothing personal: there is no
player on a terminal, so no session watcher applies.

**Errors handled and what the screen offers**

| Where      | Code                                   | Screen                                                                    |
| ---------- | -------------------------------------- | ------------------------------------------------------------------------- |
| activation | (local) not 8 Crockford characters     | "The code has 8 letters and digits" — nothing sent                        |
| activation | `NOT_FOUND` 404                        | "No terminal has this code. Check it and try again." Field kept.          |
| activation | `RETAIL_ACTIVATION_EXPIRED` 410        | "This code has expired. Ask for a new one."                               |
| activation | `RATE_LIMITED` 429                     | "Too many tries. Try again in {minutes} min." (`Retry-After`, rounded up) |
| activation | network / 5xx / other                  | "Couldn't reach the server. Try again."                                   |
| status     | `revoked` / `AUTH_INVALID_CREDENTIALS` | Blocked: "This terminal has been switched off" — no controls              |
| status     | `RETAIL_DEVICE_NOT_ALLOWED` 403        | Blocked: "This PC isn't allowed to run the terminal" — no controls        |
| status     | `AUTH_TOKEN_EXPIRED` 401               | Activation, with "This terminal's activation has lapsed"                  |
| status     | `open_now: false`                      | Closed: "This shop is closed"; keeps checking                             |
| status     | network / 5xx, no data yet             | Offline: "Can't reach the server" + Try again (and the 5-min read)        |
| status     | network / 5xx, data already shown      | Nothing changes on screen; the next read tries again                      |
| any signed | `VALIDATION_FAILED` / `CLOCK_SKEW`     | Silent: clock offset corrected, request re-signed once                    |

**i18n** — `terminal.*` (both catalogues): `activate.{title,body,label,submit,busy,lapsed,format,wrongCode,expired,tooMany,tooManyLater,unreachable,unsupported}`,
`ready.{title,body}`, `closed.{title,body}`, `blocked.{revokedTitle,revokedBody,deviceTitle,deviceBody}`,
`offline.{title,body,retry}`, `shell.label`, `loading`. The placeholder keys go. Composed Amharic
(`{minutes}`, `{label}`) in `TRANSLATION-NOTES.md`.

**Feature flags** — none: the terminal is Release 1.

## Files

| File                                                                                                 | Why                                                                    |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/server/seal.ts` (new)                                                                       | AES-GCM sealing by purpose, shared by the session and terminal cookies |
| `src/lib/server/session.ts`                                                                          | Uses `seal.ts`; behaviour unchanged                                    |
| `src/lib/server/terminal-session.ts` (new)                                                           | The sealed terminal cookie                                             |
| `src/lib/server/terminal.ts` (new)                                                                   | Host guard, device headers, activate / status / rotate loaders         |
| `src/lib/server/config.ts`                                                                           | `Retail - terminal` tag; refused in `API_REAL_TAGS` until 004          |
| `src/lib/api/mappers/terminal.ts` (new)                                                              | Contract ↔ domain                                                      |
| `src/lib/api/schemas.ts`                                                                             | Route-answer and form schemas                                          |
| `src/lib/api/errors.ts`, `src/lib/api/client.ts`                                                     | `problemError` shared by both clients                                  |
| `src/lib/query/keys.ts`                                                                              | `terminalKeys`                                                         |
| `src/app/api/terminal/{activate,status,token}/route.ts` (new)                                        | The three route handlers                                               |
| `src/features/terminal/**` (new)                                                                     | types, calls, signing, device key, client, api, hooks, components      |
| `src/app/(terminal)/layout.tsx`, `providers.tsx` (new), `terminal/page.tsx`                          | Providers; the page renders `TerminalApp`                              |
| `src/lib/i18n/messages/{en,am}.json`, `TRANSLATION-NOTES.md`                                         | Strings                                                                |
| `tests/unit/terminal-signing.test.ts` (new)                                                          | AC-2: the key and the signature                                        |
| `tests/unit/terminal-mappers.test.ts` (new)                                                          | Mappers against the contract's examples                                |
| `tests/unit/terminal-route.test.ts` (new)                                                            | AC-2, AC-4, AC-5 at the route handlers                                 |
| `tests/component/TerminalActivation.test.tsx` (new)                                                  | AC-4 on screen                                                         |
| `tests/component/TerminalStatus.test.tsx` (new)                                                      | AC-5 with fake timers; AC-2 skew retry                                 |
| `tests/unit/server-config.test.ts`, `tests/unit/session*.test.ts`                                    | The new refusal; sealing unchanged                                     |
| `tests/e2e/terminal.spec.ts` (new), `tests/e2e/hosts.spec.ts`                                        | Screens; the terminal host now shows activation                        |
| `docs/design/10-terminal.md` (new), `00-overview.md`, `01-screens.md`, `09-security.md`, `README.md` | Design pages                                                           |
| `docs/contract-requests/014-device-signature.md` (new, if approved)                                  | Decision 3                                                             |

## Acceptance criteria → tests

| AC   | Test                                                                                                                                                                                                           | How it proves it                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-2 | `tests/unit/terminal-signing.test.ts` › "makes a device key whose private half can't be exported"                                                                                                              | `privateKey.extractable === false`; `exportKey("pkcs8")` rejects; the SPKI is a P-256 key                                                              |
| AC-2 | › "signs the API's method, path, timestamp and body hash, verifiable with the public key"                                                                                                                      | `crypto.subtle.verify` over `canonicalRequest` for `GET /v1/retail/terminal` and `POST /v1/retail/terminal/token`; a changed path/timestamp/body fails |
| AC-2 | `tests/component/TerminalStatus.test.tsx` › "signs the status read for the API's path, not its own route"                                                                                                      | The `/api/terminal/status` request's headers verify against the stored key's public half over `/v1/retail/terminal`                                    |
| AC-2 | `tests/unit/terminal-route.test.ts` › "forwards the device id, timestamp, signature and token to the API"                                                                                                      | Upstream request has `X-Device-Id` (from the cookie), the browser's timestamp and signature, `Authorization: Bearer`                                   |
| AC-2 | › "refuses a status read without valid device headers, and calls nothing" / "answers a skewed clock with the server's time"                                                                                    | 400s, no upstream call; `CLOCK_SKEW` carries `current`                                                                                                 |
| AC-2 | `TerminalStatus.test.tsx` › "corrects a skewed clock from the server's answer and signs again"                                                                                                                 | Second request's timestamp = server time; screen shows ready                                                                                           |
| AC-2 | `tests/e2e/terminal.spec.ts` › "activates against Prism and signs the status read with a non-extractable key"                                                                                                  | Real Chrome: request headers present; the key read back from IndexedDB is `extractable: false`                                                         |
| AC-4 | `terminal-route.test.ts` › "activates: the token goes into a sealed httpOnly cookie, never the answer"                                                                                                         | Set-Cookie flags; body has no token; upstream got code, public key, app version                                                                        |
| AC-4 | › "passes a wrong code (404), an expired code (410) and too many tries (429, Retry-After) through"                                                                                                             | Status, `code`, `Retry-After`                                                                                                                          |
| AC-4 | › "refuses a malformed code / another site / a player host before calling the API"                                                                                                                             | 422 / 403 / 404, no upstream call                                                                                                                      |
| AC-4 | › "says revoked for a revoked status and for AUTH_INVALID_CREDENTIALS, and keeps the cookie"                                                                                                                   | `{ state: "revoked" }`; no clearing Set-Cookie                                                                                                         |
| AC-4 | `tests/component/TerminalActivation.test.tsx` › "says the code is wrong when the API answers 404" / "…expired…410" / "…too many tries, with the minutes, on 429"                                               | Visible text in both languages                                                                                                                         |
| AC-4 | › "checks the code's format before sending it"                                                                                                                                                                 | No request for `12345`; message shown                                                                                                                  |
| AC-4 | › "shows a revoked terminal with nothing to press"                                                                                                                                                             | No button, link or input in the document                                                                                                               |
| AC-4 | › "activates, then reads the status and shows the shop"                                                                                                                                                        | Key stored, status read, shop name on screen                                                                                                           |
| AC-4 | `pnpm ui`: `terminal-activate`, `-wrong-code`, `-expired`, `-too-many`, `-lapsed`, `terminal-ready`, `terminal-revoked`, `terminal-device-not-allowed`, `terminal-closed`, `terminal-offline` (phone, desktop) | Screens                                                                                                                                                |
| AC-5 | `TerminalStatus.test.tsx` › "reads the status on boot and every 5 minutes"                                                                                                                                     | Fake timers: 1 read at boot, none at 4:59, 2nd at 5:00, 3rd at 10:00                                                                                   |
| AC-5 | › "rotates the token when it is due, once, without touching the screen"                                                                                                                                        | One `POST /api/terminal/token`; the heading element is the same node before and after                                                                  |
| AC-5 | › "tries a failed rotation again at the next read"                                                                                                                                                             | Rotation 500 → retried after 5 min                                                                                                                     |
| AC-5 | › "stops reading once the terminal is revoked"                                                                                                                                                                 | No read after 5 min                                                                                                                                    |
| AC-5 | › "keeps the screen when a read fails after the terminal is up"                                                                                                                                                | Ready screen stays on a 503                                                                                                                            |
| AC-5 | `terminal-route.test.ts` › "says rotation is due when fewer than 7 days remain" / "rotates: the new token replaces the cookie"                                                                                 | `rotateDue` at 6 d 23 h, not at 7 d; new sealed token, signed upstream call                                                                            |

## Risks

- **Security.** The token never reaches JavaScript (sealed httpOnly cookie, `__Host-`, Strict); the key
  can't be exported; every handler checks the host, CSRF on POSTs, validates the body and the device
  headers before anything goes upstream, `no-store`; `Prefer` only in `next dev` to the mock;
  `Retail - terminal` can't be pointed at the real API until 004. Covered by route tests and the
  security reviewer.
- **Interop.** The signing string's encodings are assumed (decision 3); Prism can't check signatures. One
  function to change; contract request; listed as a gap.
- **Bricking a terminal.** A false "revoked" has no way out on screen: clock skew is corrected before it can
  cause one (decision 9); a lost rotation answer leaves the old token, valid 5 more minutes and then
  refused — noted in the design page as a known limit (re-activate).
- **Accessibility.** Targets ≥ 48 px (terminal), the code field labelled in both languages, errors in an
  `aria-live` region, focus to the field on error.
- **Performance.** The terminal page stays static (no cookie read on the server); one status read per 5
  minutes; the terminal bundle loads nothing of the player's layout (`check-host-split.mjs`).
- **Money.** None moves here (`touches_money: false`).

## Out of scope

Browsing, the slip, slip codes, the idle reset and the kiosk's language (F8c); the tenant's
`features.retail` switch (F8c); the POS (F9, `kelalsport-ops`); verifying signatures in our own server;
a hidden technician reset on the revoked screen.

## Sub-tasks

None. Estimated ~1,600 changed lines, about half of them tests, all one area (the terminal's boot).
