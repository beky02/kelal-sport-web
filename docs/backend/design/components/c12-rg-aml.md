# C12 Responsible Gambling & AML

## 1. Purpose & scope

C12 enforces player protection and anti-money-laundering controls. It covers deposit, stake and loss limits, time-outs, self-exclusion, reality checks, AML rules and alerts, and watch lists. It implements RG-01 to RG-08 and supports WDR-04 and REP-07. The regulator's relaunch focus on monitoring and youth harm makes this a licensing-critical component.

## 2. Research notes

| Practice | Adopted rule | Basis |
| --- | --- | --- |
| Limit changes | Decreases immediate; increases after a 24 h cooling-off | Common regulated-market standard (e.g. UK, Kenya) |
| Self-exclusion | Fixed periods, irreversible until the end; marketing stops; funds withdrawable | Same |
| Reality check | Pop-up after N minutes showing time and net result | Same |
| AML typologies for betting | Deposit-and-withdraw with little play, structuring below thresholds, third-party funding, chip dumping via accumulators, abnormal win rates | FATF guidance on gambling sector ML risk |
| Local context | ELS cited illicit fund transfers and youth harm when revoking licences (Dec 2025) | Research doc |

## 3. Data model

```sql
create table compliance.rg_limit (
  id uuid primary key, tenant_id uuid not null, player_id uuid not null,
  type text not null check (type in ('deposit','stake','loss','session_minutes')),
  period text not null check (period in ('day','week','month')),
  amount_santim bigint,                      -- null for session_minutes (use minutes)
  minutes int,
  effective_from timestamptz not null,       -- now for decreases, now+24h for increases
  replaced_at timestamptz,
  created_at timestamptz not null default now()
);
create index ix_rg_limit_active on compliance.rg_limit (tenant_id, player_id, type, period) where replaced_at is null;

create table compliance.exclusion (
  id uuid primary key, tenant_id uuid not null, player_id uuid not null,
  kind text not null check (kind in ('time_out','self_exclusion','operator_exclusion')),
  starts_at timestamptz not null, ends_at timestamptz,        -- null = permanent
  reason text, created_by text not null, created_at timestamptz not null default now()
);

create table compliance.usage_counter (       -- rolling totals for fast limit checks (also cached in Redis)
  tenant_id uuid, player_id uuid, period text, period_start date,
  deposits_santim bigint not null default 0, stakes_santim bigint not null default 0,
  net_loss_santim bigint not null default 0,
  primary key (tenant_id, player_id, period, period_start)
);

create table compliance.aml_rule (
  id uuid primary key, tenant_id uuid not null, code text not null,
  params jsonb not null, action text not null check (action in ('alert','hold_withdrawal','block')),
  active boolean not null default true
);

create table compliance.aml_alert (
  id uuid primary key, tenant_id uuid not null, player_id uuid not null,
  rule_code text not null, score numeric(5,2), evidence jsonb not null,
  status text not null check (status in ('open','investigating','cleared','reported','closed')),
  assigned_to uuid, decision_note text, str_reference text,   -- suspicious transaction report ref
  created_at timestamptz not null default now(), decided_at timestamptz
);

create table compliance.watchlist_entry (
  id uuid primary key, tenant_id uuid not null,
  kind text not null check (kind in ('national_id_hash','phone','payout_account','name_dob')),
  value_hash bytea not null, source text not null, created_at timestamptz not null default now()
);
```

## 4. Interface (used by other modules)

```python
class Compliance(Protocol):
    async def check_deposit(self, player_id, amount) -> None   # raises RgLimitReached / SelfExcluded
    async def check_stake(self, player_id, amount) -> None
    async def record_deposit(self, player_id, amount) -> None
    async def record_stake(self, player_id, amount) -> None
    async def record_result(self, player_id, stake, payout) -> None   # loss counters
    async def withdrawal_verdict(self, player_id, amount, account) -> Verdict  # ok | hold(reason)
```

## 5. AML rules (initial set, thresholds are placeholders)

| Code | Logic | Action |
| --- | --- | --- |
| `LARGE_DEPOSIT` | Single deposit ≥ 50,000 ETB | Alert |
| `LOW_PLAY_CASHOUT` | Withdrawal where stakes since last deposit < 50% of deposits | Hold withdrawal |
| `STRUCTURING` | ≥ 5 deposits in 24 h each just under the large-deposit threshold | Alert |
| `NEW_PAYOUT_ACCOUNT` | Payout account added < 24 h before withdrawal | Hold |
| `THIRD_PARTY` | Deposit source name ≠ verified name (when the provider returns it) | Alert |
| `WIN_RATE` | 30-day ROI > 50% with > 100 bets | Alert to traders (possible fixing or arbitrage) |
| `WATCHLIST_HIT` | ID, phone or payout account on watch list | Block + alert |
| `SHARED_DEVICE` | Device linked to ≥ 3 accounts (C02 signal) | Alert |
| `RETAIL_LARGE_PAYOUT` | Retail payout above the ID threshold | Alert |
| `RETAIL_CANCEL_RATE` | Cashier cancel rate far above the shop average | Alert |

Rules run on events (`payment.*`, `bet.settled`, `kyc.duplicate_detected`) in the worker, plus synchronously in `withdrawal_verdict`.

## 6. API

`GET /v1/me/limits` → current and pending limits · `PUT /v1/me/limits` `{type, period, amount}` → returns `effective_from` · `POST /v1/me/self-exclusion` `{kind: "time_out"|"self_exclusion", duration: "24h"|"7d"|"30d"|"6m"|"1y"|"5y"|"permanent"}` → revokes sessions immediately · Staff: `/v1/admin/aml/alerts` queue with decisions and a suspicious-report reference field.

## 7. Events

Publishes `rg.limit_changed`, `rg.self_excluded`, `aml.alert_raised`. Consumes `payment.deposit_completed`, `payment.withdrawal_*`, `bet.placed`, `bet.settled`, `kyc.duplicate_detected`, `player.login` (session timer), `retail.ticket_sold`, `retail.ticket_paid`, `retail.ticket_cancelled`.

## 8. Edge cases & tests

- **Period boundaries** in EAT (a “day” is 00:00–24:00 EAT); weekly periods start Monday.
- **Loss limit** counts settled net losses only; open stakes count toward stake limits.
- **Self-exclusion mid-bet**: open bets stand and settle; winnings are withdrawable; no new bets.
- **Tests**: limit timing (decrease now, increase after 24 h), exclusion blocks all channels within 60 s, each AML rule with positive and negative fixtures.
