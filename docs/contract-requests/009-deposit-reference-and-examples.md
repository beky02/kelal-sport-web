---
status: proposed
requested_by: F6b
---

# The provider's reference on a deposit (DEP-08); named examples for every deposit state and refusal; whether a 502 is kept under its key

## Why the web app needs it

F6b moved deposits onto the contract: `POST /v1/deposits`, then `GET /v1/deposits/{id}` every 3 s until
the deposit is `completed`, `failed` or `expired`. Three things are missing.

1. **The provider's reference.** DEP-08 (SRS): "The system shall show the player a clear status:
   pending, successful, failed or expired, **with the provider reference**." C04's `payments.payment`
   keeps `provider_ref`, but `Deposit` has only our `id`. The status screens show that `id` as the
   reference. A player who calls telebirr or their bank about a payment is asked for the provider's
   transaction number, which no screen can show.
2. **Examples for the states and refusals the screens handle.** `POST /v1/deposits` has examples for
   `redirect` and `ussd_push`; `GET /v1/deposits/{id}` for `completed` and `pending`. There is none for
   an `initiated`, `failed` (with `failure_reason`) or `expired` deposit, for an `app_sdk` next action,
   or for the refusals the screens answer: `PAY_METHOD_UNAVAILABLE`, `PAY_AMOUNT_OUT_OF_RANGE` (which
   limit `errors[].limit` carries), `PAY_PROVIDER_ERROR` on this operation, `RG_LIMIT_REACHED` and
   `RG_COOLING_OFF` on a deposit. The web answers them in the browser for its screens and tests, with
   shapes it had to guess, and Prism can't show them.
3. **What a 502 means for the key.** `PAY_PROVIDER_ERROR` (502) is the API's answer that the provider
   failed. The web treats it as final: Try again starts a new deposit with a new `Idempotency-Key`. If
   the API keeps that 502 under the key for 24 h, sending the same key again would replay it forever. If
   it keeps nothing and the provider did receive the first request, a new key starts a second push. The
   contract should say which.

## Proposed change

Additive: one optional property, named examples (the first example of each response stays its default,
so Prism without `Prefer: example=…` behaves as today), and a sentence on the key.

```yaml
# contracts/src/03_components.yaml → components.schemas.Deposit.properties
provider_ref:
  type:
    - string
    - "null"
  description: >-
    The provider's own transaction reference, once the provider has one (DEP-08). Null before then, and
    for a deposit the provider never received.
```

```yaml
# contracts/src/01_head_player.yaml → paths./v1/deposits/{id}.get.responses.200.content.application/json.examples
initiated:
  value:
    id: 01J9A7W0000000000000000004
    method: cbebirr
    amount: "500.00"
    currency: ETB
    status: initiated
    next_action: null
    provider_ref: null
    expires_at: "2026-10-03T14:13:10Z"
    created_at: "2026-10-03T13:58:10Z"
failed:
  value:
    id: 01J9A7W0000000000000000003
    method: cbebirr
    amount: "500.00"
    currency: ETB
    status: failed
    next_action: null
    failure_reason: Declined by the wallet
    provider_ref: CBE-7Q2M9X41
    expires_at: "2026-10-03T14:13:10Z"
    created_at: "2026-10-03T13:58:10Z"
expired:
  value:
    id: 01J9A7W0000000000000000002
    method: telebirr
    amount: "500.00"
    currency: ETB
    status: expired
    next_action: null
    provider_ref: null
    expires_at: "2026-10-03T14:13:10Z"
    created_at: "2026-10-03T13:58:10Z"
```

and `provider_ref: TB-88K2M7QX` on the existing `completed` example.

```yaml
# contracts/src/01_head_player.yaml → paths./v1/deposits.post.responses.201 …examples
app_sdk:
  value:
    id: 01J9A7W0000000000000000005
    method: telebirr
    amount: "500.00"
    currency: ETB
    status: pending
    next_action:
      type: app_sdk
      sdk_payload:
        receive_code: "TELEBIRR$BUYGOODS$…"
    expires_at: "2026-10-03T14:13:10Z"
    created_at: "2026-10-03T13:58:10Z"
```

```yaml
# contracts/src/01_head_player.yaml → paths./v1/deposits.post.responses — operation-level examples
"422":
  description: Validation or business-rule failure; `errors[]` lists fields
  content:
    application/problem+json:
      schema:
        $ref: "#/components/schemas/Problem"
      examples:
        amount_out_of_range:
          value:
            type: https://api.example.et/errors/amount-out-of-range
            title: Amount is outside this method's limits
            status: 422
            code: PAY_AMOUNT_OUT_OF_RANGE
            detail: CBE Birr takes 20.00 to 100,000.00 ETB per deposit.
            request_id: req_01J9B15
            errors:
              - field: amount
                code: MIN # or MAX; DAILY_MAX for DEP-02's daily total
                limit: "20.00" # the nearest amount this player may deposit now
        method_unavailable:
          value:
            type: https://api.example.et/errors/method-unavailable
            title: This payment method is unavailable
            status: 422
            code: PAY_METHOD_UNAVAILABLE
            request_id: req_01J9B16
"403":
  description: Not allowed
  content:
    application/problem+json:
      schema:
        $ref: "#/components/schemas/Problem"
      examples:
        limit_reached:
          value:
            type: https://api.example.et/errors/limit-reached
            title: Deposit limit reached
            status: 403
            code: RG_LIMIT_REACHED
            detail: Your daily deposit limit of 1,000.00 ETB resets at 00:00.
            request_id: req_01J9B17
            errors:
              - field: amount
                code: DEPOSIT_LIMIT
                current: "1000.00" # deposited in the period
                limit: "1000.00"
        cooling_off:
          value:
            type: https://api.example.et/errors/cooling-off
            title: You're on a break
            status: 403
            code: RG_COOLING_OFF
            request_id: req_01J9B18
```

And one sentence on `components.parameters.IdempotencyKey`, or on `POST /v1/deposits`, saying whether a
5xx Problem (`PAY_PROVIDER_ERROR`) is stored under the key. The web's reading — final, so a retry is a
new intent — is right only if it is not.

## Clients affected

- Web (F6b, built): the status screens' Reference row would show `provider_ref` when present (the
  deposit's `id` until then); the refusal and state screens would come from Prism instead of the
  browser; `errors[].limit` would be documented rather than assumed; the 502 retry would follow the
  answer to question 3.
- Flutter app: the same screens, and `app_sdk`'s payload, which only the app can follow.
- Terminal and POS: none (retail has no player deposits).

## Until it lands

The Reference row shows the deposit's `id`. Initiated, failed and expired deposits and the deposit
refusals are answered in the browser for `pnpm ui` and built from the contract's schema in the tests.
`errors[].limit` is used as the amount to offer only when it is a `Money` string, and otherwise the
method's own limit on the side the amount fell. After `PAY_PROVIDER_ERROR`, Try again is a new deposit
with a new key.
