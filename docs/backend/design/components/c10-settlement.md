# C10 Settlement

## 1. Purpose & scope

C10 turns provider results into settled bets and money. It records outcome results, resolves each affected bet with C07, posts winnings, losses and voids through C03, and handles rollbacks, cancellations and manual settlement. It implements SET-01 to SET-08 and meets NFR-P6 (10,000 bets in < 60 s).

## 2. Research notes

| Topic | Finding | Design |
| --- | --- | --- |
| Provider messages | `bet_settlement` carries per-outcome result, `void_factor`, `dead_heat_factor` and a certainty level; `rollback_bet_settlement` reverses; `bet_cancel` voids markets for a time window | Each has its own handler |
| Double settlement | Some markets get a second settlement from a different producer (e.g. live producer then pre-match) | Idempotent on `(outcome, producer, message ts)`; the latest certain result wins |
| Certainty | Settle on confirmed results; provisional (“live”) results can wait | Settle only at the configured certainty level |
| Source | [UOF messages](https://docs.sportradar.com/uof/data-and-features/messages) | — |

## 3. Responsibilities & boundaries

- **Owns**: `outcome_result`, settlement runs, per-bet settlement records (versions), manual settlement requests.
- **Updates**: `betting.bet` and `bet_selection` status **through C08's interface** (`betting.apply_settlement(...)`), not direct SQL.
- **Calls**: C07 (payout maths with `settled=True`), C03 (postings), C11 (bonus wagering and free-bet rules) and C08 (release liability).

## 4. Data model

```sql
create table settlement.outcome_result (
  outcome_id        uuid not null,
  version           int not null,              -- increments on rollback + resettle
  result            text not null check (result in ('win','lose','void','half_win','half_lose')),
  void_factor       numeric(3,2) not null default 0,
  dead_heat_factor  numeric(5,4) not null default 1,
  certainty         smallint not null,
  source            text not null check (source in ('feed','manual')),
  provider_ts_ms    bigint,
  rolled_back_at    timestamptz,
  created_at        timestamptz not null default now(),
  primary key (outcome_id, version)
);

create table settlement.bet_settlement (
  id               uuid primary key,
  tenant_id        uuid not null,
  bet_id           uuid not null,
  version          int not null,               -- 1 = first settlement, 2 = after rollback, ...
  outcome          text not null check (outcome in ('won','lost','void','partial')),
  payout_santim    bigint not null,
  win_tax_santim   bigint not null default 0,
  acca_bonus_santim bigint not null default 0,
  ledger_txn_id    uuid,
  reversed_by      uuid,                        -- settlement id that reversed it
  created_at       timestamptz not null default now(),
  unique (bet_id, version)
);

create table settlement.manual_request (
  id uuid primary key, tenant_id uuid not null,
  scope text not null check (scope in ('outcome','market','bet')), scope_id uuid not null,
  action text not null check (action in ('settle','void','resettle')),
  result text, reason text not null,
  requested_by uuid not null, approved_by uuid,
  status text not null check (status in ('pending','approved','rejected','applied')),
  created_at timestamptz not null default now()
);
```

## 5. Key flows

**On `feed.settlement_received`** (worker, per fixture batch):

1. Upsert `outcome_result` rows (new version only if the result differs from the latest un-rolled-back row).
2. Find open selections on those outcomes (`ix_sel_outcome_open`), set their results.
3. Collect affected bets; for each bet whose legs are now all resolved (or any leg lost, for multiples):

```python
async def settle_bet(bet_id):
    async with db.transaction():
        bet = await betting.lock_bet(bet_id)  # FOR UPDATE
        if bet.status != "open":
            return  # idempotent
        rules = await tenancy.rules_version(bet.rules_version)  # same rules as placement
        q = slipcalc.quote(bet.to_slip(), rules, settled=True)
        lines = settlement_postings(bet, q)  # WIN / LOSS / VOID templates (C03 §6)
        txn = await ledger.post(
            txn_type=kind(q), idempotency_key=f"settle:{bet.id}:v{bet.settle_version}", lines=lines
        )
        await repo.insert_bet_settlement(bet, q, txn)
        await betting.apply_settlement(bet, q)  # status, payout, settled_at
        await risk.release(bet)  # decrement liability
        outbox.add("bet.settled", bet)
```

4. Process in chunks of 500 bets with 8 parallel workers (NFR-P6).
5. **Early loss for multiples**: if any leg loses, the whole bet settles as lost immediately.

**On rollback**: mark the `outcome_result` version rolled back. For every bet settled using it, post a reversal of its settlement transaction, set the bet back to `open` with `settle_version + 1`, and notify the player (“result under review”). The next settlement message re-settles it.

**Clawback risk**: if a reversal would make the player's cash negative (winnings already withdrawn), post against `allow_negative` on a dedicated `PLAYER_DEBT` account instead, block withdrawals until it is cleared, and open a finance case.

**On `bet_cancel`**: void the selections of the affected markets (within the start and end time window); resolve the bets as above.

**Manual settlement**: a trader creates a request, a second trader approves it (above the amount threshold), and it is applied as `source='manual'` results through the same code path.

## 6. Events

| Consumes | Publishes |
| --- | --- |
| `feed.settlement_received`, `feed.rollback_received`, `feed.cancel_received` | `bet.settled {bet_id, outcome, payout}`, `bet.resettled`, `settlement.clawback_created` |

## 7. Configuration

`settlement.min_certainty` (2 = confirmed), `settlement.batch_size` (500), `settlement.workers` (8), `settlement.void_if_postponed_hours` (48), `settlement.manual_approval_threshold_santim` (100,000 = 1,000 ETB), `settlement.stale_open_hours` (72, SET-06).

## 8. Edge cases

- **Abandoned match**: provider cancel → void the markets not yet decided; already-decided markets (e.g. first-half result) stand per provider settlement.
- **Settlement before bet commit** (race): bets placed on a market after its settlement arrived are impossible, because C05 sets market status to settled first and C08 rejects. A nightly check verifies.
- **Dead heat**: C07 applies `dead_heat_factor` to the stake portion.
- **Out-of-order rollback** (rollback before settlement) → ignore, and log it.

## 9. Tests

Feed-replay settlement of 7 recorded match days vs expected results; rollback → resettle round trip; clawback path; manual 4-eyes; throughput test at 10,000 bets per fixture.

## Retail tickets (added for C19)

Settlement grades retail bets exactly like online bets. Only the money step differs: instead of crediting a wallet, C10 posts `RETAIL_WIN`, `RETAIL_LOSS` or `RETAIL_VOID` (C19 section 7), and C19 consumes `bet.settled` to move the ticket to `won`, `lost` or `void` and set the payable amount and the claim deadline. No push or SMS is sent, since the customer is anonymous; they check the ticket at a shop or on the public ticket page.

Resettlement after a ticket has been paid cannot take money back from an anonymous customer. The difference is posted against `SHOP_CASH` of the paying shop as an operator adjustment, reported on the agent statement, and flagged for review; it never creates a `PLAYER_DEBT`.
