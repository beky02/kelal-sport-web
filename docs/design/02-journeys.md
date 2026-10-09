# 02 — Journeys

The PRD's journeys and the ones the SRS adds, as the player web walks them. Each step names the screen,
what the browser does, which route handler and API operation it reaches, and what can go wrong there
(the code; the message and fix are in 05-errors). "Browser → `/api/x`" always means a same-origin call
with the session cookie; the browser never calls the API itself (D3).

## J1 — First bet (PRD J1, "under 3 minutes")

| #   | Screen        | Player does                                                                                | Browser and server                                                                                                                                                                                                                                                                                                                                               | Can fail with                                                                                                                                                                                             |
| --- | ------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Home          | Opens the site; sees today's popular matches, no login                                     | Server renders the board (ISR 15 s); the client polls odds every 30 s while visible (D5)                                                                                                                                                                                                                                                                         | Board error → retry; offline banner                                                                                                                                                                       |
| 2   | Home          | Taps odds                                                                                  | Selection into the slip store (optimistic: fine for selecting); the slip prices it with slipcalc and the tenant rules                                                                                                                                                                                                                                            | Rules not loaded → "Can't price this slip"                                                                                                                                                                |
| 3   | Slip          | Taps Log in to bet                                                                         | The auth dialog opens over the page; the slip is untouched                                                                                                                                                                                                                                                                                                       |                                                                                                                                                                                                           |
| 4   | Register      | Phone, age and terms consents → Continue                                                   | `/api/auth/otp` → `POST /v1/auth/otp` (`register`)                                                                                                                                                                                                                                                                                                               | `REG_PHONE_TAKEN` → Log in instead; `AUTH_OTP_RATE_LIMITED`                                                                                                                                               |
| 5   | Code          | Types the 6 digits → Continue (or Resend after `resend_after`)                             | Held until the next step; the API checks it there                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                           |
| 6   | Details       | Name, date of birth, password → Create account                                             | `/api/auth/register` → `POST /v1/auth/register` (`accept_terms_version` from config); 201 sets the session cookie                                                                                                                                                                                                                                                | `AUTH_OTP_INVALID` / `_EXPIRED` → back to the code; `REG_UNDERAGE`; `VALIDATION_FAILED` fields                                                                                                            |
| 7   | ID (optional) | Fayda number + consent → Verify, or Do this later                                          | `/api/kyc/fayda/otp` → `POST /v1/kyc/fayda/otp` → Fayda's code → `/api/kyc/fayda/verify`; `/api/me` read again                                                                                                                                                                                                                                                   | `KYC_PROVIDER_UNAVAILABLE` → later; `needs_info` → the reason, Try again or later                                                                                                                         |
| 8   | Wallet (F6b)  | Deposit: a method from `/v1/payment-methods`, an amount within its limits, Confirm and pay | `/api/deposits` with one `Idempotency-Key` per intent → `POST /v1/deposits` (`return_url` set by the server); `next_action`: an allow-listed provider page (followed at once; the return resumes the deposit) or a push to approve on the phone; the status screen polls `/api/deposits/{id}` every 3 s until final, then the balance and history are read again | `PAY_METHOD_UNAVAILABLE`, `PAY_AMOUNT_OUT_OF_RANGE` (Deposit {limit}), `PAY_PROVIDER_ERROR`, `RG_LIMIT_REACHED`, `RG_COOLING_OFF`, `KYC_REQUIRED`, `REAL_MONEY_DISABLED`; no answer → Try again, same key |
| 9   | Slip (F5a)    | Enters a stake, sees tax, bonus and potential win; Place                                   | `/api/bets` with one `Idempotency-Key` per request, sent again only with the same request after no answer → `POST /v1/bets`; nothing optimistic                                                                                                                                                                                                                  | `BET_ODDS_CHANGED` 409 → old and new odds, Accept re-places with a **new** key; `BET_STAKE_TOO_HIGH` → offer the limit; `WALLET_INSUFFICIENT_FUNDS` → Deposit; no answer → Try again, same key            |
| 10  | Placed (F5a)  | Sees the ticket number with its barcode; My bets lists it (F5b)                            | The API's figures, not the preview's; wallet and bets queries invalidated                                                                                                                                                                                                                                                                                        |                                                                                                                                                                                                           |

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

## Reset a password (REG-09, built in F4b)

Login → Forgot password? (the typed phone comes along) → `/api/auth/otp` → `POST /v1/auth/otp` (`reset`;
the same answer whether or not the phone has an account) → code → new password → `/api/auth/password/reset`
→ `POST /v1/auth/password/reset` (the code is checked here: a wrong one goes back to the code step) →
back to Log in with the phone kept and a notice. Every session of that account is revoked by the API.

## J3 — Withdrawal (PRD J3, built in F6c)

| #   | Screen       | Player does                                    | Browser and server                                                                                                                                                                                                                                                                                                              | Can fail with                                                                                                                                                                                                                                                                       |
| --- | ------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Wallet       | Withdraw                                       | The method step offers the methods with a `withdrawal` range and is locked unless `/api/me` says `can_withdraw`; an unverified ID shows Verify, any other reason a plain notice                                                                                                                                                 |                                                                                                                                                                                                                                                                                     |
| 2   | Wallet       | Method, then a saved account or another number | `/api/payout-accounts` → `GET /v1/me/payout-accounts`, filtered to the method. Save number → `POST` (`provider`, `account_ref`); Remove → `DELETE …/{id}` after the player confirms. A number left unsaved goes with the withdrawal as `account`, which the API saves                                                           | Save: the API's title (a 409 when it is already saved; the list is read again). Remove: a 404 counts as removed                                                                                                                                                                     |
| 3   | Wallet       | Amount, confirm                                | The amount checked against the method's `withdrawal` limits and the cash balance as strings (FD4); `/api/withdrawals` with one `Idempotency-Key` per intent → `POST /v1/withdrawals` (`payout_account_id` or `account`). No answer (a 502 included) → Try again with the same key, after `/api/me`                              | `KYC_REQUIRED` (Verify), `PAY_ACTIVE_BONUS_WAGERING` (Keep wagering; Confirm forfeit waits for contract request 008, BON-07), `PAY_AMOUNT_OUT_OF_RANGE`, `WALLET_INSUFFICIENT_FUNDS`, `RG_SELF_EXCLUDED` / `RG_COOLING_OFF` (Help), `REAL_MONEY_DISABLED`, `PAY_METHOD_UNAVAILABLE` |
| 4   | Wallet       | Sees the status                                | A 201 re-reads the balance and history (cash → pending withdrawals) and the status screen follows `/api/withdrawals/{id}` — every 10 s while it moves on its own, every minute in review, while open; any status change re-reads the balance and history. Cancel while `requested` or `review` → `DELETE /api/withdrawals/{id}` | `PAY_WITHDRAWAL_NOT_CANCELLABLE` (the status is read again: too late to cancel)                                                                                                                                                                                                     |
| 5   | Transactions | Finds it again                                 | The withdrawal's row (out, or back again) opens `/wallet?withdrawal={id}`                                                                                                                                                                                                                                                       | 404: "We couldn't find this withdrawal"                                                                                                                                                                                                                                             |
| 6   | Notification | Paid or rejected with the reason               | Push, SMS and inbox (C14); the balance updates from the server, never before                                                                                                                                                                                                                                                    |                                                                                                                                                                                                                                                                                     |

## Set a limit (RG-01, built in F7a)

Responsible gaming → a card (Deposit, Stake, Loss, Time limit) → Daily, Weekly or Monthly → New limit →
Save limit → `/api/me/limits` (`PUT`, CSRF, a strict 4 KiB body: a contract type and period with an
amount above 0.00 or whole minutes from 1) → `PUT /v1/me/limits`. The answer says what the API did: in
force at once ("Saved. Your limit is now {amount}"), or held back until its `pending.effective_from`
("Saved. Your new limit of {amount} starts on {date}") — the browser never decides which. The limits are
read again (the wallet's card shares them), and again on focus, after a bet, a completed deposit or an RG
refusal. Can fail with: a 422 → "Your limit wasn't saved" and the API's title and `detail`; no answer →
"We couldn't save your limit" (saving again sends the same value); 401 → the session-ended path.

## Redeem a promo code (BON-04, built in F7ca)

Promotions (nav, or Menu on a phone) → Promo code → types it → Redeem → `/api/promo-codes/redeem`
(`POST`, CSRF, a UUID `Idempotency-Key`, a strict 4 KiB body: `{ code }` of 1–32 characters) →
`POST /v1/promo-codes/redeem`. The key is made when Redeem is pressed and belongs to that code for that
player: while the try has no answer (network, 30 s, a 5xx, a 429) Try again — or Redeem with the same code
— sends the same key, after `/api/me` says it is still that player; another code, another player or any
answer starts a new key. Kept in memory across pages, not a reload (the API's one-per-player rule answers a
repeat). The answer is the API's: `granted` or `pending_deposit` (with Deposit), its message shown when it
sends one; the bonus, the wallet and the history are then read again — nothing is added in the browser.
Can fail with: `PROMO_INVALID` / `NOT_FOUND` (change the code), `PROMO_ALREADY_USED`, `VALIDATION_FAILED`,
`KYC_REQUIRED` (Verify), `RG_*` (the API's title; `/api/me` and the limits read again); 401 → the
session-ended path.

## Take a break or self-exclude (RG-02, RG-03, built in F7a)

Responsible gaming → choose the break (24 h, 7 d, 30 d) or the exclusion (6 m, 1 y, 5 y, permanent) →
the question, once, in full sentences (it can't be ended early; open bets settle as normal) → Confirm,
which sends one request however quickly it is pressed → `/api/me/self-exclusion` → `POST
/v1/me/self-exclusion`. The API revokes every session as it answers: the route handler clears the
session cookie with the 201, the browser notes a logout (no "session ended" dialog), sets the session to
a guest and drops everything only a player may see, and the page says the break started and when it ends
(the API's `ends_at`, with its year). Funds stay withdrawable (RG-02); marketing stops (C14).

Nothing about the break is kept in the browser. After a reload the player is a guest; logging in again
(RG-02 allows it, to withdraw), `/api/me` reports the break (`flags.excluded_until`, or `status:
self_excluded` with no date for a permanent one) and every screen follows: the banner with the end, the
odds locked, the slip's Betting paused, the wallet's Deposit off and the deposit flow paused. No clock in
the browser ends it: the API does. Can fail with: a refusal → "Your break didn't start" and the API's
title (the session stays); no answer → "We couldn't confirm your break — It may have started. If it did,
you'll be signed out." with Try again (a second request after a first that went through finds the
session revoked: 401); 401 → the session-ended path.

## Reality check (RG-04, F7)

Built in F7b. Every `Me.flags.reality_check_minutes` of play (the account's interval, read with `/api/me`;
`null` means none, and the browser invents no interval) a dialog opens over whatever page the player is on
and says how long they have been playing. Keep playing, Take a break and View my limits each answer it, and
the next check comes one interval later. Take a break and View my limits open Responsible gaming, where a
break is asked for with its length. Clicking away doesn't close it, and it waits while another dialog is
up. The play session is this tab's visit, from when it first showed the signed-in player, kept in
`sessionStorage` so a reload neither restarts it nor skips a check that came due. Another player, or
signing out, ends it. The session's staked, won and net figures come from the API and are never computed
in the browser. The contract has none yet (contract request 012), so the dialog shows no money until F7e,
which also moves the timing to the API's play session.

## Log out (built in F4a)

Profile → Log out → `/api/auth/logout` → `POST /v1/auth/logout`; the cookie is cleared whatever the API
answered. Only a reply from the route handler ends the session in the browser: a request that never
arrived leaves the player signed in and says so. Everything only a player may see (wallet, bets,
transactions, break status) is dropped from the cache, so the next player on the phone never sees it.

## Switch language (FD2, F2a)

The header switch navigates to the same page under the other prefix; the stored preference follows the
URL. On a match page the player lands on the same match.
