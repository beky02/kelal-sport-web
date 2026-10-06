# Build Plan

What to build next, in order, on the frontend and the backend. Written 30 Sep 2026, after the API contract (`contracts/openapi.yaml`) was finished.

**Rule of thumb.** Everything that talks to an outside company sits behind an adapter with a mock implementation. We build the parts that need nobody first, run them against the mocks, and swap in the real providers as accounts and licences arrive. The frontend builds against a Prism mock of the contract until the matching backend piece is ready, then switches that screen to the real API.

## 1. What needs a third party, and how we mock it

| Component | Third party | Mock we build now | Swap to real when |
| --- | --- | --- | --- |
| C01 OTP by SMS | AfroMessage / SMSEthiopia | `ConsoleSmsProvider`: writes the code to the log; in dev every OTP is `000000` | SMS sender ID and account approved |
| C14 Email (brand admin invitations, B16) | An email service (not chosen) | Console provider: writes the message to the log | Before the first real brand is created |
| C02 KYC | Fayda eKYC | `FakeFayda`: FIN ending in 0 = verified, 1 = needs\_info (name mismatch), 2 = provider down | Partner access to Fayda |
| C04 Payments | telebirr, CBE Birr, Chapa, M-Pesa | `MockPaymentProvider` with a dev page `/dev/pay/{id}` that approves, fails or times out a payment; Chapa sandbox as the first real adapter | Merchant accounts (after the licence application) |
| C05 Odds feed | Sportradar / LSports / OddsMatrix | `FakeFeed`: loads fixtures from JSON (the contract's fixtures plus generated leagues), moves odds on a random walk every few seconds, suspends markets at kick-off, publishes scripted results and the occasional rollback | Feed trial (OddsMatrix offers one month) |
| C13 Regulator reporting | Ethiopian Lottery Service interface | `FileSink`: writes each reportable event as a JSON line and records it as acknowledged | The directive publishes the interface (TBD-2) |
| C14 Push | Firebase Cloud Messaging | Log only | Any time (FCM is free) |
| C17 Virtual games | Kiron / GoldenRace | Not started | Release 2 |
| C19 Printing and scanning | Shop hardware | Browser print dialog; typing ticket numbers | Pilot shop with an 80 mm printer and scanner |

**Needs nobody:** C03 wallet and ledger, C06 catalogue (fed by the fake feed), C07 slip calculator, C08 bet placement, C09 booking codes, C10 settlement (from fake-feed results), C11 bonuses, C12 responsible gambling, C15 back office, C16 configuration, C19 retail network.

## 2. Frontend track (Next.js)

| Step | Build | Done when |
| --- | --- | --- |
| F0 | Wire to the contract: add `contracts/` to the repo, generate types with `openapi-typescript`, build `packages/api` on `openapi-fetch`, run Prism, set `API_BASE_URL=http://localhost:4010` | The home page renders the three mock matches from Prism |
| F1 | Design system and shell: tokens as CSS variables from `/v1/config/public` colours, the three responsive layouts, Ethiopic font, and the odds button in all its states (normal, selected, suspended, price up, price down) | One page shows every component in every state, in Amharic and English |
| F2 | Catalogue: home (popular and today), sport and league lists, match detail with market groups, search; dictionary loading and name templates (`Total {total}` → `Total 2.5`) | Every catalogue screen works against Prism, including a suspended market |
| F3 | Bet slip and the TypeScript slip calculator: singles, accumulators, system bets, quick stakes, totals from the rule set; booking codes (create and `/b/[code]`) | The calculator passes the golden CSV from B3, including the C07 worked example (net payout 690.29) |
| F4 | Auth through Next.js route handlers and the session cookie: register with OTP, login (with new-device OTP), reset, logout | Full flow against Prism, including `AUTH_OTP_INVALID` and `REG_PHONE_TAKEN` via `Prefer` headers |
| F5 | Place bet and My bets: idempotency key, odds-changed dialog on 409, ticket detail, public ticket check `/t/[ticket]` | The 409 flow works with `Prefer: code=409` |
| F6 | Wallet: balances, deposit with `next_action` (redirect, USSD push with polling), withdrawal, payout accounts, history | Deposit and withdrawal screens handle every status in the contract |
| F7 | Account, limits, self-exclusion, promotions, inbox | Screens done against Prism |
| F8 | Shop terminal app: activation, kiosk layout, slip → code screen, idle reset | Code screen shows `4829 1735` with QR, then resets |
| F9 | Cashier POS app: login, open shift, sell from a code, print the receipt (HTML + print CSS), scan and pay, cancel, cash in/out, close shift with Z report | A receipt prints from Chrome on the dev machine; all POS error codes shown clearly |
| F10 | Agent portal; then the back office (Refine) once the admin APIs exist. Retail admin creates agents with a `kind` and every shop under an agent; the agent portal works the same for a brand agent (D10) | — |
| F11 | Platform console (`console.{platform domain}`): sign-in with TOTP, brand list and creation, status, flags, figures | Against Prism once the `Platform` tag is in the contract (B16's first step) |

## 3. Backend track (FastAPI)

| Step | Build | Done when |
| --- | --- | --- |
| B0 | Skeleton (TD-00 layout): Docker Compose with PostgreSQL 16, Redis 7 and NATS; `shared/` (money, UUIDv7 IDs, `Problem` errors with `ErrorCode`, tenant context, outbox); Alembic; import-linter; CI with ruff, mypy, pytest and `oasdiff` against the contract | `/healthz` passes in CI and the contract diff runs |
| B1 | C16 tenancy and configuration, with a seeded `demo` tenant | `GET /v1/config/public` from the database matches the contract |
| B2 | C03 ledger: `post`, `reverse`, balances, invariants, property tests | Every C03 posting template has a test; the ledger balances after 10,000 random postings |
| B3 | C07 slip calculator in pure Python, and the golden CSV (format below) | All 366 golden rows pass (python3 generate.py --check in CI); the TypeScript port already passes, Dart port follows |
| B4 | C05 fake feed and C06 catalogue: fixture and market tables, dictionary builder, events endpoints, margins, prices in Redis | The frontend switches catalogue screens from Prism to the real API (milestone M1) |
| B5 | C01 identity with `ConsoleSmsProvider`, and the C14 sender interface | Register, login and reset work against the real API |
| B6 | C08 placement (re-price, limits, liability in Redis, `BET_STAKE` posting, idempotency) and C09 bookings and ticket check | Placing the same idempotency key twice returns one ticket |
| B7 | C10 settlement from fake-feed results, including rollbacks; accumulator bonus funding (C11) | Win, loss, void and rollback all post correctly |
| B8 | C04 payments with `MockPaymentProvider` (then the Chapa sandbox) and the withdrawal rule chain; C12 limits and self-exclusion | Register → deposit → bet → settle → withdraw works end to end (milestone M2) |
| B9 | C19 retail: agents (brand and partner, one level) and shops, terminal activation, slip codes, sale, receipt model, payout, cancel, shifts, settlements, commission | The shop flow works end to end (milestone M3) |
| B10 | C15 admin APIs with audit and approvals; C13 reporting to `FileSink` and daily summaries | Back office usable for an internal demo (milestone M4) |
| B16 | Platform console backend (C16 §9): platform staff with their own token audience, brand creation and lifecycle, flags, per-brand figures, platform audit; email sender with a console mock | A second brand is created from the console and serves its own `/v1/config/public` |
| B17 | Monthly platform statement per brand (C13), only if the Platform charges by GGR or outlet | Blocked until the product owner answers Q1 |
| B11 | Real providers as accounts arrive: SMS, Chapa, then telebirr and CBE Birr, Fayda, the odds-feed trial, the regulator adapter | Each adapter passes the same tests as its mock |

**Golden CSV (B3, shared by Python, Dart and TypeScript) — already built.** `contracts/golden/` holds `rules.json` (rule sets `default_2026_10`, `no_tax`, `net_win_tax_refund_void`, `small_caps`), `slips.csv` (366 rows: hand-picked edge cases plus 300 seeded random cases), `reference_slipcalc.py` (the executable definition of Engineering Decisions D1), `generate.py` (`--check` mode for CI) and a TypeScript port `ts/slipcalc.ts` that already passes every row. Columns: `case_id, rules, bet_type, system_sizes, stake, stake_is_per_line, leg_odds, leg_results, settled, expected_error, lines, stake_per_line, total_stake, stake_tax, net_stake, total_odds, gross_payout, acca_bonus, win_tax, stake_tax_refund, net_payout, capped, warnings`. Lists are `;`-separated; money is a 2-decimal string; when `expected_error` is set the outputs are empty. Full spec in `contracts/golden/README.md`. So B3 is now "port the reference into `modules/slipcalc` and make pytest pass the CSV", and F3 is "copy `slipcalc.ts` into `packages/slipcalc` and wire it to the slip store".

## 4. Where the tracks meet

| Milestone | What works | Rough timing for one developer |
| --- | --- | --- |
| M1 | Catalogue served by the backend with moving odds from the fake feed; the frontend uses it | Weeks 2–3 |
| M2 | Register, deposit (mock), place a bet, settle, win lands in the wallet, withdraw | Weeks 5–6 |
| M3 | Shop flow: terminal code, POS sale, printed receipt, settlement, payout, Z report | Weeks 8–9 |
| M4 | Back office basics and regulator file sink; a demo you can show a white-label customer | Weeks 10–12 |

Timings are placeholders; they assume full-time work with AI assistance and no outside dependency on the critical path, which is the point of the mocks.

## 5. This week

1. Unzip `contracts/` into the repo, generate the web types, and point the Next.js app at Prism (F0).
2. Start the backend skeleton (B0), then the slip calculator and golden CSV (B3). B3 comes early because the frontend slip (F3) must match it to the santim.
3. Share the local frontend URL for a review of what exists so far against the contract and C18.
