# F4b — plan

Register with the SMS code, reset the password, verify with Fayda. Builds on F4a's session
(`docs/tasks/F4/plan.md`). Plan gate: approved 2026-10-02 (mode: interactive).

## Understanding

Today the registration and reset steps only collect input: the code step shows a hardcoded number, the
password step closes the dialog, the ID step asks for a name and date of birth the API never receives,
and nothing reaches the API. F4b wires them to the contract through route handlers on F4a's session. A
new player gives a phone and the two consents, gets an SMS code, then gives name, date of birth and
password; `POST /v1/auth/register` checks the code, creates the account and the route handler seals the
tokens into the session cookie exactly as login does. The signed-in player can then verify with Fayda
(number → Fayda's own SMS code → `verified` / `pending` / `needs_info` / `rejected`) or defer it. A
forgotten password is reset by SMS code and ends back at log in with a notice. Because the API checks
an SMS code on the call after the code step, a wrong or expired code is reported one step later and the
player is sent back to the code with the message and the fix. Every refusal is decided by the Problem's
`code`; the browser never decides age, password strength beyond length, or who is verified.

## Spec conflicts and decisions

| #   | Question                                                                                                                                                                                                                                 | Decision and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The design's password rules include "A letter and a number"; C01 §2 and SRS REG-06 say minimum 8, **no composition rules**, breached passwords blocked.                                                                                  | C01 (source 4) outranks the design (5): rules are "At least 8 characters" and "Both passwords match", `maxLength` 128 (contract). The breached-password check is the API's (`VALIDATION_FAILED` on `password`, shown on the field). `auth.ruleLetterNumber` removed.                                                                                                                                                                                                                                                                                                                |
| 2   | SRS REG-03 collects the national ID at registration; the contract's `RegisterRequest.national_id` is optional and the task makes the ID step deferrable.                                                                                 | Contract + task win. The Fayda number goes to `/v1/kyc/fayda/otp` after the account exists; `national_id` is never sent at registration.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3   | Where does `accept_terms_version` come from?                                                                                                                                                                                             | The register route handler reads `legal.terms_version` from `loadPublicConfig(tenant)` (cached 60 s) and sends it; the browser sends only `acceptTerms: true`, the consent the phone step required. The version recorded is the tenant's current one, the browser cannot claim another, and `/api/config`'s shape (F1's) is unchanged. A tenant config with no `legal.terms_version` → `503 SERVICE_UNAVAILABLE` from the route handler: no account without a terms version to record.                                                                                              |
| 4   | Name and date of birth sit on the design's ID step, but `RegisterRequest` requires them.                                                                                                                                                 | They move to a **details** step with the password (task scope); the stepper's third label becomes "Details". Full name 3–100 characters (contract). Date of birth: one text field, `DD/MM/YYYY` as the design's placeholder, Gregorian (D7), sent as `YYYY-MM-DD`; the client checks only that it is a real date in the past — whether the player is old enough is the API's (`REG_UNDERAGE`, REG-04), not ours.                                                                                                                                                                    |
| 5   | Fayda number: the design says FIN, 12 digits; the contract accepts 12–16 characters.                                                                                                                                                     | The UI keeps the design's 12 digits (inside the contract's bounds); the route handler accepts the contract's length (12–16) and, as this app's own rule, letters and digits only (`^[A-Za-z0-9]{12,16}$`) — the contract sets no character pattern (spec review S1). Follow-up if the 16-digit FAN should be accepted too.                                                                                                                                                                                                                                                          |
| 6   | The code is checked on the call after the code step.                                                                                                                                                                                     | The code is held in the flow's state until `register` / `password/reset`. `AUTH_OTP_INVALID` → back to the code step, boxes cleared, message; the details stay filled. `AUTH_OTP_EXPIRED` → back to the code step with **Send a new code**, which re-sends (same phone and purpose) and starts a new challenge. Resend is offered after the challenge's `resend_after`, counted to a fixed deadline so returning to the step after an error does not restart it.                                                                                                                    |
| 7   | Fayda's challenge has no `resend_after`.                                                                                                                                                                                                 | No timed resend on the Fayda code step. `AUTH_OTP_EXPIRED` there offers Send a new code, which calls `/v1/kyc/fayda/otp` again with the same number (a new case). The number Fayda texted is the API's `otp_sent_to`, shown as given (already masked).                                                                                                                                                                                                                                                                                                                              |
| 8   | `KycResult.status` has four values; AC-10 names three.                                                                                                                                                                                   | All four get a state. **verified**: "Identity verified" — no promise about withdrawals (`can_withdraw` is the API's call). **pending**: the design's "usually takes under 10 minutes… we'll SMS you" is promised by no source, so: "We're reviewing your ID. We'll let you know when it's done." **needs_info**: the reason from `reason_code` (five codes, plus none) with Try again (back to the ID step) and Do this later. **rejected**: "We couldn't verify your ID. Contact support from your profile." After any result `/api/me` is read again. _Copy flagged at the gate._ |
| 9   | The Fayda calls need a player.                                                                                                                                                                                                           | `/api/kyc/fayda/*` read the session like `/api/me` and call through `withSession()` (refresh once). No session → `401 AUTH_TOKEN_EXPIRED` (the mapping `respond()` already has), nothing sent upstream; the dialog says the session ended and offers Log in.                                                                                                                                                                                                                                                                                                                        |
| 10  | `REG_ID_TAKEN` is in scope, but the contract has no 409 on `/v1/kyc/fayda/*` and we never send `national_id` at registration.                                                                                                            | It cannot arrive today. Mapped anyway (message, no fix but support) and raised in contract request 006: which operation says "this Fayda ID is already linked" (C01 §10) once the ID is given after registration.                                                                                                                                                                                                                                                                                                                                                                   |
| 11  | Prism's 422/429/503 examples are `BET_STAKE_TOO_LOW`, `RATE_LIMITED`, `REAL_MONEY_DISABLED`, so `AUTH_OTP_INVALID`, `_EXPIRED`, `_RATE_LIMITED`, `_UNAVAILABLE`, `REG_UNDERAGE` and `KYC_PROVIDER_UNAVAILABLE` cannot be asked of Prism. | Proven with the contract's `Problem` shape in component tests, and the `pnpm ui` screen for `AUTH_OTP_INVALID` fulfils `/api/auth/register` with that Problem in the browser (this app's route, not the API). **Contract request 006** (proposed, written in this task as AC-2 says) asks for named examples of each. `REG_PHONE_TAKEN` is Prism's 409 default and is shown end to end.                                                                                                                                                                                             |
| 12  | Reset: C01 §10 — `POST /v1/auth/otp` answers the same whether or not the phone is registered (purpose `reset`).                                                                                                                          | The reset code step says "If {phone} has an account, we've sent it a code." — never confirms the account. After `204` the dialog switches to Log in with the phone kept and a status notice ("Password changed. Log in with your new password."). The API revokes every session of that account; the browser's own cookie is left alone (it may belong to another account).                                                                                                                                                                                                         |
| 13  | Who owns the dialog's position now that there are three flows?                                                                                                                                                                           | The store says which flow is open (`AuthEntry`: `login`, `register`, `verify`, `forgot`) and carries a prefill (phone, notice) for a switch between flows; each flow's pure reducer owns its step and data, as F4a's login reducer does. Entries renamed from step names (`"phone"` → `"register"`, `"kyc"` → `"verify"`) in the five call sites. `verify` (from profile and wallet) is the ID step alone: no stepper, Done instead of Start betting.                                                                                                                               |
| 14  | After `201` the account exists.                                                                                                                                                                                                          | The register route handler sets the session cookie like login (the tokens go no further); the browser forgets any previous player's caches and reads `/api/me` (shared with login). From the ID step there is no back arrow — the account is created; closing the dialog leaves the player signed in.                                                                                                                                                                                                                                                                               |
| 15  | `REG_UNDERAGE`: 05-errors says "None; responsible-gaming link".                                                                                                                                                                          | Message ("You must be of legal age to open an account.") and a Responsible gaming link that closes the dialog and opens `/responsible-gaming`. The age box stays the design's "21" copy; wiring `legal.min_age` into it is a follow-up with F1's config view.                                                                                                                                                                                                                                                                                                                       |
| 16  | Registration language.                                                                                                                                                                                                                   | `RegisterRequest.language` = the UI language (`Accept-Language` from `apiClient`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 17  | `VALIDATION_FAILED`.                                                                                                                                                                                                                     | `errors[]` entries are put on the field they name (`phone`, `full_name`, `date_of_birth`, `password`, `new_password`, `fayda_number`) with the API's `message` (translated by the API); entries with no known field or no message fall back to the notice with the API's title.                                                                                                                                                                                                                                                                                                     |
| 18  | Size.                                                                                                                                                                                                                                    | Estimated ~1,900 changed lines; the result is ~5,800 (+5,250/−560: src ~3,000 including the login flow moved out of `AuthDialog` and both catalogues, tests ~2,200, docs ~600). The estimate missed the tests and the docs; the code is all one area (account creation in the auth dialog) and F4b is already a split of F4, so it was not split further (spec review S3).                                                                                                                                                                                                          |

Assumptions: the code step's code is 6 digits (contract `^\d{6}$`); `resend_after` and `expires_in` are
seconds from the response. A `Retry-After` on 429 is not surfaced (the route handler forwards the
Problem body only) — follow-up.

## Design

### Contract operations → server

| Operation                               | Loader (`lib/server/*`)                        | Mapper                                                      | Route handler                      | Answer to the browser                     |
| --------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| `POST /v1/auth/otp` (`sendOtp`)         | `auth.ts` `sendOtp(ctx, form)`                 | `toOtpRequest`, `toOtpChallenge`                            | `POST /api/auth/otp`               | `{ challengeId, expiresIn, resendAfter }` |
| `POST /v1/auth/register`                | `auth.ts` `register(ctx, form, device, terms)` | `toRegisterRequest`, `toPlayerSummary`, `sessionFromTokens` | `POST /api/auth/register` (cookie) | `{ player: PlayerSummary }`               |
| `POST /v1/auth/password/reset`          | `auth.ts` `resetPassword(ctx, form)`           | `toPasswordResetRequest`                                    | `POST /api/auth/password/reset`    | `204`                                     |
| `POST /v1/kyc/fayda/otp` (`startFayda`) | `kyc.ts` `startFayda(ctx, session, form)`      | `toFaydaChallenge`                                          | `POST /api/kyc/fayda/otp`          | `{ caseId, otpSentTo, expiresIn }`        |
| `POST /v1/kyc/fayda/verify`             | `kyc.ts` `verifyFayda(ctx, session, form)`     | `toKycResult`                                               | `POST /api/kyc/fayda/verify`       | `{ status, reasonCode }`                  |

Every handler: `assertSameOrigin` (F4a's CSRF), `readJson` capped (4 KB), a strict Zod form from
`lib/api/schemas.ts` checked before anything goes upstream (Prism answers an invalid body with an
unrelated `BET_STAKE_TOO_LOW`), then `respond()`. `/api/auth/otp` accepts purposes `register` and
`reset` only (the login code comes from login's 202). `/api/auth/register` and `/api/auth/otp` mint or
read the device cookie (`ensureDevice`) — register needs `device`. Prism's `Prefer` passes through
`mockPreference()` (next dev only), as on login.

### Domain types (`features/auth/types.ts`)

`AuthEntry = "login" | "register" | "verify" | "forgot"` (replaces `AuthStep`), `OtpPurpose`,
`OtpRequestForm { phone, purpose }`, `OtpChallengeView { challengeId, expiresIn, resendAfter }`,
`RegisterForm { challengeId, otp, fullName, dateOfBirth, password, acceptTerms: true }`,
`RegisterResult { player: PlayerSummary }`, `PasswordResetForm { challengeId, otp, newPassword }`,
`FaydaStartForm { faydaNumber }`, `FaydaChallengeView { caseId, otpSentTo, expiresIn }`,
`FaydaVerifyForm { caseId, otp }`, `KycReason`, `KycResultView { status, reasonCode }`. Each browser-
facing one gets a Zod schema with `satisfies z.ZodType<…>`.

### Browser

- `features/auth/api/auth.ts`: `sendOtp`, `register`, `resetPassword`; `features/auth/api/kyc.ts`:
  `startFayda`, `verifyFayda` — all through `apiClient.post` (CSRF header, language).
- Hooks: `use-session.ts` gains `useRegister()`; login and register share `signedIn(queryClient)`
  (forget the previous player's caches, read `/api/me`). `use-account.ts` (new): `useSendOtp()`,
  `useResetPassword()`, `useStartFayda()`, `useVerifyFayda()` (on a result: invalidate
  `sessionKeys.me()`). No new query keys; mutations only, none optimistic, none retried.
- Pure flow reducers: `lib/register-flow.ts` (steps `phone → otp → details → kyc → kycOtp → result`;
  entry `verify` starts at `kyc`), `lib/reset-flow.ts` (`phone → otp → password`), `lib/flow.ts`'s login
  reducer initialised from a prefill (phone, notice). Each holds pending, the current error, an attempt
  counter (the code step is keyed by it, so a refused code comes back empty with the caret in place) and
  the fixed resend deadline.
- `lib/errors.ts`: `authErrorMessage(error, { code: "login" | "resend" })` → `{ key | text, detail?, fix?, fields? }`;
  fixes `logInAgain`, `logInInstead`, `sendNewCode`, `doThisLater`, `responsibleGaming`.
- `lib/schemas.ts`: details (name 3–100, date, password 8–128 + confirm), FIN (12 digits), phone (as
  now); `lib/birth-date.ts`: `DD/MM/YYYY` (spaces, dots, dashes or none) → `YYYY-MM-DD` or null.
- `hooks/use-countdown.ts`: counts to a deadline (epoch ms), not from a number of seconds.
- Components: `AuthDialog` becomes the shell and picks the flow by entry; `AuthHeader` (back, heading,
  close — moved out of the dialog); `flows/LoginFlow.tsx` (F4a's login, moved), `flows/RegisterFlow.tsx`
  (register + verify), `flows/ResetFlow.tsx`. Steps: `PhoneStep` (submit, pending, error, field error),
  `OtpStep` (`resendAt`, `resending`), `DetailsStep` (new: name, date of birth, `PasswordFields`),
  `PasswordStep` (now the reset's new password, using `PasswordFields`), `KycStep` (FIN + consent only;
  pending, error), `KycResultStep` (new; replaces `KycPendingStep`), `ForgotStep` (submit, pending,
  error), `LoginStep` (status notice). `AuthNotice` gains the new fix labels and a `StatusNotice`
  (`role="status"`, `bg-win-bg`).
- Call sites: `AppHeader`, `ProfileView` (×2), `WalletView`, `app/register/page.tsx` use the new entries.

### Error codes → what the UI offers

| Code                                          | Step (operation)                                | UI                                                                                             |
| --------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `REG_PHONE_TAKEN` (409)                       | phone (`otp` register); details (race)          | "This phone number already has an account." + **Log in instead** (phone kept)                  |
| `AUTH_OTP_RATE_LIMITED`, `RATE_LIMITED` (429) | phone, forgot, resend                           | "Too many attempts…" (existing copy); resend waits                                             |
| `AUTH_OTP_UNAVAILABLE` (503)                  | phone, forgot, resend                           | "We can't send SMS right now. Try again in a few minutes." (the button retries)                |
| `AUTH_OTP_INVALID` (422)                      | details → code; new password → code; Fayda code | "That code isn't right…", back to / stays on the code step, boxes cleared                      |
| `AUTH_OTP_EXPIRED` (422)                      | same                                            | "That code has expired." + **Send a new code**                                                 |
| `REG_UNDERAGE` (422)                          | details                                         | "You must be of legal age to open an account." + **Responsible gaming**                        |
| `VALIDATION_FAILED` (422)                     | any form                                        | `errors[].message` on the field it names; else the API's title in the notice                   |
| `REG_ID_TAKEN` (409)                          | ID (not reachable today, decision 10)           | "This ID is already linked to another account. Contact support."                               |
| `KYC_PROVIDER_UNAVAILABLE` (503)              | ID, Fayda code                                  | "Fayda isn't reachable right now. You can verify later from your profile." + **Do this later** |
| `AUTH_TOKEN_EXPIRED` (401)                    | ID, Fayda code (no session)                     | "Your session has ended. Log in again to continue." + **Log in again** (opens login)           |
| other / network                               | any                                             | API title, or "Something went wrong…"; the button retries                                      |

### i18n keys (en + am; composed Amharic in `TRANSLATION-NOTES.md`)

Added: `auth.stepDetails`, `auth.detailsTitle`, `auth.detailsBody`, `auth.dateOfBirthInvalid`,
`auth.fullNameInvalid`, `auth.resetCodeBody`, `auth.newPasswordTitle`, `auth.savePassword`,
`auth.passwordChanged`, `auth.faydaCodeBody`, `auth.kycVerifiedTitle`, `auth.kycVerifiedBody`,
`auth.verified`, `auth.needsInfo`, `auth.needsInfoTitle`, `auth.kycReason.{NAME_MISMATCH,DOB_MISMATCH,DOC_UNREADABLE,UNDERAGE,OTHER}`,
`auth.rejected`, `auth.rejectedTitle`, `auth.rejectedBody`, `auth.tryAgain`, `auth.done`,
`auth.logInInstead`, `auth.sendNewCode`, `auth.errors.{REG_PHONE_TAKEN,REG_UNDERAGE,REG_ID_TAKEN,AUTH_OTP_UNAVAILABLE,KYC_PROVIDER_UNAVAILABLE,AUTH_TOKEN_EXPIRED,VALIDATION_FAILED,otpExpiredResend}`.
Changed: `auth.pendingBody` (decision 8). Removed: `auth.ruleLetterNumber` (decision 1),
`auth.stepPassword` (→ `stepDetails`).

### Feature flags

None. Release 2 flags untouched.

## Files

Create:

- `src/app/api/auth/otp/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/password/reset/route.ts`, `src/app/api/kyc/fayda/otp/route.ts`, `src/app/api/kyc/fayda/verify/route.ts` — the five route handlers.
- `src/lib/server/kyc.ts` — Fayda loaders through `withSession`.
- `src/lib/api/mappers/kyc.ts` — `FaydaChallenge`, `KycResult` → domain.
- `src/features/auth/api/kyc.ts`, `src/features/auth/hooks/use-account.ts` — browser calls and mutations.
- `src/features/auth/lib/register-flow.ts`, `src/features/auth/lib/reset-flow.ts`, `src/features/auth/lib/birth-date.ts` — pure flow state and date parsing.
- `src/features/auth/components/AuthFrame.tsx` (the header row, stepper and scrolling body — named for all three, not only the header), `src/features/auth/hooks/use-finish-auth.ts` (closing the dialog and following `?next=`, shared by the flows; added while implementing), `flows/LoginFlow.tsx`, `flows/RegisterFlow.tsx`, `flows/ResetFlow.tsx`, `steps/DetailsStep.tsx`, `steps/PasswordFields.tsx`, `steps/KycResultStep.tsx`.
- `tests/unit/register-route.test.ts` (otp, register, reset, Fayda handlers), `tests/unit/register-flow.test.ts` (both new reducers + birth date), `tests/component/RegisterFlow.test.tsx`, `tests/component/ResetFlow.test.tsx`.
- `docs/contract-requests/006-auth-kyc-error-examples.md` — named examples for the auth/KYC refusals; which operation answers `REG_ID_TAKEN`; 503 on `fayda/verify`.
- `docs/tasks/F4b/plan.md`, `docs/tasks/F4b/verification.md`.

Change:

- `src/lib/server/auth.ts` — `sendOtp`, `register`, `resetPassword`.
- `src/lib/server/body.ts` — `readForm()`: the capped, schema-checked JSON body the five new handlers share (added while implementing).
- `src/lib/api/mappers/auth.ts` — OTP, register, reset mappers.
- `src/lib/api/schemas.ts` — browser-facing and request schemas for the five handlers.
- `src/features/auth/types.ts`, `stores/auth.store.ts` (entry + prefill), `lib/flow.ts` (prefill), `lib/errors.ts`, `lib/schemas.ts`, `api/auth.ts`, `hooks/use-session.ts` (`useRegister`, shared `signedIn`), `hooks/use-countdown.ts` (deadline).
- `src/features/auth/components/AuthDialog.tsx`, `AuthRoute.tsx`, `AuthStepper.tsx`, `AuthNotice.tsx`, `steps/PhoneStep.tsx`, `steps/OtpStep.tsx`, `steps/PasswordStep.tsx`, `steps/KycStep.tsx`, `steps/ForgotStep.tsx`, `steps/LoginStep.tsx`.
- `src/components/layout/AppHeader.tsx`, `src/features/profile/components/ProfileView.tsx`, `src/features/wallet/components/WalletView.tsx`, `src/app/register/page.tsx`, `src/app/login/page.tsx` — new entry names.
- `src/lib/i18n/messages/en.json`, `am.json`, `TRANSLATION-NOTES.md`.
- `tests/unit/auth-mappers.test.ts` (new mappers on the contract's examples), `tests/component/AuthDialog.test.tsx` (entry names), `tests/e2e/auth.spec.ts` (AC-1), `tests/e2e/screens.spec.ts` (new screens).
- `docs/design/03-session-and-account.md`, `02-journeys.md`, `05-errors-and-states.md`, `01-screens.md`, `07-tenancy-and-theming.md` (who reads `legal.terms_version`) — registration, reset and KYC as built.
- `docs/contract-requests/README.md`, `docs/tasks/F4b-register-kyc.md`, `docs/tasks/README.md`.

Delete:

- `src/features/auth/components/steps/KycPendingStep.tsx` (→ `KycResultStep`).

## Acceptance criteria → tests

| AC      | Test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | How it proves it                                                                                                                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1    | `tests/e2e/auth.spec.ts` › "registers with the SMS code, is signed in, and verifies with Fayda against Prism (AC-1)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Dev server + Prism: `/register` → phone + consents → code → details → Create account → header shows the balance, `kelal.session` httpOnly, no token in any `/api/*` body → FIN + consent → Fayda code → "Identity verified" |
| AC-1    | `RegisterFlow.test.tsx` › "walks phone → code → details → ID → Fayda code → verified, sending each request once (AC-1)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Exact bodies to `/api/auth/otp`, `/api/auth/register` (`dateOfBirth` ISO, `acceptTerms`), `/api/kyc/fayda/otp`, `/api/kyc/fayda/verify`; `/api/me` read after register and after the result                                 |
| AC-1    | `RegisterFlow.test.tsx` › "Do this later finishes with the account created"; "resends the code after resend_after with the same phone and purpose"; "verify from the profile is the ID step alone, with Done"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Defer path, resend, standalone entry                                                                                                                                                                                        |
| AC-1    | `register-route.test.ts` › "register sends the contract's RegisterRequest with the tenant's terms version, the UI language and this browser's device, and seals the session"; "answers the player and never the tokens"; "answers 503 when the tenant has no terms version, sending nothing"; "otp sends the phone as +251… with the purpose and answers the challenge"; "otp refuses purpose login"; "Fayda without a session answers 401 AUTH_TOKEN_EXPIRED, sending nothing"; "Fayda with a session sends the bearer and maps the challenge and the result"; "every new POST is refused cross-origin, without the CSRF header, or not JSON (AC-4)"; "validates bodies before sending anything on" | Route handlers + stubbed upstream                                                                                                                                                                                           |
| AC-1    | `auth-mappers.test.ts` › "maps the contract's OtpChallenge, register AuthResult, FaydaChallenge and every KycResult example"; "builds RegisterRequest and PasswordResetRequest"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `responseExample()` / `requestExample()` fixtures                                                                                                                                                                           |
| AC-1    | `register-flow.test.ts` › reducer: each transition; a code refusal lands on the code step with details kept; back rules (no back after the account exists); `parseBirthDate` cases                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Pure                                                                                                                                                                                                                        |
| AC-2    | `RegisterFlow.test.tsx` › "REG_PHONE_TAKEN says the phone has an account and Log in instead opens login with the phone kept (AC-2)"; "AUTH_OTP_INVALID at Create account returns to the code step, cleared, with the message, details kept (AC-2)"; "AUTH_OTP_EXPIRED offers Send a new code"                                                                                                                                                                                                                                                                                                                                                                                                        | Problems in the contract's shape                                                                                                                                                                                            |
| AC-2    | `register-route.test.ts` › "otp passes the contract's 409 REG_PHONE_TAKEN through"; curl `Prefer: code=409` → 409 `REG_PHONE_TAKEN` (verification.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Route + Prism                                                                                                                                                                                                               |
| AC-2    | `pnpm ui` › `register-phone-taken` (Prefer `code=409` on `/api/auth/otp`), `register-code-invalid` (`/api/auth/register` fulfilled with the `AUTH_OTP_INVALID` Problem)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | The screens                                                                                                                                                                                                                 |
| AC-2    | `docs/contract-requests/006-auth-kyc-error-examples.md` (status `proposed`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | The request the AC calls for                                                                                                                                                                                                |
| AC-9    | `ResetFlow.test.tsx` › "resets the password by SMS code and ends at log in with the phone kept and a notice (AC-9)"; "a wrong code at Save password goes back to the code step"; "never says whether the phone has an account"                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `/api/auth/otp` `reset`, `/api/auth/password/reset` bodies; login step with `role="status"` notice                                                                                                                          |
| AC-9    | `register-route.test.ts` › "password reset answers 204 and sets no session cookie"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Route                                                                                                                                                                                                                       |
| AC-9    | `pnpm ui` › `reset-code`, `reset-done`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | The screens                                                                                                                                                                                                                 |
| AC-10   | `pnpm ui` › `verify-verified`, `verify-pending`, `verify-needs-info` (Prism `Prefer: example=…` on `/api/kyc/fayda/verify`, reached through registration)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | One screen per status, en/am × 375/1440                                                                                                                                                                                     |
| AC-10   | `RegisterFlow.test.tsx` › "shows each KycResult: verified, pending, needs_info with its reason, rejected (AC-10)"; "KYC_PROVIDER_UNAVAILABLE offers Do this later"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Component                                                                                                                                                                                                                   |
| —       | `AuthDialog.test.tsx` (existing login tests, entry names updated) still pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | The login flow survived the move into `LoginFlow`                                                                                                                                                                           |
| Screens | `pnpm ui` › `register`, `register-code`, `register-details`, `register-id`, `register-phone-taken`, `register-code-invalid`, `verify-verified`, `verify-pending`, `verify-needs-info`, `reset-code`, `reset-done`, plus the existing `login*` and `profile*`                                                                                                                                                                                                                                                                                                                                                                                                                                         | en/am × 375/1440; look at the PNGs                                                                                                                                                                                          |

## Risks

- **Money**: none moves. The verified screen makes no withdrawal promise (decision 8); the wallet's lock
  stays on `can_withdraw` (F4a).
- **Security**: tokens from `register` only ever in the sealed cookie (test: body and cookie value hold
  no raw token); CSRF + JSON + same-origin on all five new POSTs (tests); strict, capped bodies validated
  before anything goes upstream; `accept_terms_version` never from the browser (decision 3); Fayda
  handlers require the session and refresh through `withSession`; reset copy never confirms an account
  (C01 §10); passwords, codes, the Fayda number and the date of birth live only in the flow's React
  state — never in the URL, storage or logs — and go when the dialog closes; `Prefer` only under next
  dev (existing test).
- **Accessibility**: refusals in `role="alert"`, the reset notice in `role="status"`; field errors via
  `aria-describedby`; the code input regains focus on return; `autocomplete` `bday`, `name`,
  `new-password`, `one-time-code`; numeric keyboards for phone, date and FIN; touch targets ≥ 44 px.
- **Performance**: no new queries; the terms version comes from the per-tenant config cache; one
  `/api/me` read after register and after a KYC result.
- **Both languages**: every key in `en.json` and `am.json` (`i18n.test.ts`); new Amharic listed in
  `TRANSLATION-NOTES.md`.

## Out of scope

- Telegram login (P1).
- Manual document upload (`/v1/kyc/documents`) — `KYC_PROVIDER_UNAVAILABLE` offers Do this later.
- Deposit limit, promo code and marketing consent at registration (no design; F7 owns limits).
- `legal.min_age` in the age consent copy (follow-up with F1's config view).
- Surfacing `Retry-After` on 429 (follow-up).
- Accepting the 16-digit Fayda FAN (follow-up, decision 5).

## Sub-tasks

None (decision 18).

## Changes during verification

- **Mutation cache (security review SEC1).** Every auth mutation (login included) sets `gcTime: 0`, so a
  password, code, date of birth or Fayda number leaves the TanStack mutation cache as soon as the dialog
  closes; the Risks section's "go when the dialog closes" now holds (test: `RegisterFlow.test.tsx` AC-1
  run ends with an empty mutation cache).
- **Device cookie on `/api/auth/otp` (SEC2, spec S4).** The route now reads or mints it, as Design said.
- **Signing in on a signed-in browser (SEC4).** The register handler, and F4a's login handler, revoke
  the previous session at the API (best effort, after the new session exists — not on a 202 or a
  refusal) before sealing the new one. `src/app/api/auth/login/route.ts` and `tests/unit/auth-route.test.ts`
  were added to the file list for this.
- **Error-view tests (spec S5)** live in `tests/unit/register-flow.test.ts` › "what a registration refusal
  says", not `auth-flow.test.ts`, which is unchanged.
- **Unused keys (spec S6).** `auth.passwordTitle` and `auth.required` removed.

## Changes before merge (2026-10-02, the user's decisions)

- **Decision 3 revised (security SEC3; the user chose "ask for consent again").** `RegisterForm` carries
  `termsVersion`, the version the phone step showed; the register loader refuses one that is no longer
  the tenant's current version with `VALIDATION_FAILED` on `accept_terms_version` (`current` = the new
  version), sends nothing upstream, and the flow returns to the consents unticked with
  `auth.errors.termsUpdated`. Re-ticking returns to the details without a second SMS; the browser's
  config is re-read first. The version sent to the API is still the server's own. `/api/config`'s view
  gained `legal: { termsVersion, minAge }` (`features/config/types.ts`, `mappers/config.ts`, schema,
  `tests/unit/config-mappers.test.ts`, `tests/component/render.tsx`) — additive, ahead of F1.
- **Out of scope → done.** The age consent states `legal.min_age` (default 21, C01 §9). `Retry-After` on a
  429 is carried from the API (`UpstreamError.retryAfter`, `respond()`, `ApiError.retryAfter`) and shown
  as seconds or minutes (`auth.errors.rateLimitedSeconds`/`Minutes`). Terms and Privacy open in a new tab
  from the consent row without ticking it.
- **Copy (spec S2; the user chose the neutral, sourced wording).** `auth.kycBody`: "You need a verified ID
  to withdraw winnings."; `auth.laterNote`: "Withdrawals stay locked until your ID is verified." (SRS
  KYC-04).
- **FAN (decision 5; the user chose FIN only).** Unchanged; the question is in contract request 006.
- **`.claude/launch.json`** is in `.gitignore` (per-machine preview config).

## Review fixes before merge (quality and UI reviews, 2026-10-02)

- **Focus follows the step (Q1, MAJOR; U2).** `AuthFrame` takes a `stepKey`; when it changes, focus moves to
  the step's `<h2>` unless the step put the caret in its own field (phone, code). The phone fields focus
  themselves; the dialog never auto-focuses its close button. Tests: `RegisterFlow.test.tsx` (AC-1 run
  asserts focus at every step), `ResetFlow.test.tsx`, `auth.spec.ts` (`toBeFocused` in Chrome).
- **Consent rows (Q2, MAJOR).** `CheckboxRow` (`src/components/ui/Field.tsx`) is a native checkbox with the
  sentence as its `<label>`; Terms and Privacy are links of their own (not inside `role="checkbox"`),
  open in a new tab and say so to screen readers (`auth.opensInNewTab`). The click-propagation workaround
  is gone. That a link click leaves the box alone is checked in Chrome (`auth.spec.ts`).
- **Re-consent (Q3, Q5).** The version accepted after a stale-terms refusal is the one the refusal names
  (`errors[].current`), not a config read; Continue waits until config has loaded. The test now checks
  the whole second body.
- **Resend (Q4, Q6).** Going back keeps a live code; the same number goes back to it with no SMS
  (`liveChallengeFor`); a 429's `Retry-After` moves the resend deadline; only a refusal of the code empties
  the boxes. The timer test runs on a fake clock.
- **Smaller.** Touch targets of the text buttons ≥ 44 px (Q7, U4 — inline Terms/Privacy links in the
  consent sentence excepted); password rules say "(done)/(not yet)" with the field (Q8); the "password
  changed" notice describes the focused phone field (Q9); the date format as help text and the name
  placeholder from the catalogues (Q10); the min-age constant moved (Q11); Amharic `resetTitle` and
  `kycBody` corrected (U1, U3); verdict badges tinted (U5).
