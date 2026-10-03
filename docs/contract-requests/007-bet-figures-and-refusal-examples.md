---
status: proposed
requested_by: F5a
---

# A ticket's rule-set version and what its payout figures mean; named examples for the bet refusals; My bets counts

## Why the web app needs it

Placing a bet (F5a) shows the engine's `PlacedBet` instead of the slip's preview, and My bets (F5b) will
show `Bet` the same way. Four gaps:

1. **No `rules_version` on `Bet`.** A ticket is priced under one version of the tenant's rule set
   (D1.12; `Quote.rules_version` has it). The frontend design (`docs/design/04-slip-and-money.md`) and
   the F3a money review (M2) want a ticket to show it, and any labelled recomputation to use the bet's
   own version rather than today's. Without it the web shows the API's figures only and cannot say which
   rules priced the bet.
2. **`potential_payout`, `payout` and `win_tax` are not described.** The placed ticket shows
   `potential_payout` as "Potential payout". Whether it is net of payout taxes (as `Quote.net_payout`)
   or gross is not written down; the contract's examples (289.17 on 85.00 × 3.402, below the win-tax
   threshold) cannot tell the two apart. `win_tax` is `null` in the 201 example, which the web reads as
   "decided at settlement" and so shows no winnings-tax line on a new ticket.
3. **No examples for refusals the slip handles.** `POST /v1/bets` refers to the shared `Forbidden`
   (one example, `KYC_REQUIRED`) and `Unprocessable` (`stake_too_low`, `insufficient_funds`,
   `validation`), and its 409 has `odds_changed` and `event_started`. The slip also handles
   `BET_MARKET_SUSPENDED` (marks the named pick), `BET_STAKE_TOO_HIGH` (offers `errors[].limit`),
   `BET_LIMIT_EXCEEDED` (offers the limit when given), `RG_LIMIT_REACHED` (shows the API's `detail`,
   offers View limits) and `RG_SELF_EXCLUDED` / `RG_COOLING_OFF` (betting paused). None of them can be
   seen against Prism; F5a proves them with component tests in the contract's `Problem` shape and one
   `pnpm ui` screen answered in the browser, as F4b did for request 006.
4. **A retry cannot tell the web whether the first try failed.** After a placement with no answer, the
   slip sends the same request with the same `Idempotency-Key`. C08 §7 checks its idempotency cache
   first but writes it only after the bet commits, so a retry that arrives while the first try is still
   being processed is re-priced on its own and can be refused (`BET_ODDS_CHANGED`) while the first try
   then commits. The web therefore keeps such a bet "unconfirmed" through any refusal of a retry and only
   lets the player place a different bet by an explicit choice (F5a). Reserving the key before re-pricing
   — insert first, as D2 does for the ledger — or answering an in-flight duplicate with its own code would
   let a refusal of a retry settle it.
5. **`BET_LIMIT_EXCEEDED`'s `errors[]` are not defined.** TD-01 calls it "trader limit or liability";
   C08's risk limits are a maximum stake, payout or liability. The slip offers a limit as the stake to set
   only when it is on `field: stake`; a leg's liability is never offered. Please say which field carries
   which limit.
6. **No counts on `GET /v1/bets`** (for F5b). The My bets tabs are designed "Open / Settled with counts"
   (`docs/design/01-screens.md`), but the list is cursor-paged and carries no totals, so F5b will show
   the tabs without counts unless this lands. Low priority.

## Proposed change

All additive: a new optional property, descriptions, new named examples (each response's first example
stays its default, so Prism without `Prefer: …example=` behaves as today) and an optional `counts`.

```yaml
# contracts/src/03_components.yaml → components.schemas.Bet.properties
rules_version:
  {
    type: integer,
    description: "The tenant rule-set version the bet was priced under (D1.12), as Quote.rules_version",
  }
potential_payout:
  {
    $ref: "#/components/schemas/Money",
    description: "What the bet pays if every open leg wins, after payout taxes deducted from the payout (as Quote.net_payout)",
  }
payout:
  {
    oneOf: [{ $ref: "#/components/schemas/Money" }, { type: "null" }],
    description: "What the bet paid at settlement, after payout taxes; null while open",
  }
win_tax:
  {
    oneOf: [{ $ref: "#/components/schemas/Money" }, { type: "null" }],
    description: "Payout taxes deducted at settlement (as Quote.win_tax); null while open",
  }
```

(If `potential_payout` is in fact gross, the description says so instead — the point is that it is
written down. The `PlacedBetExample` and the `/v1/bets` examples gain `rules_version: 7`.)

```yaml
# contracts/src/01_head_player.yaml → paths./v1/bets.post.responses.409.content.application/problem+json.examples
market_suspended:
  value:
    type: "https://api.example.et/errors/market-suspended"
    title: Market suspended
    status: 409
    code: BET_MARKET_SUSPENDED
    detail: A selection is no longer available.
    request_id: req_01J9B21
    errors: [{ field: "legs[1].outcome_id", code: MARKET_SUSPENDED }]
```

```yaml
# contracts/src/03_components.yaml → components.responses.Unprocessable.content.application/problem+json.examples
# (stake_too_low, insufficient_funds, validation unchanged; stake_too_low stays first)
stake_too_high:
  {
    value:
      {
        type: "https://api.example.et/errors/stake-too-high",
        title: Stake is above the maximum,
        status: 422,
        code: BET_STAKE_TOO_HIGH,
        detail: Maximum stake is 50000.00 ETB.,
        request_id: req_01J9B22,
        errors: [{ field: stake, code: MAX, limit: "50000.00" }],
      },
  }
limit_exceeded:
  {
    value:
      {
        type: "https://api.example.et/errors/limit-exceeded",
        title: Over the limit for this bet,
        status: 422,
        code: BET_LIMIT_EXCEEDED,
        detail: The most this bet can take is 2000.00 ETB.,
        request_id: req_01J9B23,
        errors: [{ field: stake, code: LIMIT, limit: "2000.00" }],
      },
  }
```

```yaml
# contracts/src/03_components.yaml → components.responses.Forbidden.content.application/problem+json
examples: # was a single `example`; kyc_required stays first
  kyc_required:
    {
      value:
        {
          type: "https://api.example.et/errors/kyc-required",
          title: Verify your identity first,
          status: 403,
          code: KYC_REQUIRED,
          request_id: req_01J9B02,
        },
    }
  rg_limit_reached:
    {
      value:
        {
          type: "https://api.example.et/errors/rg-limit-reached",
          title: Limit reached,
          status: 403,
          code: RG_LIMIT_REACHED,
          detail: Your daily stake limit resets at 00:00.,
          request_id: req_01J9B24,
        },
    }
  rg_self_excluded:
    {
      value:
        {
          type: "https://api.example.et/errors/rg-self-excluded",
          title: You are self-excluded,
          status: 403,
          code: RG_SELF_EXCLUDED,
          detail: Betting is paused until 9 April 2027.,
          request_id: req_01J9B25,
        },
    }
  rg_cooling_off:
    {
      value:
        {
          type: "https://api.example.et/errors/rg-cooling-off",
          title: You are taking a break,
          status: 403,
          code: RG_COOLING_OFF,
          detail: Betting is paused until 9 October 2026 12:00.,
          request_id: req_01J9B26,
        },
    }
```

```yaml
# contracts/src/03_components.yaml → components.schemas.ErrorCode.enum (new value, for item 4)
- IDEMPOTENCY_IN_PROGRESS # 409: a request with this key is still being processed; ask again
```

`BET_LIMIT_EXCEEDED` (item 5): document in TD-01 §4 and on the `limit_exceeded` example that a maximum
stake comes as `errors[] { field: stake, code: LIMIT, limit }` and a liability as
`{ field: "legs[i].outcome_id", code: MAX_LIABILITY }`.

```yaml
# contracts/src/01_head_player.yaml → paths./v1/bets.get.responses.200 schema.properties (optional; F5b)
counts:
  type: object
  description: How many of the player's bets are open and settled, whatever the page and filters
  properties: { open: { type: integer }, settled: { type: integer } }
# and in its example:   counts: { open: 1, settled: 1 }
```

## Clients affected

- **Web** (this repo): F5a reads none of it yet; F5b would show `rules_version` on the ticket and the tab
  counts. The named examples let `pnpm ui` show every refusal against Prism instead of answering in the
  browser.
- **Flutter app**: the same tickets and refusals; the descriptions settle what its ticket screen labels.
- **Terminal / POS**: retail tickets come from `/v1/retail/tickets`, not `Bet`; unaffected.

## Until it lands

- The placed ticket shows the API's figures only — no rule-set version, no recomputation — and labels
  `potential_payout` "Potential payout", which claims nothing about tax.
- `BET_MARKET_SUSPENDED`, `BET_STAKE_TOO_HIGH`, `BET_LIMIT_EXCEEDED` (on the stake and on a leg) and the
  RG refusals are proven in `tests/component/PlaceBet.test.tsx` and `tests/unit/refusals.test.ts` with
  the contract's `Problem` shape; `pnpm ui` shows `home-slip-limit-reached` and
  `home-slip-stake-too-high` from answers given in the browser.
- A bet with no answer stays unconfirmed through any refusal of a retry, which the slip calls "Try again
  didn't go through", never a refused bet; only a ticket — its own, or one for a bet the player chose to
  place as new — ends it.
- F5b shows the My bets tabs without counts.
