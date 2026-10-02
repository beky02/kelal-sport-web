# TD-00 Architecture & Code Structure

The Platform is one FastAPI application organised as 17 modules (including retail, C19) with enforced boundaries, plus three small separate services (feed ingestion, regulator reporter, game wallet gateway). They all share one PostgreSQL cluster (a schema per module), Redis for hot state, and NATS JetStream for events. The target architecture diagram is in the Implementation Guide §0.

## 1. Architecture principles

| # | Principle | Consequence |
| --- | --- | --- |
| P1 | **Money correctness over speed** | Every money movement is one ACID transaction through C03; no module writes balances directly |
| P2 | **Modular monolith first** | One deployable, one database cluster; modules talk through Python interfaces or events, never each other's tables |
| P3 | **Idempotent everything** | Every write that can be retried carries an idempotency key; consumers de-duplicate by message ID |
| P4 | **Transactional outbox** | Events are written in the same DB transaction as the state change, then published by a relay. No dual writes |
| P5 | **Rules are data** | Taxes, limits, bonuses and payment methods live in versioned tenant config (C16), not in code |
| P6 | **Fail closed** | If the feed, the risk check or the ledger is unsure, the system rejects or suspends; it never guesses |
| P7 | **Designed for low bandwidth** | Paged, cacheable, compact responses; the dictionary is cached on the device |
| P8 | **Tenant-ready** | `tenant_id` everywhere and row-level security from day one, even with one tenant |
| P9 | **Auditable by construction** | Append-only ledger and audit log; raw provider payloads stored |

## 2. Runtime view (deployables)

| Deployable | Process type | Scales by | Talks to |
| --- | --- | --- | --- |
| `api` | FastAPI (Uvicorn workers) behind Cloudflare and an ingress | CPU / requests, 3+ replicas | Postgres (via PgBouncer), Redis, NATS, providers |
| `worker` | Same codebase, runs NATS consumers and scheduled jobs (settlement, notifications, reconciliation, outbox relay) | Queue lag | Postgres, Redis, NATS, SMS, FCM |
| `feed` | Separate service: AMQP consumer for the odds provider | Message rate (1 active + 1 standby per producer) | Provider AMQP + REST, Postgres (`feed` schema), Redis, NATS |
| `reporter` | Separate service: reads `reporting.outbox`, pushes to the regulator | Backlog | Postgres, regulator API |
| `games` (R2) | Separate FastAPI service for provider wallet callbacks | Callback rate | Postgres (`ledger` via C03 library), Redis |
| `web` | Next.js apps (standalone Node containers): player web, terminal, POS, agent portal, back office (C18; the back office is Refine inside Next.js); server-rendered, so they also serve SEO pages and link previews | Requests | `api` |

## 3. Bet placement request flow

&#91;embedded content: Bet placement · 9 steps across 6 parts\]

Only step 7 touches PostgreSQL, and it is a single transaction: stake debit (C03), bet rows (C08) and the outbox event commit together or not at all. Steps 2–6 use in-memory data, which keeps placement under the 800 ms p95 target.

## 4. Repository layout (monorepo)

```
platform/
├─ apps/
│  ├─ api/                    # FastAPI entrypoint: routers mounted per module
│  ├─ worker/                 # NATS consumers + scheduler
│  ├─ feed/                   # odds-feed service (C05)
│  ├─ reporter/               # regulator reporter (C13)
│  └─ games/                  # virtual games gateway (C17, R2)
├─ modules/
│  ├─ identity/  kyc/  ledger/  payments/  catalogue/
│  ├─ slipcalc/  betting/  booking/  settlement/  bonus/
│  ├─ compliance/  reporting/  notify/  backoffice/  tenancy/  games/  retail/
│  └─ <module>/
│     ├─ api/          # FastAPI routers + Pydantic request/response schemas
│     ├─ domain/       # entities, value objects, pure rules (no I/O)
│     ├─ service/      # use cases; the ONLY public entry points
│     ├─ repo/         # SQLAlchemy models + repositories (module schema only)
│     ├─ events.py     # event types published / consumed
│     ├─ interface.py  # Protocol other modules may call
│     └─ tests/
├─ shared/
│  ├─ money.py  ids.py  clock.py  tenancy_ctx.py  outbox.py  errors.py  i18n/
│  └─ db/ (session, RLS setup)  cache/  bus/  http/  observability/
├─ migrations/                # Alembic, one version table, schema-qualified
├─ contracts/                 # openapi.yaml, event JSON schemas, golden test CSVs
├─ client/
│  ├─ mobile/                 # Flutter Android app (C18)
│  └─ web/                    # Next.js apps: player, terminal, POS, agent portal, back office (C15, C18, C19)
└─ infra/                     # Terraform, Helm charts, dashboards
```

**Module rules**, enforced in CI with [import-linter](https://import-linter.readthedocs.io/):

- A module may import another module's `interface.py` and `events.py` only.
- `domain/` imports nothing from `repo/`, `api/` or third-party I/O libraries.
- Only `ledger` writes to the `ledger` schema. Only `betting` writes to `betting`, and so on.
- `slipcalc` is a pure library with zero I/O. It is imported by `betting`, `settlement`, `booking` and ported to Dart for the app and TypeScript for the Next.js apps.

## 5. Technology choices

| Concern | Choice | Notes |
| --- | --- | --- |
| Web framework | FastAPI + Pydantic v2 | Async; OpenAPI generated from code |
| DB access | SQLAlchemy 2.0 (async) + asyncpg; Alembic migrations | Explicit transactions; `SELECT … FOR UPDATE` in ledger |
| Connection pooling | PgBouncer (transaction mode) | Needed with many async workers |
| Cache / hot state | Redis 7 (`redis.asyncio`), Lua scripts for atomic counters | Odds, limits, liability counters, OTP, rate limits |
| Events | NATS JetStream (`nats-py`) | Durable consumers, replay, de-dup by message ID |
| Odds-feed transport | `aio-pika` (AMQP 0-9-1) | For Sportradar- or LSports-style feeds |
| Outbound HTTP | `httpx` with timeouts, retries (tenacity), circuit breaker | Payments, SMS, Fayda, FCM |
| Scheduling | APScheduler in `worker` (single leader via Redis lock) | Reconciliation, expiry sweeps |
| Decimal maths | Python `decimal` and fractions with exact arithmetic (Engineering Decisions D1.1); money as `int` santim | See TD-02 conventions |
| Logging / tracing | structlog JSON + OpenTelemetry | Trace ID propagated to app and providers |
| Quality | ruff, mypy (strict for `domain/`), pytest, hypothesis, import-linter | CI gates |
| Packaging | uv; Docker images per deployable | Same image, different entrypoints for api/worker |

## 6. Cross-cutting concerns

| Concern | How it works |
| --- | --- |
| Tenant context | Middleware resolves tenant from host or `X-Tenant-Id`, sets `app.tenant_id` on the DB session (`SET LOCAL`) so row-level security policies apply; also stored in a context variable for logs. |
| Authentication | JWT access tokens (EdDSA, 15 min) verified in middleware; staff tokens carry roles; service-to-service calls use mTLS inside the cluster. |
| Authorisation | Player endpoints check ownership; staff endpoints check permission strings, e.g. `bets:settle_manual` (C15). |
| Idempotency | `Idempotency-Key` header stored in `shared.idempotency` (tenant, key, request hash, response, expiry 24 h). A repeat with the same hash returns the saved response; a different hash returns 422. |
| Transactions & outbox | A use case opens one DB transaction, changes state, and inserts outbox rows. The relay in `worker` publishes to NATS and marks rows sent. |
| Time | `shared.clock` injected everywhere (testable); UTC in storage; EAT for display. |
| Money | `shared.money.Money(amount_santim:int, currency:str)`; odds as `Decimal` with 2–3 dp; rounding helpers in one place. |
| i18n | Error codes and templates keyed; translations in `shared/i18n/{am,en}.json`; clients send `Accept-Language`. |
| Rate limiting | Redis token bucket at the gateway per IP, device and player; stricter buckets for OTP and login. |
| Feature flags | C16 flags checked through `tenancy.flags.is_enabled("virtuals")`. |
| Errors | Domain exceptions map to RFC 7807 responses with stable codes (TD-01). |
| Observability | Every request has `trace_id`; key business metrics (bets/s, rejection reasons, payment success) exported to Prometheus. |
