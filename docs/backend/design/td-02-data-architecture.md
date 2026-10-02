# TD-02 Data Architecture

One PostgreSQL 16 cluster holds one schema per module. Redis holds hot, rebuildable state; NATS JetStream carries events; object storage holds documents and archives. The full DDL for each table is on its component page; this page sets the rules every table follows.

## 1. Schemas and tables

| Schema (owner) | Tables | Approx. volume, year 1 |
| --- | --- | --- |
| `tenancy` (C16) | tenant, tenant\_domain, tenant\_config, tenant\_config\_version, feature\_flag | Tiny |
| `identity` (C01) | player, credential, session, otp\_challenge, device | 500k players |
| `kyc` (C02) | kyc\_case, kyc\_document, fayda\_verification, duplicate\_signal | 500k |
| `ledger` (C03) | account, ledger\_txn, ledger\_entry, adjustment\_request, recon\_run, recon\_break | \~200M entries |
| `payments` (C04) | payment, payment\_event, payout\_account, provider\_settlement\_line | 10M |
| `feed` (C05) | raw\_message (partitioned), producer\_state, id\_mapping | \~1B raw messages (90 days) |
| `catalogue` (C06) | sport, category, tournament, competitor, fixture, market\_template, outcome\_template, market, outcome, dictionary\_version, translation | \~50k fixtures live; millions historic |
| `betting` (C08) | bet, bet\_selection, bet\_leg\_combination, risk\_limit, liability\_snapshot | \~60M bets |
| `booking` (C09) | booking | 20M (expire) |
| `settlement` (C10) | outcome\_result, settlement\_run, bet\_settlement | \~100M |
| `bonus` (C11) | bonus\_rule, player\_bonus, wagering\_progress, free\_bet, promo\_code, promo\_redemption | 5M |
| `compliance` (C12) | rg\_limit, rg\_limit\_change, exclusion, aml\_rule, aml\_alert, watchlist\_entry | 1M |
| `reporting` (C13) | outbox\_event, regulator\_delivery, daily\_summary, audit\_log | \~300M rows / year |
| `notify` (C14) | template, message, inbox\_item, push\_token, campaign | 50M |
| `backoffice` (C15) | staff, role, role\_permission, staff\_session, note, cms\_banner, cms\_page | Small |
| `games` (C17, R2) | game, game\_session, game\_round, game\_txn | 100M |
| `shared` | idempotency, job\_lock | Rolling 24 h |
| `retail` (C19) | agent, shop, terminal, staff, pos\_device, shift, ticket, cash\_movement, payout\_approval, settlement, commission\_plan, commission\_statement | Medium (one ticket row per retail bet; cash movements per sale); partition ticket and cash\_movement monthly |

## 2. Conventions

- **Primary keys**: `id uuid` generated as UUIDv7 in the app (time-ordered, index-friendly).
- **Tenant**: every tenant-owned table (players, wallets, ledger, bets, bonuses, config, reports) has `tenant_id uuid not null`; composite indexes start with `tenant_id`.
- **Global tables (exception)**: `tenancy.*`, `feed.*`, the global `catalogue.*` tables (fixtures, markets, outcomes, raw provider odds, results) and `settlement.outcome_result` hold data shared by every tenant, so they carry no `tenant_id` and no RLS; the app role has read-only grants on the feed and catalogue tables outside C05/C06. Per-tenant pricing (margin, market enablement, limits) lives in tenant-scoped override tables and is applied at read time, as described in C06.
- **Row-level security**: enabled with `FORCE` on every tenant-scoped table (Engineering Decisions D3); policy `using (tenant_id = current_setting('app.tenant_id', true)::uuid)`. The app role is not a superuser and does not own the tables, so it cannot bypass RLS.
- **Outbox**: one `shared.outbox` table, written in the same transaction as the change and relayed to NATS by the worker; `reporting.outbox_event` is the regulator reporter's own queue.
- **Timestamps**: `created_at timestamptz not null default now()`; `updated_at` where rows change; all UTC.
- **Money**: `bigint` santim (1 ETB = 100). Column names end in `_santim` in SQL; the API converts to decimal strings.
- **Odds**: `numeric(10,3)`.
- **Status fields**: `text` with a `CHECK` constraint listing allowed values (easier to evolve than PostgreSQL enums).
- **Soft delete**: none on financial tables. Player closure is a status, not a delete.
- **Optimistic concurrency**: `version int` on mutable aggregates (bet, payment, kyc\_case).
- **Naming**: snake\_case; foreign keys `<entity>_id`; indexes `ix_<table>_<cols>`; uniques `uq_<table>_<cols>`.

Example of the shared pattern:

```sql
create table betting.bet (
  id              uuid primary key,
  tenant_id       uuid not null,
  -- … domain columns …
  version         int  not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table betting.bet enable row level security;
alter table betting.bet force row level security;
create policy tenant_isolation on betting.bet
  using (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

## 3. Partitioning and retention

| Table | Partition key | Retention in PostgreSQL | Archive |
| --- | --- | --- | --- |
| `feed.raw_message` | `received_at`, daily | 14 days | Compressed JSONL to object storage, 90 days |
| `ledger.ledger_entry` | `created_at`, monthly | 7 years | Never deleted |
| `betting.bet`, `bet_selection` | `placed_at`, monthly | 7 years | Cold partitions on cheaper tablespace |
| `reporting.outbox_event` | `created_at`, weekly | 30 days after delivery | Delivery log kept 7 years |
| `reporting.audit_log` | `created_at`, monthly | 7 years | — |
| `notify.message` | `created_at`, monthly | 12 months | — |
| `shared.idempotency` | — | 24 h (sweeper) | — |

Partitions are managed with [pg\_partman](https://github.com/pgpartman/pg_partman).

## 4. Redis key catalogue

| Key pattern | Type | Owner | Content | TTL |
| --- | --- | --- | --- | --- |
| `odds:{outcome_id}` | hash | C05 | price, status, version | none (rebuilt from DB) |
| `mkt:{market_id}` | hash | C05 | status, version | none |
| `fx:{fixture_id}` | hash | C06 | start time, status | none |
| `liab:{tenant}:{fixture_id}` | hash | C08 | liability per outcome (santim) | 3 days after fixture |
| `lim:{tenant}:player:{id}` | hash | C08 / C12 | stake and RG limits snapshot | 5 min |
| `otp:{purpose}:{phone}` | hash | C01 | hashed code, attempts | 5 min |
| `rl:{bucket}:{key}` | string | gateway | token-bucket counters | seconds |
| `dict:{tenant}:{lang}` | string | C06 | serialised dictionary + version | until version changes |
| `cache:events:{hash}` | string | C06 | cached list pages | 10 s |
| `lock:{name}` | string | worker | leader / job locks | 30 s |

The `odds:`, `mkt:` and `fx:` keys are global: they hold raw provider prices written once by C05. Tenant margin is applied when C06 serves the price, so one feed update never fans out into N tenant writes. Everything else in the table above is tenant-scoped.

Redis is never the source of truth for money or bets. Every value can be rebuilt from PostgreSQL on restart.

## 5. Event catalogue (NATS JetStream)

Envelope for every event:

```json
{
  "event_id": "0192f3a4-…",
  "type": "bet.placed",
  "version": 1,
  "tenant_id": "…",
  "occurred_at": "2026-10-03T14:05:22Z",
  "trace_id": "…",
  "data": { "...": "..." }
}
```

| Subject | Producer | Consumers | Purpose |
| --- | --- | --- | --- |
| `feed.odds_changed` | C05 | C06 (cache), C08 (liability refresh) | Price or status change |
| `feed.bet_stop` | C05 | C06 | Suspend markets |
| `feed.settlement_received` | C05 | C10 | Results to settle |
| `feed.rollback_received` / `feed.cancel_received` | C05 | C10 | Reverse or void |
| `feed.producer_down` / `feed.producer_up` | C05 | C06, C15 | Suspend all, alert |
| `player.registered` | C01 | C11 (welcome), C13, C14 | New account |
| `player.login` | C01 | C12, C13 | Device and velocity checks, activity reports |
| `player.status_changed` | C01 | C12, C13, C14 | Account suspended, closed or reopened |
| `kyc.status_changed` | C02 | C04, C13, C14 | Unlock withdrawals |
| `kyc.duplicate_detected` | C02 | C12, C15 | Possible duplicate account for review |
| `ledger.recon_break` | C03 | C15 | Reconciliation break for finance review |
| `payment.deposit_completed` | C04 | C11, C12, C13, C14 | Bonus, AML, report, notify |
| `payment.withdrawal_paid` / `_failed` | C04 | C12, C13, C14 | — |
| `payment.payout_account_added` | C04 | C02, C12 | Ownership and AML checks on a new payout account |
| `bet.placed` | C08 | C12 (velocity), C13 | — |
| `bet.settled` / `bet.resettled` | C10 | C11 (wagering counts on settle), C13, C14, C19 (retail tickets) | — |
| `settlement.clawback_created` | C10 | C13, C15 | Winnings to recover after a resettlement |
| `bonus.granted` / `_completed` / `_expired` | C11 | C13, C14 | Bonus lifecycle for reports and notifications |
| `rg.self_excluded` / `rg.limit_changed` | C12 | C01 (session revoke), C13, C14 | — |
| `aml.alert_raised` | C12 | C15 | Review queue |
| `config.changed` | C16 | all (cache invalidation) | — |
| `game.round_closed` (R2) | C17 | C11, C13 | — |
| `game.debit` (R2) | C17 | C12, C13 | Game stake for velocity checks and reports |
| `retail.ticket_sold` | C19 | C12, C13, C15 | Shop sale (with shop, terminal and cashier) |
| `retail.ticket_paid` | C19 | C12, C13, C15 | Shop payout |
| `retail.ticket_cancelled` | C19 | C12, C13 | Shop cancel |
| `retail.shift_closed` | C19 | C14, C15 | Z report, variance alert |
| `retail.shop_settled` | C19 | C13, C15 | Cash moving up the hierarchy |

Event schemas live in `contracts/events/*.json` (JSON Schema). Consumers are idempotent by `event_id`, and new fields are additive only.

## 6. Backups and recovery

- Continuous WAL archiving plus a nightly base backup (e.g. pgBackRest or CloudNativePG backups) to a second site.
- Synchronous standby for zero data loss on the ledger (NFR-R2).
- Monthly restore drill into a staging cluster, with reconciliation run on the restored data.

## 7. Analytics path

Phase 1: Metabase on a read replica with read-only views per report. Later: change-data-capture (Debezium) or nightly exports into ClickHouse for heavy reporting and trader dashboards.
