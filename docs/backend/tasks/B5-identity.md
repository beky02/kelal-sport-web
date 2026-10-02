---
id: B5
title: C01 identity with ConsoleSmsProvider; C14 sender interface
status: todo
depends_on: [B1]
components: [C01, C14]
contract_tags: [Auth, Me]
touches_money: false
---

# B5 — Identity and auth

## Goal
Players can register with OTP, log in (with new-device OTP), refresh, reset the password and log out against
the real API, using the console SMS provider.

## Read first
- `docs/design/components/c01-identity-auth.md`, `c14-notifications.md` (sender interface only)
- `docs/engineering-decisions.md` D3 (EdDSA JWT claims and audiences, sessions, retail_staff/agent principals)
- `docs/design/td-90-infra-security-ops.md` (security controls), `td-01-api-standards.md` (auth headers, rate limits)
- `contracts/openapi.yaml`, tags `Auth`, `Me`

## Scope
In: identity schema (player, credential, session, device, otp), argon2id password hashing, EdDSA access tokens
(15 min) + rotating refresh tokens with reuse detection, OTP with TTL and attempt limits, Redis rate limits for
OTP and login, `ConsoleSmsProvider` (dev OTP `000000` only when `ENV=local`), `/v1/me` endpoints in scope,
`notify` sender interface. Auth dependency for routes (`require_player`, `require_staff(perm)`).
Out: KYC (C02), staff login UI flows beyond what the contract needs, agent/retail principals (B9).

## Acceptance criteria
- [ ] **AC-1** Every `Auth` and `Me` operation implemented; `make conformance` passes for both tags.
- [ ] **AC-2** Error codes per contract: `AUTH_OTP_INVALID`, `AUTH_OTP_EXPIRED`, `AUTH_OTP_RATE_LIMITED`, `REG_PHONE_TAKEN`, `REG_UNDERAGE` (min age from config), `AUTH_LOCKED` after N failures — one test each.
- [ ] **AC-3** Refresh token reuse revokes the whole session family (test).
- [ ] **AC-4** Tokens: EdDSA with `kid`; wrong audience, expired, or other-tenant (`tid`) tokens are rejected (tests).
- [ ] **AC-5** The fixed dev OTP is impossible outside `ENV=local` (test with ENV=production settings).
- [ ] **AC-6** No password, OTP or token appears in logs (log-capture test).
