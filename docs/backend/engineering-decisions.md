# Engineering Decisions

Decisions taken on 30 Sep 2026 after an independent readiness review, so nobody has to stop mid-build to decide them. **Where a component page says something different, this tab wins** until that page is updated. Executable versions live in `contracts/` (the API contract and `contracts/golden/`).

## D1. Slip calculator rules (C07)

The executable definition is `contracts/golden/reference_slipcalc.py`; `contracts/golden/slips.csv` (366 rows) is the test every calculator must pass. A TypeScript port (`golden/ts/slipcalc.ts`) already passes all rows.

1. **Exact arithmetic everywhere.** Money in integer santim; odds parsed exactly (max 3 decimals); products as exact fractions (Python `Fraction`, TypeScript and Dart `BigInt` rationals). No floats and no decimal contexts with limited precision; results are only rounded where a step says so.
2. **Lines.** Single: one line per leg. Multiple: one line with all legs (needs at least 2). System: all combinations for each size in `system_sizes` (distinct, ascending, 1..n, not just \[n\]). More than `max_lines` (1,024) → `BET_TOO_MANY_LINES`; more than `max_legs` → `BET_TOO_MANY_LEGS`.
3. **Stake per line.** `stake_line = floor(stake / lines)` unless the stake is per line; `total_stake = stake_line × lines`. A remainder is not charged (warning `STAKE_REMAINDER_NOT_CHARGED`). `min_stake`/`max_stake` apply to the total; a line stake under 0.01 → `BET_STAKE_TOO_LOW`.
4. **Stake tax per line.** `tax_line = floor(stake_line × rate)`; `net_line = stake_line − tax_line`; `stake_tax = tax_line × lines`; `net_stake = net_line × lines`. Every santim paid is either tax or stake at risk.
5. **Gross.** For each line, `floor(net_line × product of effective odds)`, summed. Effective odds: open (preview) and win = odds; lose = 0; void = 1; half\_win = (odds + 1) / 2; half\_lose = 1/2.
6. **Accumulator bonus.** Multiples only, and only when every non-void leg is a win (open counts as win in a preview; any half result pays no bonus). Qualifying legs: odds ≥ `acca_bonus_min_leg_odds` (1.30) and not void. Percentage: highest tier whose `min_legs` ≤ qualifying legs (past the last tier, the last tier; below the first, none). `bonus = floor((gross − net_stake) × pct / 100)` when positive, capped at `acca_bonus_max` (warning `ACCA_BONUS_CAPPED`). A void leg can drop the bonus to a lower tier at settlement.
7. **Payout cap before tax.** If `gross + bonus > max_payout`, cut the bonus first, then gross, so gross + bonus = max\_payout (warning `MAX_PAYOUT_REACHED`, `capped = true`). Taxes are then computed on the capped amount. This replaces C07's “cap after taxes”: a player never sees a tax computed on money they are not paid. Placement accepts capped bets; `BET_MAX_PAYOUT` is not used in Release 1.
8. **Payout taxes.** Bases: `stake` = total stake; `gross_win` = gross + bonus; `net_win` = gross + bonus − net stake; `profit` = gross + bonus − total stake. A tax applies when base > threshold (strictly) and base > 0, on the **whole** base, rounded down, once per ticket. `deduct_from: payout` taxes reduce the payout; `operator` taxes are reported but not deducted.
9. **All-void refund.** When every leg is void, the payout is the net stake; with `refund_stake_tax_on_void` the stake tax is also refunded (`stake_tax_refund`). This flag is added to the rule set.
10. **Preview vs settlement.** Preview treats open legs as wins and uses real results for settled legs. Settlement with any open leg is an error.
11. **Total odds** are display only: product of the odds floored to 2 decimals, single-line bets only.
12. **Rule-set shape.** The C16 `betting` section is stored in exactly the contract's `RuleSet` shape (money as decimal strings, `acca_bonus_table` as `{min_legs, pct}` with pct in percent). `rules_version` = the tenant config version that was active. Retail uses its own `retail_betting` rule set.

## D2. Ledger (C03)

- **Sign convention.** Entries: + debit, − credit (as in C03). Cached `balance_santim` is stored in the account's normal orientation (a player's cash balance is a positive number).
- **Stake tax posting (tax taken from the stake).** `BET_STAKE` for 100.00 at 15%: +PLAYER\_CASH 10000, −HOUSE\_OPEN\_STAKES 8500, −TAX\_PAYABLE\_STAKE 1500. `HOUSE_OPEN_STAKES` holds net stakes; TD-91 invariant 5 uses net stakes. `BET_VOID` returns 8500 from HOUSE\_OPEN\_STAKES, plus 1500 from TAX\_PAYABLE\_STAKE when the tax is refunded.
- **Accounts.** `owner_type` in ('player','tenant','provider','shop','agent'). The suffix is part of the code (`PROVIDER_CLEARING:telebirr`, `SHOP_CASH:ADM-004`). Uniqueness: `unique nulls not distinct (tenant_id, code, owner_id, currency)` (PostgreSQL 16).
- **Reference types** add `retail_ticket`, `cash_movement`, `retail_settlement`, `commission_statement`.
- **Hot house accounts** (e.g. HOUSE\_OPEN\_STAKES) are not locked per posting: their `balance_after` is null and the cached balance is rolled up every minute; they are excluded from the “cached = sum of entries” check between roll-ups.
- **Idempotency.** Key format `{reference_type}:{reference_id}:{txn_type}[:v{n}]`. Insert first; on a unique-key violation re-read and compare a hash of the lines: same → return the original, different → `IDEMPOTENCY_MISMATCH`.

## D3. Tenancy, security, IDs

- **Tenant resolution.** `X-Tenant-Id` carries the tenant **code** (e.g. `demo`). The Next.js server always sends it, from `TENANT_HOST_MAP` (host → code). The API matches `tenant_domain.host` ignoring the port; a host and header that disagree → 400. `DEV_DEFAULT_TENANT` is honoured only when `ENV=local`.
- **Row-level security.** On (with `FORCE`) for every tenant-scoped table. No RLS on: `tenancy.*`, `platform.*` (D10), `feed.*`, the global `catalogue.*` tables, and `settlement.outcome_result`. Policies use `current_setting('app.tenant_id', true)`. Database roles: `migrator` (owns schemas), `app` (API and worker), `feed` (writes `feed` and `catalogue`). The schema is called `catalogue` (never `catalog`).
- **Outbox.** One `shared.outbox` table (tenant RLS) written in the same transaction as the change; the worker relays it to NATS. `reporting.outbox_event` is the regulator reporter's own queue, fed from NATS.
- **IDs.** API IDs are opaque strings; clients never parse them. Entities use UUIDv7 (`uuid-utils` on Python 3.12); catalogue IDs carry a prefix (`fx_`, `mk_`, `oc_`, `t_`, `s_`, `m_`, `o_`). The ULID-looking IDs in contract examples are illustrative.
- **Ticket numbers.** 8 random Crockford base32 characters (40 bits from a secure RNG) + 1 check character using Luhn mod 32 over the Crockford alphabet, shown as `XXXX-XXXX-C`. Retail tickets start with `R`. Examples: `K7Q2-M9XP-M`, `R7K2-M9XP-K`. Older examples in component pages (`…-4`) predate this rule.
- **Tokens.** EdDSA (Ed25519) JWTs with `kid`; claims `sub`, `tid` (tenant), `aud` (`player`, `staff`, `terminal`, `retail_staff`, `agent`), `sid` (session). Platform staff tokens are a separate shape: `aud = platform` and no `tid` (D10, built in B16); every brand route refuses them. Keys generated locally by `make keys`. The cashier principal is `retail_staff` (bearer token held by the POS app's Next.js server), not the back-office `staff`.
- **Device signatures.** Terminal and POS requests carry `X-Device-Id`, `X-Device-Timestamp` (±30 s) and `X-Device-Signature` (ECDSA P-256 over method, path, timestamp and body SHA-256). POS devices are activated like terminals (`POST /v1/retail/pos-devices/activate`).
- **Runtimes.** Python 3.12, Node 22 LTS, PostgreSQL 16, Redis 7, NATS 2.10.

## D4. Schema corrections that supersede component DDL

- **`betting.bet` (C08):** `player_id` nullable; `channel text not null default 'online' check (channel in ('online','retail'))`; `client text check (client in ('app','web','telegram','sms','pos'))`; `shop_id uuid`; check `(channel='online' and player_id is not null) or (channel='retail' and shop_id is not null)`; idempotency unique on `(tenant_id, coalesce(player_id, shop_id), idempotency_key)`.
- **`booking.booking` (C09):** surrogate `id uuid` primary key; add `channel`, `shop_id`, `terminal_id`, `consumed_by_bet_id`; `unique (tenant_id, code) where expires_at > now()` is not allowed in PostgreSQL, so use a unique index on `(tenant_id, code)` plus a nightly sweeper that deletes expired rows before codes are reused.
- **Agent credentials:** `identity.agent_credential (agent_id pk, tenant_id, phone_e164 unique per tenant, password_hash, failed_attempts, locked_until)`; sessions in `identity.session` with `principal_type`.
- **Retail events:** C12 consumes `retail.ticket_sold` (velocity per shop), `retail.ticket_paid` (rule `RETAIL_LARGE_PAYOUT`), `retail.ticket_cancelled` (rule `RETAIL_CANCEL_RATE`); C14 consumes `retail.shift_closed` (template `SHIFT_VARIANCE` to the agent by SMS). C19 §10 is the authoritative consumer list.

## D5. Catalogue and the fake feed (C05, C06)

- **Margin.** `new = 1 / (1/raw + m/n)` with `m = margin_pct / 100` and `n` = active outcomes in the market; the most specific `tenant_margin_rule` wins (market\_template > tournament > sport > global); always floor to 2 decimals. If the result is below `min_odds`, the outcome is suspended (never clamped up). Margins are applied only in C06, at read time.
- **Fake feed.** An adapter in the feed service (`provider='fake'`, URNs `fake:match:N`) that goes through the normal pipeline (raw message → id mapping → catalogue → Redis → events). Seeds the contract's fixtures plus 3 generated leagues of 10 fixtures over 14 days, with the six contract market templates. Every 5 s it moves each active price by ±0–3% keeping the market overround ≥ 1.05 and odds within 1.01–100; suspends at kick-off; publishes a scripted result 2 hours after kick-off; rolls back 1 settlement in 50.
- **Redis.** Price keys as TD-02 (`odds:{outcome_id}` etc.); cache-invalidation tag sets are `tag:fx:{id}` (no clash with `fx:{id}`). Cache key hash = tenant + language + path + sorted query; responses send `Vary: Accept-Language, X-Tenant-Id`.
- **Dictionary.** One version per tenant covering all languages; rebuilt every 5 minutes and on `config.changed`; the version is bumped only when the content hash changes.
- **Lists.** Cursor = base64url JSON of the keyset `{start_time, id}`. `sort=popularity` = featured order then start time. `markets_count` counts active and suspended markets. Search: at least 2 characters, case-insensitive match on translated tournament and team names, 20 results.
- **Name templates.** `{key}`, `{+key}` (with sign) and `{-key}` (sign flipped, for the away side of handicaps).
- **Caching layers.** Edge cache 10 s (CAT-07); Next.js ISR revalidates every 15 s; visible lists refresh odds from the client every 30 s. Prices can therefore be up to \~30 s old on screen; placement always re-prices.

## D6. Local stack

- **Docker Compose:** PostgreSQL 16 with pg\_partman, PgBouncer (transaction mode; asyncpg with `statement_cache_size=0`), Redis 7, NATS 2.10 with JetStream, Prism (port 4010).
- **Partitions:** migrations create a DEFAULT partition plus 12 monthly partitions for partitioned tables; pg\_partman takes over after that.
- **NATS:** one stream `EVENTS` with subjects `evt.<type>` (e.g. `evt.bet.placed`).
- **Seed:** idempotent `python -m apps.seed` (not Alembic): tenant `demo`, config version 1 activated directly by a system user, a local-only licence valid until 2099 so `real_money_enabled` is true locally, one partner agent with one shop `ADM-004` (every shop has an agent, D10), one terminal and one POS device with printed activation codes, test players.
- **`.env.example`:** `ENV`, `DATABASE_URL`, `REDIS_URL`, `NATS_URL`, `DEV_DEFAULT_TENANT`, `JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEYS_PATH`, `FEED_PROVIDER=fake`, `SMS_PROVIDER=console`, `PAYMENT_PROVIDERS=mock`, `KYC_PROVIDER=fake`, `REGULATOR_SINK=file`; web: `API_BASE_URL`, `API_REAL_URL`, `API_REAL_TAGS`, `TENANT_HOST_MAP`, `SESSION_SECRET`.

## D7. Frontend conventions

- **Mock-to-real switch.** `packages/api` routes each call by its OpenAPI tag: tags listed in `API_REAL_TAGS` (e.g. `Catalogue,Config`) go to `API_REAL_URL`, the rest to Prism. Screens move to the real API one tag at a time.
- **Theme tokens.** `brand.colors` must provide `primary`, `primary_contrast`, `accent`, `background`, `surface`, `text`, `text_muted`, `border`, `odds_up`, `odds_down`, `danger`, `success`; the UI has defaults for any missing key.
- **Type and formats.** Noto Sans Ethiopic (subset, WOFF2) with the Latin UI font. Money: “1,250.00 ብር” in Amharic, “ETB 1,250.00” in English. Dates: Gregorian calendar and 24-hour East Africa Time in Release 1 (Ethiopian calendar is a later option). Quick stakes set the **total** stake.
- **Deep links.** One path set for web and app: `/match/{id}`, `/b/{code}`, `/t/{ticket}`.

## D8. Scope clarifications

- Live betting is not in Release 1: PRD goal G4 is read as “pre-match peak load”, and journey J2 (live bet) is a later-release journey. TD-91 tests journeys J1, J3, J4 and J5.
- Release 2 virtual games are **online only**. Selling virtuals in shops needs a cashier sales path for game rounds and is deferred.
- The PRD's phase gates map to the Build Plan milestones: Gate A = M1 (ledger and feed proven), Gate B = M2–M3 (beta with test money, shops included), Gate C = licence + regulator certification before public launch.
- Telegram Mini App is P1, not a launch channel.

## D9. Questions for finance and the regulator

| Question | Current placeholder | Why it matters |
| --- | --- | --- |
| Is win tax charged on the whole win once it exceeds the threshold, or only on the part above it? | Whole win (D1.8) | With whole-win taxation a 1,000.02 win pays 850.02 while a 1,000.00 win pays 1,000.00 (see golden rows `WIN_TAX_GROSS_*`) |
| Does the maximum payout apply before or after tax? | Before tax (D1.7) | Changes the net amount printed on big-win tickets |
| Is stake tax taken from the stake or charged on top? | From the stake, 15% | Changes every potential-win figure |
| Are voided bets' stake taxes refunded? | No (`refund_stake_tax_on_void: false`) | All-void refunds |
| Retail claim period and treatment of unclaimed winnings | 30 days; liability | Retail ledger and reporting |
| Does a `gross_win` win tax apply to the refund of an all-void bet? | Yes: the reference applies payout taxes to every payout, so under `default_2026_10` an all-void 5,000.00 bet pays 637.50 WIN\_TAX and returns 3,612.50 (D1.9 reads “the payout is the net stake”) | Fully void tickets above the threshold return less than the net stake, and C03's `BET_VOID` posting has no win-tax leg: until this is answered, settlement (B7) must post the quote's win tax rather than the void template. Changing it is a reference and golden change (B3 plan, decision 4) |
| How does a dead heat pay (a `dead_heat_factor` below 1)? | Not settled: settlement records the result and leaves the legs open (a bet settled on an earlier result of that outcome re-opens) for a trader (B7a plan, decision 4); the fake feed always sends 1 | C10 §8 says C07 applies the factor to the stake portion, but D1 has no rule for it, and a factor such as 1/3 can't be stored exactly in `numeric(5,4)` (B4a review M3) |
| May a stake tax have a threshold, or may two stake taxes apply? | Allowed by the rule-set shape; unused (every rule set has one STAKE\_TAX at 0.00) | Either makes the potential win fall as the stake rises: with a 1,000.00 threshold, 1,000.00 at 2.00 pays 2,000.00 but 1,000.01 pays 1,700.02. If not, C16 validation can reject both (B3 plan, decision 5) |

## D10. Platform layer and retail hierarchy (5 Oct 2026)

From the product owner's `design/platform-retail-hierarchy.md` (the reasoning, the examples and the open questions live there). Component pages C01, C13, C15, C16, C18 and C19 carry the details.

**Decided by the product owner**

- **Four levels: Platform → Brand → Agent → Shop.** A brand is a tenant. The Platform is the company that runs the system; its staff work in a separate **platform console**, never in a brand's back office.
- **Every shop has an agent.** `retail.shop.agent_id` is `not null`. The shops a brand runs itself sit under a **brand agent** (`retail.agent.kind = 'brand'`); agents that run shops for the brand are `kind = 'partner'` (the default).
- **One agent level.** No master agents in Phase 1: `retail.agent.parent_id` is always null and the API refuses one (`422 VALIDATION_FAILED`, `errors[]` naming `parent_id`); `level` is always `agent`; `path` is one level deep. The columns and contract fields stay so master agents can come later without a breaking change.
- **Retail money for a brand agent.** Its shops settle straight to the brand's bank (`SHOP_SETTLEMENT`: +HOUSE\_BANK, −SHOP\_CASH:shop); there is no agent-to-brand step. A partner agent settles as before. Commission accrues only for an agent or shop with a plan; a brand agent normally has none.
- **Payout location.** `same_agent` groups shops by agent, so a brand agent's shops are one group.
- **Platform staff** are a new principal: audience `platform`, no `tid`, password + TOTP, not tenant-scoped, every action audited with the brand it touched. A platform token is refused by every brand endpoint and a brand token by every platform endpoint.
- **The Platform's charge to a brand is never a posting in the brand's ledger.**

**Decided here (backend placement; B16's plan may refine the details, not the boundaries)**

- **Module `platform`**, schema `platform`, global like `tenancy` (no `tenant_id` on its own rows, no RLS): platform staff, their sessions and the platform audit log. It changes a brand only through other modules' interfaces: `tenancy` (tenant, domains, first config version, flags, status) and `backoffice` (default roles and the first brand admin, invited by email through a new C14 email sender with a console mock); the brand's house ledger accounts open on first use (C03). It reads a brand's figures one brand at a time inside that brand's `tenant_session()`, so RLS stays the only gate on brand data; there is no cross-tenant query.
- **Routes** `/v1/platform/*` (contract tag `Platform`) are not tenant-scoped: the tenant middleware skips them (like `/healthz`), and a brand is named in the path (`/v1/platform/brands/{code}`). The console is served at `console.{platform domain}`, a deployment setting, not a `tenancy.tenant_domain` row.
- **Who writes `tenancy.*`.** `tenant`, `tenant_domain` and `feature_flag` only on a platform-console request; configuration version 1 of a new brand is created and activated by the console from a template; later versions are drafted and activated by the brand (C16, B10). The grants `app` needs for that come with B16's migration.
- **Platform statement (only if Q1 is B, C or D):** `reporting.platform_statement`, one tenant-scoped row per brand and month, built from C13's daily summaries (GGR, turnover) and C19's outlet counts. Task B17, blocked until Q1 is answered.

**Contract.** `Agent.kind`, `Shop.agent_id` (required, or nullable and refused: chosen in the change itself) and the `Platform` tag need `/contract-change`. Until it lands the contract, which wins, still shows a nullable `agent_id`, no `kind` and no `Platform` tag. The retail part is B9's first step, the `Platform` tag B16's.

**Open questions and the placeholder each one uses until answered** (questions in `design/platform-retail-hierarchy.md` §7)

| # | Question | Placeholder | What changes if the answer differs |
| --- | --- | --- | --- |
| Q1 | How does a brand pay the Platform? | Nothing built: B17 stays blocked; C13 daily summaries already hold each brand's GGR and turnover | B, C or D unblocks B17; A needs nothing in the system |
| Q2 | One brand agent or several; can it earn commission? | Several allowed; commission only if the brand sets a plan | One per brand → a unique index on `(tenant_id) where kind = 'brand'` |
| Q3 | Shop manager: a cashier role or the agent's power? | Cashier role (`retail.staff.role = 'shop_manager'`), C19 unchanged | Moving it to the agent changes RET-10, C19 §3 and §4.5, and the agent-portal contract |
| Q4 | Can platform staff see inside a brand? | No. The console shows status, configuration and aggregates (counts, turnover, GGR) only; no grant mechanism is built | A brand-granted, time-limited, audited access would be a new feature (C15 grant, C16 check, both audit logs) |
| Q5 | Several brands live at launch? | The console is Release 1 scope (create, run, watch); the PRD still launches one consumer brand | More brands at launch raise the console's priority and the onboarding target (G8) |
| Q6 | Who answers to the regulator? | Each brand for itself (C13 per tenant, unchanged) | Platform-level reporting would be a second reporter feed |
| Q7 | Who logs in to the agent portal for a brand agent? | The brand may give its brand agent an agent-portal login like any agent (one `identity.agent_credential` per agent, D4); none is required, since the back office's retail screens cover the brand's own shops | Back office only → brand agents get no `identity.agent_credential` |
| Q8 | Do withdrawals stay open while a brand is suspended, and may its shops still pay tickets already sold? | C16 §7 as written: a suspended brand's real money is off, withdrawals included; §7 does not mention retail payouts, so B9 must ask before deciding | Splitting the switch (deposits and bets off, withdrawals and payouts on) changes CFG-04 and C16 §7 |
