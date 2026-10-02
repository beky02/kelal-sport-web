---
id: B1
title: C16 tenancy and configuration with a seeded demo tenant
status: done
depends_on: [B0]
components: [C16]
contract_tags: [Config]
touches_money: false
---

# B1 — Tenancy and configuration (C16)

## Goal
Tenants, domains and versioned configuration live in the database; the middleware resolves real tenants;
`GET /v1/config/public` is served from the database and matches the contract; `make seed` creates the demo
world every later task uses.

## Read first
- `docs/design/components/c16-config-tenancy.md` (all)
- `docs/engineering-decisions.md` D1.12 (RuleSet shape — wins over the array form in C16 §4), D3 (tenant resolution), D6 (seed contents)
- `contracts/openapi.yaml`: `GET /v1/config/public`, schemas `PublicConfig`, `RuleSet`
- `contracts/golden/rules.json` → `default_2026_10` is the seeded `betting` and `retail_betting` rule set

## Scope
In:
- Migration for `tenancy.*` (no RLS, per D3) and `tenancy.feature_flag`.
- `DbTenantResolver` replacing `NotYetImplementedResolver` (cached, TTL ≤ 60 s).
- `modules/tenancy/interface.py`: `config(section)`, `rules(name)`, `rules_version(v)`, `is_enabled(flag)`, `real_money_enabled()`; config cached per version.
- JSON-schema (or Pydantic) validation of the config document; versions immutable once created.
- `GET /v1/config/public` and `GET /v1/app/version` (min/latest app version from config).
- `apps/seed.py` (`make seed`), idempotent: tenant `demo`, domains for localhost, config v1 active, local licence valid until 2099, flags. Retail entities and players are added by later tasks' seeds.

Out: admin config endpoints and four-eyes activation (B10); `GET /v1/banners` and `GET /v1/pages/{slug}` (CMS content, B13) — they share the `Config` tag, so `--missing Config` will still list them.

## Acceptance criteria
- [x] **AC-1** `GET /v1/config/public` with `X-Tenant-Id: demo` validates against the contract schema (test uses the OpenAPI schema, not a hand-written copy).
- [x] **AC-2** Tenant resolution: header, host (port ignored), header/host mismatch → 400, unknown → 404, `DEV_DEFAULT_TENANT` only when `ENV=local` (tests for each).
- [x] **AC-3** `rules("betting")` returns a RuleSet equal to `contracts/golden/rules.json` `default_2026_10` after seeding, except `rules_version`, which is the active config version (1 after seeding, per D1.12).
- [x] **AC-4** A config version cannot be modified after creation (DB-level or repo-level guard + test); activating v2 changes `config/public` and keeps `rules_version(1)` available.
- [x] **AC-5** `real_money_enabled()` is false for an expired licence or a suspended tenant (tests).
- [x] **AC-6** `make seed` run twice leaves the same data (idempotent).

## Verification
- `make verify`; `make seed && make run`, then `curl -H 'X-Tenant-Id: demo' localhost:8000/v1/config/public`
- `make conformance` passes for `/v1/config/public` and `/v1/app/version`
