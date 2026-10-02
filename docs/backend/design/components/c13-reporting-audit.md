# C13 Regulator Reporting & Audit

## 1. Purpose & scope

C13 guarantees that every reportable fact reaches the regulator and that every staff action is traceable. It covers the transactional outbox, the reporter service, daily and monthly summaries, regulator exports and the audit log. It implements REP-01 to REP-07. The regulator's interface is unknown (TBD-2), so everything regulator-specific sits behind one adapter.

## 2. Research notes

| Finding | Design consequence |
| --- | --- |
| ELS is building “a unified digital system to record and monitor operators' financial and legal obligations” and will monitor transactions in real time before granting licences ([Birr Metrics](https://birrmetrics.com/sports-betting-relaunch-ethiopia-audit/)) | Real-time push, guaranteed delivery, replay on demand |
| Operators under-paid commissions (12% of 30B birr assessed) | Levy computed per bet and reconciled daily to the ledger; reports prove totals |
| Central monitoring systems that receive operator data directly are a common pattern in regulated betting markets | Same pattern expected; adapter isolates format |

## 3. Transactional outbox pattern

Each module writes to `reporting.outbox_event` **inside its own business transaction** (via `shared.outbox`). The relay publishes to NATS for internal consumers. The `reporter` service separately reads reportable types and delivers them to the regulator. Because the outbox row commits with the business change, no event can be lost or invented.

## 4. Data model

```sql
create table reporting.outbox_event (
  id            uuid primary key,              -- = event_id
  tenant_id     uuid not null,
  type          text not null,                 -- bet.placed, payment.deposit_completed, ...
  aggregate_id  uuid not null,
  payload       jsonb not null,
  reportable    boolean not null default false,
  created_at    timestamptz not null default now(),
  published_at  timestamptz                    -- NATS relay
) partition by range (created_at);
create index ix_outbox_unpub on reporting.outbox_event (created_at) where published_at is null;

create table reporting.regulator_delivery (
  event_id      uuid primary key,
  tenant_id     uuid not null,
  attempt_count int not null default 0,
  status        text not null check (status in ('pending','sent','acked','failed')),
  regulator_ref text,
  last_error    text,
  next_attempt_at timestamptz,
  acked_at      timestamptz
);
create index ix_delivery_due on reporting.regulator_delivery (next_attempt_at) where status in ('pending','failed');

create table reporting.daily_summary (
  tenant_id uuid not null, business_date date not null, product text not null,   -- sports, virtuals
  channel text not null check (channel in ('online','retail')),
  shop_code text not null default '',   -- '' for online
  shop_id uuid,                         -- null for online
  bets_count bigint, turnover_santim bigint, winnings_santim bigint, ggr_santim bigint,
  stake_tax_santim bigint, win_tax_santim bigint, levy_santim bigint,
  deposits_santim bigint, withdrawals_santim bigint, active_players int,
  ledger_reconciled boolean not null default false,
  generated_at timestamptz not null default now(),
  primary key (tenant_id, business_date, product, channel, shop_code)
);

create table reporting.audit_log (
  id bigserial, tenant_id uuid not null,
  actor_type text not null check (actor_type in ('staff','player','system')),
  actor_id uuid, action text not null,            -- e.g. wallet.adjust, config.update, player.view
  target_type text, target_id uuid,
  before jsonb, after jsonb, ip inet, user_agent text, trace_id text,
  created_at timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);
-- app role: INSERT only; no UPDATE/DELETE grants.
```

## 5. Reportable events (draft canonical schema)

| Event | Key fields sent |
| --- | --- |
| `player.registered` | player ref (pseudonymous), age band, region, registration time |
| `kyc.status_changed` | player ref, status, method |
| `payment.deposit_completed` / `withdrawal_paid` | player ref, amount, method, provider ref, time |
| `bet.placed` | ticket ID, player ref, channel, product, stake, taxes, odds, legs (fixture, market, outcome, odds) |
| `bet.settled` / `resettled` / `voided` | ticket ID, result, payout, win tax |
| `retail.ticket_sold` | ticket ID, shop code, cashier, stake, taxes, odds, legs |
| `retail.ticket_paid` | ticket ID, shop code, cashier, payout, win tax, time |
| `retail.ticket_cancelled` | ticket ID, shop code, cashier, reason, time |
| `wallet.adjusted` | amount, reason code, approvers |
| `rg.self_excluded` / `rg.limit_changed` | player ref, type, period |
| `game.round_closed` (R2) | round ID, stake, win |

Player identity is sent as a stable pseudonymous reference unless the directive demands personal data (Proclamation 1321/2024 data minimisation).

## 6. Reporter service

```python
while True:
    batch = await repo.claim_due(limit=500)  # FOR UPDATE SKIP LOCKED
    for d in batch:
        try:
            ref = await adapter.send(to_regulator_format(d.event))  # adapter per directive
            await repo.mark_acked(d, ref)
        except Retryable as e:
            await repo.reschedule(d, backoff(d.attempt_count), str(e))  # 1s, 5s, 30s, 2m ... max 1h
        except Permanent as e:
            await repo.mark_failed(d, str(e))
            alert("regulator_permanent_failure", d)
```

SLO: 99% of events acknowledged within 60 s; backlog age alert at 5 minutes. A replay endpoint re-sends a date range on the regulator's request.

## 7. Summaries and exports

- **Daily job** (02:00 EAT): builds `daily_summary` from betting and ledger data and marks `ledger_reconciled` only if the totals match C03's reconciliation.
- **Monthly report**: turnover, GGR, levy due; exported as CSV/XLSX and PDF.
- **On-demand exports** (REP-07): player history, self-exclusion list and KYC status list, generated asynchronously, stored encrypted, downloadable once.

## 8. Audit log rules

- Every staff API call that changes state writes an audit row via middleware (before/after for configuration and money).
- Viewing a player's personal data writes `player.view` (who looked at whom).
- Audit log is append-only. Optionally, rows are chained with a hash of the previous row for tamper evidence.

## 9. Tests

Outbox atomicity (rollback → no event), reporter retry/backoff, replay, summary vs ledger reconciliation, audit coverage test (every staff route declares an audit action; CI fails if missing).

## Retail data for the regulator (added for C19)

Every retail sale, payout and cancellation is reported like an online bet, with extra fields: `channel = retail`, shop code and regulator outlet id (`licence_ref`), region and city, terminal id (when the slip came from a terminal), cashier id, and for payouts above the ID threshold the ID type and a hash of the ID number. Daily totals are broken down by channel and by shop, and the reporter includes a shop register (open, suspended, closed) so the regulator can match outlets to its licence records. Exact field names wait for the regulator's interface specification (TBD-2).
