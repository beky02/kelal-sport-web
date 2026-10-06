# 03 — Session and account

Built in F4a (`docs/tasks/F4/plan.md` has the decisions and their reasons); registration, reset and
Fayda verification in F4b (`docs/tasks/F4b/plan.md`). The rule above every detail here: **the browser never holds a token and never decides who
is signed in**. It carries an opaque cookie it cannot read, and asks `/api/me`.

## The session

| Piece            | What                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cookie           | `kelal.session` (`__Host-kelal.session` in production): the API's access and refresh tokens, the access expiry and the tenant, sealed with AES-256-GCM under an HKDF key from `SESSION_SECRET`; httpOnly, SameSite=Lax, Path=/, Secure (always in production, behind a trusted HTTPS edge otherwise), 30 days (C01 §9's refresh lifetime). |
| Device cookie    | `kelal.device`: a random id minted by the route handler on the first login attempt, httpOnly, one year. It is the contract's `device.fingerprint` and, once contract request 004 lands, `X-Client-Device`.                                                                                                                                 |
| Who is signed in | `GET /api/me` → `{ player }` or `{ player: null }`. Read on every page load and when the tab comes back (60 s cache). A guest is a state, not an error.                                                                                                                                                                                    |
| Refresh          | A route handler calling the API for a player refreshes a lapsed access token before the call and retries a `401 AUTH_TOKEN_EXPIRED` once; the rotated cookie goes out on that answer. Parallel requests share one refresh (C01 §8 revokes the family on reuse). A refused refresh clears the cookie: the player is a guest and is told.    |
| Logout           | `POST /api/auth/logout`: revoked at the API when it can be, cleared here always. In the browser, only the route handler's answer ends the session.                                                                                                                                                                                         |
| Secret rotation  | `SESSION_SECRET_PREVIOUS` opens cookies sealed before a rotation; new cookies always use the current secret.                                                                                                                                                                                                                               |

## Login (C01 §6)

Phone (nine digits typed, sent as `+251…`) and password to `POST /api/auth/login`. The answer is the
player summary (never a token) or `otp_required` with the challenge when the API wants the new-device
code (202). The second call carries the challenge and the code. On success the dialog reads `/api/me`
before it closes, so the header, slip, nav and profile flip together; if that read fails the login still
stands (the cookie is set) and the next read catches up.

Refusals by `code`, never by title (05-errors): wrong password, lock-out (the API's `detail` says how
long; the button waits for a change), wrong or expired code, rate limit. Unknown codes show the API's
translated title.

`/login?next=/wallet` returns the player to the wallet after login; `next` is honoured only when it is a
path on this site.

## Guest, pending, player

`useSession()` gives every component `isLoading`, `isGuest`, `player`, `kycVerified`, `canWithdraw`.
While `/api/me` is pending nobody is a guest and nothing is placeable: the header shows a labelled
placeholder, the slip's button waits, My bets does not send a player to log in. Once answered:

| State  | Header                         | Slip                    | My bets / Wallet / Transactions                               | Profile                                         |
| ------ | ------------------------------ | ----------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| Guest  | Log in, Register               | Log in to bet; Book bet | Open the login (nav) / redirected by the proxy (direct visit) | Log in / Register, preferences, support         |
| Player | Balance chip, Deposit, profile | Place; balance check    | The player's own data                                         | Identity, Personal info, notifications, Log out |

The proxy (`src/proxy.ts`) only redirects a visitor with no session cookie away from `/my-bets`,
`/wallet` and `/transactions` to `/login?next=…`; it opens nothing and decides nothing. Every route
handler reads the session itself and the API checks every token (C18 §4.4, CVE-2025-29927). Its one
other job is public: `/t/{x}` with no ticket number in it gets a 404 rendered whole (08-performance,
"Without JavaScript"). Since F8a it also keeps each host to its own site (09-security, "The host split"):
a shop terminal's host has no login, no account pages and no `/api/me`.

## Caches and identity

Everything only a player may see — wallet, bets, transactions, payments, limits, devices — is removed from the
query cache whenever the session changes hands: on logout, on a successful login before `/api/me` is
read, after a break or self-exclusion is started (F7a), and when the watcher sees a player become a guest.
However fresh the cache, the next player never sees the previous one's balance. Whether a break is in
force is `/api/me`'s own answer (`flags.excluded_until`, `status`), read with who is signed in.

## Session ended

When a player becomes a guest without having logged out, the session-ended dialog says so once over
whatever page they are on ("Your session has ended. Log in again to continue. Your bet slip is saved."),
with Log in again or Keep browsing. The slip underneath is untouched. The copy makes no claim about
why — the API decides session validity (expiry, rotation reuse, self-exclusion, password reset). A break
or self-exclusion started on this device counts as a logout (F7a): the player just asked for it, and the
page says the break started instead.

## The auth dialog

One dialog, three flows: **log in**, **register** (and **verify**, its ID step alone), **reset**. The
auth store says which flow is open (`login`, `register`, `verify`, `forgot`) and hands the phone, and a
notice, from one flow to the next; each flow keeps its own place and what the player typed in a pure
reducer (`lib/flow.ts`, `register-flow.ts`, `reset-flow.ts`), gone when the dialog closes. Passwords,
codes, the Fayda number and the date of birth never reach the URL, storage or a log.

## Registration (F4b; C01 §8)

| Step    | Player gives                                                                | Call                                                                                          |
| ------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Phone   | Nine digits; the age box and the terms box                                  | `POST /api/auth/otp` (`register`) → `/v1/auth/otp`                                            |
| Code    | Six digits — held, not checked                                              | none; Resend after the challenge's `resend_after` (counted to a fixed deadline)               |
| Details | Full name and date of birth as on the ID; a password typed twice            | `POST /api/auth/register` → `/v1/auth/register`; 201 sets the session cookie, as a login does |
| ID      | Fayda number (FIN, 12 digits) and the consent to share it, or Do this later | `POST /api/kyc/fayda/otp` → Fayda texts the ID holder's phone                                 |
| Code    | Fayda's six digits                                                          | `POST /api/kyc/fayda/verify` → the verdict                                                    |

- **The code is checked with the details.** A wrong code sends the player back to the code step, boxes
  empty, with the message; the details stay filled. An expired one offers Send a new code.
- **The consent is to the terms on screen.** The phone step states the tenant's `legal.min_age` and
  records the `legal.terms_version` shown when the boxes were ticked; Create account sends it back. If
  the tenant has published other terms since, the route handler creates nothing and answers
  `VALIDATION_FAILED` on `accept_terms_version` with the current version: the player is back on the
  consents, unticked, with "Our terms were updated. Please read and accept them again." Ticking them
  again returns to the details — the code already sent still stands, so no second SMS. The version sent
  to the API is always the server's own. No terms version configured → no registration (503).
- **Terms and Privacy open in a new tab** from the consent row, so the flow (and the box) stay as they
  were.
- **What is asked, and what is not.** The name and date of birth are what Fayda is matched against, so
  the step asks for them as they are on the ID. The date is typed `DD/MM/YYYY` (Gregorian, D7) and sent as
  `YYYY-MM-DD`; only "is it a real date" is checked here — whether the player is old enough is the API's
  (`REG_UNDERAGE`). The password needs 8 characters and a match, no composition rules (C01 §2, REG-06);
  a breached one comes back from the API on the field. The UI language is the account's language;
  marketing consent is not asked (the contract's default, `false`). No national ID at registration — the
  ID goes to Fayda once the account exists. No deposit limit or promo code at sign-up (no design; F7
  owns limits).
- **Signed in from Create account on.** A session this browser already had is revoked at the API (as on
  login); the previous player's caches go and `/api/me` is read, as after a login. From the ID step there is no going back; closing the dialog leaves the player signed in.

## Fayda verification (F4b; C02 §8)

The ID step from registration, or alone (`verify`) from the profile's and the wallet's Verify — then with
no progress bar and Done instead of Start betting. Both calls need the session; without one the route
handler answers `401 AUTH_TOKEN_EXPIRED` and the dialog offers Log in again. Fayda's code step has no
timed resend (the challenge has no `resend_after`); an expired code offers Send a new code, which starts
again with the same number. After the verdict `/api/me` is read again, so the profile's badge and the
wallet's lock follow.

| Verdict      | Screen                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------- |
| `verified`   | Identity verified — "Your Fayda ID matches your account." No promise about withdrawals.  |
| `pending`    | Verification in progress — "We're reviewing your ID. We'll let you know when it's done." |
| `needs_info` | We couldn't match your details — the reason (`reason_code`); Try again, Do this later    |
| `rejected`   | We couldn't verify your ID — "Contact support from your profile and we'll help."         |

`KYC_PROVIDER_UNAVAILABLE` offers Do this later. Manual document upload (C02 §10's fallback) is not built
yet.

## Password reset (F4b; REG-09)

Log in → Forgot password? (the phone typed there comes along) → `POST /api/auth/otp` (`reset`) → code →
new password typed twice → `POST /api/auth/password/reset` → back to Log in with the phone kept and
"Password changed. Log in with your new password." The code step never says whether the phone has an
account ("If {phone} has an account, we've sent it a code.", C01 §10). The API revokes every session of
that account; this browser's cookie is left alone — it may belong to someone else.

## KYC states (KYC-01, C02)

| `kyc_status`          | Profile badge   | Wallet                                                                                             | Where it changes                            |
| --------------------- | --------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `unverified`          | ID not verified | Withdraw locked: "Verify your Fayda ID to unlock withdrawals" + Verify                             | The ID step, from the profile or the wallet |
| `pending`             | ID pending      | Locked; "Verification in progress… we'll SMS you"                                                  | Manual review by the operator               |
| `verified`            | ID verified     | Unlocked, unless the API says `can_withdraw: false` for another reason (a plain notice, no Verify) | —                                           |
| `needs_info`          | ID not verified | Locked; the reason (name or date of birth mismatch…) and Verify again                              | Fayda result or review                      |
| `rejected`, `expired` | ID not verified | Locked; support                                                                                    | Operator                                    |

Withdrawability is the API's call (`Me.can_withdraw`); the browser infers nothing from the KYC status.
Verification is needed before a withdrawal, not before a bet (C02 §2); the ID step says exactly that.

## Profile data

Name, phone (masked in the identity row, full under Personal info) and date of birth come from
`/v1/me`; they are shown, not edited.

Language and marketing consent are the account's (F7b), through `PATCH /api/me` → `PATCH /v1/me`. Only
the changed field is sent, and the API's answer (`Me`) becomes `/api/me`'s entry, so what is shown is
what the API kept, never what was asked. Offers (the marketing consent) waits for that answer. The
language changes the page at once (it is how this device reads) and is saved on the account for a signed-in
player from any switch (header, profile, age gate); a guest's stays on the device. **Logging in takes the
account's language** (registration doesn't: it sent the one just chosen), so a player reads their choice
on another device. While the page's language and the account's differ (a failed save, or a change on
another device), Profile says "Not saved to your account" with Save. When F2a puts the language in the URL
(FD2), the switch navigates and this save rides along.

Devices signed in (REG-10, F7b) come from `/api/me/sessions` → `GET /v1/me/sessions`: this device marked
(Log out is how it leaves), Sign out on each other one (`DELETE /api/me/sessions/{id}`; the id is checked
before it goes upstream). A row leaves only once the API has answered and the list has been read again; a
404 means it was gone already. The list (IPs included) sits under `accountKeys`, dropped with the other
personal data when the session changes hands.

## Open items

- Contract request 004 (`X-Client-IP`, `X-Client-Device`): until it lands, `Auth` and `Bookings` must
  not move to the real API; the route handlers already read the player's address behind
  `TRUSTED_PROXY_HOPS`.
- Refresh deduplication is per process: one replica, or sticky `/api/*`, until it moves to Redis or the
  backend adds a reuse grace window.
- The API's `detail` on a lock-out must follow `Accept-Language`; it is shown as its own line.
