---
status: proposed
requested_by: F4b
---

# Named examples for the registration, code and Fayda refusals; where `REG_ID_TAKEN` comes from

## Why the web app needs it

Registration, the password reset and Fayda verification (F4b) each switch on a Problem `code` and offer
a fix: a wrong code sends the player back to the code step, an expired one offers a new code, Fayda
being down offers "Do this later", and so on. Prism can only show what the contract has examples for,
and the shared responses each carry one:

| Response          | Its only example                                    | What F4b also needs to show                            |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `Unprocessable`   | `stake_too_low`, `insufficient_funds`, `validation` | `AUTH_OTP_INVALID`, `AUTH_OTP_EXPIRED`, `REG_UNDERAGE` |
| `TooManyRequests` | `RATE_LIMITED`                                      | `AUTH_OTP_RATE_LIMITED`                                |
| `Unavailable`     | `REAL_MONEY_DISABLED`                               | `AUTH_OTP_UNAVAILABLE`, `KYC_PROVIDER_UNAVAILABLE`     |
| `Conflict`        | `REG_PHONE_TAKEN`                                   | `REG_ID_TAKEN`                                         |

So today a developer, a reviewer or `pnpm ui` cannot see those screens against the mock: `Prefer:
code=422` on `/v1/auth/register` answers `BET_STAKE_TOO_LOW`, and `Prefer: code=503` on
`/v1/kyc/fayda/otp` answers `REAL_MONEY_DISABLED`. F4b proves them with component tests in the contract's
`Problem` shape, and its one `pnpm ui` screen for a refused code fulfils this app's own route in the
browser — a stand-in for an example the contract should have.

Two operations also miss a response the design describes:

- **`POST /v1/kyc/fayda/verify` has no `503`.** C02 §10 says Fayda can be unavailable; it can be when
  the code comes back as well as when it is sent. Today a `KYC_PROVIDER_UNAVAILABLE` from verify is not
  in the contract.
- **Nothing answers `REG_ID_TAKEN` once the ID is given after registration.** C01 §10 blocks the same
  national ID on two accounts (`uq_player_nid`) and answers `REG_ID_TAKEN`, but only `RegisterRequest`
  carries a `national_id`, and the web (like the task's design) creates the account first and asks for
  the Fayda number afterwards. `/v1/kyc/fayda/otp` and `/v1/kyc/fayda/verify` declare no `409`, so a
  Fayda ID already linked to another player has no defined answer.

## Proposed change

All additive: new named examples (the first example of each response stays the default, so Prism's
behaviour without `Prefer: example=` is unchanged) and two new responses.

```yaml
# contracts/src/03_components.yaml → components.responses
Unprocessable:
  content:
    application/problem+json:
      examples:
        # stake_too_low, insufficient_funds, validation — unchanged, first stays first
        otp_invalid:
          value:
            type: https://api.example.et/errors/otp-invalid
            title: That code is not right
            status: 422
            code: AUTH_OTP_INVALID
            request_id: req_01J9B14
        otp_expired:
          value:
            type: https://api.example.et/errors/otp-expired
            title: That code has expired
            status: 422
            code: AUTH_OTP_EXPIRED
            request_id: req_01J9B15
        underage:
          value:
            type: https://api.example.et/errors/underage
            title: You must be of legal age to register
            status: 422
            code: REG_UNDERAGE
            request_id: req_01J9B16
TooManyRequests:
  content:
    application/problem+json:
      examples: # was a single `example`
        rate_limited:
          value:
            type: https://api.example.et/errors/rate-limited
            title: Too many requests
            status: 429
            code: RATE_LIMITED
            request_id: req_01J9B10
        otp_rate_limited:
          value:
            type: https://api.example.et/errors/otp-rate-limited
            title: Too many codes requested
            status: 429
            code: AUTH_OTP_RATE_LIMITED
            detail: Try again in 15 minutes.
            request_id: req_01J9B17
Unavailable:
  content:
    application/problem+json:
      examples: # was a single `example`
        real_money_disabled:
          value:
            type: https://api.example.et/errors/real-money-disabled
            title: Real-money play is not available yet
            status: 503
            code: REAL_MONEY_DISABLED
            request_id: req_01J9B12
        otp_unavailable:
          value:
            type: https://api.example.et/errors/otp-unavailable
            title: We cannot send SMS right now
            status: 503
            code: AUTH_OTP_UNAVAILABLE
            request_id: req_01J9B18
        kyc_provider_unavailable:
          value:
            type: https://api.example.et/errors/kyc-provider-unavailable
            title: Fayda is not reachable right now
            status: 503
            code: KYC_PROVIDER_UNAVAILABLE
            request_id: req_01J9B19
Conflict:
  content:
    application/problem+json:
      examples: # was a single `example`
        phone_taken:
          value:
            type: https://api.example.et/errors/phone-taken
            title: This phone is already registered
            status: 409
            code: REG_PHONE_TAKEN
            request_id: req_01J9B05
        id_taken:
          value:
            type: https://api.example.et/errors/id-taken
            title: This ID is already linked to another account
            status: 409
            code: REG_ID_TAKEN
            request_id: req_01J9B20
```

```yaml
# contracts/src/01_head_player.yaml → paths./v1/kyc/fayda/verify.post.responses
"409":
  $ref: "#/components/responses/Conflict" # REG_ID_TAKEN: the verified ID belongs to another player
"503":
  $ref: "#/components/responses/Unavailable" # KYC_PROVIDER_UNAVAILABLE
```

Where `REG_ID_TAKEN` is detected after registration is the backend's call — at `fayda/otp` (if the number
alone is checked) or at `fayda/verify` (once Fayda has confirmed it). The YAML above puts it on verify;
the web handles it on either.

## A question for the backend: the Fayda FAN

`fayda_number` accepts 12–16 characters, but nothing says whether the backend's Fayda integration takes
the 16-digit FAN (Fayda Alias Number) as well as the 12-digit FIN. The web asks for the FIN only (F4b
decision, confirmed by the product owner) until the backend says. If the FAN is accepted, a sentence in
the operation's description is enough:

```yaml
# contracts/src/01_head_player.yaml → paths./v1/kyc/fayda/otp.post.requestBody…fayda_number
description: The 12-digit FIN or the 16-digit FAN, digits only.
```

## Clients affected

- **Web**: none in code — the UI already switches on these codes. After the sync, `pnpm ui` can show
  them with `Prefer: example=…` instead of a browser-side stand-in.
- **Flutter app**: the same examples for its own tests.
- **Terminal / POS**: none.

## Until it lands

The web handles every code above already; they are proven with component tests in the contract's
`Problem` shape (`tests/component/RegisterFlow.test.tsx`, `ResetFlow.test.tsx`). A `REG_ID_TAKEN` or a
`503` from `fayda/verify` would be shown with its own message today, even though the contract does not
yet say they can happen.
