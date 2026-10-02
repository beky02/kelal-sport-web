# C16 Configuration & Tenancy

## 1. Purpose & scope

C16 makes the platform configurable per tenant (brand) without code changes. It holds tenants, domains, versioned configuration, rule sets, feature flags and the real-money switch. It implements CFG-01 to CFG-05 and DC-3/DC-5. Release 1 has one tenant, but every module reads settings through C16, so a second operator is a data task (PRD goal G8).

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

The tenancy tables are the only ones without row-level security. They are read by middleware with a dedicated role.

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
