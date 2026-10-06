# C16 Configuration & Tenancy

## 1. Purpose & scope

C16 makes the platform configurable per tenant (brand) without code changes. It holds tenants, domains, versioned configuration, rule sets, feature flags and the real-money switch. It implements CFG-01 to CFG-05 and DC-3/DC-5. Release 1 launches with one brand live (how many are live at launch is open, Q5), but every module reads settings through C16, so a second operator is a data task (PRD goal G8). Brands are created and run by the Platform company's staff from the **platform console** (PLT-01 to PLT-07; section 9 below and `docs/design/platform-retail-hierarchy.md`); each brand's own staff change its configuration from its back office (C15).

## 2. Research notes

| Observation | Design |
| --- | --- |
| Convex runs one copy of the whole system per brand; each brand differs only by \~113 config keys (slip class, taxes, payment methods, branding) | One deployment, many tenants; the same breadth of keys, validated |
| Convex's gen-2 platform uses an `X-Tenant-Id` header and a tenant “public info” endpoint | Same pattern: host or header → tenant; `/v1/config/public` |
| Mistakes in config are production incidents | JSON-schema validation, versioning, diff view, four-eyes for money-related keys |

## 3. Data model

```sql
create table tenancy.tenant (
  id uuid primary key, code text unique not null, legal_name text not null,
  licence_number text, licence_valid_until date,             -- real-money switch depends on these
  status text not null check (status in ('setup','active','suspended')),
  default_lang text not null default 'am', currency char(3) not null default 'ETB',
  timezone text not null default 'Africa/Addis_Ababa', created_at timestamptz not null default now()
);
create table tenancy.tenant_domain (host text primary key, tenant_id uuid not null references tenancy.tenant(id),
  kind text not null check (kind in ('player_web','api','admin','terminal','pos','agent')));

create table tenancy.tenant_config_version (
  tenant_id uuid not null references tenancy.tenant(id),
  version int not null,
  config jsonb not null,                 -- full document, validated against schema
  schema_version int not null,
  created_by uuid not null, approved_by uuid,
  comment text, created_at timestamptz not null default now(),
  activated_at timestamptz,
  primary key (tenant_id, version)
);
create table tenancy.tenant_config_active (tenant_id uuid primary key, version int not null);

create table tenancy.feature_flag (
  tenant_id uuid not null, flag text not null, enabled boolean not null,
  rollout_pct int not null default 100, updated_at timestamptz not null default now(),
  primary key (tenant_id, flag)
);
```

The tenancy tables have no row-level security (with `platform.*`, section 9, and the global feed and catalogue tables, D3). They are read by middleware with a dedicated role. Who may write them: section 9.

## 4. Configuration document (abridged schema)

```json
{
  "brand": { "name": "…", "logo_url": "…", "primary_color": "#…", "support": { "telegram": "…", "phone": "…" } },
  "auth": { "min_age": 21, "otp_ttl_s": 300, "new_device_otp": true },
  "kyc": { "required_for_withdrawal": true, "fayda_enabled": true },
  "betting": {
    "min_stake": "5.00", "max_stake": "50000.00", "max_payout": "1000000.00", "max_legs": 30,
    "acca_bonus_table": [[3, 3], [5, 8], [8, 15], [10, 25], [15, 50], [20, 100]],
    "acca_bonus_min_leg_odds": "1.30", "acca_bonus_max": "200000.00",
    "taxes": [ { "code": "STAKE_TAX", "base": "stake", "rate": "0.15", "deduct_from": "stake" },
               { "code": "WIN_TAX", "base": "gross_win", "rate": "0.15", "threshold": "1000.00" } ],
    "default_odds_policy": "higher"
  },
  "catalogue": { "horizon_days": 14, "page_size": 20, "margins": { "global_pct": 0 } },
  "payments": { "methods": [ { "code": "telebirr", "enabled": true, "deposit": ["20.00", "100000.00"], "withdrawal": ["50.00", "50000.00"] } ],
                "auto_approve_limit": "10000.00" },
  "rg": { "reality_check_minutes": 60, "limit_increase_cooloff_h": 24 },
  "notify": { "quiet_hours": ["22:00", "07:00"], "sms_primary": "afromessage", "sms_fallback": "smsethiopia" },
  "retail": { "…": "the C19 §11 keys" },
  "retail_betting": { "…": "retail rule set, same RuleSet shape as betting" },
  "legal": { "terms_version": "2026-10", "rules_url": "…" }
}
```

Tax rates above are placeholders until the directive is published. `retail` holds the C19 §11 keys, plus the `retail_betting` rule set. `betting` and `retail_betting` are stored in the contract's RuleSet shape (Engineering Decisions D1.12). `admin` in `tenant_domain.kind` is the back office.

## 5. Interface and API

```python
class Tenancy(Protocol):
    def current(self) -> TenantCtx                           # from middleware context
    async def config(self, section: str) -> dict              # cached per version
    async def rules(self, name: str) -> RuleSet               # typed, e.g. betting rule-set + version
    async def rules_version(self, version: int) -> RuleSet    # historic (settlement)
    def is_enabled(self, flag: str) -> bool
    def real_money_enabled(self) -> bool                      # licence present and valid
```

- `GET /v1/config/public`: brand, languages, enabled products, stake limits, `features` (from the `feature_flag` table), `dictionary_version`, `min_app_version`. Payment methods come from `/v1/payment-methods`.
- Staff: `GET /v1/admin/config`, `POST /v1/admin/config/versions` (draft with diff and validation errors), `POST /v1/admin/config/versions/{v}/activate` (four-eyes for `betting`, `payments` and `rg` sections).

## 6. Caching and propagation

The active config is cached in process memory, keyed by version. Activation publishes `config.changed {tenant, version}`; all processes reload within 5 s. Rule-set versions are immutable, so bets store `rules_version` and settle under the same rules.

## 7. Real-money switch (CFG-04)

`real_money_enabled = tenant.status == 'active' and licence_number is not null and licence_valid_until >= today`. When false, deposits, bets and withdrawals return `503 REAL_MONEY_DISABLED`, and a demo mode with play money can be offered for testing.

## 8. Tests

Schema validation of the sample config, version immutability, activation four-eyes, reload propagation, tenant resolution by host and header, and an RLS isolation test with two tenants.

## 9. Brands and the platform console (added for the platform layer)

Above the brands sits the Platform: the company that runs the system. Its staff create and run brands from the **platform console** at `console.{platform domain}`, a separate web app (C18) that never replaces a brand's back office. Decided on 5 Oct 2026 (`docs/design/platform-retail-hierarchy.md`, Engineering Decisions D10); it implements PLT-01 to PLT-07 (PLT-08, the platform statement, is C13).

### 9.1 Brand lifecycle

| Status | Set by | Meaning |
| --- | --- | --- |
| `setup` | Console, on creation | Domains, configuration and the first admin exist; real money is off |
| `active` | Console | Real money on while the licence is valid (section 7) |
| `suspended` | Console, with a reason | Real money off (section 7; whether withdrawals stay open is Q8); back to `active` by the console |

Creating a brand records, in order: the tenant (legal name, code, licence number and expiry, languages, status `setup`); a domain for each app (`tenant_domain.kind`: `player_web`, `api`, `admin`, `terminal`, `pos`, `agent`); configuration version 1 from a template (the section 4 document with the brand's branding and languages, validated like any version, activated by the console because there is nothing before it); the default feature flags; the default back-office roles and the first back-office admin, invited by email (C15; the email sender is new in C14, behind an adapter with a console mock). The brand's house ledger accounts need no step: C03 opens them on first use. Each step can be repeated without harm, so a creation that fails half-way is finished by running it again.

### 9.2 Who writes `tenancy.*`

| Table | Written by |
| --- | --- |
| `tenant`, `tenant_domain`, `feature_flag` | The platform console only, through the `tenancy` interface |
| `tenant_config_version`, `tenant_config_active` | Version 1: the console, at creation. Later versions: the brand, from its back office (section 5; four-eyes for `betting`, `payments` and `rg`). The console reads versions and never activates one after creation |

`app` can only read these tables today (B1); B16 adds the grants the console needs, and B10 those the back office needs.

### 9.3 The `platform` module

The console's backend is the module `platform` (schema `platform`, global like `tenancy`: no `tenant_id` on its own rows, no RLS):

```sql
create table platform.staff (
  id uuid primary key, email text unique not null, full_name text not null,
  password_hash text not null, totp_secret_enc bytea, status text not null default 'active',
  failed_attempts int not null default 0, locked_until timestamptz,
  last_login_at timestamptz, created_at timestamptz not null default now()
);
create table platform.session (          -- platform staff sessions; identity.session is tenant-scoped
  id uuid primary key, staff_id uuid not null references platform.staff(id), family_id uuid not null,
  refresh_token_hash bytea not null unique, ip inet, user_agent text,
  created_at timestamptz not null default now(), last_used_at timestamptz not null default now(),
  expires_at timestamptz not null, revoked_at timestamptz, revoked_reason text
);
create table platform.audit_log (        -- append-only: app may INSERT only
  id bigserial primary key, actor_id uuid not null, action text not null,   -- e.g. brand.create, brand.suspend
  tenant_id uuid,                        -- the brand the action touched; null for platform-only actions
  target_type text, target_id text, before jsonb, after jsonb,
  ip inet, user_agent text, trace_id text, created_at timestamptz not null default now()
);
```

Rules:

- `platform` writes only its own schema. It changes a brand through the `tenancy` and `backoffice` interfaces, and reads a brand's figures (active players, turnover, GGR from C13's daily summaries) one brand at a time inside that brand's `tenant_session()`. There is no cross-tenant query: RLS stays the only gate on brand data.
- Platform staff see a brand's status, licence, domains, flags, configuration versions, health and aggregate figures, and nothing about individual players, bets or money (Q4; no grant mechanism in Phase 1).
- Roles for platform staff (at least read-only versus changing brands) are set in B16's plan.
- Authentication: password + TOTP, audience `platform`, no `tid` (C01, "Platform staff").
- Routes `/v1/platform/*` are not tenant-scoped: the tenant middleware skips them, a brand is named in the path, and the console host is a deployment setting, not a `tenant_domain` row. The console sits behind Cloudflare Access or an IP allow-list, like the back office (TD-90).

### 9.4 API (proposed; the contract change that adds the `Platform` tag fixes the shapes)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/platform/auth/login`, `/v1/platform/auth/totp`, `/v1/platform/auth/refresh`, `/v1/platform/auth/logout` | Platform staff sign-in |
| GET / POST | `/v1/platform/brands` | List brands with status, licence expiry and today's figures; create a brand (section 9.1) |
| GET / PATCH | `/v1/platform/brands/{code}` | One brand: licence, domains, flags, active configuration version, health; change legal name or licence |
| POST | `/v1/platform/brands/{code}/status` | `active` or `suspended`, with a reason |
| PUT | `/v1/platform/brands/{code}/domains`, `/v1/platform/brands/{code}/flags/{flag}` | Domains; feature flags |
| GET | `/v1/platform/brands/{code}/config/versions` | Configuration versions (read only) |
| GET | `/v1/platform/brands/{code}/figures?from=&to=` | Active players, turnover and GGR per day, online and retail |
| GET / POST | `/v1/platform/staff` | Platform staff |
| GET | `/v1/platform/audit-log` | Platform audit search |
| GET | `/v1/platform/statements?period=` | Platform statements (only if Q1 is B, C or D; C13) |

Licence expiry is shown with a warning ahead of the date; the lead time is a platform setting.

### 9.5 Tests

A platform token on a brand endpoint and a brand token on a platform endpoint → 401; creating a brand twice with the same code → one brand; a half-finished creation completes when repeated; a new brand's `GET /v1/config/public` validates against the contract; suspending a brand turns `real_money_enabled()` off; every console write adds a `platform.audit_log` row naming the brand; the console's figures for a brand equal that brand's daily summaries.
