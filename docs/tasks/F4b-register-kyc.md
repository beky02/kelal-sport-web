---
id: F4b
title: Register with the SMS code, reset the password, verify with Fayda
status: planned
depends_on: [F4a]
contract_tags: [Auth, KYC]
touches_money: false
touches_ui: true
---

# F4b — Register, reset the password, verify with Fayda

Split from [F4](F4-auth-session.md) (2026-10-02): the account-creation half. The session cookie,
login and logout are [F4a](F4a-session-login.md), which this builds on.

## Goal

A new player opens an account (phone → SMS code → name, date of birth and password), verifies their
identity with Fayda (ID number → Fayda's own OTP → verified, pending or needs more information) or
defers it, and resets a forgotten password by SMS code — all through route handlers on F4a's session.

## Read first

As F4: `c01-identity-auth.md` §6 and §8 (registration, OTP), `c02-kyc.md` §6, §8 and §10 (Fayda path,
fallbacks); `contracts/openapi.yaml`: `/v1/auth/otp` (409 `REG_PHONE_TAKEN`, 429, 503),
`/v1/auth/register` (`RegisterRequest`: `full_name`, `date_of_birth`, `accept_terms_version` and
`device` are required), `/v1/auth/password/reset`, `/v1/kyc/fayda/otp`, `/v1/kyc/fayda/verify`
(`verified`, `needs_info`, `pending`), `/v1/kyc/documents`; `/v1/config/public` `legal.terms_version`;
F4a's `lib/server/session.ts`, `csrf.ts`, `features/auth/lib/flow.ts` and the dialog.

## Scope

In:

- Route handlers `POST /api/auth/otp`, `/api/auth/register` (sets the session cookie),
  `/api/auth/password/reset`, `/api/kyc/fayda/otp` and `/api/kyc/fayda/verify` (session required).
- Registration steps: phone (with the age and terms consents; `accept_terms_version` from the tenant's
  `legal.terms_version`) → code → details (full name, date of birth, password: the contract needs the
  name and date of birth to create the account, so they move here from the ID step) → ID (Fayda number
  and consent → Fayda's OTP → `verified` / `pending` / `needs_info` with its `reason_code`) → done.
  "Do this later" at the ID step finishes with the account created.
- Password reset: phone → code → new password → back to log in with a notice.
- Resend after the challenge's `resend_after`. The API checks the code on the call after the code step,
  so `AUTH_OTP_INVALID` and `AUTH_OTP_EXPIRED` send the player back to the code step with the message
  and the fix (re-enter, or a new code).
- Error codes: `REG_PHONE_TAKEN` (offers Log in), `AUTH_OTP_INVALID`, `AUTH_OTP_EXPIRED`,
  `AUTH_OTP_RATE_LIMITED`, `AUTH_OTP_UNAVAILABLE`, `REG_UNDERAGE`, `REG_ID_TAKEN`,
  `KYC_PROVIDER_UNAVAILABLE` (offers Do this later), `VALIDATION_FAILED` (`errors[]` on the fields).

Out (do not build here):

- Telegram login (P1).
- Manual document upload (`/v1/kyc/documents`): needs a compress-under-1-MB upload flow; until a
  follow-up builds it, `KYC_PROVIDER_UNAVAILABLE` offers "Do this later" (verification from the profile).
- Deposit limit, promo code and marketing consent at registration (no design for them; F7 owns limits).

## Acceptance criteria

- [ ] **AC-1** Full register → OTP → password → KYC flow against Prism.
- [ ] **AC-2** `REG_PHONE_TAKEN` and `AUTH_OTP_INVALID` show their messages and the fix.
      `REG_PHONE_TAKEN` via `Prefer: code=409`. The contract has no named example for
      `AUTH_OTP_INVALID` (its 422 examples are `stake_too_low`, `insufficient_funds`, `validation`), so
      it is proven with the contract's `Problem` shape in a component test and a `pnpm ui` screen; a
      contract request for named auth examples is proposed.
- [ ] **AC-9** Password reset by SMS code ends at the log-in step with a notice (component test).
- [ ] **AC-10** Each `KycResult.status` (`verified`, `pending`, `needs_info`) has a screen state
      (`pnpm ui` screenshots via Prism's named examples).

## Verification

- `pnpm verify` passes
- `curl -H 'Prefer: code=409' …/api/auth/otp` → 409 `REG_PHONE_TAKEN`
- `curl -H 'Prefer: example=needs_info' …/api/kyc/fayda/verify` → `needs_info` with `NAME_MISMATCH`

## Notes

- 2026-10-02: split from F4. Starts when F4a is `done` on main.
