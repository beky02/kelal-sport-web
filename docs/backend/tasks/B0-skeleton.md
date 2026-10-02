---
id: B0
title: Finish the skeleton — DB session and RLS helpers, outbox, idempotency, readiness, CI green
status: done
depends_on: []
components: [TD-00, TD-01, TD-02]
contract_tags: []
touches_money: false
---

# B0 — Finish the skeleton

## Goal
Everything later modules lean on exists and is tested: tenant-scoped transactions with row-level security,
the transactional outbox with its NATS relay, the `Idempotency-Key` store, readiness checks and a green CI.
Already scaffolded (do not redo): app factory, Problem errors, request-id and tenant middleware (with a
placeholder resolver), money/ids/clock helpers, module folders, import-linter contracts, baseline schemas
migration, `scripts/verify.sh`.

## Read first
- `docs/design/td-00-architecture.md` §4–6 (layout, module rules, cross-cutting concerns)
- `docs/design/td-01-api-standards.md` (idempotency, errors, headers)
- `docs/design/td-02-data-architecture.md` (schemas, RLS, outbox, partitions, events)
- `docs/engineering-decisions.md` D3 (RLS, roles, outbox, IDs) and D6 (local stack, NATS stream)

## Scope
In:
- Migration: `shared.outbox` (tenant RLS, FORCE) and `shared.idempotency` (tenant, key, request hash, status, response, expires_at); a reusable RLS helper for migrations (`enable_tenant_rls(table)`) used by every later migration.
- `shared/outbox.py`: `add_event(session, event, key)` inside the caller's transaction; event envelope `{event_id, type, tenant_id, occurred_at, payload}`.
- Worker: outbox relay → NATS JetStream stream `EVENTS`, subjects `evt.<type>`, publish with `Nats-Msg-Id = event_id` (de-dup), mark sent; retries with backoff. Creates the stream if missing.
- `shared/http/idempotency.py`: dependency/decorator for POST routes: same key + same body hash → stored response replayed; same key + different body → 422 `IDEMPOTENCY_MISMATCH`; a concurrent duplicate waits for the first request (row lock on the key, max 10 s) and then replays its response — on timeout 503 `SERVICE_UNAVAILABLE` with `Retry-After`. No new error code. 24 h expiry + sweeper job.
- `/readyz` checks PostgreSQL, Redis and NATS (503 problem if any is down).
- Test fixtures: `db` marker fixtures that create a throwaway database (or schema) and run migrations; two-tenant fixture.
- `docker-compose.yml` Postgres image with pg_partman (or a Dockerfile) per D6; create the extension in `infra/docker/postgres/init.sql` (superuser only — the `migrator` role can't) and in the CI step.
- RLS helper policy: `tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid` (pooled connections return `''`, not NULL, after a `SET LOCAL` ends).
- CI workflow green on a fresh clone.

Out: tenant resolution from the database (B1), any business tables.

## Acceptance criteria
- [x] **AC-1** A test with two tenants proves a row inserted under tenant A is invisible (select returns 0 rows) and not updatable under tenant B, using the `app` role (not a superuser).
- [x] **AC-2** `tenant_session()` without a tenant in context raises; the `app` role reads 0 rows (no error) from a tenant table when `app.tenant_id` is unset, including on a reused pooled connection after an earlier `SET LOCAL`.
- [x] **AC-3** `add_event` in a transaction that rolls back leaves no outbox row; on commit, the relay publishes exactly one NATS message per row even if the relay crashes and restarts mid-batch (test with a fake publisher that fails once).
- [x] **AC-4** Idempotency: the same key and body twice returns the identical status and body and runs the handler once; a different body returns 422 `IDEMPOTENCY_MISMATCH` as a Problem; two concurrent requests with one key run the handler once.
- [x] **AC-5** `/readyz` returns 503 with a Problem body when Redis is unreachable (test with a bad URL).
- [x] **AC-6** `make verify` passes locally with `make up && make migrate`, including the `db`-marked tests; CI runs the same script.

## Verification
- `make up && make migrate && make verify`
- `uv run pytest -m db -q`
