# C15 Back Office & Trading

## 1. Purpose & scope

C15 is the operator's console. It covers staff identity and roles, player management, trading and risk screens, finance and compliance queues, content management, reports and configuration. Most business logic stays in the owning modules; C15 provides staff authentication, RBAC, the audit hook, and the admin front end. It implements BO-01 to BO-16.

## 2. Research notes

| Topic | Decision |
| --- | --- |
| Framework | [Refine](https://refine.dev/) inside a Next.js app (`apps/admin`, served at `bo.{brand}`), decided 30 Sep 2026. Refine is headless, works with any REST API and supports access control and audit logs. |
| Staff authentication | Password + TOTP (RFC 6238) mandatory; optional Google/Microsoft SSO later |
| Four-eyes | Money and settlement actions above thresholds need a different approver (never the requester) |
| Competitors | Convex's platform includes back office, agent management, risk and CRM as core parts of the product; operators live in it all day |

## 3. Roles and permissions

| Permission | Support | Trader | Finance | Compliance | Marketing | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| `players:read` | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `players:write` (status, notes) | ✓ | — | — | ✓ | — | ✓ |
| `players:pii` (see full ID, documents) | — | — | — | ✓ | — | ✓ |
| `wallet:adjust` / `wallet:approve` | request | — | ✓ / ✓ | — | — | ✓ |
| `bets:read` | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `bets:settle_manual` | — | ✓ (+ approver) | — | — | — | ✓ |
| `trading:read` / `trading:write` | — | ✓ / ✓ | — | — | — | ✓ |
| `payments:approve` | — | — | ✓ | ✓ | — | ✓ |
| `kyc:review`, `aml:review` | — | — | — | ✓ | — | ✓ |
| `reports:read` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `marketing:write`, `cms:write` | — | — | — | — | ✓ | ✓ |
| `config:write`, `admin` | — | — | — | — | — | ✓ |
| `audit:read` | — | — | — | ✓ | — | ✓ |

## 4. Data model

```sql
create table backoffice.staff (
  id uuid primary key, tenant_id uuid not null, email text not null, full_name text not null,
  password_hash text not null, totp_secret_enc bytea, status text not null default 'active',
  last_login_at timestamptz, created_at timestamptz not null default now(),
  unique (tenant_id, email)
);
create table backoffice.role (id uuid primary key, tenant_id uuid not null, name text not null, unique (tenant_id, name));
create table backoffice.role_permission (role_id uuid references backoffice.role(id), permission text not null,
  primary key (role_id, permission));
create table backoffice.staff_role (staff_id uuid references backoffice.staff(id), role_id uuid references backoffice.role(id),
  primary key (staff_id, role_id));
create table backoffice.approval (
  id uuid primary key, tenant_id uuid not null, kind text not null,     -- adjustment, manual_settlement, config_change, retail_payout, retail_limit
  subject_id uuid not null, requested_by uuid not null, approved_by uuid,
  status text not null check (status in ('pending','approved','rejected','expired')),
  created_at timestamptz not null default now(), decided_at timestamptz,
  check (approved_by is null or approved_by <> requested_by)
);
create table backoffice.note (id uuid primary key, tenant_id uuid not null, player_id uuid not null,
  author_id uuid not null, body text not null, created_at timestamptz not null default now());
create table backoffice.cms_banner (id uuid primary key, tenant_id uuid not null, placement text not null,
  image_key text not null, link text, lang text not null, starts_at timestamptz, ends_at timestamptz, sort int);
create table backoffice.cms_page (id uuid primary key, tenant_id uuid not null, slug text not null, lang text not null,
  title text not null, body_md text not null, version int not null, published_at timestamptz,
  unique (tenant_id, slug, lang, version));
```

## 5. Screens (admin front end)

| Area | Screens | Main data source |
| --- | --- | --- |
| Dashboard | Today: bets, turnover, GGR, deposits, withdrawals pending, feed health, open alerts | C13 summaries (near-real-time counters in Redis) |
| Players | Search; 360° (profile, KYC, balances, transactions, bets, limits, devices, notes, alerts); actions | C01–C04, C08, C12 |
| Trading | Liability board by fixture (sortable by exposure); market suspend/reopen; limits editor; large-bet feed; sharp-player list | C06, C08 |
| Settlement | Unsettled > 72 h; manual settlement requests and approvals | C10 |
| Finance | Withdrawal queue; deposits; reconciliation breaks; reports | C03, C04, C13 |
| Compliance | KYC queue with document viewer; AML alerts; RG cases; regulator exports | C02, C12, C13 |
| Marketing | Bonus rules (JSON editor + form), promo codes, banners, pages, campaigns | C11, C14, C15 |
| Settings | Tenant configuration with diff and version history; staff and roles | C16 |
| Audit | Search by actor, action, target, time | C13 |

## 6. Trading: liability board

For each upcoming fixture, the board shows the top outcomes by exposure: `liability = sum(potential payout − stake)` from Redis counters, with stake count, largest single bet, and limit utilisation (%) in green, amber or red. Actions: suspend market, lower the max stake for that market, or open the bets list. Refresh is every 5 s (polling; live push later).

## 7. Security specifics

- The admin front end runs on a separate domain, behind Cloudflare Access or an IP allow-list plus staff 2FA.
- PII masking by default (phone `+2519••••67`, ID last 4). Unmasking requires `players:pii` and writes an audit row.
- Session timeout: 30 min idle, 12 h absolute.

## 8. Tests

Permission matrix tests (every staff route × role), the four-eyes constraint (the requester cannot approve), PII masking, and audit rows for every mutating route.

## Retail screens (added for C19)

The back office gets a Retail section for operator staff; agents use their own portal (C18/C19), not the back office.

| Screen | What staff do there |
| --- | --- |
| Agents and shops | Tree view of master agents, agents and shops; create, suspend, close; set shop limits, opening hours, payout rules and commission plan |
| Terminals and POS devices | Create a terminal and show its activation code; see last-seen time, IP and app version; revoke |
| Staff | Cashiers and shop managers per shop; reset PIN; daily cancel limit |
| Payout approvals | Queue of big-win payouts waiting for head office, with ticket, shop, customer ID; approve or reject |
| Retail tickets | Search by ticket number, shop, cashier, date or status; full history including reprints and cancels |
| Shifts and cash | Open shifts, Z reports, variances; settlements recorded between shops, agents and the operator |
| Commission | Plans, weekly statements, mark paid |
| Retail dashboard | Turnover, payouts, GGR, cancels and cash held per shop and region, today and by week |

Permissions: `retail:read`, `retail:manage`, `retail:approve_payout`, `retail:finance`; payout approvals and limit changes go through the same four-eyes rule as manual wallet adjustments.
