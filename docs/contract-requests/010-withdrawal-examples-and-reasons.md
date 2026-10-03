---
status: proposed
requested_by: F6c
---

# Withdrawals: an example for every status and refusal; the review reasons as codes; a code for an account already saved; the kind of account a method pays to; self-exclusion and the 502

## Why the web app needs it

F6c moved withdrawals onto the contract: payout accounts (`GET`/`POST /v1/me/payout-accounts`,
`DELETE …/{id}`), `POST /v1/withdrawals` with an `Idempotency-Key`, then `GET /v1/withdrawals/{id}` while
its screen is open, and `DELETE /v1/withdrawals/{id}` to cancel while `requested` or in `review`. Seven
things are missing or undefined.

1. **Examples for the states and refusals the screens handle.** `POST /v1/withdrawals` has `processing`
   and `review`; `GET /v1/withdrawals/{id}` has `paid`. There is no `requested`, `approved`, `failed`,
   `rejected` (with `rejection_reason`) or `cancelled` withdrawal. `DELETE /v1/withdrawals/{id}` has no
   200 example at all, so Prism invents one from the schema (`"id": "string"`, `"status": "requested"`):
   a cancel that answers "requested". Its 409 is the shared `Conflict`, whose example is
   `REG_PHONE_TAKEN`, not `PAY_WITHDRAWAL_NOT_CANCELLABLE`. None of the refusals the withdrawal screen
   answers has an example on this operation: `PAY_AMOUNT_OUT_OF_RANGE` (which limit `errors[].limit`
   carries, and for which field), `RG_SELF_EXCLUDED`, `PAY_METHOD_UNAVAILABLE` (and
   `PAY_ACTIVE_BONUS_WAGERING`, already asked in request 008). The web answers them in the browser for its
   screens and tests, with shapes it had to guess.
2. **`review_reason` is a free string.** Its only example is the code `FIRST_WITHDRAWAL`. C04's rules
   chain and C12's `withdrawal_verdict` put a withdrawal in review for reasons that include AML holds
   (`LOW_PLAY_CASHOUT`, `NEW_PAYOUT_ACCOUNT`, `WATCHLIST_HIT`…), which a player should not be told about.
   The web puts `FIRST_WITHDRAWAL` in words and shows no reason for anything else — never a raw code — but
   it can't know which codes exist, or which are meant for the player.
3. **`rejection_reason`.** WDR-06 makes it finance's mandatory note, and the PRD's J3 shows it to the
   player ("rejected with reason"). The contract doesn't say whether it is written for the player, or in
   which language (the request's `Accept-Language`, or as typed). The web shows it as sent, as its own
   line.
4. **No code for an account already saved.** `POST /v1/me/payout-accounts` can answer 409 (`uq_payout`
   in C04 §5), but `ErrorCode` has no value for it, so the web can only show the API's title. It lists no
   422 either, for an `account_ref` the provider can't pay to.
5. **What kind of account a method pays to.** `PayoutAccountCreate.account_ref` and
   `WithdrawalRequest.account` are "wallet phone or bank account number", but nothing on `PaymentMethod`
   says which a method takes. The web asks for a mobile number for every method with a `withdrawal`
   range (the launch methods are mobile money, PRD J3) and its route handlers send only the contract's
   `Phone`. A method that pays to a bank account would need the contract to say so.
6. **Self-exclusion and withdrawals.** C04's rules chain has `NotExcluded` and WDR-04 says "not
   self-excluded", but RG-02 says a self-excluded player's "remaining funds can be withdrawn" and C12
   says "funds withdrawable". The web shows `RG_SELF_EXCLUDED` (or `RG_COOLING_OFF`) on a withdrawal as
   the API's refusal with Help, and never calls withdrawals paused. The backend should settle
   which rule applies and list the 403 codes this operation can return.
7. **A 502 on `POST /v1/withdrawals`.** None is listed. The web treats any 5xx but `REAL_MONEY_DISABLED`
   — a 502 included — as no answer, and Try again sends the same request with the same key, so a
   dropped answer can never become a second withdrawal. That is safe only if the API stores the key
   before it calls the provider (as C04 §10 suggests: "never re-send blindly"). The contract should say
   so, or list the 502 with what it means for the key.

## Proposed change

Additive throughout: new named examples (the first of each response stays its default, so Prism
without `Prefer: example=` behaves as today), one optional enum on an existing field, one new
`ErrorCode` value, one optional property. Ids, amounts and the masked account match the existing
withdrawal examples.

```yaml
# contracts/src/03_components.yaml → components.schemas
ErrorCode:
  enum:
    # … existing values …
    - PAY_PAYOUT_ACCOUNT_EXISTS

Withdrawal:
  properties:
    review_reason:
      description: >-
        Why the withdrawal is being reviewed, for the player. Holds the player must not be told about
        (AML) are sent as OTHER.
      type: [string, "null"]
      enum: [FIRST_WITHDRAWAL, LARGE_AMOUNT, OTHER, null]
    rejection_reason:
      description: >-
        Finance's note on why it was rejected (WDR-06), written for the player, in the request's
        language.
      type: [string, "null"]

PaymentMethod:
  properties:
    withdrawal_account:
      description: What a withdrawal through this method is paid to. Absent when it can't pay out.
      type: string
      enum: [phone, bank_account]
```

```yaml
# contracts/src/01_head_player.yaml → paths./v1/withdrawals/{id}.get.responses.200
content:
  application/json:
    schema:
      $ref: "#/components/schemas/Withdrawal"
    examples:
      paid: # the current example, kept first
        value:
          id: 01J9A7Y0000000000000000001
          method: telebirr
          amount: "2000.00"
          currency: ETB
          status: paid
          account_masked: +2519••••567
          review_reason: null
          created_at: "2026-10-04T09:00:00Z"
          paid_at: "2026-10-04T09:04:12Z"
      requested:
        value:
          id: 01J9A7Y0000000000000000003
          method: telebirr
          amount: "2000.00"
          currency: ETB
          status: requested
          account_masked: +2519••••567
          review_reason: null
          created_at: "2026-10-04T09:00:00Z"
      approved:
        value:
          id: 01J9A7Y0000000000000000002
          method: telebirr
          amount: "20000.00"
          currency: ETB
          status: approved
          account_masked: +2519••••567
          review_reason: FIRST_WITHDRAWAL
          created_at: "2026-10-04T09:00:00Z"
      failed:
        value:
          id: 01J9A7Y0000000000000000004
          method: cbebirr
          amount: "500.00"
          currency: ETB
          status: failed
          account_masked: +2519••••567
          review_reason: null
          created_at: "2026-10-04T09:00:00Z"
      rejected:
        value:
          id: 01J9A7Y0000000000000000005
          method: telebirr
          amount: "20000.00"
          currency: ETB
          status: rejected
          account_masked: +2519••••567
          review_reason: FIRST_WITHDRAWAL
          rejection_reason: The account holder's name does not match the name on your account.
          created_at: "2026-10-04T09:00:00Z"
      cancelled:
        value:
          id: 01J9A7Y0000000000000000003
          method: telebirr
          amount: "2000.00"
          currency: ETB
          status: cancelled
          account_masked: +2519••••567
          review_reason: null
          created_at: "2026-10-04T09:00:00Z"
```

```yaml
# paths./v1/withdrawals/{id}.delete.responses
"200":
  description: Cancelled; money back in cash balance
  content:
    application/json:
      schema:
        $ref: "#/components/schemas/Withdrawal"
      example:
        id: 01J9A7Y0000000000000000003
        method: telebirr
        amount: "2000.00"
        currency: ETB
        status: cancelled
        account_masked: +2519••••567
        review_reason: null
        created_at: "2026-10-04T09:00:00Z"
"409":
  description: It can no longer be cancelled (PAY_WITHDRAWAL_NOT_CANCELLABLE)
  content:
    application/problem+json:
      schema:
        $ref: "#/components/schemas/Problem"
      example:
        type: https://api.example.et/errors/withdrawal-not-cancellable
        title: This withdrawal can no longer be cancelled
        status: 409
        code: PAY_WITHDRAWAL_NOT_CANCELLABLE
        request_id: req_01J9B20
```

```yaml
# paths./v1/withdrawals.post.responses — named examples beside the shared ones
"403":
  content:
    application/problem+json:
      examples:
        kyc_required: # the shared Forbidden example, kept first
          value:
            {
              type: https://api.example.et/errors/kyc-required,
              title: Verify your identity first,
              status: 403,
              code: KYC_REQUIRED,
              request_id: req_01J9B02,
            }
        self_excluded:
          value:
            type: https://api.example.et/errors/self-excluded
            title: You are self-excluded
            status: 403
            code: RG_SELF_EXCLUDED
            detail: Your self-exclusion ends on 10 April 2027.
            request_id: req_01J9B21
"422":
  content:
    application/problem+json:
      examples:
        amount_out_of_range:
          value:
            type: https://api.example.et/errors/amount-out-of-range
            title: Amount out of range
            status: 422
            code: PAY_AMOUNT_OUT_OF_RANGE
            detail: Your withdrawals today can't go over 30,000.00 ETB.
            request_id: req_01J9B22
            errors:
              - field: amount
                code: DAILY_MAX
                limit: "30000.00"
        insufficient_funds: # the shared example
          value:
            {
              type: https://api.example.et/errors/insufficient-funds,
              title: Balance too low,
              status: 422,
              code: WALLET_INSUFFICIENT_FUNDS,
              request_id: req_01J9B08,
            }
        method_unavailable:
          value:
            type: https://api.example.et/errors/method-unavailable
            title: This payment method is not available right now
            status: 422
            code: PAY_METHOD_UNAVAILABLE
            request_id: req_01J9B23
```

```yaml
# paths./v1/me/payout-accounts.post.responses
"409":
  description: This account is already saved (PAY_PAYOUT_ACCOUNT_EXISTS)
  content:
    application/problem+json:
      schema:
        $ref: "#/components/schemas/Problem"
      example:
        type: https://api.example.et/errors/payout-account-exists
        title: This account is already saved
        status: 409
        code: PAY_PAYOUT_ACCOUNT_EXISTS
        request_id: req_01J9B24
"422":
  $ref: "#/components/responses/Unprocessable" # VALIDATION_FAILED, errors[].field = account_ref
```

For item 6, a sentence on `POST /v1/withdrawals` listing the 403 codes it returns, after the backend has
settled whether `NotExcluded` applies. For item 7, either a sentence that the key is stored before the
provider is called (so a same-key retry after any 5xx is safe), or a listed 502 with what it means for
the key.

## Clients affected

- Web (F6c): the status screen's examples in Prism instead of the browser; review reasons from the enum;
  the account step's 409 by its code; the account field by `withdrawal_account`.
- Flutter app: the same withdrawal screens and account step.
- Terminal and POS: none (retail has no player wallet).

## Until it lands

The web answers the missing statuses, the cancel and the refusals in the browser for `pnpm ui`, with
shapes from the contract's schema; puts only `FIRST_WITHDRAWAL` in words and shows no other review
reason; shows `rejection_reason` as sent; shows a refused Save with the API's title and reads the list
again; asks for a mobile number for every method that pays out; answers `RG_SELF_EXCLUDED` with Contact
support; and treats a 502 as no answer, retried with the same key.
