---
status: proposed
requested_by: F6a (for F6c)
---

# Confirm a bonus forfeit when withdrawing (BON-07); an example for `PAY_ACTIVE_BONUS_WAGERING`

## Why the web app needs it

BON-07 (SRS): "A player shall be warned, and must confirm, before a withdrawal forfeits incomplete bonus
funds." C11 says the same from the backend's side: a withdrawal with an active bonus is blocked by C04's
`NoActiveWagering` rule, and "the player may forfeit (BON-07) → C03 reverses the bonus balance". The
frontend design answers `PAY_ACTIVE_BONUS_WAGERING` with "what withdrawing now forfeits" and two choices:
**Confirm forfeit** or **Keep wagering** (`docs/design/05-errors-and-states.md`, Wallet).

The contract can refuse but cannot accept the confirmation:

1. `WithdrawalRequest` has `method`, `amount` and `payout_account_id` or `account` — nothing that says
   "I accept losing the bonus". There is no forfeit operation either (`/v1/me/bonuses` is read-only).
2. `PAY_ACTIVE_BONUS_WAGERING` is in `ErrorCode` but has no example, so what the refusal carries — which
   amount would be forfeited — is undefined, and the warning BON-07 requires has nothing to quote.

Without this, the withdrawal screen (F6c) can only say the bonus is still being wagered and offer Keep
wagering: a player who would rather give the bonus up has no way to withdraw.

## Proposed change

Additive: one optional property on the request, one named 422 example on `POST /v1/withdrawals` (the
first example of each response stays its default, so Prism without `Prefer: …example=` behaves as today).

```yaml
# contracts/src/03_components.yaml → components.schemas.WithdrawalRequest.properties
forfeit_bonus:
  type: boolean
  default: false
  description: >-
    The player confirms that withdrawing now forfeits the active bonus balance and its wagering progress
    (BON-07). Without it, a withdrawal while a bonus is being wagered is refused with
    PAY_ACTIVE_BONUS_WAGERING.
```

```yaml
# contracts/src/01_head_player.yaml (where paths./v1/withdrawals lives) → post.responses.422
"422":
  description: Validation or business-rule failure; `errors[]` lists fields
  content:
    application/problem+json:
      schema:
        $ref: "#/components/schemas/Problem"
      examples:
        active_bonus_wagering:
          value:
            type: https://api.example.et/errors/active-bonus-wagering
            title: Your bonus is still being wagered
            status: 422
            code: PAY_ACTIVE_BONUS_WAGERING
            detail: Withdrawing now forfeits your bonus of 500.00 ETB.
            request_id: req_01J9B14
            errors:
              - field: forfeit_bonus
                code: REQUIRED
                current: "500.00"
```

`errors[].current` is the bonus amount that would be forfeited, so the warning quotes the server's figure
rather than one the browser works out; `500.00` matches the active bonus in the `/v1/me/bonuses` example.
If the forfeit posts its own ledger movement, naming it in `WalletTxn.type` (a new enum value) lets the
history label it.

The confirmed request is a new intent: the web sends it with a **new** `Idempotency-Key` (the refused one
was a final answer), so `IDEMPOTENCY_MISMATCH` never arises from it.

## Clients affected

- Web (F6c): the refusal shows `current` as the amount forfeited, with Confirm forfeit (sends
  `forfeit_bonus: true`) and Keep wagering.
- Flutter app: the same flow on its withdrawal screen.
- Terminal and POS: none (retail has no player wallet).

## Until it lands

F6c explains the refusal ("your bonus is still being wagered", with the API's `detail` when sent) and
offers Keep wagering only; no Confirm forfeit button.
