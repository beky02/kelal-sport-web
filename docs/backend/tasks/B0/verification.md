# B0 verification

Branch `task/B0-skeleton`. Stack: `make up && make db-init && make migrate` (local compose: sportsbook-postgres:16
with pg_partman 5.5.0, PgBouncer, Redis 7, NATS 2.10 JetStream).

## Automated gate

| Check | Result | Command |
|---|---|---|
| format | PASS | `uv run ruff format --check .` |
| lint | PASS | `uv run ruff check .` |
| types | PASS | `uv run mypy apps shared modules scripts tests` |
| imports | PASS | `uv run lint-imports` (4 contracts kept, including the new worker-only `shared.db.system`) |
| tests | PASS | `uv run pytest -q`: 94 passed, 1 skipped (pre-existing: golden CSV waits for B3); 35 of them `db`-marked, none skipped |
| golden-csv | PASS | `uv run python contracts/golden/generate.py --check` |
| contract-routes | PASS | `uv run python scripts/contract_check.py` (now also sees routes of included routers) |
| migrations-sql | PASS | `uv run alembic upgrade head --sql` |
| bandit | PASS | `uv run bandit -q -r apps shared modules -x '*/tests/*' -ll` |
| secrets-scan | PASS | `git grep` for keys in verify.sh |
| dependency-audit | PASS | `uv run pip-audit` (non-blocking) |
| contract-lint | PASS | `npx @redocly/cli@1 lint contracts/openapi.yaml` |
| conformance | N/A | No contract operations were added (`/readyz` is an ops route), so the Schemathesis path filter is empty |

Final `make verify` summary (local, at 2302fb5, after the last review fix):

```
verify (full)
  PASS  format
  PASS  lint
  PASS  types
  PASS  imports
  PASS  tests
  PASS  golden-csv
  PASS  contract-routes
  PASS  migrations-sql
  PASS  bandit
  PASS  secrets-scan
  PASS  dependency-audit
  PASS  contract-lint

RESULT: PASS
```

Also checked by hand:
- **Fresh clone, CI settings.** A clean `git worktree` of the branch at 2302fb5 (no `.env`, `CI=true`, `ENV=test`,
  new venv) runs `scripts/verify.sh`: all 12 checks PASS. With `CI=true` and an unreachable database, the
  tests step FAILs instead of skipping.
- **Fresh database volume.** `init.sql` on an empty volume in a throwaway `sportsbook-postgres:16` container:
  init completes, `migrator` has CREATEDB, `app` and `feed` exist. A second `make db-init` on the existing volume is a no-op.
- **Worker process.** `python -m apps.worker.main` against the local stack, through PgBouncer as `app`: creates
  stream `EVENTS` (`evt.>`), relays, and exits 0 on SIGINT within the poll interval.
- **The guard test catches a regression.** With `force row level security` removed from the helper,
  `test_every_tenant_table_has_forced_rls_and_tenant_policy` fails. The isolation tests alone don't, since FORCE
  only binds the owner. A probe table with an extra `using (true)` policy also fails it.
- **The pool test catches the deadlock.** With the request-transaction join disabled,
  `test_more_concurrent_requests_than_pool_connections_all_succeed` fails (pool exhausted).
- **pg_partman pin.** `docker compose build postgres` installs `postgresql-16-partman 5.5.0-1.pgdg13+1` from `=5.5.*`.

## Acceptance criteria

| AC | Status | Evidence |
|---|---|---|
| AC-1 | ✅ | `shared/tests/test_rls.py::test_row_of_tenant_a_is_invisible_and_not_updatable_under_tenant_b` (asserts `current_user='app'`, not superuser, no BYPASSRLS; select 0 rows, update rowcount 0, row unchanged for A), `::test_insert_for_another_tenant_is_rejected`, `::test_every_tenant_table_has_forced_rls_and_tenant_policy`: PASS |
| AC-2 | ✅ | `::test_tenant_session_without_tenant_raises`, `::test_app_role_reads_zero_rows_without_tenant`, `::test_reused_pooled_connection_after_set_local_reads_zero_rows` (same `pg_backend_pid()`, `current_setting` = `''`, 0 rows, no error): PASS |
| AC-3 | ✅ | `shared/tests/test_outbox.py` (rollback leaves no row; envelope fields; one row per key; floats/naive datetimes/bad types rejected; tenants can't mark events sent) and `tests/worker/test_outbox_relay.py::test_relay_publishes_each_row_once_when_publisher_fails_once`, `::test_relay_crash_mid_batch_then_restart_publishes_each_row_once`, `::test_jetstream_keeps_one_message_per_msg_id` (real JetStream: crash after 2 publishes, restart → stream holds exactly 3 messages), `::test_ensure_stream_creates_missing_stream_once`, `::test_relay_holds_no_row_lock_while_publishing`, `::test_relay_publishes_events_of_all_tenants`, `::test_run_relay_backs_off_and_recovers`; `tests/worker/test_worker_main.py` (incl. clean stop while NATS is down): PASS |
| AC-4 | ✅ | `shared/tests/test_idempotency.py` (16 tests): replay runs the handler once with one committed effect (identical status, body, content-type, Location); different body → 422 `IDEMPOTENCY_MISMATCH` valid against the contract `Problem`; concurrent pair → one run, one effect; lock wait over the limit → 503 `SERVICE_UNAVAILABLE` + `Retry-After: 1`; raised errors and returned 5xx roll back their writes and aren't stored; a caught use-case error still rolls back that use case; a use case carries on after a failed DB block; 6 concurrent keys on a 2-connection pool (also reading `global_session()`) all succeed; no principal → 401; expired key is new; tenant and principal scopes independent; tenants can't delete stored keys; missing/invalid header → 422; misconfigured router fails startup. `tests/worker/test_sweepers.py`: 24 h expiry across tenants. All PASS |
| AC-5 | ✅ | `tests/test_readyz.py::test_readyz_503_problem_when_redis_unreachable` (Problem valid against the contract, only `redis` listed, no internals), `::test_readyz_ok_when_stack_up`, `::test_readyz_lists_only_redis_when_only_redis_is_down`, `::test_readyz_503_when_nats_unreachable`, `::test_readyz_runs_checks_once_per_second_however_often_it_is_called`: PASS |
| AC-6 | ✅ locally / ⚠️ CI not executed | `make up && make db-init && make migrate && make verify` → PASS, including all `db` tests. `.github/workflows/ci.yml` runs the same compose services and `scripts/verify.sh`. A clean-checkout run with CI settings passes, but GitHub Actions itself hasn't run (no remote). See Gaps. |
| D6 | ✅ | `::test_pg_partman_is_installed` (in the template1-derived test database): PASS |

## Review findings

Round 1: spec-verifier PASS (4 minor); quality-reviewer FAIL (1 blocker, 3 major, 8 minor); security-reviewer FAIL
(3 major, 5 minor). The money-reviewer wasn't run: `touches_money: false`, and the diff touches no ledger, slip,
betting, settlement, payments, bonus, retail or amount/odds code. Fix commits: bf102be, f527ee3, d4c6596, cd030fe.

| id | reviewer | severity | summary | decision |
|---|---|---|---|---|
| Q1 | quality | BLOCKER | Idempotency held a pooled connection for the key (T1) while the handler took a second (T2): N concurrent requests deadlock a pool of N. Placement became two transactions. | **Fixed** in bf102be: one transaction per idempotent request (`request_transaction()`, joined by `tenant_session()`). Tests `test_more_concurrent_requests_than_pool_connections_all_succeed` (fails with the join disabled: pool exhausted) and `test_returned_5xx_is_not_stored_and_its_writes_roll_back`. |
| SEC1 | security | MAJOR | Same pool starvation, framed as abuse: 15 parallel POSTs with fresh keys stall the API process. | **Fixed** by the Q1 change (same tests). The suggested lease-based claim was not used: the task requires duplicates to wait on the key's row lock. |
| SEC2 | security | MAJOR | With no principal the scope fell back to `anonymous`, shared by every unauthenticated caller. If auth runs as a dependency, a replay leaks another player's stored response. | **Fixed** in bf102be: no principal → 401 `AUTH_INVALID_CREDENTIALS`, nothing claimed or replayed. Test `test_request_without_principal_is_refused_not_replayed`. |
| SEC3 | security | MAJOR | Rich tracebacks with `show_locals` printed the DB password from asyncpg's frames, repeated on every relay backoff. | **Fixed** in cd030fe: plain tracebacks without locals; JSON with `format_exc_info` outside `ENV=local`; the relay logs only the error type. Test `shared/tests/test_logging.py` (reproduced the leak first). |
| Q2 | quality | MAJOR | Relay published up to 100 messages inside an open `FOR UPDATE` transaction. | **Fixed** in f527ee3: lease (`claimed_until`), publish with no transaction open, mark/record/release in a second short transaction, per-batch deadline. Test `test_relay_holds_no_row_lock_while_publishing`; crash test now covers lease expiry. |
| Q3 | quality | MAJOR | `/readyz` depends on NATS, which the API doesn't strictly need (the outbox absorbs outages). A NATS blip removes all API pods. | **Rejected for B0**: the task file explicitly scopes "/readyz checks PostgreSQL, Redis and NATS", and TD-00 §2 lists NATS among the API's dependencies. Raised with the user as a decision. Probe cost addressed by SEC6. |
| Q4 | quality | MAJOR | The 503 test relied on `sleep(0.2)` ordering; the fake handler wrote nothing, so no test could catch Q1. | **Fixed** in bf102be: synchronised on an `entered` event; the handler writes an outbox row via `tenant_session()` and tests assert committed effects per key; pool test added. |
| Q5 | quality | MINOR | Tenant sessions could update their own outbox rows (e.g. mark sent, suppressing events). | **Fixed** in f527ee3: restrictive `outbox_updates_only_by_relay`. Test `test_tenant_session_cannot_mark_its_events_sent`. |
| SEC4 | security | MINOR | Relay UPDATE could rewrite any column (tenant_id, data). | **Fixed** in f527ee3: column-level `grant update (sent_at, claimed_until, attempts, last_error)`. |
| Q6 | quality | MINOR | The RLS guard only checked that `tenant_isolation` exists; an added `using (true)` policy would pass. | **Fixed** in cd030fe: every permissive policy must be tenant- or job-scoped. Mutation-checked: a probe table with `using (true)` fails the guard. |
| Q7 | quality | MINOR | Migrations import the live helper; editing it rewrites merged migrations. | **Fixed** in cd030fe: helper SQL pinned by `test_rls_helper_sql_is_pinned`; docstring says to add a new helper instead. |
| Q8 | quality | MINOR | `ON CONFLICT DO NOTHING` silently drops a repeated event; retention unbounded. | **Fixed** in f527ee3: `add_event` returns False and logs `outbox.duplicate_ignored`; versioned keys documented. Retention is a **follow-up** (out of scope). |
| Q9 | quality | MINOR | `test_stream` tests weren't auto-marked `db`; unmarked readyz tests hit live services (2.1 s). | **Fixed** in cd030fe: auto-mark includes `test_stream`; readyz unit tests stub the other checks (NATS test 0.3 s). |
| Q10 | quality | MINOR | Aborted runs leak test databases. | **Fixed** in cd030fe: names carry a timestamp; databases older than 6 h are dropped at session start. |
| Q11 | quality | MINOR | TODO without task id; constants not in settings; unreachable branch; too few logs. | **Fixed** in cd030fe/f527ee3/bf102be: `TODO(B2)`, settings for relay/sweep, an assert, `idempotency.replayed` / `.mismatch` logs. |
| Q12 | quality | MINOR | Diff past the plan's own split trigger. | **Follow-up**: split offered to the user (see Gaps). |
| SEC5 | security | MINOR | `system_session` importable by request code; sweeper in an API-imported module. | **Fixed** in bf102be: `shared/db/system.py` + import-linter contract (modules, apps.api); sweeper in `apps/worker/sweepers.py`. |
| SEC6 | security | MINOR | `/readyz` is unauthenticated and opens connections per call. | **Fixed** in cd030fe: per-app `ReadinessProbe` reuses results for 1 s with one in-flight run. Test `test_readyz_runs_checks_once_per_second_however_often_it_is_called`. |
| SEC7 | security | MINOR | Request hash ambiguous via decoded `%00`; streaming responses silently not stored. | **Fixed** in bf102be: length-prefixed method, raw path, query string, body; streaming → error. |
| SEC8 | security | MINOR | Unpinned base image and package. | **Partly fixed** in cd030fe: `postgresql-16-partman=5.5.*`. **Rejected:** a digest pin for `postgres:16` (CI used the same floating major tag before; digest pins belong with an update bot). |
| S1 | spec | MINOR | `verify.sh` passed without the db tests when PostgreSQL was unreachable, so CI could go green without them. | **Fixed** in cd030fe: with `CI` set it's a FAIL (checked with an unreachable URL). |
| S2 | spec | MINOR | 10/15 Idempotency-Key operations don't list 503, 7 don't list 422, and the 503 response lacks `Retry-After`. | **Follow-up** (contract change, needs approval): `/contract-change` before the tasks that implement those routes. B0 adds no contract routes. |
| S3 | spec | MINOR | Plan out of date (index name, check constraints, AC-2 pool wording). | **Fixed**: plan.md updated. |
| S4 | spec | MINOR | verification.md unfinished and uncommitted. | **Fixed**: this file, committed with `B0: verified`. |
| — | self | — | nats-py waits forever when no server answers the first connect, so the worker could neither back off nor stop. | **Fixed** in cd030fe: `connect()` times out after 5 s. Test `test_worker_stops_cleanly_while_nats_is_down`. |

Round 2 (re-check of Q1–Q4 and SEC1–SEC3):

| id | reviewer | severity | summary | decision |
|---|---|---|---|---|
| Q1, Q2, Q4, Q5–Q11 | quality | — | Confirmed fixed (idempotency and relay suites green in 5 repeat runs) | — |
| Q3 | quality | — | Deferral accepted: the task file mandates the NATS check | Raised with the user |
| Q13 | quality | BLOCKER (new) | A joined `tenant_session()` had no savepoint: a use case that raised and was caught still committed its writes, and a fallback after a DB error failed because the shared transaction was aborted | **Fixed**: SAVEPOINT per joined block. Tests `test_use_case_error_caught_by_the_handler_still_rolls_back_that_use_case`, `test_use_case_can_carry_on_after_a_failed_database_block` (both failed first) |
| SEC2–SEC8 | security | — | Confirmed fixed (fake-password probe: 0 occurrences, 14 before; 4 import contracts kept; SEC8 digest decision agreed) | — |
| SEC1 | security | MAJOR (still open) | Fixed for `tenant_session()`, but a handler that also opens `global_session()` still took a second connection: 15× 500 after 47 s | **Fixed**: inside `request_transaction()`, `global_session()` joins as a savepoint too. The pool test now also reads through `global_session()` (failed first, passes now) |
| NEW1 | security | MAJOR | = Q13, reviewed before commit 5c6b280 landed | Fixed in 5c6b280 (confirmed by both reviewers) |
| SEC4 note | security | MINOR | No test showed a tenant session denied the idempotency DELETE | **Added** `test_tenant_session_cannot_delete_stored_keys` (the outbox UPDATE case was already covered by `test_tenant_session_cannot_mark_its_events_sent`) |

Round 3 (last allowed):

| id | reviewer | result |
|---|---|---|
| Q13 | quality | **FIXED.** The reviewer's probe: a caught error leaves 0 rows (was 1); a fallback after a DB error → 201 (was 500). 5/5 repeat runs green. Non-blocking notes: SAVEPOINT costs 2 round trips per block; never commit by hand (added to the `tenant_session()` docstring). |
| SEC1 | security | **FIXED.** 15 concurrent requests reading `global_session()` → 15× 201 in 0.4 s (was 15× 500 after 47 s). No new issue. Informational: misusing `global_session()` on a tenant table sees 0 rows outside idempotent routes but the request's own tenant inside them; no isolation impact. |

**Open blocker/major findings: none.** Q3 (/readyz and NATS) is with the user as a decision.

## Gaps

- **CI not run on GitHub.** The repository has no remote. The workflow is checked by its YAML parsing, the clean
  worktree run with CI settings, and the fresh-volume init test. Not yet proven: `docker compose up --build --wait`
  on an Ubuntu runner (image build ~30 s, PgBouncer has no healthcheck so `--wait` waits only for "running").
- **PgBouncer in tests.** The throwaway test databases are reached directly on 5432, since PgBouncer routes only
  `sportsbook`. Pooled-connection reuse is proven with SQLAlchemy's pool, and the worker run above went through
  PgBouncer, but no automated test does.
- **Diff size.** About 3,100 changed lines (1,229 code and infra, 1,498 tests, 366 docs) against the plan's estimate
  of 1,400–1,600; the review fixes added ~750. The plan said idempotency would be split off as `B0b` past that point.
  It wasn't, because the overrun only became clear after implementation. The commits are one per step and per
  review round, so it can be reviewed commit by commit, and splitting is offered to the user in the final report.
- **Open decision.** Q3: whether a NATS outage should make `/readyz` fail (the task says yes). It doesn't block B0.
