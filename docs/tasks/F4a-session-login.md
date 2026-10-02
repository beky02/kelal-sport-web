---
id: F4a
title: Session cookie, login with the new-device OTP, logout, /api/me, trusted proxy
status: done
depends_on: [F0]
contract_tags: [Auth, Me]
touches_money: false
touches_ui: true
---

# F4a — Session and login

Split from [F4](F4-auth-session.md) (2026-10-02): the session half. Registration, password reset and
Fayda KYC are [F4b](F4b-register-kyc.md).

## Goal

A player logs in (answering the new-device OTP when the API asks for one) and out through route handlers
that hold the API tokens in an encrypted httpOnly cookie; every screen reads who is signed in from
`/api/me`; a lapsed access token is refreshed once and the call retried; the tenant and the player's
address come from forwarded headers only behind a trusted proxy. The browser never sees a token.

## Read first

As F4: `docs/backend/engineering-decisions.md` D3 (tokens, audiences); `c18-client-apps.md` §4.4;
`c01-identity-auth.md` §6 (login, refresh) and §8 (refresh rotation with reuse detection);
`contracts/openapi.yaml`: `/v1/auth/login` (200 vs 202 `OtpRequired`), `/v1/auth/refresh`,
`/v1/auth/logout`, `/v1/me`; `docs/contract-requests/004-client-ip-forwarding.md`;
`docs/tasks/F3b/verification.md` SEC3, SEC4, Q6; existing `src/features/auth/*`,
`src/stores/session.store.ts`, `src/lib/server/*`, `src/lib/api/client.ts`.

## Scope

In:

- `lib/server/session.ts`: an AES-256-GCM-sealed httpOnly, Secure, SameSite=Lax cookie
  (`SESSION_SECRET`) holding the access and refresh tokens, the access expiry and the tenant; a
  first-party httpOnly device-id cookie that becomes `LoginRequest.device.fingerprint`; refresh on 401
  `AUTH_TOKEN_EXPIRED` once, deduplicated across parallel requests; logout clears the cookie.
- `upstream()` sends `Authorization` from the session; `respond()` carries `Set-Cookie` headers and the UI
  language to the loaders.
- Route handlers: `POST /api/auth/login` (200 → cookie + player summary; 202 → `otp_required` with the
  challenge, no cookie), `POST /api/auth/logout` (204, cookie cleared whatever the API said),
  `GET /api/me` (a guest is `{ player: null }`, not an error).
- `lib/server/csrf.ts`: on every POST route handler, bookings included — `Sec-Fetch-Site` and `Origin`
  must be this site when present, the request must carry `X-Requested-With: KelalSport` and a JSON body;
  `apiClient` sends the header on every POST (C18 §4.4's "CSRF header").
- `useSession()` on `/api/me` replaces `stores/session.store.ts` (`isGuest`, `kycVerified`) everywhere;
  `useLogout()`; the profile's identity rows (name, phone, date of birth, KYC badge) come from `/api/me`.
- `src/proxy.ts` redirects a visitor without a session cookie from `/my-bets`, `/wallet` and
  `/transactions` to `/login?next=…` (same-origin path only); the route handlers re-check (C18 §4.4).
- `TRUSTED_PROXY_HOPS`: `X-Forwarded-Host`, `-Proto` and `-For` are honoured only when it is set
  (AC-7); `clientIpFromHeaders()` reads the player's address for contract request 004 (read now, sent
  once 004 lands).
- Error codes: `AUTH_INVALID_CREDENTIALS`, `AUTH_LOCKED` (with the Problem's `detail`),
  `AUTH_OTP_INVALID` and `AUTH_OTP_EXPIRED` on the login OTP, `RATE_LIMITED`, `AUTH_TOKEN_EXPIRED`
  (refresh; when the refresh is refused the player is a guest again and the session-expired dialog says
  so).
- Login dialog wired end to end: phone + password → OTP step on 202 → done; `/login?next=/wallet`
  returns to the wallet.

Out: registration, OTP send, password reset and KYC (F4b); `PATCH /v1/me` and `/v1/me/sessions` (F7);
Telegram login (P1); sending `X-Client-IP` / `X-Client-Device` (contract request 004 is `proposed`).

## Acceptance criteria

- [x] **AC-3** No token in `localStorage`, `document.cookie` or any response body to the browser
      (Playwright check after login).
- [x] **AC-4** A cross-origin POST to a mutating route handler is rejected (route test).
- [x] **AC-5** An expired access token is refreshed once and the request retried (loader test).
- [x] **AC-6** Login answering 202 (new device) asks for the OTP.
- [x] **AC-7** The tenant comes from `X-Forwarded-Host` only behind an explicit trusted-proxy setting,
      else from `Host` (`tenantFromHeaders`, route test): with a session cookie, a forged forwarded host
      must not send tenant A's session with tenant B's `X-Tenant-Id` (F3b security review). The same
      setting lets the route handlers read the player's IP for contract request 004.
- [x] **AC-8** `GET /api/me` says who is signed in from the API, never from a browser flag; logging out
      clears the cookie and every screen returns to the guest state (route and component tests).

## Verification

- `pnpm verify` passes
- `curl -i -X POST -H 'Content-Type: application/json' -H 'Origin: https://evil.example' -d '{}' localhost:3000/api/auth/login`
  → 403 `PERMISSION_DENIED`
- `curl -i localhost:3000/api/me` → 200 `{"player":null}` with no cookie
- In the dialog with `Prefer: code=202` on `/api/auth/login` (next dev only): the OTP step appears

## Notes

- 2026-10-02: split from F4 (plan: `docs/tasks/F4/plan.md`). AC numbers keep F4's; AC-8 added here.
- 2026-10-02: verified — `pnpm verify` green, five reviews, one fix round (`docs/tasks/F4/verification.md`).
  A second confirmation round for the two MAJORs was skipped at the user's request; both fixes carry tests.
