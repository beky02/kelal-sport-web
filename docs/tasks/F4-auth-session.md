---
id: F4
title: Auth through route handlers and an httpOnly session cookie; KYC
status: done
depends_on: [F0]
contract_tags: [Auth, Me, KYC]
touches_money: false
touches_ui: true
---

# F4 — Auth and session

Split (2026-10-02) into [F4a — session and login](F4a-session-login.md) (AC-3 to AC-8) and
[F4b — register, reset, Fayda KYC](F4b-register-kyc.md) (AC-1, AC-2, AC-9, AC-10), as F3 was: one
reviewable PR each. F4 is done when both are. Plan for F4a: `F4/plan.md`.

## Goal

Register, log in (with the new-device OTP), reset the password, log out and verify identity with Fayda,
all through route handlers that hold the API tokens server-side in an httpOnly cookie. The browser never
sees a token.

## Read first

- `docs/backend/engineering-decisions.md` D3 (tokens, audiences)
- `docs/backend/design/components/c18-client-apps.md` §4.4; `c01-identity-auth.md`; `c02-kyc.md`
- `contracts/openapi.yaml`: `/v1/auth/otp`, `/register`, `/login` (200 vs 202 OTP required), `/refresh`,
  `/logout`, `/password/reset`, `/v1/me`, `/v1/me/sessions`, `/v1/kyc/fayda/otp`, `/v1/kyc/fayda/verify`
  (`verified`, `needs_info`, `pending`), `/v1/kyc/documents`
- Existing: `src/features/auth/*`, `src/stores/session.store.ts`

## Scope

In:

- Session module (`lib/server/session.ts`): encrypted httpOnly, Secure, SameSite=Lax cookie
  (`SESSION_SECRET`) holding access and refresh tokens; refresh on 401 `AUTH_TOKEN_EXPIRED`; logout clears it.
- Route handlers for each auth step; origin check / CSRF header on every POST (C18 §4.4).
- `upstream()` adds `Authorization` from the session; loaders that need a player require one.
- Replace `session.store` guest/KYC flags with a `/api/me` query (safety state is server state).
- Proxy (middleware) only redirects logged-out users away from account pages; handlers re-check.
- Error codes: `AUTH_INVALID_CREDENTIALS`, `AUTH_LOCKED`, `AUTH_OTP_INVALID`, `AUTH_OTP_EXPIRED`,
  `AUTH_OTP_RATE_LIMITED`, `REG_PHONE_TAKEN`, `REG_UNDERAGE`, `KYC_PROVIDER_UNAVAILABLE`.

Out: Telegram login (P1).

## Acceptance criteria

- [x] **AC-1** Full register → OTP → password → KYC flow against Prism.
- [x] **AC-2** `REG_PHONE_TAKEN` and `AUTH_OTP_INVALID` (via `Prefer`) show their messages and the fix.
- [x] **AC-3** No token in `localStorage`, `document.cookie` or any response body to the browser
      (Playwright check after login).
- [x] **AC-4** A cross-origin POST to a mutating route handler is rejected (route test).
- [x] **AC-5** An expired access token is refreshed once and the request retried (loader test).
- [x] **AC-6** Login answering 202 (new device) asks for the OTP.
- [x] **AC-7** The tenant comes from `X-Forwarded-Host` only behind an explicit trusted-proxy setting,
      else from `Host` (`tenantFromHeaders`, route test): with a session cookie, a forged forwarded host
      must not send tenant A's session with tenant B's `X-Tenant-Id` (F3b security review). The same
      setting lets the route handlers read the player's IP for contract request 004.

## Notes

- 2026-10-02: done — both halves are: [F4a](F4a-session-login.md) (AC-3 to AC-7, `F4/verification.md`) and
  [F4b](F4b-register-kyc.md) (AC-1, AC-2, AC-9, AC-10, `F4b/verification.md`). AC-2's `AUTH_OTP_INVALID`
  is proven in the contract's `Problem` shape rather than "via `Prefer`": Prism has no example of it
  (contract request 006).
