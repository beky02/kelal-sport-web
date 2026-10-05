---
status: proposed
requested_by: F7a
---

# Responsible gambling: removing a time limit, minutes used, when a period resets, which exclusion is in force, RG refusal examples, the missing responses

## Why the web app needs it

F7a moved responsible gaming onto the contract: the limits come from `GET /v1/me/limits` and change
through `PUT /v1/me/limits` (the API decides when a change applies, and its `pending` says so); a break or
a self-exclusion is `POST /v1/me/self-exclusion`, after which the player is signed out; and whether one is
in force is read from `/v1/me` (`flags.excluded_until`), so the banner, the locked slip and the paused
deposits are server state. Seven things are missing or undefined.

1. **Removing a time limit.** `RgLimitSet.amount` says "Null removes the limit (applies after 24 h)".
   A `session_minutes` limit has no `amount` at all (C12: "null for session_minutes (use minutes)"), and
   `minutes` says nothing, so the web can't tell how a time limit is removed — or whether a time limit
   sent with `amount: null` is read as its removal. The web sends only the field that applies (`amount`
   for deposit, stake and loss; `minutes` for time) — a time limit is sent with no `amount` key at all,
   which the backend must not read as `amount: null` (a default of `None` would) — and **offers no Remove**; a pending removal set
   elsewhere is shown ("No limit from {date}").
2. **Minutes used.** `RgLimit.used` is `Money`, so a time limit can't say how much of it the current
   period has used. The web shows the time limit without a used line.
3. **When the current period resets.** `used` is "used in the current period" (C12 §8: a day is
   00:00–24:00 EAT, weeks start Monday), but nothing says when the period ends. The design's deposit-limit
   dialog ("you can deposit again after {time}") can't be built without it, and the web won't work the
   boundary out itself. F7a removed that dialog: a deposit refused with `RG_LIMIT_REACHED` shows the API's
   `detail` with View limits, and the wallet's card shows `used` of `amount`.
4. **Which exclusion is in force.** `Me.flags.excluded_until` is a time and nothing else. The web can't
   tell a short break (`time_out`) from a self-exclusion, so its banner is worded for both ("Break
   active until …"). A permanent self-exclusion has no end (`Exclusion.ends_at` null); the web reads it
   as `status: self_excluded` with `excluded_until: null`, which the contract doesn't state. Nor does it
   say that `excluded_until` is null once the break has passed: the web never compares it with the
   browser's clock, so a stale value keeps the slip locked until `/api/me` is read again.
5. **What a second exclusion does.** RG-02 and C12 §2 make an exclusion irreversible until it ends. The
   web still offers a break and a self-exclusion to a player already on one (a player on a 24-hour break
   may want six months). The contract should say what a second `POST` does while one is in force — the
   later end wins, or a 409 — so a shorter one can never end a longer one early.
6. **RG refusal examples.** `POST /v1/bets` and `POST /v1/deposits` list the shared `Forbidden` (403),
   whose only example is `KYC_REQUIRED`. There is no example of `RG_LIMIT_REACHED` (with the `detail`
   that names the limit and when it resets), `RG_COOLING_OFF` or `RG_SELF_EXCLUDED`, so the web answers
   them in the browser for its screens and tests, with shapes it had to guess. `PUT /v1/me/limits` lists
   the shared `Unprocessable` (422), whose examples are about stakes: which codes refuse a limit (05-errors
   expects "a limit that cannot be lowered below usage"), and what `errors[]` carries, is undefined.
7. **Missing responses.** `PUT /v1/me/limits` lists no 401 (and no 400) although it needs `playerAuth`;
   `POST /v1/me/self-exclusion` lists no 422 for a request the API refuses, and no 400; `GET
/v1/me/limits` lists no 400 or 404, which the other `/v1/me` reads gained in the last sync.

## Proposed change

Additive throughout: descriptions, optional properties, named examples (the first of each response stays
its default, so Prism without `Prefer: example=` behaves as today) and listed responses. Amounts and times
match the existing limit and exclusion examples.

```yaml
# contracts/src/03_components.yaml → components.schemas
RgLimit:
  properties:
    used_minutes:
      type: [integer, "null"]
      description: Minutes used in the current period, for a session_minutes limit; null otherwise.
    period_ends_at:
      $ref: "#/components/schemas/Timestamp"
      description: >-
        When the current period ends and `used` starts again (C12 §8: days end at 24:00 EAT, weeks on
        Monday 00:00 EAT).
RgLimitSet:
  description: >-
    Send `amount` for a deposit, stake or loss limit and `minutes` for a session_minutes limit — never
    both. Null in that field removes the limit (after 24 h, as an increase).
  properties:
    minutes:
      type: [integer, "null"]
      description: Minutes, for a session_minutes limit. Null removes it (applies after 24 h).
Me:
  properties:
    flags:
      properties:
        excluded_until:
          type: [string, "null"]
          format: date-time
          description: >-
            When the break or self-exclusion in force ends; null when none is in force (it is cleared once
            the end has passed) and for a permanent one, whose player is `self_excluded`.
        exclusion:
          description: The break or self-exclusion in force, if any.
          oneOf:
            - $ref: "#/components/schemas/Exclusion"
            - { type: "null" }
```

```yaml
# contracts/src/01_head_player.yaml → paths./v1/me/limits
get:
  responses:
    "200": # unchanged, with period_ends_at and used_minutes in its example:
      # - { type: deposit, period: week, amount: "1000.00", minutes: null, effective_from: "2026-10-01T08:15:00Z",
      #     used: "500.00", used_minutes: null, period_ends_at: "2026-10-04T21:00:00Z",
      #     pending: { amount: "2000.00", minutes: null, effective_from: "2026-10-04T10:00:00Z" } }
      # - { type: session_minutes, period: day, amount: null, minutes: 120, effective_from: "2026-10-01T08:15:00Z",
      #     used: null, used_minutes: 45, period_ends_at: "2026-10-03T21:00:00Z", pending: null }
    "400": { $ref: "#/components/responses/BadRequest" }
    "401": { $ref: "#/components/responses/Unauthorized" }
    "404": { $ref: "#/components/responses/NotFound" }
put:
  responses:
    "200": # the current example, kept first; then a decrease, in force at once:
      content:
        application/json:
          examples:
            increase:
              value:
                {
                  type: deposit,
                  period: week,
                  amount: "1000.00",
                  minutes: null,
                  effective_from: "2026-10-01T08:15:00Z",
                  used: "500.00",
                  pending:
                    {
                      amount: "2000.00",
                      minutes: null,
                      effective_from: "2026-10-04T10:00:00Z",
                    },
                }
            decrease:
              value:
                {
                  type: deposit,
                  period: week,
                  amount: "600.00",
                  minutes: null,
                  effective_from: "2026-10-03T12:00:00Z",
                  used: "500.00",
                  pending: null,
                }
    "400": { $ref: "#/components/responses/BadRequest" }
    "401": { $ref: "#/components/responses/Unauthorized" }
    "422":
      description: The limit can't be set (VALIDATION_FAILED, with errors[] naming the field)
      content:
        application/problem+json:
          schema: { $ref: "#/components/schemas/Problem" }
          example:
            type: https://api.example.et/errors/validation-failed
            title: This limit can't be set
            status: 422
            code: VALIDATION_FAILED
            detail: A limit must be above 0.00 ETB.
            request_id: req_01J9B40
            errors: [{ field: amount, code: MIN, limit: "0.01" }]
```

```yaml
# paths./v1/me/self-exclusion.post.responses
"400": { $ref: "#/components/responses/BadRequest" }
"409":
  description: >-
    An exclusion that ends later is already in force (or say here that the later end wins and answer
    201 with the exclusion in force).
"422": { $ref: "#/components/responses/Unprocessable" }
```

```yaml
# paths./v1/bets.post.responses.403 and paths./v1/deposits.post.responses.403 — named examples
"403":
  description: Not allowed (KYC_REQUIRED, RG_LIMIT_REACHED, RG_COOLING_OFF, RG_SELF_EXCLUDED)
  content:
    application/problem+json:
      schema: { $ref: "#/components/schemas/Problem" }
      examples:
        kyc_required: # the current Forbidden example, kept first
          value:
            {
              type: https://api.example.et/errors/kyc-required,
              title: Verify your identity first,
              status: 403,
              code: KYC_REQUIRED,
              request_id: req_01J9B02,
            }
        rg_limit_reached:
          value:
            {
              type: https://api.example.et/errors/rg-limit-reached,
              title: Limit reached,
              status: 403,
              code: RG_LIMIT_REACHED,
              detail: "Your weekly deposit limit of 1,000.00 ETB resets on Monday at 00:00.",
              request_id: req_01J9B41,
            }
        rg_cooling_off:
          value:
            {
              type: https://api.example.et/errors/rg-cooling-off,
              title: You're taking a break,
              status: 403,
              code: RG_COOLING_OFF,
              detail: "Your break ends on 10 Oct at 15:00.",
              request_id: req_01J9B42,
            }
        rg_self_excluded:
          value:
            {
              type: https://api.example.et/errors/rg-self-excluded,
              title: You've excluded yourself,
              status: 403,
              code: RG_SELF_EXCLUDED,
              request_id: req_01J9B43,
            }
```

## Clients affected

- **Web (F7a)**: offers Remove for every kind of limit (1); a time limit's used line (2); the
  deposit-limit refusal and the wallet's card can say when the limit resets (3); the banner can name a
  break or a self-exclusion, and a permanent one is stated rather than inferred (4); the RG screens and
  tests use the contract's own refusals (6).
- **Flutter app**: the same limits, exclusion and refusal handling (C18's sibling).
- **Terminal / POS**: none — limits and exclusions are the online player's; a retail sale checks them
  through the API.

## Until it lands

- No Remove button; a pending removal set elsewhere is shown. A time limit shows no used line.
- No reset time anywhere: the deposit refusal shows the API's `detail`, which names it.
- The banner says "Break active until {date}" for a break or a self-exclusion with an end, and
  "Self-exclusion active" for `status: self_excluded` with no date; nothing compares the end with the
  browser's clock.
- A break and a self-exclusion stay offered during one; the API decides what a second does.
- RG refusals, a lowered limit and a refused limit are answered in the browser for `pnpm ui` and in
  component tests, with shapes from the `Problem` schema.
