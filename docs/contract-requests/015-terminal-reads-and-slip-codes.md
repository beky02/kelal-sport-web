---
status: proposed
requested_by: F8c (F8ca, for F8cc too)
---

# What a terminal's catalogue read is; `Idempotency-Key` and named refusals on `POST /v1/retail/slip-codes`

## Why the web app needs it

**The user's decision (2026-10-07): shops have no prices or rules of their own.** Every shop and agent
sells at the brand's prices, under the brand's one shop rule set (`retail_betting`). So for the web the
answer to part 1 can be "a terminal's read is the anonymous read": no retail margin or market set per shop
(C19 §9.1's "the shop's retail margin" would not apply). If the backend agrees, the contract can drop
`terminalAuth` from the catalogue reads, or say a terminal read changes nothing; parts 2 and 3 stand.

**1. A terminal's catalogue and config reads.** The shop kiosk (F8ca) shows the shop's matches and prices,
and F8cb prices the slip with `retail_betting`. C19 §9.1 says: "Terminals read the catalogue through the
same public endpoints as the player web (C06) with the terminal token attached, so the shop's retail
margin and market set apply." The contract half-says the same:

- `listSports`, `listEvents`, `listPopularEvents`, `getEvent`, `getDictionary`, `search`, `quoteSlip`,
  `listBanners`, `getPublicConfig` and `getBooking` list `terminalAuth` among their security schemes.
  Since the user's second review (2026-10-07), the kiosk also loads a customer's booking code
  (`getBooking`, re-priced at current odds), so the same question applies to it: is a code loaded at a
  shop re-priced at the shop's odds?
- `terminalAuth`'s description says "Every request is also signed with the device key (X-Device-Timestamp,
  X-Device-Signature)".
- But none of those operations declares `X-Device-Id`, `X-Device-Timestamp` or `X-Device-Signature`. They
  all accept an anonymous call (`security: [ {}, … ]`).

So the web can't send a terminal read the contract describes, and it doesn't know what such a read would
change. Today the kiosk reads the catalogue **anonymously** (F8ca, decision 2), through its own route
handlers and the player's loaders. If a shop's prices or market set differ from the online ones, the kiosk
shows the online prices. Every slip code would then reach the counter with "odds changed" (C19 §14). The
engine's price is the one that counts, so no money is wrong, but the customer is shown a price the shop
won't sell at.

How the web signs matters for the answer. The browser holds the non-extractable device key and never
calls the API (D3), so the browser signs each **API call** and the route handler forwards the signature
(request 014). A kiosk board is today one route handler making three API calls: `/v1/events` in two
languages and `/v1/dictionary`. Signed reads would mean one browser signature per API call, so the
kiosk's reads would become one route per API call. That is workable, but worth knowing before choosing.

**2. A retried Get code.** F8cc turns the kiosk's slip into a code (`createSlipCode`, 30 per terminal per
10 minutes). If the answer is lost (a dropped connection, a timeout after the API created the code), the
kiosk tries again. Without a key, each retry mints another code and spends another of the terminal's 30.
The codes never shown are harmless, but a flaky shop connection can lock the kiosk out for ten minutes.
The web's rule is one `Idempotency-Key` per user intent for anything that creates a booking (request 005
asks the same for `POST /v1/bookings`). A slip code is a C09 booking with `channel='retail'` (C19 §4.2).

**3. What a refused code says.** The kiosk has to tell a walk-in customer what to change, by the Problem
`code`, never the `title`. `createSlipCode` refers to the shared `Unprocessable` (whose examples are
`BET_STAKE_TOO_LOW` at 5.00, `WALLET_INSUFFICIENT_FUNDS` and a phone `VALIDATION_FAILED`) and
`TooManyRequests` (no `Retry-After` value). Several things are left open:

- Is a `stake_hint` under the retail minimum refused (`BET_STAKE_TOO_LOW` with `errors[].limit`), or
  stored, since it is only a hint?
- Which code, and which `errors[]` entry, names a started or suspended leg (`BET_EVENT_STARTED`,
  `BET_MARKET_SUSPENDED`)?
- Is there `BET_TOO_MANY_LEGS` past `max_legs` (the schema caps `legs` at 30)?
- Is a closed shop answered with `RETAIL_SHOP_CLOSED`, and with which status (the operation lists no 403)?

## Proposed change

**1.** Either answer works for the web. Option A is simpler for every terminal client.

_Option A: a terminal's read is an anonymous read._ The retail margin, if there is one, is applied when the
POS loads the code (`GET /v1/retail/slip-codes/{code}` already returns `PricedLeg`s). The change is wording
only:

```yaml
# contracts/src/03_components.yaml → components.securitySchemes.terminalAuth
description: >-
  Shop terminal token (90 days, audience `terminal`). Required, and signed with the device key
  (X-Device-Id, X-Device-Timestamp, X-Device-Signature), on the `Retail - terminal` operations.
  Catalogue, Config and Content operations answer a terminal exactly as they answer an anonymous
  caller; a terminal calls them without its token.
```

and `terminalAuth` dropped from those operations' `security` lists, so the generated types and the docs
agree.

_Option B: a terminal's read differs._ Optional device headers on those operations, and their
descriptions saying what changes:

```yaml
# contracts/src/03_components.yaml → components.parameters (additive: anonymous callers send none)
DeviceIdOptional:
  name: X-Device-Id
  in: header
  required: false
  description: The activated terminal's ID; sent with `terminalAuth` (and then with the two below).
  schema: { type: string }
DeviceTimestampOptional:
  name: X-Device-Timestamp
  in: header
  required: false
  description: As DeviceTimestamp; required when X-Device-Id is sent.
  schema: { type: integer, format: int64 }
DeviceSignatureOptional:
  name: X-Device-Signature
  in: header
  required: false
  description: As DeviceSignature; required when X-Device-Id is sent.
  schema: { type: string }
```

```yaml
# contracts/src/01_head_player.yaml → paths./v1/events.get (and listSports, listPopularEvents,
# getEvent, getDictionary, search, getPublicConfig, getBooking)
parameters:
  - { $ref: "#/components/parameters/AcceptLanguage" }
  - { $ref: "#/components/parameters/DeviceIdOptional" }
  - { $ref: "#/components/parameters/DeviceTimestampOptional" }
  - { $ref: "#/components/parameters/DeviceSignatureOptional" }
description: >-
  … With a terminal's token and signature, prices are the shop's retail prices and only markets on
  sale in shops are listed (C19 §9.1).
```

**2.** The optional key that request 005 proposes for bookings (`IdempotencyKeyOptional`), on slip codes
too:

```yaml
# contracts/src/02_retail_agent_admin.yaml → paths./v1/retail/slip-codes.post
parameters:
  - { $ref: "#/components/parameters/DeviceTimestamp" }
  - { $ref: "#/components/parameters/DeviceSignature" }
  - { $ref: "#/components/parameters/IdempotencyKeyOptional" }
```

The key is a header, so the device signature (method, path, timestamp, body hash) doesn't cover it and
nothing about signing changes. The same key with a different body → `422 IDEMPOTENCY_MISMATCH`, as
elsewhere.

**3.** Named examples on `createSlipCode`, and the closed shop listed:

```yaml
# contracts/src/02_retail_agent_admin.yaml → paths./v1/retail/slip-codes.post.responses
"403":
  description: The shop is closed or suspended (RETAIL_SHOP_CLOSED)
  content:
    application/problem+json:
      schema: { $ref: "#/components/schemas/Problem" }
      example:
        {
          type: https://api.example.et/errors/shop-closed,
          title: This shop is closed,
          status: 403,
          code: RETAIL_SHOP_CLOSED,
          request_id: req_01J9B40,
        }
"422":
  description: The slip can't be stored as a code; `errors[]` names the stake or the leg
  content:
    application/problem+json:
      schema: { $ref: "#/components/schemas/Problem" }
      examples:
        stake_hint_too_low:
          value:
            {
              type: https://api.example.et/errors/stake-too-low,
              title: Stake is below the minimum,
              status: 422,
              code: BET_STAKE_TOO_LOW,
              detail: Minimum stake is 10.00 ETB.,
              request_id: req_01J9B41,
              errors: [{ field: stake_hint, code: MIN, limit: "10.00" }],
            }
        event_started:
          value:
            {
              type: https://api.example.et/errors/event-started,
              title: A match has started,
              status: 422,
              code: BET_EVENT_STARTED,
              request_id: req_01J9B42,
              errors: [{ field: "legs[1].outcome_id", code: EVENT_STARTED }],
            }
        market_suspended:
          value:
            {
              type: https://api.example.et/errors/market-suspended,
              title: A market is suspended,
              status: 422,
              code: BET_MARKET_SUSPENDED,
              request_id: req_01J9B43,
              errors: [{ field: "legs[0].outcome_id", code: SUSPENDED }],
            }
"429":
  description: 30 codes per terminal per 10 minutes (RATE_LIMITED)
  headers:
    Retry-After: { schema: { type: integer }, example: 240 }
  content:
    application/problem+json:
      schema: { $ref: "#/components/schemas/Problem" }
      example:
        {
          type: https://api.example.et/errors/rate-limited,
          title: Too many slip codes,
          status: 429,
          code: RATE_LIMITED,
          request_id: req_01J9B44,
        }
```

If a `stake_hint` under the minimum is stored rather than refused, drop `stake_hint_too_low` and say so
in the operation's description. If a closed shop is a 422, move its example there.

## Clients affected

- **Web terminal (this repo).**
  - F8ca: no change under Option A. Under Option B, one route per signed read, with the browser signing
    each read as it signs status reads.
  - F8cc: sends the key; the screens switch on these codes.
- **POS (`kelalsport-ops`, F9b).** Under Option A, the retail price is the POS's to show when it loads the
  code. That is already its job (C19 §14).
- **Flutter app.** None.

## Until it lands

- The kiosk reads the catalogue, config and booking codes anonymously, and shows online prices. The gap is
  listed in F8ca's verification.
- F8cc sends `Idempotency-Key` on `POST /v1/retail/slip-codes` anyway: Prism and the backend ignore an
  undeclared header, as for bookings (005).
- F8cc switches on `code` only. Each refusal's screen is made in Playwright by answering the kiosk's own
  route with the shapes above.
- `Retail - terminal` stays refused in `API_REAL_TAGS` until request 004 lands (F8b), so nothing here
  reaches the real API before B9.
