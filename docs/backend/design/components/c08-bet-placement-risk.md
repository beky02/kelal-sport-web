# C08 Bet Placement & Risk

## 1. Purpose & scope

C08 accepts or rejects bets. It validates the slip, re-prices it, checks player, responsible-gambling and trader limits, updates liability, debits the stake and stores the bet atomically. It implements BET-01 to BET-14 and BO-06 to BO-09, and meets NFR-P1 (p95 < 800 ms).

## 2. Research notes

| Topic | Finding | Design |
| --- | --- | --- |
| Server re-pricing | Every serious book re-reads odds at placement and applies the player's odds-change preference; competitors send only outcome IDs and let the server price | Client sends `odds_seen`; server compares |
| Liability | Books track worst-case payout per outcome; accumulators add exposure to every leg's outcome | Liability counters per outcome in Redis, recomputed from DB nightly |
| Managed risk | Sportradar MTS can accept or reject tickets in real time with customer profiling, via SDK | Our `RiskGate` interface lets MTS plug in later ([MTS](https://sportradar.com/betting-gaming/trading-risk-management/managed-trading-services/)) |
| Idempotency | Mobile networks drop responses; clients retry | `Idempotency-Key` required; same key returns the same ticket |

## 3. Responsibilities & boundaries

- **Owns**: bets, selections, risk limits, liability counters, placement pipeline, bet history API.
- **Calls**: C06 (current prices and status), C07 (quote), C12 (RG check), C11 (bonus stake and free bet), C03 (stake posting).
- **Does not**: settle bets (C10) or change odds (C05/C06).

## 4. Internal structure

| Part | Role |
| --- | --- |
| `betting/domain/bet.py` | `Bet` aggregate, statuses, ticket-ID generator (Crockford base32 + Luhn mod 32 check) |
| `betting/service/place.py` | `PlaceBetService`: the pipeline below |
| `betting/risk/` | `RiskGate` protocol; `LimitsRiskGate` (built-in); `LiabilityStore` (Redis Lua) |
| `betting/service/query.py` | My bets, bet detail, staff search |
| `betting/api` | `/v1/bets`, `/v1/admin/bets`, `/v1/admin/risk/*` |

## 5. Data model

```sql
create table betting.bet (
  id               uuid primary key,
  tenant_id        uuid not null,
  ticket_id        text not null,
  player_id        uuid,                           -- null for retail bets
  channel          text not null default 'online' check (channel in ('online','retail')),
  client           text check (client in ('app','web','telegram','sms','pos')),
  shop_id          uuid,                           -- retail bets only
  bet_type         text not null check (bet_type in ('single','multiple','system')),
  system_sizes     int[],
  lines            int not null,
  stake_santim     bigint not null,
  stake_bonus_santim bigint not null default 0,   -- part paid from bonus balance
  free_bet_id      uuid,
  stake_tax_santim bigint not null default 0,
  total_odds       numeric(14,3),
  potential_payout_santim bigint not null,
  acca_bonus_pct   numeric(5,2) not null default 0,
  rules_version    int not null,                   -- C16 rule-set version used
  odds_policy      text not null check (odds_policy in ('none','higher','any')),
  status           text not null check (status in ('open','won','lost','void','cashed_out','cancelled')),
  payout_santim    bigint,
  win_tax_santim   bigint,
  placed_at        timestamptz not null default now(),
  settled_at       timestamptz,
  idempotency_key  text not null,
  ledger_txn_id    uuid not null,
  client_ip        inet, device_id uuid,
  version          int not null default 1,
  constraint uq_bet_ticket unique (tenant_id, ticket_id),
  constraint ck_bet_channel check ((channel = 'online' and player_id is not null) or (channel = 'retail' and shop_id is not null))
);
-- idempotency: per (tenant, player or shop, key)
create unique index uq_bet_idem on betting.bet (tenant_id, coalesce(player_id, shop_id), idempotency_key);
create index ix_bet_player on betting.bet (tenant_id, player_id, placed_at desc);
create index ix_bet_open on betting.bet (tenant_id, status) where status = 'open';

create table betting.bet_selection (
  id              uuid primary key,
  tenant_id       uuid not null,
  bet_id          uuid not null references betting.bet(id),
  leg_no          smallint not null,
  fixture_id      uuid not null,
  market_id       uuid not null,
  outcome_id      uuid not null,
  specifiers      text not null default '',
  odds_seen       numeric(10,3) not null,
  odds_taken      numeric(10,3) not null,
  result          text not null default 'open'
                  check (result in ('open','win','lose','void','half_win','half_lose')),
  void_factor     numeric(3,2), dead_heat_factor numeric(5,4),
  settled_at      timestamptz,
  unique (bet_id, leg_no)
);
create index ix_sel_outcome_open on betting.bet_selection (outcome_id) where result = 'open';

create table betting.risk_limit (
  id          uuid primary key,
  tenant_id   uuid not null,
  scope       text not null check (scope in ('global','sport','tournament','fixture','market_template','market','player','segment')),
  scope_id    uuid,
  max_stake_santim     bigint,
  max_payout_santim    bigint,
  max_liability_santim bigint,             -- per outcome within scope
  bet_delay_s  int,                         -- used for live later
  updated_by   uuid, updated_at timestamptz not null default now()
);
```

## 6. API

```json
// POST /v1/bets        Headers: Authorization, Idempotency-Key
{
  "bet_type": "multiple",
  "legs": [
    { "outcome_id": "oc_01", "odds": "1.85" },
    { "outcome_id": "oc_77", "odds": "2.10" }
  ],
  "stake": "100.00",
  "odds_policy": "higher",
  "use_bonus": false,
  "free_bet_id": null
}
// 201 Created
{
  "id": "b_0192…", "ticket_id": "K7Q2-M9XP-4", "status": "open",
  "stake": "100.00", "stake_tax": "15.00", "total_odds": "3.88",
  "potential_payout": "330.22", "acca_bonus": "0.00",
  "legs": [ { "outcome_id": "oc_01", "odds_taken": "1.85" }, { "outcome_id": "oc_77", "odds_taken": "2.10" } ],
  "balance": { "cash": "900.00", "bonus": "0.00" },
  "placed_at": "2026-10-03T14:05:22Z"
}
// 409 BET_ODDS_CHANGED  → errors[] with current odds per leg
// 403 RG_LIMIT_REACHED
// 422 BET_LIMIT_EXCEEDED | BET_MAX_PAYOUT | WALLET_INSUFFICIENT_FUNDS …
// total_odds is display only: product of the odds floored to 2 decimals
```

`GET /v1/bets?status=open|settled&cursor=` · `GET /v1/bets/{id}` (full legs and results).

## 7. Placement pipeline

```python
async def place(req, player, idem_key):
    if cached := await idem.get(player.id, idem_key):
        return cached  # 0 replay
    assert_real_money_enabled()
    assert_player_can_bet(player)  # 1 status, KYC-light, flags
    await compliance.check_stake(player.id, req.stake)  # 2 RG limits (C12)
    prices = await catalogue.current_prices([l.outcome_id for l in req.legs])  # 3 Redis read
    legs = reprice(req.legs, prices, req.odds_policy)  # 4 raises OddsChanged / Suspended / Started
    rules = await tenancy.rules("betting")  # 5 rule-set + version
    q = slipcalc.quote(Slip(legs, req.bet_type, req.system_sizes, req.stake), rules)
    limits = await risk.check_and_reserve(player, legs, q)  # 6 Lua: check + add liability atomically
    try:
        async with db.transaction():  # 7 atomic commit
            bet = Bet.new(player, legs, q, rules.version, idem_key)
            txn = await ledger.post(
                txn_type="BET_STAKE", idempotency_key=f"stake:{bet.id}", lines=stake_lines(bet, q)
            )
            bet.ledger_txn_id = txn.id
            await repo.insert(bet)
            outbox.add("bet.placed", bet)
    except Exception:
        await risk.release(limits)  # undo Redis reservation
        raise
    resp = to_response(bet)
    await idem.put(player.id, idem_key, resp)
    return resp
```

## 8. Liability algorithm

- For a single: `liability[outcome] += potential_payout − stake`.
- For an accumulator: add `potential_payout − stake` to **each** leg's outcome counter. This is conservative: it counts the full exposure on every leg, because any leg losing wipes it out, but each leg is where the book is exposed.
- The Lua script checks every outcome's `current + add ≤ max_liability` (the most specific limit wins: market > fixture > tournament > sport > global) and increments atomically, or returns the first breach.
- Nightly job recomputes counters from open bets to correct drift; C10 decrements on settlement.

## 9. Configuration

From C07 rule-set, plus `betting.default_odds_policy` ("higher"), `betting.max_bets_per_minute` (10 per player), `betting.related_market_pairs` (allow-list of combinable same-fixture markets, empty in R1), `risk.large_bet_alert_santim` (5,000,000 = 50,000 ETB).

## 10. Edge cases & failure modes

- **Redis down** → fail closed: reject bets with 503 (P6) rather than accept without a liability check.
- **DB commit fails after the Redis reservation** → release in `except`; the nightly recompute fixes any leak.
- **Fixture starts during placement** → the price read in step 3 includes status; the final check uses `start_time > now()` in step 4.
- **Same slip placed twice quickly with different idempotency keys** → allowed (legitimate), subject to rate limit.
- **Bonus + cash split stake** → C11 decides the split; winnings from the bonus part follow the bonus rules.

## 11. Tests

- Pipeline tests for each rejection code; concurrency test of 500 bets on one outcome near its liability limit (no overshoot).
- Load test: 600 bets/s for 5 minutes with p95 < 800 ms (TD-91).
- Idempotency: network-drop simulation returns the same ticket.

## Retail channel (added for C19)

The placement pipeline is shared by online and shop bets; `channel` switches four steps:

| Step | `online` | `retail` |
| --- | --- | --- |
| Who is placing | Player (`player_id`) | Cashier on behalf of an anonymous customer (`shop_id`, `staff_id`, `shift_id`) |
| Limits | Player stake and RG limits (C12) | Tenant retail limits, shop overrides, shop daily payout cap, shop cash limit (`max_cash_held`) |
| Money | Debit `PLAYER_CASH` / `PLAYER_BONUS` | Debit `SHOP_CASH:{shop}` from the cash taken (`RETAIL_SALE`); no bonuses |
| Liability and risk | Per player segment | Per shop (a shop's exposure on one fixture is capped like a player's) |

Everything else (price check against Redis, odds-change policy, max win, stake tax, outbox event, the single transaction) is identical. `betting.bet.player_id` is nullable for retail rows, guarded by the `channel` check constraint in section 5 above (Engineering Decisions D4).
