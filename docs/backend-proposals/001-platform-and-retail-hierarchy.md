---
status: draft # draft → agreed → in-docs (PRD, SRS, C01, C13, C15, C16, C18, C19 updated)
requested_by: product owner, 2026-10-05
applies_to: Phase 1
---

# The platform layer, and one retail chain: Platform → Brand → Agent → Shop

## Summary

The Platform is a multi-tenant product. In Phase 1 the ownership chain is fixed at four levels:

```
Platform            the company that runs this system, and the brands on it
└─ Brand            a licensed betting operator (a tenant), e.g. "Demo Bet" at demobet.et
   └─ Agent         runs shops for the brand; every shop has one
      └─ Shop       a betting shop
         ├─ Terminals   shop computers customers use (no login; activated once)
         └─ Cashiers    staff at the counter (PIN, on an activated POS computer)
```

Two rules are decided:

1. **Every shop has an agent.** A shop the brand runs itself sits under an agent the brand owns (a
   **brand agent**). There are no shops without an agent.
2. **One agent level.** No master agents in Phase 1: an agent belongs to a brand, a shop to an agent.

Everything else here is either a consequence of those rules or an open question for the product owner
and the backend (§7).

## 1. Why

- **One shape everywhere.** Payout rules (`issuing_shop`, `same_agent`, `any_shop`), cash settlement,
  commission, agent-portal views and reports all assume a shop belongs to an agent. Shops "owned by the
  operator, no agent" (C19 §3) are a second case in every one of them. A brand agent removes it: the
  brand's own shops behave like any agent's, with commission set to whatever the brand chooses (usually
  none).
- **Simpler for Phase 1.** Master agents (regional supervisors) add a tree, subtree permissions and
  roll-up statements. Brands that need regions can come later; the data model can keep room for it.
- **The Platform is a business, not just a tenant table.** C16 holds tenants and their config, and C15 is
  each brand's back office. Nothing describes the company above the brands: who creates a brand, who can
  see what across brands, and how brands pay for the Platform.

## 2. The four levels

| Level              | Who                                                | Owns / does                                                                                                                                                                                                      | App                                                           | Can't                                                                                         |
| ------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Platform**       | The Platform company's staff                       | Creates brands (tenant, domains, licence, branding, first brand admin); suspends or reactivates a brand; sees each brand's status, licence expiry, config versions and billing figures; platform-wide monitoring | **Platform console** (new) at `console.{platform domain}`     | See players' personal data, bets or money in a brand, except through a brand's grant (§7, Q4) |
| **Brand** (tenant) | The licensed operator's staff                      | Its players, rules, taxes, payment methods, odds and risk, agents, shops, commission plans, approvals; everything in C15                                                                                         | Back office at `bo.{brand}`                                   | See another brand                                                                             |
| **Agent**          | A partner agent, or the brand itself (brand agent) | Its shops: sales, payouts, cash owed, float, settlement with the brand, commission statements; adds cashiers and terminals to its own shops                                                                      | Agent portal at `agents.{brand}`                              | Change odds, markets, player data, commission rates                                           |
| **Shop**           | Cashiers (and, see Q3, a shop manager)             | Sells tickets from slip codes, prints, pays winners, cancels within the window, counts cash at shift close                                                                                                       | Cashier POS at `pos.{brand}`; terminals at `terminal.{brand}` | Change limits or see other shops                                                              |

Separation (unchanged): every row of brand data carries `tenant_id` and is protected by row-level
security (TD-02). A ticket is only ever paid in shops of the brand that sold it; a phone number registers
separately at each brand.

## 3. Changes to the retail network (C19)

### 3.1 Hierarchy (C19 §3)

Replace the tree with:

```
Brand (tenant)
├─ Brand agent      kind = brand: the brand's own shops
│  └─ Shop …
└─ Agent            kind = partner: e.g. "Adama agent"
   └─ Shop
      ├─ Terminals (1..n)
      └─ Cashiers (1..n)
```

- Remove "Master agent (optional)" and "Shop owned directly by the operator (no agent)" for Phase 1.
- A brand can have **one or more** brand agents (e.g. one per city it runs itself) — see Q2.

### 3.2 Data model (C19 §6)

| Table                    | Change                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `retail.agent`           | Add `kind text not null default 'partner' check (kind in ('brand','partner'))`. `parent_id` stays but is always null in Phase 1 (the API refuses one); `path` stays one level deep. |
| `retail.shop`            | `agent_id uuid not null references retail.agent(id)`: every shop has an agent. Drop the "null = owned by the operator" comment.                                                     |
| `retail.commission_plan` | Unchanged; a brand agent usually has no plan (no accrual), or a 0 % plan — see Q2.                                                                                                  |

### 3.3 Flows (C19 §4)

- **Settlement (§4.7):** a brand agent's collected cash goes straight to the brand's bank
  (`SHOP_SETTLEMENT` to `HOUSE_BANK`). A partner agent settles with the brand as today, keeping
  commission if it is netted.
- **Commission (§4.8):** plans attach to partner agents (or their shops). A brand agent earns nothing
  unless the brand gives it a plan.
- **Payout (§4.4):** `same_agent` now covers the brand's own shops as one group. Example: Demo Bet runs
  3 shops itself (brand agent "Demo Bet Direct") and has a partner agent in Adama with 5 shops. With
  `same_agent`, a ticket from a direct shop is paid in any of the 3; an Adama ticket in any of the 5; with
  `any_shop`, in all 8.

### 3.4 Contract (for `/contract-change` in the backend)

- `Agent`: add `kind: { type: string, enum: [brand, partner] }`. Keep `parent_id` and `level`; in Phase 1
  `level` is always `agent` and a non-null `parent_id` is refused (`422 VALIDATION_FAILED`, `errors[]`
  naming `parent_id`). (Keeping the fields leaves room for master agents later without a breaking change.)
- `Shop`: `agent_id` becomes required and non-null. This is not additive (TD-01). There are no clients
  yet, so the backend can decide whether to change it before Release 1 or keep it nullable and refuse
  null.
- New tag **Platform** for the console's operations (§4).

The web repo's [contract request 013](../contract-requests/013-platform-and-retail-chain.md) carries these
changes, the missing error answers on the retail admin operations, and the console's operations.

## 4. The Platform layer (new)

### 4.1 What the console does in Phase 1

- **Create a brand:** legal name, code, licence number and expiry (C16 `tenancy.tenant`), domains for each
  app (`tenancy.tenant_domain`: player web, API, back office, terminal, POS, agent portal), branding and
  languages, the first configuration version (the C16 document, from a template), and the brand's first
  back-office admin (invited by email).
- **Run brands:** status `setup → active → suspended` (C16), the real-money switch's inputs (licence,
  CFG-04), feature flags per brand, config versions (read; activation stays the brand's, with its
  four-eyes rule for `betting`, `payments` and `rg`).
- **Watch:** per brand — health, licence expiry warnings, active players, turnover and GGR totals for
  billing (§5).

### 4.2 Who it is (C01)

- A new principal type, **platform staff**, with its own token audience: a platform token can't call a
  brand's back-office endpoints, and a brand token can't call platform endpoints.
- Platform staff are not tenant-scoped (unlike `backoffice.staff`); every action is audited with the brand
  it touched.
- Login with password + TOTP, like the back office (C15).

### 4.3 What it is not

The console doesn't replace a brand's back office. Odds, players, payments, retail and reports stay in C15
for each brand.

## 5. Money between a brand and the Platform

The money flow inside a brand is designed (C19 §4.7–4.8, C03): cash moves shop → agent → brand,
commission goes to agents, stake and win tax to the government. **Nothing says how a brand pays the
Platform.** Options (the product owner decides — Q1):

| Option          | How it works                                                                           | What the system needs                                                                                       |
| --------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A. Fixed fee    | Monthly subscription per brand                                                         | Nothing in the ledger; an invoice outside the system                                                        |
| B. Share of GGR | A percentage of each brand's gross gaming revenue (stakes − winnings, online + retail) | GGR per brand per period is already in the ledger (`HOUSE_GGR`); add a monthly platform statement per brand |
| C. Per outlet   | A fee per active shop, terminal or cashier device                                      | Counts per brand per month from C19 tables                                                                  |
| D. Mix          | e.g. a minimum fee plus a share of GGR above a threshold                               | B + C, and the threshold rule                                                                               |

Whatever is chosen: the Platform's charge is **not a posting in the brand's ledger** — the brand's books
stay the brand's (it is the licensed operator). The Platform keeps its own statement per brand, built from
the brand's reported totals, and invoices from it.

## 6. Documents to update in the backend

| Document   | Change                                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRD        | Personas: add **Platform staff**; move **Tenant operator** from "phase 2+" to Phase 1 (see Q5); E16 includes the platform console                                                                                |
| SRS        | New `PLT-*` requirements (create a brand, suspend it, platform staff identity and audit, cross-brand access rule, platform statement); amend `RET-*`/`AGT-*` for "every shop has an agent" and "one agent level" |
| C01        | Platform staff principal and token audience                                                                                                                                                                      |
| C13        | The monthly platform statement per brand (if option B, C or D)                                                                                                                                                   |
| C15        | Note that the back office is per brand; the platform console is separate                                                                                                                                         |
| C16        | Brand creation and lifecycle owned by the platform console; who may write `tenancy.*`                                                                                                                            |
| C18        | Web layout (FD1 here): two projects — player and terminal in `kelalsport-web`, split by host; POS, agent portal, back office and the platform console in `kelalsport-ops`. Replaces the single workspace of §3   |
| C19        | §3 hierarchy and roles, §4.4 payout example, §4.7–4.8 brand agent, §6 data model, §9.3 admin endpoints, §16 build order                                                                                          |
| Contract   | §3.4 and the new `Platform` tag                                                                                                                                                                                  |
| Build plan | Where the platform console and the platform statement fit (backend B-step, frontend task)                                                                                                                        |

On the web side (this repo), once the backend docs change: the back office's retail admin (F10g) creates
agents with `kind` and requires an agent on every shop; the agent portal (F10a) works the same for a brand
agent; a new task adds the platform console app.

## 7. Open questions

| #   | Question                                                                                                                                                                                                                                                            | Options / recommendation                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | How does a brand pay the Platform?                                                                                                                                                                                                                                  | §5: A, B, C or D. Decides whether the system needs a platform statement.                                                          |
| Q2  | Brand agents: one per brand, or several (e.g. per city)? Do they ever earn commission?                                                                                                                                                                              | Recommended: several allowed; no commission unless the brand sets a plan                                                          |
| Q3  | Shop manager: the chain lists terminals and cashiers only. C19 has a shop manager (approves cancels up to 30 min, closes any shift, resets a cashier's PIN). Keep it as a **cashier permission** in the shop, or move those powers to the **agent** (agent portal)? | Recommended: keep it as a cashier role — a cancel needs approving at the counter within minutes, and the agent is often not there |
| Q4  | Can platform staff see inside a brand (players, bets, money) — e.g. for support?                                                                                                                                                                                    | Recommended: no by default; a brand admin grants time-limited, audited access                                                     |
| Q5  | Phase 1: are several brands live at launch, or is the platform layer built with one brand live?                                                                                                                                                                     | Changes the PRD's "launches as one consumer brand"; affects how much of the console is needed on day one                          |
| Q6  | Who answers to the regulator: each brand for itself (C13 per tenant), or the Platform as well?                                                                                                                                                                      | Depends on the new directive; most likely each licensed brand                                                                     |
| Q7  | Who logs in to the agent portal for a brand agent?                                                                                                                                                                                                                  | Brand staff with an agent-portal account for that brand agent, or the back office's retail screens only                           |
