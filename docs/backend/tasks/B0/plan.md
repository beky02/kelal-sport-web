# B0 plan — Finish the skeleton

Branch: `task/B0-skeleton`. Mode: interactive — plan approved by the user on 2026-10-01. Sections marked
**(review)** were revised during verification; the finding ids refer to `verification.md`.

## Understanding

Later tasks need four pieces of plumbing that don't exist yet: tenant-scoped transactions that are provably
isolated by row-level security (including on reused pooled connections), a transactional outbox whose worker
relay publishes each event to NATS JetStream exactly once, an `Idempotency-Key` store that replays responses and
serialises concurrent duplicates, and a `/readyz` that reports the real state of PostgreSQL, Redis and NATS.
Around them: a Postgres image with pg_partman, test fixtures that build a throwaway migrated database with two
tenants, an RLS helper every later migration calls, and a CI workflow that runs the same `scripts/verify.sh`
against the same compose stack as a laptop. No business tables and no tenant lookup (B1).

## Spec conflicts and decisions

| # | Topic | Sources | Decision |
|---|---|---|---|
| 1 | RLS policy text | TD-02 §2 example: `tenant_id = current_setting('app.tenant_id', true)::uuid`; task, CLAUDE.md, migration template: `nullif(..., '')::uuid` | **nullif** form. D3 (higher than TD-02) only requires `current_setting('app.tenant_id', true)`, which nullif satisfies, and without it a reused pooled connection raises on `''::uuid` (AC-2). |
| 2 | Event envelope | Task: `{event_id, type, tenant_id, occurred_at, payload}`; TD-02 §5: `{event_id, type, version, tenant_id, occurred_at, trace_id, data}` | **TD-02** (design doc; the task file summarises it). Superset of the task's fields, with the body under `data`. `trace_id` = the request id until OpenTelemetry exists. |
| 3 | Idempotency key scope | TD-00 §6: `(tenant, key, …)`; C08: bet keys unique per `(tenant, player or shop, key)` | Primary key `(tenant_id, scope, key)` where `scope` = the principal (`<audience>:<subject>`). The method, raw path and query go into the request hash, so the same key on another route returns `IDEMPOTENCY_MISMATCH`. **(review, SEC2)** There is no `anonymous` scope: an idempotent request without a principal is refused with 401 `AUTH_INVALID_CREDENTIALS` and never replayed. All 15 contract operations with the header require auth. |
| 4 | Cross-tenant system jobs vs. forced RLS | D3: `shared.outbox` has tenant RLS, the worker runs as `app`, the only roles are migrator/app/feed | **Job-scoped policies** instead of a BYPASSRLS role (not in D3): `current_setting('app.system_job', true) = 'outbox_relay'` (SELECT and UPDATE on outbox) and `= 'idempotency_sweeper'` (SELECT and DELETE on idempotency), set with `SET LOCAL` by `system_session(job)`. **(review, SEC5)** `system_session` lives in `shared/db/system.py`, which import-linter forbids for `modules` and `apps.api`. **(review, Q5/SEC4)** Restrictive policies mean only the relay updates outbox rows and only the sweeper deletes idempotency rows. `app` may update just the relay's bookkeeping columns of the outbox. |
| 5 | `add_event(..., key)` meaning | Stub docstring: "`key` de-duplicates consumers" | `key` is the business identity of the event. A unique `(tenant_id, type, dedup_key)` plus `ON CONFLICT DO NOTHING` means a retried use case writes one row, so one message. `event_id` stays a UUIDv7 (D3) and is the `Nats-Msg-Id`. **(review, Q8)** `add_event` returns False and logs `outbox.duplicate_ignored` on a duplicate. Events that legitimately repeat need versioned keys (documented). |
| 6 | Stored responses **(review, Q1/SEC1)** | TD-00/task: "same key + same body → stored response"; TD-00 §3: placement is a single transaction | **One transaction per idempotent request** (`request_transaction()`): the claim, everything the handler's `tenant_session()` writes, and the stored response commit together on one connection. A raised error or a returned 5xx rolls all of it back and the key can be retried. **(review, Q13)** Each joined `tenant_session()` block is a SAVEPOINT, so it keeps its standalone meaning: an error leaving it undoes just its writes and the request transaction stays usable. Previously the claim (T1) and the use case (T2) each held a pooled connection: N concurrent requests deadlocked a pool of N, and a crash between the two commits lost the stored response. Consequence: a use case that must commit before slow external I/O can't run as-is under an idempotent route; its task decides how. |
| 7 | Test database | TD-91: testcontainers; task: throwaway database or schema on the stack | Throwaway **database** per test session (`sportsbook_test_<epoch>_<hex>`), created by `migrator` (granted `CREATEDB` in the local and CI init script only), migrated with Alembic, dropped at the end. **(review, Q10)** Databases left behind by a crashed run are dropped by a later run once they are 6 hours old. |
| 8 | pg_partman in throwaway DBs | D6: pg_partman; only a superuser can create the extension | `init.sql` creates it in `sportsbook` **and `template1`**, so every new database (test databases included) inherits it. `migrator` gets usage/execute on `partman` so B2's migrations can call `create_parent`. |
| 9 | Leader lock | TD-00 §5: APScheduler single leader via Redis lock; TD-02 lists `shared.job_lock` | Out of scope. B0's only scheduled job (the expiry sweep) is idempotent and safe on every worker. `TODO(B2)` in the worker: needed before the nightly reconciliation job. |
| 10 | Existing local volumes | init scripts only run on an empty volume | `init.sql` becomes idempotent, and `make db-init` re-applies it to a running stack. |
| 11 **(review, Q3)** | NATS in `/readyz` | Task scope: "/readyz checks PostgreSQL, Redis and NATS"; TD-00 §2 lists NATS among the API's dependencies; the quality review argues a NATS blip shouldn't take API pods out of rotation | **Kept as the task says.** The trade-off is raised with the user as a follow-up decision. |

No product rules or contract changes are involved. `SERVICE_UNAVAILABLE`, `IDEMPOTENCY_MISMATCH`,
`VALIDATION_FAILED` and `AUTH_INVALID_CREDENTIALS` already exist in the contract. **(review, S2)** The contract
doesn't yet list 422/503 (and `Retry-After`) on every `Idempotency-Key` operation. That's a follow-up
`/contract-change` for the tasks that implement those routes, and nothing in B0 needs it.

## Design

### Data model (migration `0002`, file `20261001_0002_shared_outbox_idempotency.py`)

`shared.outbox`. RLS via `enable_tenant_rls("shared.outbox", grants="select, insert")`, plus
`grant update (sent_at, claimed_until, attempts, last_error)`. Policies: `outbox_relay_select`, `outbox_relay_update`,
and restrictive `outbox_updates_only_by_relay`.

| column | type | notes |
|---|---|---|
| event_id | uuid PK | UUIDv7, also `Nats-Msg-Id` |
| tenant_id | uuid not null | |
| type | text not null | `ck_outbox_type`: `^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*)+$` |
| dedup_key | text not null | `ck_outbox_dedup_key` (1–200 chars); `uq_outbox_tenant_id_type_dedup_key (tenant_id, type, dedup_key)` |
| version | int not null default 1 | `ck_outbox_version` (≥ 1) |
| occurred_at | timestamptz not null | from `shared.clock` |
| trace_id | text | request id |
| data | jsonb not null | event payload |
| created_at | timestamptz not null default now() | |
| sent_at | timestamptz | null = pending |
| claimed_until | timestamptz | **(review, Q2)** a relay's lease while it publishes |
| attempts | int not null default 0 | publish failures, for operators |
| last_error | text | last publish failure (type and message, ≤ 500 chars) |

Index `ix_outbox_created_at_event_id (created_at, event_id) where sent_at is null`. The name follows TD-02 §2's
`ix_<table>_<cols>` rule; it's partial, for pending rows only, and EXPLAIN shows the relay's claim uses it.

`shared.idempotency`. RLS via `enable_tenant_rls(..., grants="select, insert, update, delete")`. Policies:
`idempotency_sweeper_select`, `idempotency_sweeper_delete`, and restrictive `idempotency_deletes_only_by_sweeper`.

| column | type | notes |
|---|---|---|
| tenant_id | uuid not null | PK part 1 |
| scope | text not null | PK part 2: the principal |
| key | uuid not null | PK part 3: `Idempotency-Key` (contract: format uuid) |
| request_hash | text not null | sha256 over length-prefixed method, raw path, query string, body |
| status | text not null | check in (`in_progress`, `completed`) |
| response_status | int | set when completed |
| response_headers | jsonb | stored subset: `content-type`, `location` |
| response_body | bytea | exact bytes replayed |
| created_at | timestamptz not null default now() | |
| expires_at | timestamptz not null | created + 24 h |

Check `(status = 'completed') = (response_status is not null)`. Index `ix_idempotency_expires_at (expires_at)`.

### RLS helper — `migrations/helpers.py`
`tenant_rls_sql(table, grants)` (validated `schema.table` identifier and grant list) and `enable_tenant_rls`, which
runs it through `op.execute`: enable and force RLS, policy `tenant_isolation` with `USING` and `WITH CHECK` on
`tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`, and grants to `app` (default
`select, insert, update`). **(review, Q7)** Merged migrations call it, so its SQL is pinned by a test, and new
behaviour goes in a new helper.

### Sessions — `shared/db/session.py`, `shared/db/system.py`
`tenant_session()`, `global_session()`, `request_transaction()` (**review, Q1**: `tenant_session()` joins it; it can't
be nested; changing tenant inside it raises), `reset_engine()`, `dispose_engine()`. Pool size, overflow and timeout
are settings. `system_session(job)` in `shared/db/system.py` (worker only). `shared/tenancy_ctx.py` gains
`tenant_scope(ctx)`.

### Outbox — `shared/outbox.py`
`Event` Protocol: read-only `type`, `version`, `payload()`. `add_event(session, event, *, key) -> bool` validates the
type and key, JSON-encodes the payload while **rejecting floats** (UUID, datetime and Decimal become strings; a naive
datetime is refused), checks the session is in a transaction, and inserts with `ON CONFLICT DO NOTHING RETURNING`.
`envelope(row)` builds the TD-02 JSON. Relay-side SQL: `claim_pending(session, limit, lease_s)` leases the oldest
unsent, unleased rows (`FOR UPDATE SKIP LOCKED` inside the claiming `UPDATE`), plus `mark_sent`, `record_failure`
and `release`.

### Relay — `apps/worker/outbox_relay.py`, bus — `shared/bus/nats.py` **(review, Q2)**
- `Publisher` Protocol; `JetStreamPublisher` sends `Nats-Msg-Id`. `connect()` raises within 5 s (nats-py otherwise
  waits forever for a first connection). `ensure_stream` creates `EVENTS` / `evt.>` when missing and never changes
  an existing stream.
- `relay_batch`: (1) short transaction: lease ≤ `outbox_relay_batch_size` rows for `outbox_relay_lease_s`
  (30 s); (2) publish in order to `evt.<type>` with **no transaction open**, stopping at the first failure or halfway
  through the lease; (3) short transaction: mark published rows sent, record the failure (`attempts`,
  `last_error`), release the rest. A crashed relay's rows become claimable when its lease ends and are republished
  inside JetStream's 2-minute duplicate window, so the repeats are dropped. Beyond that window, consumers de-duplicate
  by `event_id`.
- `run_relay(stop)`: drain full batches back to back, poll every `outbox_relay_poll_s` when idle, back off
  exponentially to `outbox_relay_max_backoff_s`. Logs carry only the error type (SEC3).

### Idempotency — `shared/http/idempotency.py` **(review, Q1/SEC1/SEC2/SEC7)**
- `IdempotencyKey = Annotated[UUID, Header(alias="Idempotency-Key")]`. A missing or non-UUID header gives 422
  `VALIDATION_FAILED` from FastAPI.
- `IdempotentRoute(APIRoute)` wraps routes that declare the header. `assert_idempotent_routes(app)` (run in
  `create_app`; walks included routers with `iter_route_contexts`) refuses to start if one lacks the route class.
- Per request: no principal → 401. Otherwise, in `request_transaction()`: set `lock_timeout` (setting
  `idempotency_lock_timeout_s`), claim with `INSERT … ON CONFLICT (pk) DO UPDATE … WHERE expires_at <= now()
  RETURNING`, restore `lock_timeout`, then:
  - claimed → run the handler (its `tenant_session()` joins). A response < 500 is stored and the transaction
    commits; a 5xx or an exception rolls back. A streaming response is an error.
  - not claimed → a live entry. While its request runs, the claim waits on the row lock; past the timeout,
    55P03 → **503 `SERVICE_UNAVAILABLE` + `Retry-After: 1`**. Same hash → replay (`idempotency.replayed`);
    different hash → **422 `IDEMPOTENCY_MISMATCH`** (`idempotency.mismatch`).
- Expiry sweep: `apps/worker/sweepers.py::sweep_idempotency_keys`, every `idempotency_sweep_minutes` (15), in batches.
  The outer `DELETE` re-checks `expires_at`, so a key re-claimed meanwhile isn't deleted.

### Readiness — `shared/http/readiness.py`, `apps/api/main.py`
Concurrent checks (`select 1`, Redis PING, NATS connect and close), 2 s timeout each. 200 `{"status":"ok"}`, or
**503 Problem `SERVICE_UNAVAILABLE`** with `errors: [{"field": "<dependency>", "code": "UNAVAILABLE"}]` and no
exception text. **(review, SEC6)** A `ReadinessProbe` per app reuses the result for 1 s, and concurrent callers share
one run.

### Worker — `apps/worker/main.py`
`run(stop)`: scheduler with the sweep, NATS connect with backoff (interruptible by stop), ensure the stream, relay
until stopped, then shut down the scheduler, NATS and the engine. `main()` wires SIGTERM/SIGINT.

### Logging — `shared/observability/logging.py` **(review, SEC3)**
Tracebacks never include local variables (connection frames hold DSNs with passwords). Plain tracebacks on the
console; JSON with `format_exc_info` whenever `LOG_JSON` is set or `ENV` isn't `local`.

### Infrastructure
- `infra/docker/postgres/Dockerfile`: `FROM postgres:16` + `postgresql-16-partman=5.5.*` (**review, SEC8**).
- `docker-compose.yml`: postgres `build: infra/docker/postgres`, `image: sportsbook-postgres:16`; Prism
  `--multiprocess=false` (merged before B0).
- `init.sql`: idempotent, `ALTER ROLE migrator CREATEDB`, pg_partman in `sportsbook` and `template1`. `make db-init`.
- CI: `docker compose up -d --build --wait postgres pgbouncer redis nats`, `alembic upgrade head`,
  `scripts/verify.sh`. **(review, S1)** With `CI` set, an unreachable database fails the tests step instead of
  skipping the `db` tests.

### Config keys (`shared/config.py`)
`db_pool_size` 5, `db_max_overflow` 10, `db_pool_timeout_s` 30, `nats_stream` `EVENTS`, `nats_subject_prefix` `evt`,
`outbox_relay_batch_size` 100, `outbox_relay_poll_s` 0.5, `outbox_relay_max_backoff_s` 30, `outbox_relay_lease_s` 30,
`idempotency_sweep_minutes` 15, `idempotency_lock_timeout_s` 10.

### Test fixtures — root `conftest.py` → `tests/fixtures/stack.py`, `tests/fixtures/contract.py`
`test_database` (session), `db`, `migrator_conn`, `two_tenants`, `empty_outbox`, `test_stream`. Tests using `db`,
`test_database` or `test_stream` are auto-marked `db`. `assert_matches_schema(name, body)` validates against
`contracts/openapi.yaml`.

## Files

| File | Why |
|---|---|
| `infra/docker/postgres/Dockerfile` (new) | PostgreSQL 16 + pg_partman 5.5 (D6) |
| `infra/docker/postgres/init.sql` | Idempotent roles, CREATEDB for test DBs, pg_partman in sportsbook + template1 |
| `docker-compose.yml` | Build the partman image |
| `Makefile` | `db-init` target |
| `.github/workflows/ci.yml` | Same compose stack as local (partman, NATS), same verify script |
| `scripts/verify.sh` | (review, S1) CI fails when the database is unreachable |
| `migrations/helpers.py` (new) | `tenant_rls_sql` / `enable_tenant_rls` |
| `migrations/env.py` | Honour a `sqlalchemy.url` override (test DBs) |
| `alembic.ini` | `path_separator = os` (silences Alembic's deprecation warning) |
| `migrations/script.py.mako` | Checklist points at the helper |
| `migrations/versions/20261001_0002_shared_outbox_idempotency.py` (new) | `shared.outbox`, `shared.idempotency`, policies, grants |
| `.importlinter` | (review, SEC5) `shared.db.system` is worker-only |
| `shared/config.py` | Settings above |
| `shared/db/session.py` | Pool settings, `request_transaction()`, join, engine reset/dispose |
| `shared/db/system.py` (new) | (review, SEC5) `system_session(job)` |
| `shared/tenancy_ctx.py` | `tenant_scope()` |
| `shared/outbox.py` | `Event`, `add_event`, envelope, relay-side SQL |
| `shared/bus/nats.py` (new) | `connect` (with timeout), `ensure_stream`, `Publisher`, `JetStreamPublisher` |
| `shared/http/idempotency.py` (new) | `IdempotencyKey`, `IdempotentRoute`, startup check |
| `shared/http/readiness.py` (new) | Checks and `ReadinessProbe` |
| `shared/observability/logging.py` | (review, SEC3) no locals in tracebacks; JSON outside local |
| `apps/api/main.py` | Real `/readyz`; idempotent-route check |
| `apps/worker/outbox_relay.py` (new) | `relay_batch`, `run_relay` |
| `apps/worker/sweepers.py` (new) | (review, SEC5) idempotency expiry sweep |
| `apps/worker/main.py` | Worker wiring |
| `scripts/contract_check.py` | FastAPI 0.142 keeps included routers as wrappers in `app.routes`, so the contract-routes gate saw no module routes; walk them with `iter_route_contexts` |
| `conftest.py`, `tests/fixtures/__init__.py`, `tests/fixtures/stack.py`, `tests/fixtures/contract.py` (new) | Fixtures |
| `pyproject.toml`, `uv.lock` | `db` marker description; `jsonschema-rs` as a direct dev dependency |
| `shared/tests/test_rls.py`, `test_outbox.py`, `test_idempotency.py`, `test_logging.py` (new) | AC-1–AC-4, SEC3 |
| `tests/worker/{__init__,test_outbox_relay,test_worker_main,test_sweepers}.py` (new) | AC-3, AC-4 (sweep), worker wiring |
| `tests/test_readyz.py` (new), `tests/contract/test_contract.py` | AC-5; included-router routes |
| `README.md` | First-run steps, `make db-init` |
| `docs/tasks/B0-skeleton.md`, `docs/tasks/README.md`, `docs/tasks/B0/*` | Status, plan, verification |

## Acceptance criteria → tests

| AC | Test | How it proves it |
|---|---|---|
| AC-1 | `shared/tests/test_rls.py::test_row_of_tenant_a_is_invisible_and_not_updatable_under_tenant_b` | Probe table built with `tenant_rls_sql`; as `app` (asserted: not superuser, no BYPASSRLS), B selects 0 rows and updates 0; A's row is unchanged. |
| AC-1 | `…::test_insert_for_another_tenant_is_rejected` | `WITH CHECK` refuses B writing A's tenant id. |
| AC-1 | `…::test_every_tenant_table_has_forced_rls_and_tenant_policy` | Catalog guard over every table with `tenant_id`: RLS forced, `tenant_isolation` with nullif, and (review, Q6) no permissive policy that is neither tenant- nor job-scoped. |
| AC-2 | `…::test_tenant_session_without_tenant_raises`, `…::test_app_role_reads_zero_rows_without_tenant` | No tenant → error before connecting; global session sees 0 rows, no error. |
| AC-2 | `…::test_reused_pooled_connection_after_set_local_reads_zero_rows` | The app's own engine and pool: the second transaction has the same `pg_backend_pid()`, `current_setting` = `''`, 0 rows, no error. |
| AC-3 | `shared/tests/test_outbox.py` | Rollback leaves no row; envelope fields; one row per key (`add_event` returns False); floats, naive datetimes, bad types and keys refused; (review, Q5) a tenant session can't mark its events sent. |
| AC-3 | `tests/worker/test_outbox_relay.py::test_relay_publishes_each_row_once_when_publisher_fails_once` | Publisher fails once: each `event_id` succeeds exactly once, order kept, failure recorded, the rest released. |
| AC-3 | `…::test_relay_crash_mid_batch_then_restart_publishes_each_row_once` | Crash mid-batch: nothing marked; rows leased (another relay gets 0); after the lease, republished; one message per row. |
| AC-3 | `…::test_relay_holds_no_row_lock_while_publishing` | (review, Q2) `FOR UPDATE NOWAIT` on the row succeeds during publish. |
| AC-3 | `…::test_jetstream_keeps_one_message_per_msg_id`, `…::test_ensure_stream_creates_missing_stream_once`, `…::test_relay_publishes_events_of_all_tenants`, `…::test_run_relay_backs_off_and_recovers`, `tests/worker/test_worker_main.py` | Real JetStream de-dup; stream creation; cross-tenant relay; backoff; worker wiring and clean stop (also while NATS is down). |
| AC-4 | `shared/tests/test_idempotency.py` | Replay (identical bytes, Location; handler once; one committed effect); mismatch → 422 Problem valid against the contract; concurrent pair → one run, one effect; waiting duplicate → 503 + `Retry-After` (synchronised on an `entered` event, review Q4); raised error and returned 5xx roll back their writes and aren't stored; expired key is new; tenant and principal scopes independent; (review, SEC2) no principal → 401, never a replay; (review, Q1) 6 concurrent keys on a 2-connection pool all succeed; header validation; startup check. |
| AC-4 | `tests/worker/test_sweepers.py::test_sweeper_deletes_only_expired_rows_of_every_tenant` | 24 h expiry sweep across tenants, in batches. |
| AC-5 | `tests/test_readyz.py` | Bad Redis URL → 503 Problem with only `redis`, no internals; NATS down → only `nats`; full stack → 200; (review, SEC6) one check run per second however often it's called. |
| AC-6 | `make up && make db-init && make migrate && make verify` | Full gate PASS, including the `db` tests (none skipped); with `CI` set, an unreachable DB fails. |
| D6 | `shared/tests/test_rls.py::test_pg_partman_is_installed` | The extension exists in the template1-derived test DB. |

## Risks

- **Security: tenant isolation.** RLS forced and guarded by the catalog test. `app.system_job` opens cross-tenant
  access only for named commands on two tables, from a module request code can't import. Like `app.tenant_id`, it's
  settable by the `app` role, so RLS defends against a missing tenant filter, not SQL injection (bound parameters
  everywhere).
- **Security: idempotency replay.** A replay doesn't run route dependencies, so authentication must run in
  middleware (TD-00 §6). Without a principal the request is refused, so a misplaced auth dependency fails loudly (401)
  instead of leaking.
- **Money / double effects.** Fixed by decision 6: the stored response commits with the effects. Money paths still
  keep their own idempotency (D2 ledger keys, C08's unique bet key).
- **Concurrency.** One connection per idempotent request: `tenant_session()` and `global_session()` both join it
  (review, SEC1). Only `system_session()` doesn't, and request code can't import it. No global event ordering across relay
  pods; consumers must not assume one.
- **Poison event.** A row that can never be published stops the relay at that row and retries with backoff;
  `attempts` / `last_error` show it. Dead-lettering is a follow-up.
- **Supply chain.** pg_partman pinned to 5.5.x from the PGDG repo the official image already trusts; `postgres:16`
  follows the major tag, as CI did before.

## Out of scope

Tenant resolution from the database and the seed (B1); any business table or event schema
(`contracts/events/*.json`); leader election / `shared.job_lock` (`TODO(B2)`); outbox retention of sent rows and
dead-lettering; OpenTelemetry and metrics; JetStream retention limits for `EVENTS`; running the CI workflow on GitHub
(there's no remote); the contract's 422/503 responses on idempotent operations (S2).

## Sub-tasks

Not split during implementation. The plan's own trigger (well past 1,600 changed lines → split off idempotency as
`B0b`) was hit, and the review fixes added more. This is recorded in `verification.md`, and the final report offers
the split.
