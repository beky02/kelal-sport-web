# F4 — plan

F4 is split (see **Sub-tasks**). This plan covers **F4a — session and login**; F4b (register, reset,
Fayda KYC) gets its own plan when it starts. Plan gate: approved 2026-10-02 (mode: interactive).

## Understanding

Today nobody is really signed in: `stores/session.store.ts` holds an `isGuest` flag that starts `false`
and a `kycVerified` that starts `true`, the login and registration steps collect input and call
`setGuest(false)`, and every account screen trusts those flags. F4a gives the app a real session, held
the way D3 and C18 §4.4 say: the route handlers log in against `/v1/auth/login`, seal the API's access
and refresh tokens into an httpOnly cookie the browser cannot read, add `Authorization` to every call
made for a player, refresh once on `AUTH_TOKEN_EXPIRED`, and answer `/api/me` from `/v1/me`. The
screens stop asking a store whether someone is signed in and ask `/api/me` instead (safety state is
server state). Every mutating route handler gets the same origin check and CSRF header, and the tenant
(and the player's address, for contract request 004) is read from forwarded headers only behind an
explicit trusted-proxy setting, which closes the F3b security review's point about a forged
`X-Forwarded-Host`. The browser never holds a token, in any form, anywhere.

## Spec conflicts and decisions

| #   | Question                                                                                                               | Decision and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | F4 is ~4,000 changed lines (session, CSRF, proxy, login, logout, `/api/me`, register, OTP, reset, KYC, 13 screens).    | Split into F4a (session, login, logout, `/api/me`, CSRF, trusted proxy — AC-3..AC-8) and F4b (register, reset, KYC — AC-1, AC-2, AC-9, AC-10), as F3 was. F4a first: everything in F4b needs the session.                                                                                                                                                                                                                                                                                                                                                                 |
| 2   | C18 §4.4: "Mutations carry a CSRF token header." The task scope says "origin check / CSRF header".                     | Origin check (`Sec-Fetch-Site` same-origin or none; `Origin`, when present, equal to the request's own origin) **plus** a fixed custom header `X-Requested-With: KelalSport` and a JSON body on every POST route handler. The custom header forces a CORS preflight that no other origin can pass (this app sends no CORS headers), which is what a CSRF token header buys; a per-session token would need a cookie the browser can read or an extra round trip, and adds nothing over SameSite=Lax + Origin + custom header. Recorded as a deviation from C18's wording. |
| 3   | How long does the cookie live? The contract's `Tokens` only gives the access `expires_in`.                             | `Max-Age` = 30 days, C01 §9 `auth.refresh_ttl_days`. The API's refresh token is what actually ends a session (expiry, rotation reuse, revocation on self-exclusion or password reset); the browser keeps no inactivity timer. The access expiry is stored in the cookie so a lapsed token is refreshed before the call, not after a 401.                                                                                                                                                                                                                                  |
| 4   | `Secure` on `http://localhost`.                                                                                        | `Secure` always in production (TLS ends at the edge, so the request may be plain HTTP inside); in other builds only when the request itself is HTTPS. So `pnpm ui` on `http://localhost:3000` works and a phone on the LAN can test. `HttpOnly`, `SameSite=Lax`, `Path=/` always.                                                                                                                                                                                                                                                                                         |
| 5   | `SESSION_SECRET` (D6 lists it for the web).                                                                            | Required (≥ 32 chars) when `NODE_ENV=production`, else the server refuses to start. Development and test fall back to a built-in, clearly named development key so `next dev` does not log everyone out on every restart. The production check also refuses the development key. Documented in `.env.example`.                                                                                                                                                                                                                                                            |
| 6   | `LoginRequest.device.fingerprint` is required; the web has no device SDK.                                              | A random id minted by the route handler into a first-party httpOnly cookie (`kelal.device`, 1 year) — exactly what contract request 004 describes for `X-Client-Device`. `platform: "web"`, `app_version` from `package.json`. The browser never sees or sets it.                                                                                                                                                                                                                                                                                                         |
| 7   | Parallel requests after the access token expires would each refresh; C01 §8 revokes the whole family on refresh reuse. | `withSession()` deduplicates: one in-flight refresh per refresh token (keyed by its hash), and a 60 s memory of "old refresh token → new tokens" so requests still carrying the previous cookie reuse the rotation instead of replaying it. In-process only; with 2+ replicas (C18 §7) the backend needs a short reuse grace window — noted as a follow-up for the backend, not a contract change.                                                                                                                                                                        |
| 8   | What does `GET /api/me` answer a guest?                                                                                | `200 { player: null }`. A guest is a state the UI renders, not an error to retry; 401 stays for routes that require a player. A cookie whose refresh is refused is cleared in the same response.                                                                                                                                                                                                                                                                                                                                                                          |
| 9   | AC-7: which forwarded headers, and how many hops?                                                                      | `TRUSTED_PROXY_HOPS` (integer, default 0). At 0 only `Host` counts. At n ≥ 1 the first `X-Forwarded-Host` and `X-Forwarded-Proto` values are trusted and the player's IP is the n-th `X-Forwarded-For` entry from the right — the one the trusted edge appended, never the first (004). `publicOrigin()` follows the same rule. Defence in depth: the sealed session also records its tenant, and a cookie read under another tenant is treated as absent.                                                                                                                |
| 10  | Prism cannot answer 202 on login by default.                                                                           | `Prefer: code=202` through the existing `mockPreference()` (next dev only, fails closed). Prism validates `playerAuth` presence, so `/v1/me` and `/v1/auth/logout` exercise the `Authorization` header for real.                                                                                                                                                                                                                                                                                                                                                          |
| 11  | Prism's Problem titles are English; the UI is bilingual.                                                               | Known codes get our own copy in both catalogues (switching on `code`, as `bookings/lib/errors.ts` does); unknown codes show the API's `title`. `AUTH_LOCKED` appends the Problem's `detail` ("Try again in 15 minutes.") when present. The route handlers forward the UI language as `Accept-Language` so the real API's titles arrive in the right script.                                                                                                                                                                                                               |
| 12  | The profile shows a hardcoded name, phone and a masked Fayda number.                                                   | Name, phone and date of birth come from `/api/me`; the Fayda row goes (not in `Me`). `PATCH /v1/me` stays F7.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 13  | The "session expired" dialog's copy claims "after 30 minutes without activity", which the API does not promise.        | Shown when a player's session is found gone (refresh refused); copy changed to "Your session has ended. Log in again to continue. Your bet slip is saved." (both languages). Not money copy; flagged at the plan gate.                                                                                                                                                                                                                                                                                                                                                    |
| 14  | Which pages does the proxy guard?                                                                                      | `/my-bets/*`, `/wallet`, `/transactions` — the pages with nothing for a guest. `/profile` and `/responsible-gaming` keep their guest views. The proxy only checks that the cookie exists (no decryption) and redirects to `/login?next=<path>`; `next` is honoured only when it is a same-origin path (`/…`, not `//…`), otherwise home.                                                                                                                                                                                                                                  |
| 15  | What do the register steps do in F4a?                                                                                  | They stay as they are visually but stop pretending: the last step closes the dialog instead of flipping a guest flag. F4b wires them.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 16  | Logout when the API refuses (401, 5xx).                                                                                | The cookie is cleared and 204 answered regardless; the UI resets `/api/me` and the account queries. A logout that fails upstream must never leave someone signed in on a shared phone.                                                                                                                                                                                                                                                                                                                                                                                    |

Assumptions: the API's `expires_in` is seconds from the response (`Date` header when present, else
now). Phone numbers are typed as nine digits and sent as `+251…` (the contract's `Phone` pattern); the
login form keeps that.

## Design

### Server

- `lib/server/config.ts` (change): `trustedProxyHops` (`TRUSTED_PROXY_HOPS`, int ≥ 0, default 0),
  `sessionSecret` (`SESSION_SECRET`, rules in decision 5). `requestHost()` uses `X-Forwarded-Host` only
  when hops ≥ 1; new `clientIpFromHeaders(headers): string | null` (n-th from the right of
  `X-Forwarded-For`, validated as IPv4/IPv6, else null); `publicOrigin()` unchanged in behaviour at
  hops ≥ 1, ignores forwarded headers at 0.
- `lib/session-cookie.ts` (new, no `server-only`): `SESSION_COOKIE = "kelal.session"`,
  `DEVICE_COOKIE = "kelal.device"` — shared with the proxy.
- `lib/server/session.ts` (new, `server-only`):
  - `Session = { tenant, access, refresh, expiresAt }`; `seal()` / `open()` with AES-256-GCM
    (`node:crypto`, key = SHA-256 of the secret, 12-byte IV, `v1.<iv>.<ct>.<tag>` base64url); a cookie
    that fails to open, or opens for another tenant, is `null`.
  - `readSession(request, tenant)`, `sessionCookie(session, request)`, `clearSessionCookie(request)`,
    `ensureDevice(request, setCookie)` (reads or mints the device id), `secureFor(request)` (decision 4).
  - `withSession(ctx, session, call)`: proactive refresh when `expiresAt − 30 s` has passed; otherwise
    runs `call(authorization)`; on `401` whose Problem `code` is `AUTH_TOKEN_EXPIRED` refreshes (via
    `POST /v1/auth/refresh`, tag `Auth`) and retries **once**; writes the rotated cookie through
    `ctx.setCookie`; dedupes refreshes (decision 7). A refresh refused with 401 throws
    `SessionGoneError` after pushing the clear-cookie header.
- `lib/server/upstream.ts` (change): `RequestContext.authorization?: string` → `Authorization` header;
  `unwrapEmpty(result)` for 204s (openapi-fetch gives `data: undefined` on 204).
- `lib/server/respond.ts` (change): `load(ctx)` gets `lang` (from `Accept-Language`, `en`/`am`, default
  `en`) and `setCookie(header)`; collected `Set-Cookie` headers go on the response, success or Problem;
  `SessionGoneError` → 401 Problem `AUTH_TOKEN_EXPIRED` (the cookie is already cleared).
- `lib/server/csrf.ts` (new): `assertSameOrigin(request): Response | null` — 403 `PERMISSION_DENIED`
  when `Sec-Fetch-Site` is cross-site/same-site, or `Origin` is present and differs from the request's
  own origin (host per `requestHost`), or `X-Requested-With !== "KelalSport"`; 415 when the body is not
  JSON. `lib/server/body.ts` (new): `readJson(request, maxBytes)` moved from the bookings route.
- `lib/server/auth.ts` (new): `login(ctx, body, device)` → `{ status: "ok", player, session }` or
  `{ status: "otp_required", challenge }`; `logout(ctx, session)` (swallows upstream errors, logs
  nothing sensitive); `loadMe(ctx, session)` → `Player`.
- `lib/api/mappers/auth.ts` (new): `toPlayer(Me)`, `toPlayerSummary(PlayerSummary)`,
  `toOtpRequired(OtpRequired)`, `toLoginRequest(form, device)`, `toSessionTokens(Tokens, now)`.
- Route handlers (new): `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`,
  `app/api/me/route.ts`. `app/api/bookings/route.ts` uses `csrf.ts` and `body.ts`.
- `src/proxy.ts` (new): `config.matcher = ["/my-bets/:path*", "/wallet", "/transactions"]`; no cookie →
  `NextResponse.redirect(/login?next=…)`.

### Browser

- `lib/api/client.ts` (change): every POST carries `X-Requested-With: KelalSport`; every request carries
  `Accept-Language` from the UI store.
- `lib/api/schemas.ts` (change): `playerSchema`, `sessionViewSchema` (`{ player: Player | null }`),
  `loginResultSchema`, each `satisfies z.ZodType<…>`.
- `lib/query/keys.ts`: `sessionKeys.all = ["session"]`, `sessionKeys.me()`.
- `lib/query/client.ts`: a `QueryCache` `onError` that invalidates `sessionKeys.me()` on an `ApiError`
  401, so a dead session is noticed by whichever account query hits it first.
- `features/auth/api/auth.ts` (new): `getMe`, `login`, `logout`. `features/auth/hooks/use-session.ts`
  (new): `useSession()` → `{ isLoading, isGuest, player, kycStatus, kycVerified, canWithdraw }`
  (`staleTime` 60 s, refetch on focus); `useLogout()` (sets `me` to guest, invalidates wallet, bets,
  transactions, pushes home). `useSessionGone()` shows the `session` overlay when a player becomes a
  guest without logging out.
- `features/auth/lib/flow.ts` (new): the dialog's state as a pure reducer — login → `loginOtp` on 202,
  back, errors; F4b extends it. `features/auth/lib/errors.ts` (new): `authErrorMessage(error)` →
  `{ key, values?, fix? }`. `features/auth/lib/phone.ts` (new): `toE164`, `maskPhone` (`+251 9•• ••• 482`).
- Components: `AuthDialog` (uses the reducer and the mutations; `next` from `AuthRoute`), `LoginStep`
  (submits values, shows the error notice, pending state), `OtpStep` (generalised: `onSubmit(code)`,
  `error`, `pending`, `body` copy, resend after `resendAfter` → F4b), new `AuthNotice` (role=alert,
  optional fix button). `AuthRoute` reads `?next=`.
- Consumers switched from `useSessionStore` to `useSession()`: `AppHeader` (neutral while loading),
  `MobileTabBar`, `MainNav`, `AsidePanel`, `ProfileView` (identity rows from `player`; log out via
  `useLogout`), `WalletView` (`canWithdraw ?? kycVerified`), `use-bet-slip.ts`, `SystemOverlays` (keep
  browsing = logout). `stores/session.store.ts` deleted.

### Error codes → what the UI offers

| Code                             | Where           | UI                                                                                  |
| -------------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| `AUTH_INVALID_CREDENTIALS` (401) | login           | Message under the form; Forgot password? is already in the label row                |
| `AUTH_LOCKED` (423)              | login           | Message + the Problem's `detail`; button disabled until the fields change           |
| `AUTH_OTP_INVALID` (422)         | login OTP       | Message, code cleared, focus back on the code input                                 |
| `AUTH_OTP_EXPIRED` (422)         | login OTP       | Message + "Log in again" (a new 202 brings a new challenge)                         |
| `RATE_LIMITED` (429)             | login           | Message, retry                                                                      |
| `AUTH_TOKEN_EXPIRED` (401)       | any player call | Refreshed once and retried; if the refresh is refused: guest + session-ended dialog |
| other / network                  | login           | API `title` or "Something went wrong…" + retry                                      |

### i18n keys added (en + am; composed Amharic listed in `TRANSLATION-NOTES.md`)

`auth.errors.AUTH_INVALID_CREDENTIALS`, `auth.errors.AUTH_LOCKED`, `auth.errors.AUTH_OTP_INVALID`,
`auth.errors.AUTH_OTP_EXPIRED`, `auth.errors.RATE_LIMITED`, `auth.errors.failed`, `auth.newDeviceBody`
("New device. We sent a code to {phone} to confirm it's you."), `auth.logInAgain`, `auth.tryAgain`,
`header.accountLoading` (sr-only). Changed: `system.sessionBody` (decision 13).

### Feature flags

None new. Release 2 flags untouched.

## Files

Create:

- `src/lib/session-cookie.ts` — cookie names and the CSRF header, shared by the session module, the proxy and `apiClient`.
- `src/lib/server/session.ts` — sealing, cookies, device id, `withSession` refresh with dedupe.
- `src/lib/server/csrf.ts` — same-origin + `X-Requested-With` + JSON check for every POST.
- `src/lib/server/body.ts` — capped JSON body reader (moved from the bookings route).
- `src/lib/server/auth.ts` — login, logout, loadMe loaders.
- `src/lib/api/mappers/auth.ts` — contract ↔ domain for `Me`, `PlayerSummary`, `OtpRequired`, `Tokens`, `LoginRequest`.
- `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/me/route.ts`.
- `src/proxy.ts` — redirect logged-out visitors from account pages.
- `src/features/auth/api/auth.ts`, `src/features/auth/hooks/use-session.ts`, `src/features/auth/lib/flow.ts`, `src/features/auth/lib/errors.ts`, `src/features/auth/lib/phone.ts`, `src/features/auth/components/AuthNotice.tsx`.
- `tests/unit/session.test.ts`, `tests/unit/auth-route.test.ts`, `tests/unit/auth-mappers.test.ts`, `tests/unit/auth-flow.test.ts`, `tests/unit/auth-phone.test.ts`, `tests/unit/proxy.test.ts`, `tests/component/AuthDialog.test.tsx`, `tests/component/Session.test.tsx`, `tests/e2e/auth.spec.ts`.
- `docs/tasks/F4a-session-login.md`, `docs/tasks/F4b-register-kyc.md`, `docs/tasks/F4/plan.md`, `docs/tasks/F4/verification.md`.

Change:

- `src/lib/server/config.ts` — trusted proxy hops, client IP, session secret.
- `src/lib/server/respond.ts` — `lang`, `setCookie`, `SessionGoneError`.
- `src/lib/server/upstream.ts` — `authorization`, `unwrapEmpty`.
- `src/app/api/bookings/route.ts` — shared CSRF and body helpers.
- `src/lib/api/client.ts` — CSRF header on POST, `Accept-Language`.
- `src/lib/api/schemas.ts`, `src/lib/query/keys.ts`, `src/lib/query/client.ts`.
- `src/features/auth/components/AuthDialog.tsx`, `AuthRoute.tsx`, `steps/LoginStep.tsx`, `steps/OtpStep.tsx`, `src/features/auth/stores/auth.store.ts`, `src/features/auth/types.ts`.
- `src/components/layout/AppHeader.tsx`, `MobileTabBar.tsx`, `MainNav.tsx`, `AsidePanel.tsx`; `src/features/profile/components/ProfileView.tsx`; `src/features/wallet/components/WalletView.tsx`; `src/features/bet-slip/hooks/use-bet-slip.ts`; `src/features/system/components/SystemOverlays.tsx`.
- `src/config/routes.ts` — `loginNext(path)`.
- `src/lib/i18n/messages/en.json`, `am.json`, `TRANSLATION-NOTES.md`.
- `tests/component/render.tsx` (session seeding option), `tests/component/BetSlip.test.tsx`, `tests/component/BookingFlow.test.tsx`, `tests/unit/booking-route.test.ts` (CSRF header), `tests/unit/server-config.test.ts`, `tests/e2e/screens.spec.ts` (log in before account screens; new login screens).
- `.env.example` — `SESSION_SECRET`, `TRUSTED_PROXY_HOPS`.
- `docs/tasks/F4-auth-session.md`, `docs/tasks/README.md` (split, statuses).

Delete:

- `src/stores/session.store.ts`.

## Acceptance criteria → tests

| AC      | Test                                                                                                                                                                                                                                                                               | How it proves it                                                                                                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-3    | `tests/e2e/auth.spec.ts` › "logs in through the dialog and leaves no token in the browser"                                                                                                                                                                                         | Real dev server + Prism: after login `document.cookie` and `localStorage` hold no `eyJ`/`rt_`; `/api/auth/login` and `/api/me` bodies hold no token; `context.cookies()` shows `kelal.session` httpOnly, SameSite Lax |
| AC-3    | `auth-route.test.ts` › "POST /api/auth/login answers with the player and a sealed cookie, never the tokens"                                                                                                                                                                        | Body has no `access_token`/`refresh_token`; `Set-Cookie` value does not contain the raw tokens; opening it with the key gives them back                                                                               |
| AC-4    | `auth-route.test.ts` › "refuses a POST from another origin" (Origin / Sec-Fetch-Site cross-site), "refuses a POST without X-Requested-With", "refuses a form body"; `booking-route.test.ts` updated the same way                                                                   | 403 / 415, nothing sent upstream                                                                                                                                                                                      |
| AC-5    | `session.test.ts` › "refreshes an expired access token once, retries once and rotates the cookie"; "makes one refresh for parallel calls on the same session"; "refreshes before the call when the token has lapsed"; "gives up and clears the cookie when the refresh is refused" | Stubbed `fetch`: exact upstream request sequence (`/v1/me` 401 → `/v1/auth/refresh` 200 → `/v1/me` 200), `Set-Cookie` rotated, one refresh for N parallel calls                                                       |
| AC-5    | `auth-route.test.ts` › "GET /api/me refreshes on AUTH_TOKEN_EXPIRED and answers the profile"                                                                                                                                                                                       | End to end through the route handler                                                                                                                                                                                  |
| AC-6    | `auth-route.test.ts` › "login answering 202 returns otp_required with the challenge and sets no cookie"; "login with challenge_id and otp sends them on"                                                                                                                           | Contract's 202 example → `{ status: "otp_required", challengeId }`, no `Set-Cookie`                                                                                                                                   |
| AC-6    | `AuthDialog.test.tsx` › "asks for the SMS code when login answers 202 and logs in with it"; "says the code is wrong on AUTH_OTP_INVALID and keeps the code step"                                                                                                                   | Visible OTP step, second POST carries `challengeId` + `otp`                                                                                                                                                           |
| AC-6    | `pnpm ui` › `login-otp` (Prefer `code=202` on `/api/auth/login`), en/am, 375/1440                                                                                                                                                                                                  | The screen                                                                                                                                                                                                            |
| AC-7    | `server-config.test.ts` › "ignores X-Forwarded-Host without a trusted proxy"; "takes the host and the player's IP from the trusted hop"; "never takes the first X-Forwarded-For entry"                                                                                             | `tenantFromHeaders`, `clientIpFromHeaders`, `publicOrigin` at hops 0 and 1                                                                                                                                            |
| AC-7    | `auth-route.test.ts` › "a forged X-Forwarded-Host does not change the tenant the session is sent to"                                                                                                                                                                               | Cookie for `demo` + `X-Forwarded-Host: kelalsport.et` → upstream `X-Tenant-Id: demo`; with hops=1 and a cookie sealed for `demo` under tenant `kelal` → guest, no `Authorization` sent                                |
| AC-8    | `auth-route.test.ts` › "GET /api/me without a cookie says guest"; "with a session answers the contract's profile"; "with a dead session clears the cookie and says guest"; "POST /api/auth/logout revokes upstream and clears the cookie, even when the API refuses"               | Route handler + stubbed upstream                                                                                                                                                                                      |
| AC-8    | `Session.test.tsx` › "the header shows the balance for a player and Log in for a guest, from /api/me"; "logging out returns the header to the guest state"; "the slip asks a guest to log in"                                                                                      | Components read `useSession()`, no store                                                                                                                                                                              |
| AC-8    | `proxy.test.ts` › "redirects a visitor without a session cookie from /wallet to /login?next=%2Fwallet"; "lets a cookie through"; "leaves the home page alone"                                                                                                                      | `proxy(new NextRequest(…))`                                                                                                                                                                                           |
| AC-8    | `auth-mappers.test.ts` › "maps the contract's /v1/me example"; "maps the login 200 and 202 examples"                                                                                                                                                                               | `example()` / `responseExample()` fixtures                                                                                                                                                                            |
| AC-8    | `auth-flow.test.ts` › the reducer: login → otp on 202 → done; back from otp returns to login with the fields kept; errors land on the right step                                                                                                                                   | Pure reducer                                                                                                                                                                                                          |
| open    | `auth-route.test.ts` › "login's next path must be same-origin" (`/wallet` kept, `https://evil.example`, `//evil.example` → home)                                                                                                                                                   | No open redirect                                                                                                                                                                                                      |
| Screens | `pnpm ui` › `login`, `login-otp`, `login-wrong-password` (401), `login-locked` (423), `profile-guest`, and the existing `my-bets`, `transactions`, `wallet`, `profile`, `home-slip-booked` now behind a real login                                                                 | en/am × 375/1440; look at the PNGs                                                                                                                                                                                    |

## Risks

- **Money**: none moves. The balance chip and wallet are still the mock repository (F6); they are only
  requested for a player now (`useWallet(!isGuest)` unchanged).
- **Security**: tokens only in an AES-GCM-sealed httpOnly cookie (test: body and cookie value hold no
  raw token); CSRF: origin + custom header + JSON on every POST (tests); open redirect: `next` must be a
  same-origin path (test); proxy bypass (CVE-2025-29927): the proxy only redirects, handlers re-check
  (test: `/api/me` without a cookie is a guest); tenant confusion: forwarded headers off by default,
  session sealed with its tenant (tests); refresh reuse: deduped (test); nothing sensitive logged (the
  logout loader logs no body; review item); `Prefer` fails closed (existing test).
- **Accessibility**: `AuthNotice` is `role="alert"`; after an error focus goes to the first invalid
  field or the code input; the OTP input stays one real `<input>`; touch targets ≥ 44 px; the header
  renders a neutral placeholder while `/api/me` loads so nothing jumps.
- **Performance**: one `/api/me` per page load, cached 60 s and refetched on focus; account queries stay
  disabled for guests; the proxy runs only on three paths.
- **Both languages**: every new key in `en.json` and `am.json`; `tests/unit/i18n.test.ts`.

## Out of scope

- Registration, OTP send, password reset, Fayda KYC, document upload — F4b.
- `PATCH /v1/me`, `/v1/me/sessions` (devices list, reality check) — F7.
- Sending `X-Client-IP` / `X-Client-Device` — contract request 004 is `proposed`; F4a only reads the IP.
- F3b SEC3 (an explicit mock/real flag for `API_BASE_URL`) — follow-up.
- Cross-replica refresh coordination — follow-up for the backend (reuse grace window).
- Telegram login (P1).

## Sub-tasks

- [F4a — session and login](../F4a-session-login.md): this plan.
- [F4b — register, reset, Fayda KYC](../F4b-register-kyc.md): AC-1, AC-2, AC-9, AC-10; depends on F4a.
