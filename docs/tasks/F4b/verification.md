# F4b — verification

Branch `task/F4b-register-kyc`. Stack: Prism on :4010 (contract examples), `next dev` on :3000.

## Automated gate

| Check                  | Result | Command / evidence                                                                                                              |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck              | PASS   | `pnpm typecheck` (in `pnpm check`)                                                                                              |
| Lint                   | PASS   | `pnpm lint` — 0 problems                                                                                                        |
| Format                 | PASS   | `pnpm format:check` — "All matched files use Prettier code style!"                                                              |
| Unit + component tests | PASS   | `pnpm test` — 35 files, 783 tests (main: 31 files, 720 tests)                                                                   |
| Generated types        | PASS   | `pnpm api:check` — "Generated API types match contracts/openapi.yaml."                                                          |
| Contract drift         | PASS   | `node scripts/contract-sync.mjs --check` — contracts/ and docs/backend/ match the backend                                       |
| Build                  | PASS   | `pnpm build` — compiled; Node's `localStorage` ExperimentalWarning during static generation (WARN, from code that predates F4b) |
| UI screens + e2e       | PASS   | `pnpm ui` — 132 Playwright tests (33 screens × en/am × 375/1440, plus `auth.spec.ts`, `booking.spec.ts`)                        |

`pnpm verify` summary (first run, before review fixes; the run after the fixes is below):

```
 Test Files  35 passed (35)
      Tests  783 passed (783)
Generated API types match contracts/openapi.yaml.
contracts/ matches the backend.
docs/backend/ matches the backend.
✓ Compiled successfully in 2.7s
Running 132 tests using 6 workers
  132 passed (1.4m)
exit 0
```

Route handlers against Prism through the dev server (the task's Verification list):

```
$ curl -H 'Prefer: code=409' -X POST …/api/auth/otp -d '{"phone":"911234567","purpose":"register"}'
{"type":"https://api.example.et/errors/phone-taken","title":"This phone is already registered","status":409,"code":"REG_PHONE_TAKEN","request_id":"req_01J9B05"} 409
$ curl -c jar -X POST …/api/auth/register -d '{…,"dateOfBirth":"1998-04-12",…,"acceptTerms":true}'
{"player":{"id":"01J9A7R0000000000000000001","phone":"+251911234567","fullName":"Abebe Kebede","kycStatus":"unverified","language":"am"}} 201   (jar: kelal.device, kelal.session)
$ curl -b jar -H 'Prefer: example=needs_info' -X POST …/api/kyc/fayda/verify -d '{"caseId":"01J9A7T0000000000000000001","otp":"123456"}'
{"status":"needs_info","reasonCode":"NAME_MISMATCH"} 200
$ curl -b jar -X POST …/api/kyc/fayda/otp -d '{"faydaNumber":"482109375516"}'
{"caseId":"01J9A7T0000000000000000001","otpSentTo":"+2519••••567","expiresIn":300} 200
$ curl -X POST …/api/kyc/fayda/verify -d '{"caseId":"c","otp":"123456"}'          (no session)
{"type":"about:blank","title":"Your session has ended","status":401,"code":"AUTH_TOKEN_EXPIRED"} 401
$ curl -X POST …/api/auth/password/reset -d '{"challengeId":"c","otp":"551203","newPassword":"another long passphrase"}'
 204
```

(Every request carried `Content-Type: application/json` and `X-Requested-With: KelalSport`.)

## Acceptance criteria

| AC    | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1  | PASS   | `tests/e2e/auth.spec.ts` › "registers with the SMS code, is signed in, and verifies with Fayda against Prism (AC-1)" — passed against Prism (sealed httpOnly `kelal.session`, `/api/me` a player, no token marker in any `/api/*` body, `document.cookie` or `localStorage`, "Identity verified"). `tests/component/RegisterFlow.test.tsx` › "walks phone → code → details → ID → Fayda code → verified, sending each request once (AC-1)" and 4 more; `tests/unit/register-route.test.ts` (18 tests) and `auth-mappers.test.ts` (F4b block) on the contract's examples; `register-flow.test.ts` reducer tests. Screens `register-code`, `register-details`, `register-id`.                             |
| AC-2  | PASS   | `REG_PHONE_TAKEN`: curl above; `register-route.test.ts` › "passes the contract's 409 REG_PHONE_TAKEN through unchanged (AC-2)"; `RegisterFlow.test.tsx` › "REG_PHONE_TAKEN says the phone has an account, and Log in instead opens login with the phone kept (AC-2)"; screen `register-phone-taken` (Prism `Prefer: code=409`). `AUTH_OTP_INVALID`: `RegisterFlow.test.tsx` › "AUTH_OTP_INVALID at Create account returns to the code step, cleared, with the message; the details are kept (AC-2)"; screen `register-code-invalid` (this app's route fulfilled in the browser with the contract's Problem shape). Contract request `docs/contract-requests/006-auth-kyc-error-examples.md` (proposed). |
| AC-9  | PASS   | `tests/component/ResetFlow.test.tsx` › "resets by SMS code and ends at log in with the phone kept and a notice (AC-9)" and 4 more; `register-route.test.ts` › "sends the contract's request, answers 204 and signs nobody in (AC-9)"; curl above; screens `reset-code`, `reset-done`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| AC-10 | PASS   | Screens `verify-verified`, `verify-pending`, `verify-needs-info` (Prism `Prefer: example=…` on `/api/kyc/fayda/verify`, reached through registration), en/am × 375/1440; `register-route.test.ts` › "verifies with Fayda's code and answers each verdict the contract names (AC-10)"; `RegisterFlow.test.tsx` › pending, needs_info, rejected.                                                                                                                                                                                                                                                                                                                                                          |

## Review findings

One round. Verdicts: **spec-verifier PASS** (all four ACs met; re-ran the AC-1 e2e test, the 44 F4b
screens and the curls), **security-reviewer PASS**. **quality-reviewer** and **ui-checker** stalled
(no progress for 600 s) before reporting and were not re-run, at the user's request to finalise — see
Gaps. No BLOCKER or MAJOR findings were reported.

| ID   | Reviewer | Severity | Summary                                                                                                                                                             | Decision                                                                                                                                                                                 |
| ---- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC1 | security | MINOR    | Auth mutations keep their variables (password, codes, DOB, Fayda number) in the TanStack mutation cache for the default 5 min after the dialog closes               | Fixed: `gcTime: 0` on every auth mutation, login included; test in `RegisterFlow.test.tsx` (fails without the fix)                                                                       |
| SEC2 | security | MINOR    | `/api/auth/otp` reads no device cookie, though the plan said it would; the SMS route has no per-client identity                                                     | Fixed the cookie (route test "reads or mints this browser's device cookie…"). Forwarding IP/device stays contract request 004's job; `Auth` stays refused on the real API until then     |
| SEC3 | security | MINOR    | The consent records the terms version current at Create account, not the one current when the box was ticked                                                        | Follow-up: needs `legal.terms_version` in `/api/config`'s view (F1's) so the phone step can send what it showed and the handler can refuse a stale one. Plan decision 3 stands meanwhile |
| SEC4 | security | MINOR    | Registering while signed in replaces the cookie without revoking the previous session                                                                               | Fixed for register (route tests "revokes the session the browser had…", "keeps the session it had when the registration is refused"). Login (F4a) has the same gap — follow-up           |
| S1   | spec     | MINOR    | The route's `^[A-Za-z0-9]{12,16}$` is called "the contract's bounds"; the contract sets length only                                                                 | Plan decision 5 reworded: the character rule is this app's own                                                                                                                           |
| S2   | spec     | MINOR    | The ID step's existing copy claims "Ethiopian law requires…", "about 2 minutes" and "You can deposit and bet now" — no source makes those claims (C02 §2 TBD-1, §9) | Follow-up for the user: money copy is the product's to decide (CLAUDE.md); F4b did not write it                                                                                          |
| S3   | spec     | MINOR    | Diff ~5,800 lines vs the ~1,900 estimated                                                                                                                           | Plan decision 18 updated with the actual size and why; not split                                                                                                                         |
| S4   | spec     | MINOR    | Plan says `/api/auth/otp` mints the device cookie; it did not                                                                                                       | Fixed with SEC2                                                                                                                                                                          |
| S5   | spec     | MINOR    | `verification.md` missing; error-view tests not in `auth-flow.test.ts` as listed                                                                                    | This file; plan notes where the tests live                                                                                                                                               |
| S6   | spec     | MINOR    | `auth.passwordTitle`, `auth.required` unused                                                                                                                        | Removed from both catalogues and the notes                                                                                                                                               |
| S7   | spec     | MINOR    | `.claude/launch.json` (local preview config) untracked in the tree                                                                                                  | Not committed                                                                                                                                                                            |

## Gaps

- Prism has no example of `AUTH_OTP_INVALID`, `AUTH_OTP_EXPIRED`, `AUTH_OTP_RATE_LIMITED`,
  `AUTH_OTP_UNAVAILABLE`, `REG_UNDERAGE`, `REG_ID_TAKEN` or `KYC_PROVIDER_UNAVAILABLE`; they are proven by
  component tests in the contract's `Problem` shape, not against the mock. Contract request 006.
- `REG_ID_TAKEN` and a `503` from `/v1/kyc/fayda/verify` are not in the contract for the operations F4b
  calls; the UI handles them by code if they arrive.
- `Auth` stays refused on the real API until contract request 004 lands (F4a), so nothing here has run
  against the FastAPI backend.
- **No quality or UI-checker report.** Both reviewers stalled before reporting. Partly covered: the
  automated screen checks (no console errors, no sideways scroll, no raw keys or `{placeholders}`) passed
  on all 132 runs; the spec reviewer and the author looked at the F4b PNGs (`register-*`, `verify-*`,
  `reset-*`, en/am, 375/1440) and found nothing wrong. Not covered: an independent pass on layering,
  React effects, accessibility details and test quality, and a review of the unchanged login screens
  after the move into `LoginFlow` (their tests and screens pass). Worth running before merging if time
  allows.
- Following a Terms or Privacy link from the consent row navigates away and the dialog reopens at the
  phone step with nothing kept (already so before F4b; found while writing the e2e test). Follow-up:
  open them without leaving the flow.
