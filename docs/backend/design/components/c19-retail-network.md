# C19 Retail Network: Shops, Terminals & Cashiers

## 1. Purpose & scope

C19 runs the cash business that every white-label operator in Ethiopia expects: betting shops with self-service terminals and a cashier counter, grouped under agents. It implements RET-01 to RET-17 and AGT-01 to AGT-07 (SRS 4.19 and 4.20) and is part of **Release 1** (pre-match), because an operator that buys the platform will not launch without shops.

The flow the platform must support:

1. A customer walks into a shop and uses a **terminal** (a PC or touch screen showing the betting site in a locked browser). No login, no account, no money on the terminal.
2. They pick matches and outcomes, and press **Get code**. The terminal shows a short **slip code**.
3. They give the code to the **cashier** and pay in cash. The cashier enters the code, sees the slip re-priced, enters the stake, takes the cash and **prints a ticket** with a barcode.
4. If the ticket wins, the customer brings it back; the cashier **scans the barcode** and pays out cash.

In scope: the brand → agent → shop → terminal/cashier hierarchy (every shop under an agent, one agent level; §3), terminal activation, slip codes from terminals, ticket sale, receipt printing, payout, cancellation, cashier shifts and cash reconciliation, shop cash limits, agent commission, and retail data for the regulator. Out of scope for Release 1: offline selling, shop-level promotions, agent-assisted online deposits (P1), and self-service terminals that take cash (bill acceptors, P2).

## 2. Research notes

| Finding | Source | Design consequence |
| --- | --- | --- |
| Ethiopian shops are small rooms with a few PCs showing the operator's website and one cashier; customers build slips on the PCs, read a code to the cashier, pay cash and receive a thermal-printed ticket | Our teardown and competitor shops (HuluSport and other Convex white labels) | Terminal = the normal web client in a kiosk mode; cashier = a separate POS client |
| HuluSport's public API creates a booked bet without login (`POST /sport-data/bet.place/`) and loads it with `GET /shared-bet/{code}/` | API teardown (research doc) | Reuse C09 bookings for terminal codes, with a retail code format and shop binding |
| Convex sells retail and agent modules alongside the white label; shops and agents are how incumbents reach players without smartphones | Convex research (research doc) | Hierarchy, float and commission are table stakes for B2B sales |
| Chrome can run locked to one URL (`--kiosk`) and print without a dialog to the default printer (`--kiosk-printing`) | [Kiosk silent printing guide](https://gist.github.com/sajinct/cf4863f7b5da061b2c65c104c55a6da6), [ShopTill-e](https://www.shoptill-e.com/support/48) | No native app needed for terminals or the POS in Release 1 |
| USB barcode scanners act as a keyboard and type the code followed by Enter | Standard HID behaviour | POS needs no driver: a focused input field receives scans |
| Retail customers are anonymous; tax on winnings and AML checks still apply to large payouts | PRD context, C12 | Payout above a threshold requires ID capture and may need head-office approval |

## 3. Actors, hierarchy and roles

The hierarchy lives inside one tenant (a **brand**, the licensed operator) and has two rules, decided on 5 Oct 2026 (`docs/design/platform-retail-hierarchy.md`, Engineering Decisions D10):

1. **Every shop has an agent.** The shops a brand runs itself sit under a **brand agent** (`kind = brand`) that the brand owns; agents that run shops for the brand are **partner agents** (`kind = partner`). There are no shops without an agent.
2. **One agent level.** No master agents in Phase 1: an agent belongs to the brand, a shop to an agent.

```
Brand (tenant)
├─ Brand agent                    kind = brand, e.g. "Demo Bet Direct": the brand's own shops
│  └─ Shop …
└─ Agent                          kind = partner, e.g. "Adama agent"
   └─ Shop                        e.g. "Adama Kebele 04"
      ├─ Terminals (1..n)         self-service PCs, no user
      ├─ Cashiers (1..n)          staff users with PIN
      └─ Shop manager (0..1)      a cashier role: approves cancels, closes shifts, sees shop reports (Q3)
```

- A brand may have several brand agents, e.g. one per city it runs itself (Q2 placeholder: several allowed).
- `parent_id` (always null), `path` (one level deep) and the contract's `level` (always `agent`) stay in Phase 1, so master agents can come later without reshaping the tables or breaking the API.
- Above the brands is the Platform (the company that runs the system, with its platform console, C16). It creates and suspends brands and sees no retail data inside a brand beyond aggregates (Q4).

Q2, Q3, Q4 and Q7 are open questions with the product owner (`platform-retail-hierarchy.md` §7); Engineering Decisions D10 lists the placeholder each one uses until answered.

| Role | Client | Can do | Cannot do |
| --- | --- | --- | --- |
| Terminal (device) | Next.js web app in Chrome kiosk | Browse pre-match (and virtuals in R2), build a slip, get a slip code, check a ticket | Place bets, see money, log in |
| Cashier | Cashier POS (Next.js) | Open and close own shift, sell tickets, print and reprint, pay out, cancel within the window, record cash in and out | Change limits, see other shops, cancel after the window |
| Shop manager | Cashier POS | Everything a cashier can, plus approve cancels, close any shift in the shop, view shop reports, reset a cashier PIN | Change shop limits or commission |
| Agent (partner or brand agent) | Agent portal (Next.js) | See its shops, sales, payouts, cash owed, commission statements; add cashiers and terminals to its own shops; record cash collected from its shops. A brand agent is used the same way, by brand staff given a portal login for it (Q7) | Change odds, markets, player data, commission rates |
| Brand retail admin | Back office (C15) | Create agents (with their kind) and shops under them, terminals; set limits, cancel window, payout rules, commission plans; approve big payouts; see everything in the brand | See another brand |

## 4. End-to-end flows

&#91;embedded content: Retail ticket · sale and payout, 8 steps\]

Only the platform decides prices, limits and ticket status; terminals and the POS only display and collect.

### 4.1 Terminal activation (once per device)

1. Retail admin or agent creates the terminal in the portal; the platform returns a one-time **activation code** (8 characters, valid 24 h).
2. The technician opens `https://terminal.{brand}` on the shop PC in Chrome kiosk mode and types the activation code.
3. `POST /v1/retail/terminals/activate` returns a **terminal token** (90 days, rotated silently) bound to the terminal id, the shop and a device key generated in the browser (WebCrypto, non-extractable, kept in IndexedDB).
4. From then on the terminal boots straight into the shop's betting screen. Revoking the terminal in the portal logs it out on its next request.

### 4.2 Self-service slip → code (terminal)

1. Customer taps outcomes; the slip and totals are calculated locally with the shared TypeScript `slipcalc` (C07), using the tenant's retail rule set (it can differ from online, e.g. a higher minimum stake).
2. Customer optionally types a stake hint, then taps **Get code**.
3. `POST /v1/retail/slip-codes` (terminal token) stores selections only (a C09 booking with `channel='retail'`) and returns an **8-digit numeric code** shown as `4829 1735` plus a QR code.
4. The screen shows the code in large type for 60 s, then clears the slip and returns home, so the next customer starts clean. An idle timer (90 s without touch) also resets the screen.

Why numeric: cashiers type codes all day on a numeric keypad; digits in groups of four are faster and less error-prone than letters. 10^8 codes per tenant is plenty because a retail code lives a few hours at most.

### 4.3 Ticket sale (cashier)

1. Cashier types or scans the slip code (or builds the slip directly in the POS for a customer who reads out selections).
2. `GET /v1/retail/slip-codes/{code}` loads the selections **re-priced from the current catalogue**. Changed odds are highlighted; unavailable legs (started, suspended) are struck out and must be removed.
3. Cashier enters the stake (the cash handed over), confirms the customer is 21+ (a tick box when the tenant enables it), and presses **Sell** (F9).
4. `POST /v1/retail/tickets` with an idempotency key runs the normal placement pipeline (C08) with `channel='retail'`: price check, limits (per shop instead of per player), liability, stake tax, ledger posting `RETAIL_SALE`.
5. The response returns the ticket and the receipt; the POS prints it immediately (section 8). Reprint is allowed and logged, and every reprint is marked **COPY**.
6. The slip code is marked consumed so it cannot be sold twice by mistake. A customer who wants the same slip again gets it rebuilt from the ticket (**Sell again**).

### 4.4 Payout

1. Cashier scans the ticket barcode (or types the ticket ID).
2. `GET /v1/retail/tickets/{ticket_no}` shows the status: open, lost, won (amount), void (refund amount), paid (when and where), cancelled, expired.
3. For a winning or void ticket the cashier presses **Pay** → `POST /v1/retail/tickets/{ticket_no}/payout`. The server locks the ticket row, checks the payout rules below, marks it paid and posts `RETAIL_PAYOUT`. A second scan shows "PAID at Adama Kebele 04, 14:05, cashier Abebe".
4. Payout rules (tenant config): where a ticket can be paid (`issuing_shop`, `same_agent`, `any_shop`; `same_agent` treats each agent's shops as one group, a brand agent's included — see the example below); amounts above `retail.payout.id_required_over` need the customer's ID type and number (tax and AML, C12); amounts above `retail.payout.approval_over` go to head office, and the POS shows "waiting for approval" until an admin approves in the back office.
5. If the drawer does not hold enough cash, the cashier marks the payout **deferred** and gives a claim slip; the agent or head office pays later. The ticket stays unpaid until then.

Example of the location rule: Demo Bet runs 3 shops itself (brand agent "Demo Bet Direct") and has a partner agent in Adama with 5 shops. With `same_agent`, a ticket sold in a direct shop is paid in any of the 3 and an Adama ticket in any of the 5; with `issuing_shop`, only where it was sold; with `any_shop`, in all 8. Anywhere else the payout is refused with `RETAIL_PAYOUT_NOT_ALLOWED_HERE`. A ticket is never paid in another brand's shop.

### 4.5 Cancellation

A cashier can cancel a ticket only when **all** of these hold: within `retail.cancel.window_seconds` of the sale (default 300 s), before the first leg's start time, in the same open shift, and under the cashier's daily cancel limit. The stake is returned in cash (`RETAIL_CANCEL`). Outside those conditions only a shop manager (within 30 min) or head office can cancel. Every cancel is audited and counted; C12 alerts on a cashier whose cancel rate is far above the shop average (a known fraud pattern: cancelling losing tickets after an early goal).

### 4.6 Shift and cash reconciliation

1. **Open shift**: the cashier logs in and enters the opening cash counted in the drawer.
2. During the shift the POS keeps an expected cash figure: opening + sales + cash in − payouts − cancels − cash out.
3. **Cash in / cash out**: float received from the agent, cash handed to the agent or bank, petty expenses if allowed. Each needs a reason; amounts above a threshold need a manager.
4. **Close shift**: the cashier counts the drawer by denomination (200, 100, 50, 10, 5 birr notes and coins); the platform computes the variance and prints a **Z report** (totals, counts, variance). Variances above `retail.shift.variance_alert` alert the agent.
5. Shifts left open for more than 16 h are force-closed overnight with a "not counted" flag.

### 4.7 Shop cash position and settlement

Each shop has a ledger account `SHOP_CASH:{shop}`: cash the shop holds for the operator. Sales increase it; payouts and cancels decrease it; handing money to the agent or bank decreases it; float received increases it.

- **Cash limit**: `shop.max_cash_held` stops new sales when the shop holds too much of the operator's cash (theft and robbery risk) until it settles.
- **Negative position**: when payouts exceed sales, the shop needs float; the agent tops it up (`SHOP_FLOAT_TOPUP`).
- **Settlement**: the agent records cash collected from a shop in the agent portal; the shop manager confirms it on the POS (two-sided confirmation); then the platform posts `SHOP_SETTLEMENT`. The same happens between a partner agent and the brand, with bank-transfer references; the partner keeps its commission when it is netted (§4.8).
- **Brand agent**: its shops' cash goes straight to the brand's bank (`SHOP_SETTLEMENT` to `HOUSE_BANK`) and float comes from it (`SHOP_FLOAT_TOPUP` from `HOUSE_BANK`), so there is no agent-to-brand step and no `SHOP_CASH:{agent}` balance for a brand agent. The collection is recorded and confirmed the same two-sided way; who records it on the brand's side (a portal login for the brand agent, or the back office) is Q7.

### 4.8 Commission

Commission plans attach to partner agents or their shops; a brand agent earns nothing unless the brand gives it a plan (Q2), and an agent or shop without a plan accrues nothing (no `COMMISSION_ACCRUAL`). A plan is a percentage of **net revenue** (stakes − winnings − cancels, after tax) or of **turnover**, with optional tiers, calculated weekly. A negative week carries forward (configurable). Statements are generated every Monday for the previous week, shown in the agent portal as PDF and CSV, and accrued in the ledger (`COMMISSION_ACCRUAL`). Agents are paid either by keeping commission out of the cash they settle (`COMMISSION_NETTED`) or by transfer.

## 5. Module structure

C19 is a module inside the core monolith (`modules/retail`) with the same layering as the other modules. It calls C08 for placement, C03 for postings and C09 for codes through their public interfaces only (enforced by import-linter).

```
modules/retail/
├─ api/
│  ├─ terminal_routes.py    # /v1/retail/terminals/activate, /v1/retail/slip-codes (terminal token)
│  ├─ cashier_routes.py     # login, shifts, tickets, payout, cancel, cash movements, receipts
│  ├─ agent_routes.py       # /v1/agent/*: shops, reports, settlements, statements
│  └─ admin_routes.py       # /v1/admin/retail/*: CRUD, limits, approvals
├─ domain/
│  ├─ hierarchy.py          # Agent (kind brand | partner, one level), Shop (always under an agent), Terminal, Staff
│  ├─ ticket.py             # RetailTicket states: open → won/lost/void → paid | expired; cancelled
│  ├─ shift.py              # Shift, CashMovement, expected cash, Z report
│  ├─ payout_rules.py       # where, when and how much can be paid; approval thresholds
│  └─ commission.py         # plan evaluation, statements
├─ service/
│  ├─ sell_ticket.py        # C09 load → C08 place(channel=retail) → receipt
│  ├─ pay_ticket.py         # row lock, rules, posting, event
│  ├─ receipt.py            # receipt model (printed as HTML by the POS; PDF for back-office reprints); ESC/POS bytes (P1)
│  └─ settlement_sync.py    # consumes bet.settled for retail bets → ticket status + RETAIL_* postings
├─ repo/                    # SQLAlchemy repositories
├─ events.py                # retail.* event schemas
└─ jobs.py                  # expire unclaimed tickets, force-close shifts, weekly commission
```

## 6. Data model

All tables are tenant-scoped with RLS (TD-02). Every shop has an agent and there is one agent level (§3), so in Phase 1 an agent's `path` is its own id and a shop's is the agent's plus its own. The `ltree` columns and `parent_id` stay so master agents can be added later without reshaping the tables.

```sql
create extension if not exists ltree;

create table retail.agent (
  id            uuid primary key,
  tenant_id     uuid not null,
  kind          text not null default 'partner' check (kind in ('brand','partner')),  -- brand = the brand's own shops
  parent_id     uuid references retail.agent(id), -- always null in Phase 1: the API refuses one
  path          ltree not null,                 -- one level in Phase 1, e.g. 'a_07'
  name          text not null,
  phone         text not null,
  status        text not null default 'active', -- active | suspended | closed
  commission_plan_id uuid,                      -- usually null for a brand agent (no commission, §4.8)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index ix_agent_path on retail.agent using gist (path);

create table retail.shop (
  id              uuid primary key,
  tenant_id       uuid not null,
  agent_id        uuid not null references retail.agent(id),  -- every shop has an agent (a brand agent for the brand's own shops)
  path            ltree not null,                    -- agent path + shop id
  code            text not null,                     -- short code printed on tickets, e.g. 'ADM-004'
  name            text not null,
  region          text not null,
  city            text not null,
  address         text,
  geo             point,
  licence_ref     text,                              -- regulator's outlet id if issued
  status          text not null default 'active',    -- active | suspended | closed
  max_cash_held_santim     bigint not null,         -- stop sales above this
  max_ticket_stake_santim  bigint,                  -- override tenant default
  max_payout_per_day_santim bigint,
  opening_hours   jsonb,                             -- sales blocked outside hours
  commission_plan_id uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, code)
);

create table retail.terminal (
  id              uuid primary key,
  tenant_id       uuid not null,
  shop_id         uuid not null references retail.shop(id),
  label           text not null,                     -- 'PC 3'
  status          text not null default 'pending',   -- pending | active | revoked
  activation_code_hash  text,                        -- argon2id; cleared after use
  activation_expires_at timestamptz,
  device_public_key text,                            -- from WebCrypto at activation
  last_seen_at    timestamptz,
  last_ip         inet,
  app_version     text,
  created_at      timestamptz not null default now()
);

create table retail.staff (
  id              uuid primary key,
  tenant_id       uuid not null,
  shop_id         uuid not null references retail.shop(id),
  role            text not null,                     -- cashier | shop_manager
  username        text not null,
  full_name       text not null,
  phone           text not null,
  pin_hash        text not null,                     -- argon2id, 6-digit PIN
  failed_attempts int not null default 0,
  status          text not null default 'active',
  daily_cancel_limit int not null default 5,
  created_at      timestamptz not null default now(),
  unique (tenant_id, username)
);

create table retail.pos_device (                      -- cashier PCs allowed to log in
  id                uuid primary key,
  tenant_id         uuid not null,
  shop_id           uuid not null references retail.shop(id),
  device_public_key text not null,
  label             text,
  status            text not null default 'active',
  created_at        timestamptz not null default now()
);

create table retail.shift (
  id              uuid primary key,
  tenant_id       uuid not null,
  shop_id         uuid not null,
  staff_id        uuid not null references retail.staff(id),
  pos_device_id   uuid not null,
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  opening_cash_santim  bigint not null,
  expected_cash_santim bigint not null default 0,   -- updated on every movement
  counted_cash_santim  bigint,
  denominations   jsonb,                             -- {"200":12,"100":30,...}
  variance_santim bigint,
  status          text not null default 'open',      -- open | closed | force_closed
  closed_by       uuid
);
create unique index ux_one_open_shift on retail.shift (staff_id) where status = 'open';

create table retail.ticket (                           -- retail view of a C08 bet
  bet_id          uuid primary key,                  -- = betting.bet.id
  tenant_id       uuid not null,
  ticket_no       text not null,                     -- printed ID with check char, e.g. 'R7K2-M9XP-4'
  barcode_mac     text not null,                     -- HMAC-SHA256(ticket_no), 10 chars in the barcode
  shop_id         uuid not null,
  terminal_id     uuid,                              -- when the slip code came from a terminal
  slip_code       text,
  sold_by         uuid not null,                     -- staff id
  shift_id        uuid not null,
  stake_santim    bigint not null,
  status          text not null default 'open',      -- open | won | lost | void | paid | cancelled | expired
  payable_santim  bigint,                            -- net win or refund once settled
  paid_at         timestamptz,
  paid_shop_id    uuid,
  paid_by         uuid,
  paid_shift_id   uuid,
  payout_id_type  text,
  payout_id_number_enc bytea,                        -- only above the ID threshold, encrypted (C02 key)
  approval_id     uuid,                              -- big-win approval
  claim_expires_at timestamptz,                      -- settled_at + retail.claim_days
  reprints        int not null default 0,
  created_at      timestamptz not null default now(),
  unique (tenant_id, ticket_no)
);
create index ix_ticket_shop_status on retail.ticket (tenant_id, shop_id, status, created_at desc);

create table retail.cash_movement (
  id              uuid primary key,
  tenant_id       uuid not null,
  shift_id        uuid not null references retail.shift(id),
  kind            text not null,   -- sale | payout | cancel | cash_in | cash_out | float | settlement
  amount_santim   bigint not null, -- signed: + into the drawer, − out
  ref_type        text,
  ref_id          uuid,            -- ticket, settlement, approval
  reason          text,
  approved_by     uuid,
  ledger_txn_id   uuid,            -- C03 transaction
  created_at      timestamptz not null default now()
);

create table retail.payout_approval (
  id            uuid primary key,
  tenant_id     uuid not null,
  bet_id        uuid not null,
  amount_santim bigint not null,
  requested_by  uuid not null,
  shop_id       uuid not null,
  status        text not null default 'pending',   -- pending | approved | rejected
  decided_by    uuid,
  decided_at    timestamptz,
  note          text,
  created_at    timestamptz not null default now()
);

create table retail.settlement (                       -- cash moving shop → agent → operator (a brand agent's shops: shop → operator)
  id            uuid primary key,
  tenant_id     uuid not null,
  from_kind     text not null,  from_id uuid not null, -- shop | agent
  to_kind       text not null,  to_id   uuid,          -- agent | operator
  amount_santim bigint not null,
  method        text not null,                         -- cash | bank | telebirr
  reference     text,
  recorded_by   uuid not null,
  confirmed_by  uuid,
  status        text not null default 'recorded',      -- recorded | confirmed | disputed
  ledger_txn_id uuid,
  created_at    timestamptz not null default now()
);

create table retail.commission_plan (
  id             uuid primary key,
  tenant_id      uuid not null,
  name           text not null,
  basis          text not null,             -- net_revenue | turnover
  tiers          jsonb not null,            -- [{"from":0,"rate":"0.20"},{"from":500000000,"rate":"0.25"}]
  carry_negative boolean not null default true,
  period         text not null default 'weekly'
);

create table retail.commission_statement (
  id                 uuid primary key,
  tenant_id          uuid not null,
  owner_kind         text not null,         -- agent | shop
  owner_id           uuid not null,
  period_start       date not null,
  period_end         date not null,
  turnover_santim    bigint not null,
  winnings_santim    bigint not null,
  cancels_santim     bigint not null,
  net_revenue_santim bigint not null,
  carried_in_santim  bigint not null,
  commission_santim  bigint not null,
  status             text not null default 'draft',   -- draft | final | paid
  pdf_key            text,
  created_at         timestamptz not null default now(),
  unique (tenant_id, owner_kind, owner_id, period_start)
);
```

Changes to other modules' tables (made in those modules' migrations):

- `betting.bet` (C08): `player_id` becomes nullable; add `channel text not null default 'online'` (`online | retail`) and `shop_id uuid`, with a check constraint `(channel = 'online' and player_id is not null) or (channel = 'retail' and shop_id is not null)`.
- `booking.booking` (C09): add `channel`, `shop_id`, `terminal_id` and `consumed_by_bet_id`, and allow the 8-digit numeric code format when `channel = 'retail'`.

## 7. Ledger postings

New accounts in C03: `SHOP_CASH:{shop}` (asset, debit), `RETAIL_UNPAID_WINNINGS` (liability, credit, one sub-account per shop), `AGENT_COMMISSION_PAYABLE:{agent}` (liability), `HOUSE_COMMISSION_COST` (expense), `HOUSE_UNCLAIMED_WINNINGS` (liability or revenue, per the regulator's rule) and `HOUSE_BANK:{account}` (asset). Same notation as C03 (+ debit, − credit).

| Txn type | Entries |
| --- | --- |
| `RETAIL_SALE` | +SHOP\_CASH:shop, −HOUSE\_OPEN\_STAKES (and −TAX\_PAYABLE\_STAKE if stake tax is charged on top) |
| `RETAIL_WIN` | +HOUSE\_OPEN\_STAKES (stake), +HOUSE\_GGR (profit paid), −RETAIL\_UNPAID\_WINNINGS (net), −TAX\_PAYABLE\_WIN |
| `RETAIL_LOSS` | +HOUSE\_OPEN\_STAKES, −HOUSE\_GGR |
| `RETAIL_VOID` | +HOUSE\_OPEN\_STAKES, −RETAIL\_UNPAID\_WINNINGS (refund waits at the counter) |
| `RETAIL_CANCEL` | +HOUSE\_OPEN\_STAKES, −SHOP\_CASH:shop |
| `RETAIL_PAYOUT` | +RETAIL\_UNPAID\_WINNINGS, −SHOP\_CASH:paying shop |
| `RETAIL_UNCLAIMED` | +RETAIL\_UNPAID\_WINNINGS, −HOUSE\_UNCLAIMED\_WINNINGS (after `retail.claim_days`) |
| `SHOP_FLOAT_TOPUP` | +SHOP\_CASH:shop, −SHOP\_CASH:agent (or −HOUSE\_BANK) |
| `SHOP_SETTLEMENT` | +HOUSE\_BANK (or +SHOP\_CASH:agent), −SHOP\_CASH:shop |
| `COMMISSION_ACCRUAL` | +HOUSE\_COMMISSION\_COST, −AGENT\_COMMISSION\_PAYABLE:agent |
| `COMMISSION_NETTED` | +AGENT\_COMMISSION\_PAYABLE:agent, −SHOP\_CASH:agent (agent keeps it from collected cash) |

For a brand agent's shops the other side is always the brand's bank (§4.7): `SHOP_SETTLEMENT` is +HOUSE\_BANK, −SHOP\_CASH:shop and `SHOP_FLOAT_TOPUP` is +SHOP\_CASH:shop, −HOUSE\_BANK. `SHOP_CASH:agent` and the commission postings apply to partner agents, and to a brand agent only if the brand gives it a plan.

Invariants checked nightly: for each shop, the sum of `retail.cash_movement` over closed shifts equals the movement of `SHOP_CASH:shop` over the same period; and `RETAIL_UNPAID_WINNINGS` equals the sum of `payable_santim` over tickets in `won` or `void` status.

## 8. Printing and hardware

**Receipt content** (80 mm by default, 58 mm layout available): brand logo, shop code and name, date and time, ticket number with check character, a Code 128 barcode of ticket number + MAC, a QR code with the public ticket-check URL, each leg (match, market, pick, odds, kick-off), bet type, stake, stake tax, potential win, win-tax note, "claim before {date}", cashier name, a terms line, and a **COPY** banner on reprints.

**How it prints**:

| Stage | Method | Why |
| --- | --- | --- |
| Release 1 | The ticket response carries a receipt model. The Next.js POS renders it as an HTML receipt (80 mm or 58 mm) in a hidden iframe with print CSS (`@page { size: 80mm auto; margin: 0 }`), draws the barcode as SVG (JsBarcode) and the QR code (`qrcode`), and calls `print()`. Chrome runs with `--kiosk --kiosk-printing`, so the job goes straight to the default printer with no dialog. The server also renders a PDF (`GET /v1/retail/tickets/{ticket_no}/receipt.pdf`) for reprints from the back office. | Nothing to install on the shop PC beyond Chrome flags and the printer driver; works on Windows and Linux. Test it on the real printer model during the pilot. |
| P1 | A small local print bridge (a tray app listening on `localhost` over WebSocket; our own build or QZ Tray) that receives ESC/POS bytes from the POS. | Faster, sharper barcodes, opens the cash drawer, can pick between two printers, prints while the browser is busy. |

**Per-shop equipment** (bought by the operator or agent; the platform only needs a current Chrome):

| Item | Notes |
| --- | --- |
| Terminals: PCs or mini PCs with a monitor or touch screen | Chrome (Chromium on Linux) in kiosk mode, auto-start on boot, OS auto-login to a restricted user; no keyboard needed with touch screens |
| Cashier PC | Chrome kiosk with `--kiosk-printing`; wired network where possible |
| 80 mm thermal receipt printer | Any model with a Windows or CUPS driver; USB or Ethernet |
| USB barcode scanner (1D/2D) | HID keyboard mode with Enter suffix; 2D if QR payouts are wanted |
| Cash drawer | Opened by the printer (P1 print bridge) or manually |
| Internet | 4G router with a backup SIM; the POS shows an offline banner and blocks sales when the API is unreachable |

## 9. API

All endpoints follow TD-01 (versioning, RFC 7807 errors, idempotency keys, cursor pagination, money as decimal strings). C01 gains three principal types: `terminal`, `retail_staff` (cashier or shop manager) and `agent`. Each has its own token audience, so a terminal token can never call cashier endpoints. POS devices are activated like terminals: `POST /v1/retail/pos-devices/activate`.

The exact request and response shapes, error codes and mock data are in `contracts/openapi.yaml` (tags *Retail - terminal*, *Retail - cashier*, *Agent portal*, *Admin - retail*). The examples below are abridged; where they differ from the file, the file wins.

### 9.1 Terminal

```json
// POST /v1/retail/terminals/activate            (no auth; 5 attempts per IP per hour)
{ "activation_code": "K7Q2M9XP", "device_public_key": "MFkwEwYHKoZIzj0CAQ…", "app_version": "1.4.0" }
// 200
{ "terminal_id": "0192f3a4-…", "shop": { "code": "ADM-004", "name": "Adama Kebele 04" },
  "access_token": "…", "expires_in": 7776000, "rule_set": "retail" }

// POST /v1/retail/slip-codes                    (terminal token; 30 per terminal per 10 min)
{ "bet_type": "multiple", "legs": [{ "outcome_id": "oc_01" }, { "outcome_id": "oc_77" }], "stake_hint": "50.00" }
// 201
{ "code": "48291735", "display": "4829 1735", "expires_at": "2026-10-04T13:55:00Z",
  "qr": "https://example.et/r/48291735" }
```

Terminals read the catalogue through the same public endpoints as the player web (C06) with the terminal token attached, so the shop's retail margin and market set apply.

### 9.2 Cashier POS

```json
// POST /v1/retail/auth/login                    (request signed with the POS device key)
{ "username": "abebe.k", "pin": "482913" }
// 200
{ "access_token": "…", "staff": { "id": "…", "role": "cashier", "shop_code": "ADM-004" }, "open_shift": null }

// POST /v1/retail/shifts
{ "opening_cash": "1500.00" }
// 201
{ "id": "…", "opened_at": "2026-10-04T07:02:11Z" }

// GET /v1/retail/slip-codes/48291735
{ "code": "48291735", "stake_hint": "50.00", "consumed": false,
  "legs": [ { "outcome_id": "oc_01", "fixture_name": "Arsenal v Chelsea", "market_name": "1X2", "outcome_name": "1",
              "odds": "1.85", "odds_at_code": "1.80", "changed": "up", "available": true },
            { "outcome_id": "oc_77", "available": false, "reason": "EVENT_STARTED" } ] }

// POST /v1/retail/tickets                       (Idempotency-Key header required)
{ "slip_code": "48291735", "bet_type": "single", "legs": [{ "outcome_id": "oc_01", "odds": "1.85" }],
  "stake": "50.00", "age_confirmed": true }
// 201
{ "ticket_no": "R7K2-M9XP-4", "bet_id": "…", "status": "open", "stake": "50.00", "stake_tax": "7.50",
  "potential_win": "78.62",
  "receipt": { "ticket_no": "R7K2-M9XP-4", "barcode": "R7K2M9XP4.3F9A0C21B7", "shop": { "code": "ADM-004", "name": "Adama Kebele 04" },
               "legs": [ … ], "stake": "50.00", "potential_win": "78.62", "copy": false, … },
  "receipt_pdf": "/v1/retail/tickets/R7K2-M9XP-4/receipt.pdf",
  "shift_expected_cash": "1550.00" }

// GET /v1/retail/tickets/R7K2-M9XP-4?mac=3F9A0C21B7          (barcode scan)
{ "ticket_no": "R7K2-M9XP-4", "status": "won", "payable": "78.62", "sold_at_shop": "ADM-004",
  "can_pay_here": true, "requires_id": false, "requires_approval": false, "claim_expires_at": "2026-11-03T16:02:00Z" }

// POST /v1/retail/tickets/R7K2-M9XP-4/payout   (Idempotency-Key header required)
{ "mac": "3F9A0C21B7", "id_type": null, "id_number": null }
// 200
{ "status": "paid", "paid": "78.62", "shift_expected_cash": "1471.38" }
// 409 application/problem+json
{ "type": "https://api.example.et/errors/ticket-already-paid", "title": "Ticket already paid", "status": 409, "code": "RETAIL_TICKET_ALREADY_PAID",
  "detail": "Paid at ADM-004 on 2026-10-04 14:05 by abebe.k" }

// POST /v1/retail/tickets/R7K2-M9XP-4/cancel   → 200 | 422 RETAIL_CANCEL_WINDOW_CLOSED
// POST /v1/retail/shifts/{id}/cash-movements
{ "kind": "cash_out", "amount": "5000.00", "reason": "Handed to agent" }
// POST /v1/retail/shifts/{id}/close          (example: a full day's shift, not the one above)
{ "denominations": { "200": 12, "100": 30, "50": 4 } }
// 200
{ "expected": "5600.00", "counted": "5600.00", "variance": "0.00", "z_report_pdf": "…" }
```

### 9.3 Agent portal and admin

```json
// GET /v1/agent/shops?cursor=                   → the caller's own shops with today's figures
{ "items": [ { "shop_code": "ADM-004", "status": "active",
  "today": { "turnover": "48250.00", "payouts": "31100.00", "cancels": "150.00",
             "cash_held": "17000.00", "open_shifts": 1 } } ], "next_cursor": null }

// POST /v1/agent/settlements
{ "shop_code": "ADM-004", "direction": "collect", "amount": "15000.00", "method": "cash" }

// GET /v1/agent/statements?period=2026-W40     → commission statements with PDF and CSV links

// Admin (back office, C15):
//   /v1/admin/retail/agents, /shops, /terminals, /staff, /pos-devices, /commission-plans
//   POST /v1/admin/retail/agents  { "kind": "brand" | "partner", "name": "Demo Bet Direct", "phone": "+251911…" }
//        a non-null parent_id → 422 VALIDATION_FAILED, errors[] naming parent_id; level is always "agent"
//   POST /v1/admin/retail/shops   { "agent_id": "…", "code": "ADM-008", … }   agent_id required (no shop without an agent)
//   (kind and the required agent_id wait for the contract change in platform-retail-hierarchy §3.4)
//   POST /v1/admin/retail/payout-approvals/{id}/decision  { "decision": "approve" | "reject", "note": "…" }
//   /v1/admin/retail/tickets?shop=&status=&from=&to=
```

## 10. Events

| Subject | Producer | Consumers | Purpose |
| --- | --- | --- | --- |
| `retail.ticket_sold` | C19 | C13 (regulator, with shop and terminal), C12 (velocity per shop), C15 (dashboards) | Every sale |
| `retail.ticket_paid` | C19 | C13, C12 (large-payout AML), C15 | Payout with shop and cashier |
| `retail.ticket_cancelled` | C19 | C13, C12 (cancel-rate monitoring) | Cancellation |
| `retail.shift_closed` | C19 | C15, C14 (variance alert to the agent) | Z report |
| `retail.shop_settled` | C19 | C13, C15 | Cash moved up the hierarchy |
| `bet.settled` (existing) | C10 | C19 | Moves retail tickets to won, lost or void and posts `RETAIL_*` entries instead of wallet entries |

## 11. Configuration

| Key | Default | Meaning |
| --- | --- | --- |
| `retail.enabled` | true | Tenant switch |
| `retail.code.ttl_minutes` | 240 | Slip-code life, capped at the first kick-off |
| `retail.min_stake` / `retail.max_stake` | 10.00 / 50,000.00 | Per ticket; a shop can only lower the maximum |
| `retail.cancel.window_seconds` | 300 | Cashier cancel window |
| `retail.payout.where` | `same_agent` | `issuing_shop`, `same_agent` (any shop of the selling shop's agent, a brand agent's included; §4.4) or `any_shop` (any shop of the brand) |
| `retail.payout.id_required_over` | 10,000.00 | ID capture threshold |
| `retail.payout.approval_over` | 100,000.00 | Head-office approval threshold |
| `retail.claim_days` | 30 | Days to claim a winning ticket |
| `retail.shift.variance_alert` | 100.00 | Z-report variance that alerts the agent |
| `retail.terminal.idle_reset_seconds` | 90 | Terminal screen reset |
| `retail.age_confirmation` | true | Cashier ticks 21+ on each sale |
| `retail.sales_hours` | shop opening hours | Sales blocked outside them |

All amounts and periods are placeholders to set once the directive is published.

## 12. Security and fraud controls

| Threat | Control |
| --- | --- |
| Stolen or cloned terminal token | Token bound to the device key (every request signed); optional shop IP range; instant revoke; terminals cannot move money |
| Cashier logs in from home | Staff login only from an activated POS device of that shop; PIN plus device; lockout after 5 failed PINs |
| Forged or photocopied ticket | The barcode carries an HMAC of the ticket number; payout checks the server record, never the paper; paying is atomic (`select … for update`, status change and posting in one transaction) |
| Selling after kick-off | Server time only; placement rejects legs whose start time has passed, whatever the POS shows |
| Cancelling losing tickets after an early goal | Short window, before the first kick-off only, per-cashier limits, cancel-rate alerts |
| Paying a non-winning ticket to a friend | Payout only when the server status is `won` or `void`; every payout audited with shift and cashier |
| Drawer shortfalls | Denomination count at close, variance alerts, two-sided settlement confirmation |
| Scraping odds through terminals | Terminal rate limits; terminals get no data beyond the public catalogue |
| Robbery exposure | `max_cash_held` forces regular settlement |

## 13. Offline behaviour

Release 1 sells **online only**. If the API cannot be reached, the POS shows a red banner, disables Sell, Pay and Cancel, and queues nothing. Offline selling would mean tickets the server has not priced or limited, and payouts that could be doubled across shops; it is a P2 item that needs signed offline tickets and pre-authorised per-shop limits.

## 14. Edge cases

- **Odds changed between code and sale**: the POS shows old and new odds; the cashier reads them to the customer and confirms. Placement uses the new price.
- **Leg started between code and sale**: removed; if nothing is left, the code is unusable.
- **Same slip code sold twice**: the second sale is refused (`409 RETAIL_SLIP_CODE_CONSUMED`) and shows the first ticket number.
- **Network drop after Sell**: the POS retries with the same idempotency key and the server returns the original ticket, so nothing is sold twice. If the cashier gives up, the next login shows an "unprinted ticket" to reprint.
- **Printer jam or out of paper**: reprint from the shift's ticket list; the copy is marked COPY.
- **Ticket resettled after payout** (feed correction, C10): the difference is posted to the paying shop as an adjustment and appears on the agent's statement; the customer is not chased.
- **Void legs**: that leg's odds become 1.00 (C07 rules); a fully void ticket is refunded at the counter.
- **Shop closed or suspended**: terminals show "closed" and the POS sells nothing; its tickets can be paid elsewhere if `payout.where` allows.
- **Unclaimed winnings**: after `claim_days`, the nightly job moves the ticket to `expired` and posts `RETAIL_UNCLAIMED`.

## 15. Tests

- Golden tests: receipt totals equal the C07 golden CSV for the same slips.
- Concurrency: 50 parallel payout requests for one ticket → exactly one paid, 49 × 409.
- Ledger: the section 7 invariants on a generated day of 10,000 sales, payouts, cancels and settlements.
- Rules: cancel-window boundaries, payout location rules (the §4.4 example with a brand agent and a partner agent), ID and approval thresholds, sales hours, the shop cash limit.
- Hierarchy: a shop without an agent and an agent with a `parent_id` are refused (`422 VALIDATION_FAILED`); a brand agent's settlement posts to `HOUSE_BANK`; an agent without a plan gets no commission accrual.
- Security: terminal token calling cashier endpoints → 403; staff login from an unknown device → 403; tampered barcode MAC → 404.
- End to end (Playwright against the Next.js terminal and POS apps): terminal code → POS sale → printed receipt → settle → scan → pay → Z report balances.
- Installation checklist per shop: kiosk boot, silent print, scanner input, reprint, offline banner.

## 16. Build order

| Step | Content | Release |
| --- | --- | --- |
| 1 | Hierarchy tables (agents with `kind`, every shop under an agent, one level), admin CRUD, terminal activation, staff and POS-device login | R1 |
| 2 | Slip codes from terminals, ticket sale, HTML receipt printed with Chrome kiosk printing, scan and payout | R1 |
| 3 | Cancel rules, shifts, cash movements, Z report | R1 |
| 4 | Shop cash position, settlements, agent portal read views | R1 |
| 5 | Commission plans and weekly statements | R1 (P1 if time is short) |
| 6 | Local print bridge (ESC/POS, cash drawer), SMS ticket check, agent-assisted online deposits | P1 |
| 7 | Offline-tolerant POS, cash-accepting terminals | P2 |
