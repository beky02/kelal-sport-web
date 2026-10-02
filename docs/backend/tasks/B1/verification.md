# B1 verification — Tenancy and configuration (C16)

Branch `task/B1-tenancy-config`, verified 2026-10-02 at the final commit (`B1: verified`). Plan:
`docs/tasks/B1/plan.md`. Two review rounds; all findings triaged below.

## Automated gate

| Check | Result | Command / evidence |
|---|---|---|
| format | PASS | `uv run ruff format --check .` |
| lint | PASS | `uv run ruff check .` |
| types | PASS | `uv run mypy apps shared modules scripts tests` (224 files) |
| imports | PASS | `uv run lint-imports` — 5 contracts kept, 0 broken (new: `shared.db.ops` is for the seed and test fixtures only) |
| tests | PASS | `uv run pytest -q` against the compose stack: 240 collected (1 skipped: the golden CSV test until B3), 154 in the B1-related files |
| golden-csv | PASS | `uv run python contracts/golden/generate.py --check` (`contracts/golden/` untouched by this branch) |
| contract-routes | PASS | `uv run python scripts/contract_check.py` — 2/159 implemented, no route outside the contract; `--missing Config` lists only `GET /v1/banners` and `GET /v1/pages/{}` (B13) |
| migrations-sql | PASS | `uv run alembic upgrade head --sql` (migration `0003` renders, trigger body included); the quality reviewer also ran an upgrade → downgrade(0002) → upgrade cycle on a scratch database |
| bandit | PASS | `uv run bandit -q -r apps shared modules -x '*/tests/*' -ll` |
| secrets-scan | PASS | git grep for key material and api keys |
| dependency-audit | PASS (non-blocking) | `uv run pip-audit` |
| contract-lint | PASS | Redocly: "Your API description is valid" after each contract rebuild; a rebuild from `contracts/src` reproduces the committed `openapi.yaml` byte for byte (spec and quality reviewers) |
| conformance | PASS | `make conformance` (Schemathesis, `X-Tenant-Id: demo`, implemented routes only): **276 generated, 276 passed** on `GET /v1/config/public` and `GET /v1/app/version`, coverage and fuzzing phases; the spec reviewer reproduced it on an isolated export of the branch |
| seed | PASS | `make seed` twice on the local stack: first run `new_config_version=1`, every later run `new_config_version=None` |
| curl | PASS | `curl -H 'X-Tenant-Id: demo' localhost:8000/v1/config/public` → 200, `cache-control: public, max-age=60`, `vary: X-Tenant-Id`, tenant `demo`/`Demo Bet`, `real_money_enabled: true`, 6 features, `betting.rules_version 1`, `min_stake 5.00`; `/v1/app/version` → `{"min_supported":"1.0.0","latest":"1.0.0"}` |

Final `make verify`:

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

## Acceptance criteria

| AC | Status | Evidence |
|---|---|---|
| AC-1 `GET /v1/config/public` with `X-Tenant-Id: demo` validates against the contract schema | MET | `tests/contract/test_config_public.py::test_public_config_for_demo_matches_contract` (seeded DB, real app; `assert_matches_schema("PublicConfig")` from `contracts/openapi.yaml`; `Cache-Control`; exact values), `::test_public_config_for_demo_by_host` (`Host: demo.localhost:3000`), `::test_app_version_for_demo_matches_contract`; `modules/tenancy/tests/test_public_api.py` (9 tests on fresh tenants: schema, values, omitted optionals, activation, suspended tenant, 503 paths, `Accept-Language`). Conformance 276/276. |
| AC-2 header, host (port ignored), mismatch → 400, unknown → 404, `DEV_DEFAULT_TENANT` only when `ENV=local` | MET | `modules/tenancy/tests/test_resolution.py` (13 tests through the real app and the database resolver): `test_header_resolves_tenant`, `test_host_resolves_tenant_ignoring_port`, `test_header_and_host_of_same_tenant_is_fine`, `test_header_and_host_of_different_tenants_is_400`, `test_unknown_header_is_404`, `test_unknown_host_without_header_is_404`, `test_dev_default_tenant_used_when_env_local`, `test_dev_default_tenant_ignored_outside_local[test|staging|production]`, `test_suspended_tenant_still_resolves`, `test_resolver_caches_hits_and_misses_until_the_ttl`, `test_resolver_ttl_may_not_exceed_60_seconds`. |
| AC-3 `rules("betting")` == golden `default_2026_10` except `rules_version` (1 after seeding) | MET | `tests/test_seed.py::test_seeded_rule_sets_equal_golden_default_2026_10` (after `seed()`, exact dict equality for `betting` and `retail_betting` with `rules_version: 1`); `modules/tenancy/tests/test_config_service.py::test_rules_carry_the_active_version_and_equal_the_stored_rule_set`. The money reviewer fed the seeded document through `contracts/golden/reference_slipcalc.py` and reproduced the CSV figures for `SINGLE_BASIC`, `WORKED_EXAMPLE_C07`, `WIN_TAX_GROSS_1000_02` and `SINGLE_REMAINDER`. |
| AC-4 versions immutable; activating v2 changes `config/public` and keeps `rules_version(1)` | MET | `test_config_service.py::test_config_version_cannot_be_updated_or_deleted` (owner: trigger raises on UPDATE/DELETE; `app`: permission denied on insert/update/delete), `::test_first_activation_may_set_activated_at_and_approved_by_once`, `::test_activating_v2_changes_config_and_keeps_v1` (+ `config.changed` outbox rows, re-activation no-op), `::test_invalid_config_is_rejected_on_create`, `::test_create_version_requires_the_tenant_default_language`, `::test_stored_versions_are_parsed_by_their_schema_version`, `::test_activating_a_version_this_build_cannot_read_fails`; `test_public_api.py::test_public_config_shows_the_newly_activated_version`; `test_config_document.py` (53 validation cases). |
| AC-5 `real_money_enabled()` false for an expired licence or a suspended tenant | MET | `test_config_service.py::test_real_money_disabled_for_suspended_or_expired_tenant`, `::test_licence_expires_at_midnight_in_the_tenant_timezone`, `::test_tenant_without_active_config` (the switch is independent of config); `test_tenant_rules.py` (unit cases incl. last-day-inclusive, blank number, `setup`, UTC/Addis date edge, unknown timezone rejected); `test_public_api.py::test_public_config_real_money_off_for_suspended_tenant`. |
| AC-6 `make seed` twice leaves the same data | MET | `tests/test_seed.py::test_seed_twice_leaves_the_same_data` (`row_to_json` snapshot of every demo row in the five `tenancy.*` tables plus its outbox rows, equal after the second run; `new_version is None`), `::test_seeded_demo_tenant`, `::test_seed_refuses_outside_local_and_test[staging|production]`, `::test_seed_refuses_when_env_is_only_the_default`; `test_config_service.py::test_ensure_active_config_is_a_no_op_until_the_document_changes` (a changed document becomes v2, v1 untouched). `make seed` run twice on the local stack (above). |

## Review findings

Round 1 (at `3e3a002`): spec-verifier (S) FAIL on S1 only; security (SEC), money (M; run because the diff
carries amount and odds fields) and quality (Q) PASS. Round 2 (at `5b2f85c`, after the fixes): money PASS,
quality PASS, spec PASS — every MAJOR confirmed fixed; the new MINORs they raised (N) are in the table too.

| Id | Reviewer | Severity | Summary | Decision |
|---|---|---|---|---|
| S1 | spec | MAJOR | `make conformance` failed: a 65-character `X-Request-Id` was accepted (contract `maxLength: 64`); after that fix the 400 was undocumented; then `Accept-Language` outside the enum was accepted and 405 lacked `Allow` | fixed in `5693506` (middleware 400; `shared/http/language.py`; `Allow` kept on 405) and `f4273d4` (contract: `BadRequest` component, 400/404 on both operations, user-approved) → 276/276. Round 2: CONFIRMED |
| S2 | spec | MINOR | module README status stale | fixed in `5b2f85c`. CONFIRMED |
| S3 | spec | MINOR | 503 (plan decision 17) not in the contract | fixed in `defafd0` (user-approved extension of the contract change). CONFIRMED |
| S4 | spec | MINOR | plan AC→test table named tests that don't exist under those names | fixed in `5b2f85c`. CONFIRMED |
| S5 | spec | MINOR | validation bounds no source states | recorded as plan decision 19 in `5b2f85c`. CONFIRMED |
| S6 / Q13 | spec, quality | MINOR | first event without a schema in `contracts/events/` (TD-02 §5) | fixed in `5b2f85c`: `contracts/events/config.changed.json` + `test_events.py`. CONFIRMED |
| S7 / Q14 | spec, quality | MINOR | `.schemathesis/` untracked | fixed in `5693506` (`.gitignore`). CONFIRMED |
| SEC1 / Q2 | security, quality | MINOR | `activate_version` re-targets a tenant-bound transaction | fixed in `5b2f85c`: raises for another tenant; `bind_tenant` in `shared/db/session.py`; test. CONFIRMED (and see N-Q2) |
| SEC2 | security | MINOR | seed guard fail-open when `ENV` is unset (default `local`) | fixed in `5b2f85c`: `ENV` must be in `model_fields_set`; test. CONFIRMED |
| SEC3 | security | MINOR | free-form sections unbounded | fixed in `5b2f85c`: 256 KB, depth 16, NUL rejected; `Auth` extras fall under the same bounds |
| SEC4 | security | MINOR | `download_url` without `sha256` | fixed in `5b2f85c` |
| SEC5 / Q1 | security, quality | MINOR / **MAJOR** | stored documents re-validated with the current schema on read; `ConfigInvalid` on read → 500 | fixed in `5b2f85c`: `SCHEMA_PARSERS` keyed by the stored `schema_version`; unreadable document → logged 503; tests. CONFIRMED |
| SEC6 / Q11 | security, quality | MINOR | insertion-order eviction lets a Host flood evict hot entries | fixed in `5b2f85c` (LRU on hit; test). CONFIRMED. A separate, shorter-lived negative cache is a follow-up |
| SEC7 / Q8 | security, quality | MINOR | `tenant.timezone` unvalidated | fixed in `5b2f85c`: `validate_timezone` at `ensure_tenant`; tests. CONFIRMED. No read-time fallback: the column is written only through `ensure_tenant` until B10 |
| SEC note | security | — | nothing stops `approved_by = created_by` at DB level | follow-up for B10 (four-eyes belongs to its service; the seed self-approves as `SYSTEM_USER_ID` by design, D6) |
| M1 | money | MAJOR | `base: stake` with `deduct_from: payout/operator` accepted but never charged by the calculator | fixed in `5b2f85c`: `(base == stake) == (deduct_from == stake)`; 2 INVALID rows. CONFIRMED by probe against the reference calculator |
| M2 | money | MINOR | duplicate tax codes accepted | fixed in `5b2f85c`. CONFIRMED |
| M3 | money | MINOR | missing sanity bounds | partly fixed in `5b2f85c` (`max_payout ≥ max_stake`, `max_lines ≤ 1024` per D1.2, `acca_bonus_min_leg_odds ≥ 1.01` per D5). CONFIRMED. Follow-up (no source fixes them; D9 / B3): `acca_bonus_max > 0` with a table, pct bounds, a `max_legs` ceiling, tier `min_legs ≤ max_legs`; B3 must bound legs/lines before enumerating combinations |
| M4 | money | MINOR | `quick_stakes` unchecked against the stake range | fixed in `5b2f85c`. CONFIRMED |
| M5 | money | MINOR | golden CSV test skipped until B3 | gap (below); `contracts/golden/` is untouched by this branch |
| Q3 | quality | MINOR | no log when a tenant has no active config | fixed in `5b2f85c` (and see N-Q3) |
| Q4 | quality | MINOR | seed: engine not disposed, file I/O inside the transaction | fixed in `5b2f85c`. CONFIRMED |
| Q5 | quality | MINOR | cold-cache `/config/public` opens four transactions | follow-up (steady state is zero queries; misses once per 5 s per tenant per process) |
| Q6 | quality | MINOR | existence check loads the whole document | fixed in `5b2f85c` (`version_exists`); superseded by N-M1: the activation now parses the document on purpose |
| Q7 | quality | MINOR | `upsert_tenant` rewrites an unchanged row | fixed in `5b2f85c`. CONFIRMED |
| Q9 | quality | MINOR | `reset_caches` / `invalidate` unused | fixed in `5b2f85c` (wired into the test database fixture; `invalidate` removed). CONFIRMED (and see N-Q4) |
| Q10 | quality | MINOR | floats accepted in free-form sections | fixed in `5b2f85c` (rejected anywhere in the raw document; test). CONFIRMED |
| Q12 | quality | MINOR | test touches `FrozenClock._at` | fixed in `5b2f85c`. CONFIRMED |
| N-M1 | money (round 2) | MINOR | `activate_version` only checked existence, so a version this build can't parse could become active and serve 503; schema policy unstated | fixed in `6138d21`: the target version is parsed with its schema parser before the pointer moves (test); the policy is written at `SCHEMA_PARSERS`. Follow-up (B10 tooling): a check that every stored row parses with its schema parser |
| N-Q2 / N-S2 | quality, spec (round 2) | MINOR | with a matching `tenant_scope` on an owner session the connection was never bound, so the outbox insert failed RLS (reproduced by the quality reviewer) | fixed in the final commit: `bind_tenant` always runs after the mismatch check (idempotent inside `tenant_session()`); test `test_activate_version_binds_an_owner_session_inside_a_matching_tenant_scope` |
| N-Q1 | quality (round 2) | MINOR | an unreadable stored document was re-read, re-parsed and re-logged on every request | fixed in the final commit: `Caches.broken` negative-caches the `ConfigInvalid` for the config TTL; one log line per TTL (test `test_unreadable_document_is_remembered_for_the_cache_ttl`) |
| N-Q3 | quality (round 2) | MINOR | the no-active-config warning fired per call, not per TTL | fixed in the final commit (logged in the cache-miss branch) |
| N-Q4 | quality (round 2) | MINOR | `tests/fixtures/stack.py` imported tenancy internals at module level | fixed in the final commit (lazy import inside the fixture) |
| N-Q5 | quality (round 2) | MINOR | sync `accept_language` dependency ran in a worker thread | fixed in the final commit (`async def`) |
| N-Q6 / N-S1 | quality, spec (round 2) | MINOR | `Accept-Language` outside the bare enum is a 400 (browser language ranges included) | follows the contract literally; recorded as plan decision 20 with the condition for revisiting it (before B4 reuses the dependency) |
| N-S3 | spec (round 2) | MINOR | two plan sentences stale after the contract change | fixed in the final commit |

## Gaps

- The golden CSV test (`tests/golden/test_golden.py`) is skipped until B3 builds the calculator; B1 only proves
  the four golden rule sets are storable and that the seeded sets equal `default_2026_10` (M5).
- Conformance covers the two implemented operations only (2/159); the 400/404/503 that the middleware returns
  on every route are documented only on these two. Follow-up: each task documents them on the operations it
  implements.
- `Accept-Language` is modelled by the contract as the `Language` enum, so a browser sending a language range
  straight to the API gets 400 (plan decision 20).
- No load test of the caches under a Host-header flood (bounded and LRU by construction; SEC6's separate
  negative cache is a follow-up).
- No check yet that every stored config version parses with its schema parser in a real database (N-M1
  follow-up for B10's config tooling).
