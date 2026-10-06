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
| 6   | `401 AUTH_TOKEN_EXPIRED` (a terminal switched off for more than 90 days, past rotation).                                                                                                                                          | Not revoked: the terminal shows activation with "this terminal's activation has lapsed". _(Changed in review, S1: the cookie is kept rather than cleared, so the reason survives the next 5-minute read and a reload; the next activation replaces it.)_ The cookie's `Max-Age` is the token's life plus 30 days, so a lapsed token is recognised (and said) without calling the API.                                                                                                                                                                                                                                                                             |
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
                                                   deviceSignature(request) → 400 if missing/skewed
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
- `terminal.ts` — `terminalOnly(request)`; `deviceSignature(request, now)` (validate the two signed headers,
  ±20 s); `activateTerminal(ctx, form)` → `{ result, session }`; `loadTerminalStatus(ctx, session, device)`
  → `TerminalStatus` (401 invalid → blocked/revoked; 401 expired → inactive/expired, cookie kept — S1;
  403 `RETAIL_DEVICE_NOT_ALLOWED` → blocked); `rotateTerminalToken(ctx, session, device)` → new
  `TerminalSession`.
- `config.ts` — `ApiTag` gains `"Retail - terminal"`; refused in `API_REAL_TAGS` until 004.

**Mapper (`src/lib/api/mappers/terminal.ts`)** — pure: `toActivateRequest(form, appVersion)`,
`toTerminalActivation(api)`, `toTerminalInfo(api)` (status 200 → domain; `label`, `idleResetSeconds`,
`codeDisplaySeconds` as `null` when absent).

**Route handlers (`src/app/api/terminal/`)**

| Route                         | Checks before upstream                                                                                                                                | Answers                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `POST /api/terminal/activate` | terminal host; same origin + CSRF header + JSON; body ≤ 4 KiB, Zod (code pattern, SPKI b64)                                                           | `TerminalActivation`, sets the sealed cookie; 404/410/429 (`Retry-After`) pass through                              |
| `GET /api/terminal/status`    | terminal host; no cookie → `inactive` (no call); lapsed → `inactive`/expired (no call; cookie kept, review S1); device headers valid and within ±20 s | `TerminalStatus`; the cookie is never cleared (review S1)                                                           |
| `POST /api/terminal/token`    | terminal host; same origin + CSRF header (no body); cookie (401 without); device headers                                                              | `{ rotated: true }`, sets the new cookie; a refusal passes through, cookie untouched (the next status read decides) |

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
  | { state: "blocked"; reason: "revoked" | "device_not_allowed" };
interface ActivationForm {
  activationCode: string;
  devicePublicKey: string;
}
```

Zod schemas for the route answers (`terminalStatusSchema`, `terminalActivationSchema`, `activationFormSchema`)
with `satisfies z.ZodType<…>`, in their own `lib/api/terminal-schemas.ts` (review Q3: `schemas.ts` would put
every player schema in the kiosk's bundle).

**Browser (`src/features/terminal/`)**

- `lib/calls.ts` — `TERMINAL_CALLS = { activate, status, token }`: route, method, API path, signed?
- `lib/signing.ts` — `canonicalRequest`, `sha256Hex`, `signRequest(privateKey, call, body, now)` →
  `{ "X-Device-Timestamp", "X-Device-Signature" }`.
- `lib/code.ts` — `normaliseActivationCode(raw)`: Crockford's forgiveness (shared `compactCrockford`, moved
  out of `features/tickets/lib/number.ts`), then the contract's pattern.
- `lib/device-key.ts` — `createDeviceKey()` (P-256, `extractable: false`), `publicKeyBase64(pair)`;
  `deviceKeyStore` (IndexedDB `kelal-terminal`/`keys`/`device`, structured-clone of the `CryptoKeyPair`).
- `api/client.ts` — `terminalRequest(call, schema, { body, key })`: signs when the call is signed, CSRF header
  on POST, `Accept-Language: am`, Problems → `ApiError` (shared `problemError` moved into
  `lib/api/errors.ts`, used by `apiClient` too); on `CLOCK_SKEW` corrects the clock offset and re-signs
  once.
- `api/terminal.ts` — `getTerminalStatus()` (no key in IndexedDB → `inactive` without a request),
  `activateTerminal(code)` (new key → stored → activate), `rotateTerminalToken()`.
- `hooks/use-terminal.ts` — `useTerminalStatus()`: `terminalKeys.status()`, `staleTime` and
  `refetchInterval` 5 min (in background too), no polling once blocked, no abort signal (so a remount
  doesn't cancel and repeat the boot read); rotates when `rotateDue`, once per status read — remembered in
  the mutation cache (`["terminal","rotate"]`), so remounts and strict mode don't rotate twice — then
  invalidates status. `useActivateTerminal()`: mutation, invalidates status on success.
- `components/` — `TerminalApp` (switch on state), `ActivationScreen`, and in `TerminalScreens.tsx`:
  `TerminalShell` (top bar: shop, label), `TerminalLoading`, `TerminalReady`, `TerminalClosed`,
  `TerminalBlocked` (revoked / device not allowed, no controls), `TerminalOffline` (no status yet and the
  server can't be reached: Try again); `Bilingual` (a key in Amharic then English).
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
`offline.{title,body,retry}`, `loading`. The placeholder keys go. Composed Amharic (all of it, `{minutes}`
included) in `TRANSLATION-NOTES.md`.

**Feature flags** — none: the terminal is Release 1.

## Files

| File                                                                                                 | Why                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/seal.ts` (new)                                                                       | AES-GCM sealing by purpose, shared by the session and terminal cookies                                                                 |
| `src/lib/server/session.ts`                                                                          | Uses `seal.ts`; behaviour unchanged                                                                                                    |
| `src/lib/server/terminal-session.ts` (new)                                                           | The sealed terminal cookie                                                                                                             |
| `src/lib/server/terminal.ts` (new)                                                                   | Host guard, device headers, activate / status / rotate loaders                                                                         |
| `src/lib/server/config.ts`                                                                           | `Retail - terminal` tag; refused in `API_REAL_TAGS` until 004                                                                          |
| `src/lib/api/mappers/terminal.ts` (new)                                                              | Contract ↔ domain                                                                                                                      |
| `src/lib/api/terminal-schemas.ts` (new)                                                              | The terminal's route-answer and form schemas, apart from `schemas.ts` so the kiosk carries none of the player's (review Q3)            |
| `src/lib/api/errors.ts`, `src/lib/api/client.ts`                                                     | `problemError` shared by both clients                                                                                                  |
| `src/lib/query/keys.ts`                                                                              | `terminalKeys`                                                                                                                         |
| `src/app/api/terminal/{activate,status,token}/route.ts` (new)                                        | The three route handlers                                                                                                               |
| `src/features/terminal/**` (new)                                                                     | types, calls, code, signing, device key, client, api, hooks, components                                                                |
| `src/features/tickets/lib/number.ts`                                                                 | `compactCrockford` exported for the activation code (behaviour unchanged)                                                              |
| `src/app/(terminal)/layout.tsx`, `providers.tsx` (new), `terminal/page.tsx`                          | Providers; the page renders `TerminalApp`                                                                                              |
| `src/lib/i18n/messages/{en,am}.json`, `TRANSLATION-NOTES.md`                                         | Strings                                                                                                                                |
| `tests/unit/terminal-signing.test.ts` (new)                                                          | AC-2: the key and the signature                                                                                                        |
| `tests/unit/terminal-mappers.test.ts` (new)                                                          | Mappers against the contract's examples                                                                                                |
| `tests/unit/terminal-route.test.ts` (new)                                                            | AC-2, AC-4, AC-5 at the route handlers                                                                                                 |
| `tests/component/TerminalActivation.test.tsx` (new)                                                  | AC-4 on screen                                                                                                                         |
| `tests/component/TerminalStatus.test.tsx` (new)                                                      | AC-5 with fake timers; AC-2 skew retry                                                                                                 |
| `tests/unit/server-config.test.ts`, `tests/unit/session.test.ts`                                     | The new refusal; a cookie sealed before the move still opens                                                                           |
| `tests/e2e/terminal.spec.ts` (new), `tests/e2e/hosts.spec.ts`                                        | Screens; the terminal host now shows activation                                                                                        |
| `scripts/check-host-split.mjs`, `tests/unit/host-split-build.test.ts`                                | Added in verification: both sites now share library chunks; a layout's chunks are those that define its modules (F8a left this to F8b) |
| `docs/design/10-terminal.md` (new), `00-overview.md`, `01-screens.md`, `09-security.md`, `README.md` | Design pages                                                                                                                           |
| `docs/contract-requests/014-device-signature.md` (new), `README.md`                                  | Decision 3 (approved at the plan gate)                                                                                                 |

## Acceptance criteria → tests

| AC   | Test                                                                                                                                                                                                                                                                                                                                                       | How it proves it                                                                                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-2 | `tests/unit/terminal-signing.test.ts` › "makes a device key whose private half can't be exported"                                                                                                                                                                                                                                                          | `privateKey.extractable === false`; `exportKey("pkcs8")` and `("jwk")` reject; the SPKI is a 91-byte P-256 key                                                                   |
| AC-2 | › "signs the API's method, path, timestamp and body hash, verifiable with the public key"                                                                                                                                                                                                                                                                  | `crypto.subtle.verify` over `canonicalRequest` for `GET /v1/retail/terminal` and `POST /v1/retail/terminal/token`; the route's path, another time, method or body fail           |
| AC-2 | › "covers the exact body bytes it was given" / "hashes the body as lowercase hex SHA-256, and no body as zero bytes" / "builds the string the contract names…"                                                                                                                                                                                             | The signed string, pinned                                                                                                                                                        |
| AC-2 | `tests/component/TerminalStatus.test.tsx` › "signs the status read for the API's path, not its own route"                                                                                                                                                                                                                                                  | The `/api/terminal/status` request's headers verify against the stored key over `/v1/retail/terminal`; no `X-Device-Id` or `Authorization` from the browser                      |
| AC-2 | › "corrects a skewed clock from the server's answer and signs again, once"                                                                                                                                                                                                                                                                                 | Second read's timestamp is the server's; later reads stay corrected                                                                                                              |
| AC-2 | `tests/unit/terminal-route.test.ts` › "forwards the device id, timestamp, signature and token to the API (AC-2)" / "names the device from the sealed cookie, never from the browser (AC-2)"                                                                                                                                                                | Upstream `X-Device-Id` (cookie), timestamp, signature, `Authorization: Bearer`, `X-Tenant-Id`                                                                                    |
| AC-2 | › "refuses a status read without valid device headers, and calls nothing (AC-2)" / "answers a skewed clock with the server's time instead of calling the API (AC-2)"                                                                                                                                                                                       | 400s, no upstream call; `CLOCK_SKEW` carries `current`                                                                                                                           |
| AC-2 | `tests/component/TerminalActivation.test.tsx` › "activates with the code and a new device key, then reads the status and shows the shop"                                                                                                                                                                                                                   | The status after activation is signed by the key just stored                                                                                                                     |
| AC-2 | `tests/e2e/terminal.spec.ts` › "ready: activates against Prism and signs the status read with a non-extractable key (AC-2)"                                                                                                                                                                                                                                | Real Chrome and Prism: headers present and shaped; the IndexedDB key is `extractable: false` and `exportKey` fails; the cookie is httpOnly + Strict and not in `document.cookie` |
| AC-4 | `terminal-route.test.ts` › "activates: the token goes into a sealed httpOnly cookie, never the answer"                                                                                                                                                                                                                                                     | Set-Cookie flags and Max-Age; body has no token; upstream got code, public key, app version                                                                                      |
| AC-4 | › "passes a wrong code (404), an expired code (410) and too many tries (429, Retry-After) through, and stores nothing"                                                                                                                                                                                                                                     | Status, `code`, `Retry-After`, no cookie                                                                                                                                         |
| AC-4 | › "refuses a malformed code, another site and a player host before calling the API"                                                                                                                                                                                                                                                                        | 422 / 403 / 404, no upstream call                                                                                                                                                |
| AC-4 | › "says blocked for a revoked status and for AUTH_INVALID_CREDENTIALS, and keeps the cookie (AC-4)" / "says the PC isn't allowed when the API answers RETAIL_DEVICE_NOT_ALLOWED (AC-4)" / "clears the cookie and asks for a new code when the token has expired"                                                                                           | Blocked and lapsed states, cookie kept or cleared                                                                                                                                |
| AC-4 | `TerminalActivation.test.tsx` › "says the code is wrong when the API answers 404, and keeps it to correct" / "says the code has expired when the API answers 410 RETAIL_ACTIVATION_EXPIRED" / "says too many tries, with the minutes to wait, on 429" / "…try later, on a 429 without Retry-After"                                                         | Alert text in both languages; focus back on the field                                                                                                                            |
| AC-4 | › "checks the code's format before sending it"                                                                                                                                                                                                                                                                                                             | No request and no key for `12345`, 9 characters, a `U`                                                                                                                           |
| AC-4 | › "says it is revoked and offers nothing to press" / "says it is device_not_allowed and offers nothing to press"                                                                                                                                                                                                                                           | No button, link, input or tabindex in the document                                                                                                                               |
| AC-4 | › "activates with the code and a new device key, then reads the status and shows the shop" / "asks for a new code when the terminal's activation lapsed" / "says the browser can't keep the key, and sends nothing…" / "says the server couldn't be reached…"                                                                                              | The rest of the activation screen's states                                                                                                                                       |
| AC-4 | `terminal.spec.ts` › "revoked: a revoked terminal says so and offers nothing, after a reload too (AC-4)"                                                                                                                                                                                                                                                   | Prism's 401 through the real route, twice                                                                                                                                        |
| AC-4 | `pnpm ui`: `terminal-loading`, `-activate`, `-activate-format`, `-activate-wrong-code`, `-activate-expired`, `-activate-too-many`, `-lapsed`, `-ready`, `-revoked`, `-device-not-allowed`, `-closed`, `-offline` (phone, desktop)                                                                                                                          | Screens                                                                                                                                                                          |
| AC-5 | `TerminalStatus.test.tsx` › "reads the status on boot and every 5 minutes"                                                                                                                                                                                                                                                                                 | Fake timers: reads at 0, 5:00, 10:00 and none at 4:59.999                                                                                                                        |
| AC-5 | › "rotates the token when it is due, once, without touching the screen"                                                                                                                                                                                                                                                                                    | One signed `POST /api/terminal/token` with the CSRF header; the heading is the same node before, during and after; no loading state; status read again                           |
| AC-5 | › "rotates once when a screen mounts with a due status already read, however often it mounts"                                                                                                                                                                                                                                                              | Two strict-mode mounts over a cached due status → one rotation                                                                                                                   |
| AC-5 | › "tries a failed rotation again at the next read"                                                                                                                                                                                                                                                                                                         | Rotation 500 → retried at 5:00, not before                                                                                                                                       |
| AC-5 | › "stops reading once the terminal is revoked" / "keeps the screen when a read fails after the terminal is up" / "shows the closed shop until it opens, then the terminal, by itself" / "says the server can't be reached when the first read fails, and tries again on a tap" / "asks nothing and shows activation when this browser holds no device key" | The status hook's other states                                                                                                                                                   |
| AC-5 | `terminal-route.test.ts` › "says rotation is due when fewer than 7 days of the token remain, and not before (AC-5)" / "rotates: the new token replaces the cookie, from a signed call made with the old one"                                                                                                                                               | `rotateDue` at 7 d − 1 min, not at 7 d; new sealed token from a signed call with no body                                                                                         |

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
