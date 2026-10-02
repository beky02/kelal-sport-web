# 03 — Session and account

Built in F4a (`docs/tasks/F4/plan.md` has the decisions and their reasons); registration, reset and KYC
follow in F4b. The rule above every detail here: **the browser never holds a token and never decides who
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
handler reads the session itself and the API checks every token (C18 §4.4, CVE-2025-29927).

## Caches and identity

Everything only a player may see — wallet, bets, transactions, the break status — is removed from the
query cache whenever the session changes hands: on logout, on a successful login before `/api/me` is
read, and when the watcher sees a player become a guest. However fresh the cache, the next player never
sees the previous one's balance.

## Session ended

When a player becomes a guest without having logged out, the session-ended dialog says so once over
whatever page they are on ("Your session has ended. Log in again to continue. Your bet slip is saved."),
with Log in again or Keep browsing. The slip underneath is untouched. The copy makes no claim about
why — the API decides session validity (expiry, rotation reuse, self-exclusion, password reset).

## Registration (F4b; C01 §8)

Phone (+ the age and terms consents, recorded with `accept_terms_version` from the tenant's
`legal.terms_version`) → SMS code → full name, date of birth, password → account created (the session
cookie is set) → Fayda ID → done. The contract needs the name and date of birth to create the account,
so they come before the ID step. The code is checked by the API on the step after it, so a wrong or
expired code sends the player back to the code step with the message and the fix (re-enter, or a new
code after `resend_after`). A deposit limit at sign-up (PRD J1 step 3, G9) is offered where the design
has it; F4b records the decision.

## KYC states (KYC-01, C02)

| `kyc_status`          | Profile badge   | Wallet                                                                                             | Where it changes                                  |
| --------------------- | --------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `unverified`          | ID not verified | Withdraw locked: "Verify your Fayda ID to unlock withdrawals" + Verify                             | The ID step (F4b), from the profile or the wallet |
| `pending`             | ID pending      | Locked; "Verification in progress… we'll SMS you"                                                  | Manual review by the operator                     |
| `verified`            | ID verified     | Unlocked, unless the API says `can_withdraw: false` for another reason (a plain notice, no Verify) | —                                                 |
| `needs_info`          | ID not verified | Locked; the reason (name or date of birth mismatch…) and Verify again                              | Fayda result or review                            |
| `rejected`, `expired` | ID not verified | Locked; support                                                                                    | Operator                                          |

Withdrawability is the API's call (`Me.can_withdraw`); the browser infers nothing from the KYC status.
Verification is needed before a withdrawal, not before a bet (C02 §2); the ID step says exactly that.

## Profile data

Name, phone (masked in the identity row, full under Personal info) and date of birth come from
`/v1/me`; they are shown, not edited. Language and marketing consent change through `PATCH /v1/me`
(F7). Active devices (`/v1/me/sessions`, REG-10) are F7.

## Open items

- Contract request 004 (`X-Client-IP`, `X-Client-Device`): until it lands, `Auth` and `Bookings` must
  not move to the real API; the route handlers already read the player's address behind
  `TRUSTED_PROXY_HOPS`.
- Refresh deduplication is per process: one replica, or sticky `/api/*`, until it moves to Redis or the
  backend adds a reuse grace window.
- The API's `detail` on a lock-out must follow `Accept-Language`; it is shown as its own line.
