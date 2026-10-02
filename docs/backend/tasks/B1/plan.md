# B1 plan — Tenancy and configuration (C16)

Branch: `task/B1-tenancy-config`. Mode: interactive — plan approved by the user on 2026-10-01.

## Understanding

Every later module reads its settings through C16, so B1 puts tenants, their domains, versioned config documents
and feature flags into a `tenancy` schema. The B0 middleware already implements the resolution rules (header,
host, mismatch → 400, unknown → 404, `DEV_DEFAULT_TENANT` only when local); B1 replaces its placeholder resolver
with a cached, database-backed one. A Python interface (`config`, `rules`, `rules_version`, `is_enabled`,
`real_money_enabled`) serves the active, validated config document, cached per immutable version, and
`GET /v1/config/public` / `GET /v1/app/version` are built from it. `make seed` idempotently creates the `demo`
tenant: localhost domains, config v1 (betting and retail rule sets = golden `default_2026_10`), a local-only
licence until 2099, and feature flags.

## Spec conflicts and decisions

| # | Topic | Sources | Decision |
|---|---|---|---|
| 1 | Rule-set shape | C16 §4: `acca_bonus_table` as `[[3,3],…]`, taxes without `threshold`/`deduct_from` on WIN_TAX; D1.12 + contract `RuleSet` | **D1.12 / contract.** `betting` and `retail_betting` are stored in the `RuleSet` shape (decimal strings, `{min_legs, pct}`), validated on creation. |
| 2 | `rules_version` in the stored document | D1.12: `rules_version` = the tenant config version that was active | The stored `betting` / `retail_betting` sections **must not** contain `rules_version` (validation rejects it). `rules()` / `rules_version()` inject the config version number. A version number can't disagree with itself. |
| 3 | Brand colours | C16 §4: `brand.primary_color`; contract `PublicConfig.brand.colors` (map); D7: the 12 colour tokens | **Contract + D7.** `brand.colors` is a map. Only the 12 D7 token names are accepted, as `#RRGGBB`, and all 12 are required ("must provide"). The seed sets all 12. |
| 4 | Fields `PublicConfig` needs that C16 §4 doesn't define | contract: `languages`, `min_app_version`, `legal.min_age`; `/v1/app/version` needs `min_supported`, `latest`, … | New config sections `locale: {languages}` and `app: {min_supported, latest, download_url?, sha256?, release_notes?}`. `legal.min_age` is served from `auth.min_age` (C01 reads that key; one source). `default_language`, `currency` and `timezone` come from the `tenancy.tenant` row (C16 §3). Creating a version checks that the tenant's `default_lang` is in `locale.languages`. `tenant.name` = `tenant.legal_name`. |
| 5 | `dictionary_version` (required by the contract) | D5: the catalogue builds the dictionary (B4) | B1 returns **0** ("no dictionary yet"). B4 replaces it with the catalogue's version. I'll add a scope line to the B4 task file so it isn't lost. |
| 6 | Sync vs. async interface | C16 §5: `is_enabled` and `real_money_enabled` are sync | **async.** Flags and tenant status come from the database through a cache, and a sync call would need everything preloaded into the request context. Callers `await` them. `current()` stays sync. |
| 7 | `rules_version(v)` signature | Task: `rules_version(v)`; C19/D1.12: retail uses its own `retail_betting` rule set | `rules_version(version, name="betting")`, so retail settlement can ask for `retail_betting` at the version a ticket was sold under. |
| 8 | Role for tenancy reads | C16 §3: "read by middleware with a dedicated role"; D3: the roles are `migrator`, `app`, `feed` | **D3.** No new role. `app` gets SELECT only on all `tenancy.*` tables in B1. Writes in B1 come only from `make seed` (and tests), running as `migrator`, the owner. B10 grants `app` what its admin endpoints need (insert version, update the active pointer). |
| 9 | Version immutability | AC-4: DB- or repo-level guard; C16 DDL has `approved_by` and `activated_at` on the version row | **DB-level trigger** on `tenancy.tenant_config_version` (fires for every role, owner included): DELETE is rejected. UPDATE is rejected unless the only change is setting `approved_by` / `activated_at` from null (the first activation). Plus `app` has no UPDATE/DELETE grant, and the repo has no update function. |
| 10 | Propagation | C16 §6: activation publishes `config.changed`; all processes reload within 5 s | The active-version pointer, tenant row and flags are cached for **5 s** (`TENANT_CONFIG_CACHE_TTL_S`), so processes converge within 5 s with no consumer. Version documents are cached without TTL (immutable). Activation also invalidates the local cache and writes `config.changed {tenant, version}` to the outbox in the same transaction, for other modules (the D5 dictionary rebuild). The tenant resolver caches code/host → tenant for 30 s (`TENANT_RESOLVE_CACHE_TTL_S`, task: ≤ 60 s), unknowns included, in a bounded cache (random `Host` headers can't grow memory or hammer the DB). |
| 11 | Real-money "today" | C16 §7: `licence_valid_until >= today` | "Today" = the current date in the **tenant's timezone** (`tenancy.tenant.timezone`, Africa/Addis_Ababa), from the injectable clock. The licence is valid through its last day. |
| 12 | Feature-flag rollout | C16 DDL has `rollout_pct`; no rule for how it's applied | `is_enabled(flag, subject=None)`: false when the flag is missing or disabled; true at 100 %; below 100 %, true only for a subject whose stable bucket `sha256(flag:subject) mod 100 < rollout_pct`. With no subject (e.g. public config), a partial rollout counts as off. `features` in public config = every flag of the tenant under that rule. |
| 13 | Seeded `retail_betting` | Task: `default_2026_10` is the seeded `betting` **and** `retail_betting`; contract example shows a different retail set | **Task** (contract examples are illustrative). Both are `default_2026_10`. |
| 14 | `quick_stakes` | Contract example has them; AC-3: `rules("betting")` equals golden `default_2026_10` (which has none) except `rules_version` | **AC-3.** Not seeded. The field is optional and validated when present. |
| 15 | Other config sections | C16 §4 lists `auth`, `kyc`, `catalogue`, `payments`, `rg`, `notify`, `retail` | Typed and strict where B1 serves them (`brand`, `locale`, `betting`, `retail_betting`, `legal`, `app`, `auth.min_age`). The other sections are free-form objects that their owning tasks tighten. Unknown top-level sections are rejected. The seed uses C16 §4's sample values (placeholders, as C16 says). `retail` (C19 §11 keys) is left to B9. |
| 16 | Seed safety | D6: a local-only licence valid until 2099 | `apps/seed.py` refuses to run unless `ENV` is `local` or `test`. A fake valid licence in staging or production would switch on real money. |
| 17 | Config not activated | contract (at planning time) documented only 200/401 for `/config/public` | A tenant with no active config gets 503 `SERVICE_UNAVAILABLE` ("Tenant configuration unavailable"). This is an operator error state, not a client error. **(verification)** The 503 is now documented on both operations (contract change approved by the user). |
| 18 | Size | Skill: split above ~1,500 changed lines | About 1,700 lines (half of them tests), all in one area (C16 plus its seed). **Not split.** |
| 19 **(review S5, M3, SEC3)** | Validation bounds no source fixes | — | Operator-input bounds only, nothing player-facing: `auth.min_age` 18–99, ≤ 8 `quick_stakes` within [`min_stake`, `max_stake`], https-only URLs, phone `^\+\d{8,15}$`, texts ≤ 200 chars, document ≤ 256 KB and ≤ 16 levels, `max_lines ≤ 1024` (D1.2), `acca_bonus_min_leg_odds ≥ 1.01` (D5), `max_payout ≥ max_stake`, distinct tax codes, `download_url` needs `sha256`. B10's admin validation inherits them; loosen there if the operator needs it. |
| 20 **(verification)** | `Accept-Language` | contract: the parameter's schema is the `Language` enum (`am`, `en`); TD-01: "`Accept-Language: am` or `en`" | Followed literally: any other value (including a browser's `en-US,en;q=0.9`) is a 400 `VALIDATION_FAILED` (`shared/http/language.py`). Browsers reach the API through the Next.js server (D3), which sets the header. If direct browser or webview calls are ever wanted, negotiating per RFC 9110 needs a contract change first; decide before B4 reuses the dependency for `Vary: Accept-Language` responses (D5). |

No product rules are invented (tax and limit values come from the golden file and C16 §4's documented samples).
No new error codes. **(verification)** Two additive contract changes were approved by the user during
verification (see the Files table): the `BadRequest` component with 400/404/503 documented on the two B1
operations, because `make conformance` checks every status the API returns.

## Design

### Data model — migration `0003` (`migrations/versions/20261001_0003_tenancy.py`), no RLS (D3)

```sql
tenancy.tenant (id uuid pk, code text unique not null check (code ~ '^[a-z0-9-]{2,32}$'),
  legal_name text not null, licence_number text, licence_valid_until date,
  status text not null check (status in ('setup','active','suspended')),
  default_lang text not null default 'am' check (default_lang in ('am','en')),
  currency char(3) not null default 'ETB' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Africa/Addis_Ababa', created_at timestamptz not null default now())
tenancy.tenant_domain (host text pk check (host = lower(host) and position(':' in host) = 0),
  tenant_id uuid not null references tenancy.tenant, kind text not null check (kind in (...6 kinds...)))
  + index (tenant_id)
tenancy.tenant_config_version (tenant_id uuid references tenancy.tenant, version int check (version >= 1),
  config jsonb not null check (jsonb_typeof(config) = 'object'), schema_version int not null check (>= 1),
  created_by uuid not null, approved_by uuid, comment text, created_at timestamptz not null default now(),
  activated_at timestamptz, primary key (tenant_id, version))
  + trigger tenant_config_version_immutable (before update or delete, function tenancy.config_version_guard())
tenancy.tenant_config_active (tenant_id uuid pk references tenancy.tenant, version int not null,
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, version) references tenancy.tenant_config_version)
tenancy.feature_flag (tenant_id uuid references tenancy.tenant, flag text check (flag ~ '^[a-z][a-z0-9_]{0,63}$'),
  enabled boolean not null, rollout_pct int not null default 100 check (rollout_pct between 0 and 100),
  updated_at timestamptz not null default now(), primary key (tenant_id, flag))
grant select on all five tables to app   -- nothing else (decision 8)
```
`created_by` for the seed = `SYSTEM_USER_ID` (nil UUID, "activated directly by a system user", D6). There is no
staff table until B10, so it has no FK.

### Module layout (`modules/tenancy/`)

- `domain/config_document.py` (pure, Pydantic, mypy strict): `ConfigDocument` (`extra="forbid"`, frozen), with
  `Brand`, `Locale`, `Auth` (typed `min_age` 18–99, other keys allowed), `RuleSetBody` (the contract `RuleSet`
  minus `rules_version`; tuples, so it's deeply immutable), `TaxRule`, `AccaBonusTier`, `Legal`, `AppVersions`,
  and free-form `kyc`, `catalogue`, `payments`, `rg`, `notify`, `retail`. `RuleSet(RuleSetBody)` adds
  `rules_version`. Validation: money `^\d{1,12}\.\d{2}$`, odds per contract, rate a fraction 0–1, pct
  `^\d{1,3}(\.\d{1,4})?$`, `min_stake ≤ max_stake`, `min_stake > 0`, `max_legs ≥ 1`, `max_lines ≥ 1`,
  `acca_bonus_table.min_legs` ≥ 2 and strictly ascending, `deduct_from: stake ⇒ base: stake`, semver
  versions with `min_supported ≤ latest`, https URLs, sha256 hex. Money is compared via `shared.money.parse_santim`
  (integers, never float). `parse_config(dict) -> ConfigDocument` raises `ConfigInvalid(errors)`.
  `CONFIG_SCHEMA_VERSION = 1`.
- `domain/tenant.py`: `TenantRecord` dataclass; `real_money_enabled(record, today) -> bool` (C16 §7);
  `flag_on(enabled, rollout_pct, flag, subject) -> bool` (decision 12); `SYSTEM_USER_ID`.
- `repo/tenancy_repo.py`: SQL via `text()` (house style, as in B0): `tenant_by_code`, `tenant_by_host`,
  `tenant_by_id`, `active_version`, `config_version`, `flags`, `upsert_tenant`, `upsert_domain`,
  `insert_config_version` (version = max + 1 in one statement), `set_active` (upsert pointer +
  `activated_at = coalesce(activated_at, now())`), `upsert_flag` (writes only when `enabled`/`rollout_pct`
  differ, so a re-seed changes nothing).
- `service/caches.py`: the process caches (`shared.cache.local.TtlCache`), plus `invalidate(tenant_id)`.
- `service/resolver.py`: `DbTenantResolver` (implements `shared.http.middleware.TenantResolver`) over
  `global_session()`, with a 30 s bounded cache.
- `service/config.py`: `current()`, `config(section)` (deep copy), `rules(name)`, `rules_version(version, name)`,
  `is_enabled(flag, subject=None)`, `real_money_enabled()`, `tenant_record()`. Unknown section/rule-set name →
  `ValueError`; missing version → `ConfigNotFound`.
- `service/versions.py`: `create_version(session, tenant_id, config, created_by, comment) -> int` (validate,
  check `default_lang`, insert); `activate_version(session, tenant, version)` (pointer, `activated_at`,
  `config.changed` outbox event in the same transaction, local invalidate). These take the caller's session, so
  the seed (migrator) and later B10 (app) run them in their own transactions.
- `service/provision.py`: `ensure_tenant`, `ensure_domain`, `ensure_flag` (seed and tests).
- `service/public.py`: `public_config() -> dict`, `app_version() -> dict`.
- `api/schemas.py` (`PublicConfigOut`, `AppVersionOut`), `api/router.py`: `GET /config/public`
  (`Cache-Control: public, max-age=60`, `Vary: X-Tenant-Id`) and `GET /app/version`. Problem 503 when no active
  config.
- `events.py`: `ConfigChanged(tenant: str, version: int)`, type `config.changed`, version 1.
- `interface.py`: re-exports `DbTenantResolver`, `RuleSet`, `TaxRule`, `AccaBonusTier`, the service functions,
  `ConfigNotFound`.

### Endpoints

| Operation | Module → service | Notes |
|---|---|---|
| `GET /v1/config/public` (getPublicConfig) | tenancy → `service.public.public_config` | `betting` + `retail_betting` RuleSets with `rules_version` = active version; `features` from `feature_flag`; `real_money_enabled` computed; `dictionary_version` 0 (decision 5) |
| `GET /v1/app/version` (getAppVersion) | tenancy → `service.public.app_version` | from the `app` section |

### Elsewhere

- `shared/cache/local.py`: `TtlCache[K, V]` (ttl, maxsize with oldest-first eviction, injectable monotonic clock,
  negative caching via a sentinel).
- `shared/config.py`: `tenant_resolve_cache_ttl_s = 30.0`, `tenant_config_cache_ttl_s = 5.0`.
- `apps/api/main.py`: the default resolver becomes `DbTenantResolver()`. `NotYetImplementedResolver` is removed
  from `shared/http/middleware.py`.
- `apps/seed.py`: `python -m apps.seed`. Refuses unless ENV is local/test. One migrator transaction: tenant `demo`
  ("Demo Bet", status active, licence `LOCAL-DEV-ONLY` until 2099-12-31), domains `localhost`, `127.0.0.1` (api),
  `demo.localhost` (player_web), `admin.demo.localhost`, `pos.demo.localhost`, `terminal.demo.localhost`,
  `agent.demo.localhost`. Config: if there's no active version, create v1 and activate it; if the active
  document differs from the seed document, create the next version and activate it (so later tasks can extend
  the seed); otherwise nothing. Flags: `sports`, `booking_codes`, `bonuses`, `retail` on; `virtuals`, `live` off
  (D8, R2).
- Events: `config.changed` (TD-02 table), dedup key `activation:<uuid7>` (each activation is its own event).
- Error codes used: `NOT_FOUND`, `VALIDATION_FAILED` (middleware), `SERVICE_UNAVAILABLE`. No new ones.
- Transactions: request reads use `global_session()` (tenancy is global; joins a request transaction as a
  savepoint). Seed: one migrator transaction. `activate_version` sets `app.tenant_id` on the caller's session and
  uses `tenant_scope` for the outbox insert (shared.outbox has forced RLS).

## Files

| File | Why |
|---|---|
| `migrations/versions/20261001_0003_tenancy.py` | tenancy tables, immutability trigger, grants |
| `modules/tenancy/domain/config_document.py` | config schema and validation, RuleSet types |
| `modules/tenancy/domain/tenant.py` | tenant record, real-money rule, flag rollout rule |
| `modules/tenancy/repo/tenancy_repo.py` | SQL for the tenancy schema |
| `modules/tenancy/service/caches.py` | process caches and invalidation |
| `modules/tenancy/service/resolver.py` | `DbTenantResolver` |
| `modules/tenancy/service/config.py` | `config` / `rules` / `rules_version` / `is_enabled` / `real_money_enabled` |
| `modules/tenancy/service/versions.py` | create and activate config versions |
| `modules/tenancy/service/provision.py` | ensure tenant, domain and flag (seed) |
| `modules/tenancy/service/public.py` | public config and app version documents |
| `modules/tenancy/api/schemas.py`, `api/router.py` | the two routes |
| `modules/tenancy/events.py`, `interface.py`, `README.md` | `config.changed`; public interface; status |
| `modules/tenancy/tests/conftest.py` | `make_tenant` fixture (fresh tenant per test) |
| `modules/tenancy/tests/test_config_document.py` | validation unit tests |
| `modules/tenancy/tests/test_tenant_rules.py` | real-money and rollout unit tests |
| `modules/tenancy/tests/test_resolution.py` | AC-2 through the real app and DB |
| `modules/tenancy/tests/test_config_service.py` | AC-3, AC-4, AC-5 against the DB |
| `tests/contract/test_config_public.py` | AC-1 contract-shape tests for the seeded `demo` tenant (header and host resolution) |
| `modules/tenancy/tests/test_public_api.py` | **(added)** AC-1 contract-shape tests on fresh tenants, 503 paths, `Accept-Language` |
| `modules/tenancy/tests/test_events.py`, `contracts/events/config.changed.json` | **(added, review Q13/S6)** the first event schema (TD-02 §5) and a test that the payload matches it |
| `tests/test_seed.py` | AC-6 and the ENV guard |
| `tests/fixtures/stack.py` | `seeded` fixture (runs the seed, returns the demo `TenantContext`); docstring |
| `shared/cache/local.py`, `shared/tests/test_local_cache.py` | TTL cache and its tests |
| `shared/db/ops.py` | **(added during implementation)** `ops_session()`: a transaction as the schema owner (`migrator`) for the seed and test fixtures, since `app` has no write grant on `tenancy.*` (decision 8). Import-linter forbids it for `modules`, `apps.api` and `apps.worker` (module tests excepted) |
| `.importlinter` | **(added)** the contract above |
| `modules/tenancy/tests/factories.py` | **(added)** a valid config document built from the golden rule set, shared by the tests |
| `shared/config.py` | the two cache TTL settings |
| `shared/http/middleware.py` | remove the placeholder resolver; docstring. **(added during verification)** `RequestIdMiddleware` refuses an `X-Request-Id` over 64 characters with 400 `VALIDATION_FAILED`: the contract's `RequestId` parameter has `maxLength: 64` and `make conformance` (Schemathesis) checks it on the B1 routes |
| `apps/api/main.py` | wire `DbTenantResolver` |
| `apps/seed.py` | `make seed` |
| `tests/test_app.py` | **(changed during verification)** tests for the `X-Request-Id` length rule above and for the `Allow` header on 405 |
| `shared/errors.py` | **(added during verification)** the Problem handler for Starlette's `HTTPException` keeps `exc.headers`, so a 405 carries `Allow` (RFC 9110; Schemathesis checks it) |
| `shared/http/language.py` | **(added during verification)** `accept_language` dependency: the contract types `Accept-Language` as the `Language` enum (TD-01), so any other value is a 400 `VALIDATION_FAILED` Problem; `GET /v1/config/public` uses it, later routes with that parameter reuse it |
| `contracts/src/01_head_player.yaml`, `contracts/src/03_components.yaml`, `contracts/openapi.yaml` | **(contract change, approved by the user during verification)** `BadRequest` response component; `400` and `404` documented on `getPublicConfig` and `getAppVersion` (plus their previously generated `401` / `422`, now explicit). Follow-up: every other tenant-scoped operation returns the same 400/404 from the middleware; each task documents them on the operations it implements |
| `Makefile` | **(added during verification)** `contract-build` runs `build.py` through `uv run` (the bare `python3` has no PyYAML) |
| `docs/tasks/B4-fake-feed-catalogue.md` | one scope line: replace the `dictionary_version` 0 placeholder |
| `docs/tasks/B1-tenancy-config.md`, `docs/tasks/README.md`, `docs/tasks/B1/*` | status, plan, verification |

## Acceptance criteria → tests

| AC | Test | How it proves it |
|---|---|---|
| AC-1 | `tests/contract/test_config_public.py::test_public_config_for_demo_matches_contract` | seeded DB, real app, `X-Tenant-Id: demo` → 200; body validated with `assert_matches_schema("PublicConfig")` (from `contracts/openapi.yaml`); `Cache-Control` header |
| AC-1 | `…::test_app_version_for_demo_matches_contract` | `/v1/app/version` → `AppVersion` schema |
| AC-1 | `modules/tenancy/tests/test_public_api.py::test_public_config_matches_the_contract_schema`, `…::test_public_config_values_come_from_the_database`, `…::test_public_config_omits_unset_optional_fields`, `…::test_accept_language_must_be_a_contract_language` | fresh tenants: schema check, rules_version = 1, features from the flags, real_money_enabled, retail_betting present or omitted, `Accept-Language` enum |
| AC-2 | `modules/tenancy/tests/test_resolution.py::test_header_resolves_tenant` | `X-Tenant-Id: demo` → 200 for demo |
| AC-2 | `…::test_host_resolves_tenant_ignoring_port` | `Host: demo.localhost:3000`, no header → demo |
| AC-2 | `…::test_header_and_host_of_different_tenants_is_400` | header `demo` + host of a second tenant → 400 `VALIDATION_FAILED` |
| AC-2 | `…::test_unknown_header_is_404` / `…::test_unknown_host_without_header_is_404` | 404 Problem |
| AC-2 | `…::test_dev_default_tenant_used_when_env_local` / `…::test_dev_default_tenant_ignored_outside_local` | ENV=local → demo; ENV=test → 404 |
| AC-2 | `…::test_resolver_caches_hits_and_misses_until_the_ttl`, `…::test_resolver_ttl_may_not_exceed_60_seconds` | second lookup within TTL doesn't query (cache hit), unknown cached too; refreshed after TTL (fake clock); TTL capped at 60 s |
| AC-3 | `tests/test_seed.py::test_seeded_rule_sets_equal_golden_default_2026_10` | after `seed()`: `rules("betting")` and `rules("retail_betting")` dump == golden `default_2026_10` with `rules_version` 1 |
| AC-3 | `modules/tenancy/tests/test_config_service.py::test_rules_carry_the_active_version_and_equal_the_stored_rule_set` | the mechanism on a fresh tenant |
| AC-4 | `…::test_config_version_cannot_be_updated_or_deleted` | as migrator: UPDATE of `config` and DELETE raise (trigger); as app: permission denied |
| AC-4 | `…::test_first_activation_may_set_activated_at_and_approved_by_once` | trigger allows null→value once, rejects a later change |
| AC-4 | `…::test_activating_v2_changes_config_and_keeps_v1`, `modules/tenancy/tests/test_public_api.py::test_public_config_shows_the_newly_activated_version` | fresh tenant, v1 then v2 (different `min_stake` and brand name) → `rules()` and `/config/public` show v2 (`rules_version` 2); `rules_version(1)` still returns v1's values; `config.changed` outbox rows written; re-activation is a no-op |
| AC-4 | `…::test_invalid_config_is_rejected_on_create` | `create_version` with bad money → `ConfigInvalid`, no row |
| AC-4 | `modules/tenancy/tests/test_config_document.py::*` | seed document valid; rejects `rules_version` in the stored rule set, unknown keys/sections, bad money/odds/rate, min > max, unsorted bonus table, stake-deducted non-stake tax, unknown colour token, bad semver, min_supported > latest, non-https URL |
| AC-5 | `modules/tenancy/tests/test_tenant_rules.py::test_real_money_*` | unit: active + valid → true; expired (yesterday) → false; valid until today → true; no licence number → false; suspended → false; setup → false; "today" taken in the tenant timezone (23:30 UTC = next day in Addis) |
| AC-5 | `test_config_service.py::test_real_money_disabled_for_suspended_or_expired_tenant` | DB tenants (suspended; expired licence) → `real_money_enabled()` false and `/config/public` says false |
| AC-6 | `tests/test_seed.py::test_seed_twice_leaves_the_same_data` | snapshot of every demo row in all `tenancy.*` tables + its `config.changed` outbox rows, before/after a second run: equal |
| AC-6 | `…::test_seed_refuses_outside_local_and_test` | ENV=production → refuses, writes nothing |
| AC-6 | `modules/tenancy/tests/test_config_service.py::test_ensure_active_config_is_a_no_op_until_the_document_changes` | the seed's `ensure_active_config`: unchanged document → nothing written; changed → v2 active, v1 untouched |
| edge | `test_config_service.py::test_flags_rollout_and_unknown_flag` | unknown → false; 0 % / partial without subject → false; partial with subject is stable |
| edge | `test_config_service.py::test_config_returns_a_copy` | mutating the returned dict doesn't change the next call |
| edge | `modules/tenancy/tests/test_public_api.py::test_tenant_without_active_config_is_503`, `…::test_unreadable_stored_config_is_503` | Problem 503 for no active version and for a stored document this build can't read |
| edge | `shared/tests/test_local_cache.py::*` | TTL expiry, negative caching, maxsize eviction, invalidate |

## Risks

- **Money (indirect).** The rule sets feed slipcalc. Values are strings validated against the contract patterns;
  comparisons use integer santim (`parse_santim`). No floats anywhere. AC-3 pins the seeded values to golden.
- **Security: real money switched on by mistake.** The seed refuses outside local/test. `real_money_enabled`
  requires active status + licence number + date. Unit tests cover each condition and the timezone edge.
- **Security: tenant spoofing.** Header/host mismatch → 400, unknown header never falls back to the host (B0
  behaviour, re-tested against the real resolver). `DEV_DEFAULT_TENANT` is local only. `app` can only SELECT
  tenancy tables, so a compromised request path can't remap hosts or rewrite config.
- **Security: cache abuse.** Bounded resolver cache (unknown hosts cached too, oldest evicted). No unbounded keys.
- **Concurrency.** Two concurrent `create_version` calls for one tenant: the second hits the primary key and fails
  cleanly (no lost or overwritten versions). Only the seed creates versions in B1; B10 adds four-eyes and locking.
  Caches are per process, asyncio-only (no threads), stale for at most 5 s / 30 s by design.
- **Performance.** A request costs at most two cached resolver lookups. `/config/public` is about 4 cached reads,
  and the DB is hit only on a TTL miss. Public config is edge-cacheable for 60 s.
- **Immutability.** Enforced in the database (trigger fires for the owner too) and by grants; tested both ways.

## Out of scope

- Admin config endpoints, diff view, four-eyes activation, staff identities (B10), and `app` write grants (B10).
- A `config.changed` consumer: the 5 s TTL already meets C16 §6. The event is written for other modules.
- `GET /v1/banners`, `GET /v1/pages/{slug}` (B13; `--missing Config` still lists them).
- The real `dictionary_version` (B4), `REAL_MONEY_DISABLED` enforcement on money routes (B2/B6/B8 call
  `real_money_enabled()`), staged APK rollout (C18), `retail` config keys (B9), retail entities and players in
  the seed (later tasks), auth on `/config/public` (B5; it's optional there anyway).
- IPv6 literal `Host` headers (the B0 middleware strips the port by splitting on `:`).

## Sub-tasks

None. See decision 18.
