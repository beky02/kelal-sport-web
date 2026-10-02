# 02 — Journeys

The PRD's journeys and the ones the SRS adds, as the player web walks them. Each step names the screen,
what the browser does, which route handler and API operation it reaches, and what can go wrong there
(the code; the message and fix are in 05-errors). "Browser → `/api/x`" always means a same-origin call
with the session cookie; the browser never calls the API itself (D3).

## J1 — First bet (PRD J1, "under 3 minutes")

| #   | Screen         | Player does                                               | Browser and server                                                                                                                                                 | Can fail with                                                                                                                                                 |
| --- | -------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Home           | Opens the site; sees today's popular matches, no login    | Server renders the board (ISR 15 s); the client polls odds every 30 s while visible (D5)                                                                           | Board error → retry; offline banner                                                                                                                           |
| 2   | Home           | Taps odds                                                 | Selection into the slip store (optimistic: fine for selecting); the slip prices it with slipcalc and the tenant rules                                              | Rules not loaded → "Can't price this slip"                                                                                                                    |
| 3   | Slip           | Taps Log in to bet                                        | The auth dialog opens over the page; the slip is untouched                                                                                                         |                                                                                                                                                               |
| 4   | Register (F4b) | Phone, age and terms consents → Continue                  | `/api/auth/otp` → `POST /v1/auth/otp` (`register`)                                                                                                                 | `REG_PHONE_TAKEN` → Log in instead; `AUTH_OTP_RATE_LIMITED`                                                                                                   |
| 5   | Code           | Types the 6 digits (or taps Resend after `resend_after`)  | Held until the next step; the API checks it there                                                                                                                  |                                                                                                                                                               |
| 6   | Details        | Name, date of birth, password → Create account            | `/api/auth/register` → `POST /v1/auth/register` (`accept_terms_version` from config); 201 sets the session cookie                                                  | `AUTH_OTP_INVALID` / `_EXPIRED` → back to the code; `REG_UNDERAGE`; `VALIDATION_FAILED` fields                                                                |
| 7   | ID (optional)  | Fayda number + consent → Verify, or Do this later         | `/api/kyc/fayda/otp` → `POST /v1/kyc/fayda/otp` → Fayda's code → `/api/kyc/fayda/verify`                                                                           | `KYC_PROVIDER_UNAVAILABLE` → later                                                                                                                            |
| 8   | Wallet (F6)    | Deposit: telebirr, amount, confirm                        | `/api/deposits` with an `Idempotency-Key` → `POST /v1/deposits`; `next_action` redirect or USSD push; the pending screen polls `GET /v1/deposits/{id}` until final | `PAY_AMOUNT_OUT_OF_RANGE`, `RG_LIMIT_REACHED`, `REAL_MONEY_DISABLED`                                                                                          |
| 9   | Slip (F5)      | Enters a stake, sees tax, bonus and potential win; Place  | `/api/bets` with an `Idempotency-Key` made at the tap and reused on retry → `POST /v1/bets`; nothing optimistic                                                    | `BET_ODDS_CHANGED` 409 → old and new odds, Accept re-places with a **new** key; `BET_STAKE_TOO_HIGH` → offer the limit; `WALLET_INSUFFICIENT_FUNDS` → Deposit |
| 10  | Placed         | Sees the ticket number with its barcode; My bets lists it | The API's figures, not the preview's; wallet and bets queries invalidated                                                                                          |                                                                                                                                                               |

## Book a slip and load it elsewhere (BKG-01…04, built in F3b)

| #   | Screen       | Player does                         | Browser and server                                                                                                   | Can fail with                                   |
| --- | ------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Slip (guest) | Book bet                            | `/api/bookings` with an `Idempotency-Key` per booking intent → `POST /v1/bookings` (selections only, no odds)        | `BET_STAKE_TOO_LOW/HIGH` → offer the stake; 429 |
| 2   | Slip         | Copies the code, shares on Telegram | The code's life is counted from the API's `Date`; it drops out of the slip when it expires                           |                                                 |
| 3   | `/b/[code]`  | Opens the link                      | Server-rendered with Open Graph; `GET /v1/bookings/{code}` re-prices every leg; started or suspended legs are marked | `BOOKING_EXPIRED` 410, not found 404            |
| 4   | `/b/[code]`  | Load into bet slip                  | Available legs enter the slip at today's price; the notice lists the ones that could not                             |                                                 |

## Log in on a new device (C01 §6, built in F4a)

| #   | Screen   | Player does                 | Browser and server                                                                                            | Can fail with                                                                 |
| --- | -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Login    | Phone + password → Log in   | `/api/auth/login` → `POST /v1/auth/login` with this browser's device id; **202** → the code step              | `AUTH_INVALID_CREDENTIALS`, `AUTH_LOCKED` (button held until a field changes) |
| 2   | Code     | Types the SMS code → Verify | The same call again with `challenge_id` and `otp`; 200 sets the cookie; `/api/me` is read; every screen flips | `AUTH_OTP_INVALID` → try again; `AUTH_OTP_EXPIRED` → Log in again             |
| 3   | Anywhere | Comes back later            | A lapsed access token is refreshed once by the route handler; the player notices nothing                      | A refused refresh → guest + "Your session has ended"                          |

## Reset a password (REG-09, F4b)

Login → Forgot password? → phone → `POST /v1/auth/otp` (`reset`) → code → new password → `POST
/v1/auth/password/reset` → back to Log in with a notice. Every session is revoked by the API.

## J3 — Withdrawal (PRD J3, F6)

| #   | Screen       | Player does                                   | Browser and server                                                                                                                                        | Can fail with                                                                                                                  |
| --- | ------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Wallet       | Withdraw                                      | The method step is locked unless `/api/me` says `can_withdraw`; an unverified ID shows Verify, any other reason a plain notice                            |                                                                                                                                |
| 2   | Wallet       | Method, payout account (saved or new), amount | `/api/withdrawals` with an `Idempotency-Key` → `POST /v1/withdrawals`; the amount is checked against the method's limits before sending, as strings (FD4) | `KYC_REQUIRED`, `PAY_ACTIVE_BONUS_WAGERING` (forfeit must be confirmed, BON-07), `PAY_AMOUNT_OUT_OF_RANGE`, `RG_SELF_EXCLUDED` |
| 3   | Wallet       | Sees the status                               | `processing` or `review` explained; the balance shows the locked amount; cancel while cancellable                                                         | `PAY_WITHDRAWAL_NOT_CANCELLABLE`                                                                                               |
| 4   | Notification | Paid or rejected with the reason              | Push, SMS and inbox (C14); the balance updates from the server, never before                                                                              |                                                                                                                                |

## Take a break or self-exclude (RG-02, RG-03, F7)

Responsible gaming → choose the break or the exclusion period → confirm (self-exclusion is irreversible
until it ends) → `POST /v1/me/self-exclusion` → the API revokes every session; the slip locks, deposits
stop, the cool-off banner shows the end date; marketing stops. Funds stay withdrawable. Because the state
is read from the server (`/v1/me` `flags.excluded_until`, the RG status query), a reload cannot end it.

## Reality check (RG-04, F7)

Every `rg.reality_check_minutes` of play the dialog shows time played and the session's staked, won and
net figures from `/v1/me/sessions` and the API, never computed in the browser; Keep playing, Take a
break or My limits.

## Log out (built in F4a)

Profile → Log out → `/api/auth/logout` → `POST /v1/auth/logout`; the cookie is cleared whatever the API
answered. Only a reply from the route handler ends the session in the browser: a request that never
arrived leaves the player signed in and says so. Everything only a player may see (wallet, bets,
transactions, break status) is dropped from the cache, so the next player on the phone never sees it.

## Switch language (FD2, F2a)

The header switch navigates to the same page under the other prefix; the stored preference follows the
URL. On a match page the player lands on the same match.
