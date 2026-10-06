# Sportsbook Platform — Product Requirements (PRD)

Sep 29, 2026 · @Bereket

## Summary

We are building a regulator-ready sports betting and gaming platform for Ethiopia. It launches as one consumer brand and is architected from day one so other licensed operators can run on it: from Release 1 the company that runs the Platform creates and runs brands from its own platform console (whether more than one brand is live at launch is open, Q5 in the platform and retail hierarchy). Release 1 is pre-match sports betting, sold online and in retail shops (self-service terminals, a cashier counter and agents), because every operator buying a white label expects shops. Release 2 adds virtual games. Live betting and casino follow later. Players reach it through a Flutter Android app, a responsive Next.js web app for desktop and phone browsers, shop terminals, and Telegram (P1).

**Why now.** The Ethiopian Lottery Service revoked every sports-betting licence on 15 December 2025 and is preparing a relaunch under a new framework built around real-time monitoring. Every operator that returns will need a platform that can report to the regulator from the start. Today's incumbent platform (Convex) is mid-rewrite and has no live-odds push, a 3.8 MB first page load, and a separate copy of the system per operator.

**What makes it different.**

- **Compliance built in**: a double-entry ledger, a full audit trail for every bet, responsible-gambling controls and a regulator reporting interface.
- **Built for Ethiopian mobile networks**: small, paged odds data and live updates pushed to the app, not re-downloaded.
- **One codebase, many tenants**: brand, tax, bonus and payment rules are configuration, so a second operator is a setup task, not a fork.
- **Shops included**: terminals that need no login, a cashier POS that prints tickets, and agents with cash control and commission (every shop under an agent; a brand's own shops under its brand agent), all running in a browser, so a white-label operator can open shops on day one without installing software.

The product name is a placeholder; “the Platform” is used throughout. The companion SRS tab specifies how each requirement is met.

## Context

The market was large before the shutdown and will be regulated much more tightly when it reopens. Licensed operators moved 199 billion birr between July 2022 and December 2025, and about 20 billion birr a month by September 2025. Only about 12% of the commission owed to the regulator was paid ([Birr Metrics](https://birrmetrics.com/sports-betting-relaunch-ethiopia-audit/)).

| Factor | What we know | Product implication |
| --- | --- | --- |
| Licence status | All licences revoked 15 Dec 2025; relaunch “in a new form” with no date yet ([SiGMA](https://sigma.world/news/ethiopia-revokes-all-sports-betting-licences/), [Ethio Negari](https://ethionegari.com/2026/09/20/ethiopia-to-relaunch-sports-betting-under-new-rules/)) | Build and certify now; no real-money traffic until licensed |
| Regulator tech | A unified digital system to monitor operators' transactions in real time | Reporting interface is a launch requirement (Epic 12) |
| Payments | Banks and payment providers must tell licensed from unlicensed platforms | Licensed rails only: telebirr, CBE Birr, M-Pesa, Chapa / SantimPay |
| Ownership | Licences historically reserved for Ethiopian-owned companies | Fits a local founder; B2B tenants must hold their own licence |
| Age | 21+ (Directive 172/2021) | Age check at registration |
| Tax and levy | Previously \~15% of turnover to the regulator, plus win and withholding taxes | Configurable tax engine per tenant |

### Competitors

| Competitor | Platform | Strengths | Gaps we target |
| --- | --- | --- | --- |
| HuluSport, Shamo.bet, BetHulu and \~60 others | Convex white-label (Django, one copy per brand; .NET rewrite under way) | Retail and agent network, P2P payment agents, rich engagement features, Telegram and SMS | No live-odds push, heavy data load, same odds for every brand, weak security basics |
| Melbet, 1xBet | 1xBet-family platform, offshore | Huge market depth, fast paged feeds, live betting | Offshore; not eligible for a local licence |

Full teardowns: Ethiopian Betting Sites — API & Storage Teardown.

## Goals and success metrics

The first goal is a licence; everything else follows from it. Targets below are proposals to confirm once the directive is published.

| # | Goal | Metric | Target | When |
| --- | --- | --- | --- | --- |
| G1 | Be licensable on day one of the relaunch | Regulator integration passes certification; all compliance requirements met | 100% of published requirements | Before public launch |
| G2 | Reliable, correct money handling | Ledger reconciliation breaks; mis-settled bets | 0 unreconciled; < 0.01% of bets resettled | Continuous |
| G3 | Fast on Ethiopian mobile networks | App home screen ready on 3G; first-load data | < 3 s; < 300 KB | Launch |
| G4 | Pre-match betting that holds up on big match days | Bet placement p95 latency; uptime | < 800 ms; 99.9% monthly | Launch |
| G5 | Grow an active player base | Monthly active bettors | 50k by month 6 (placeholder) | Month 6 |
| G6 | Payments that just work | Deposit success rate; median withdrawal time | > 95%; < 30 min | Month 3 |
| G7 | Retail footprint | Active shops and agents | 100 by month 6 (placeholder) | Month 6 |
| G8 | B2B-ready | Time to onboard a second tenant | < 2 weeks, no code changes | Month 12 |
| G9 | Protect players | Share of active players with a deposit limit set; self-exclusion honoured | Offered to 100% at sign-up; 100% enforced within 1 minute | Launch |

## Users and personas

Ten user types touch the Platform; the first four decide whether it succeeds. The ownership chain behind them is Platform → Brand → Agent → Shop (`docs/design/platform-retail-hierarchy.md`).

| Persona | Who they are | Needs | Channel |
| --- | --- | --- | --- |
| **Online player** | Adult (21+) football fan in Addis or a regional city, Android phone, pays with telebirr, patchy 3G/4G | Quick odds, cheap on data, instant deposits, fast withdrawals, Amharic | Flutter Android app, responsive Next.js web, Telegram Mini App |
| **Retail player** | Bets in a shop with cash, often without a smartphone | Printed ticket, booking codes, easy payout | Shop terminal (no login) to build a slip and get a code, then the cashier counter; SMS |
| **Cashier** | Shop employee selling tickets and paying winnings | Fast ticket entry and printing, payouts, end-of-day cash report | Cashier POS (Next.js web app in Chrome kiosk, receipt printer, barcode scanner) |
| **Agent** | Runs shops for a brand in an area (a partner agent), or the brand's own shops (a brand agent); a partner earns commission | Balance, shop management, cash owed, commission statements | Agent portal (Next.js), Telegram |
| **Trader / risk manager** | Operator staff watching liability and odds | Liability per market, limits, suspend or re-price, alerts on sharp or suspicious bettors | Back office |
| **Customer support** | Handles player issues | Player 360° view, bet and transaction history, manual adjustments with approval | Back office |
| **Finance / compliance officer** | Reconciles money, files tax and regulator reports | Reconciliation, tax reports, AML flags, audit log exports | Back office |
| **Regulator (Ethiopian Lottery Service)** | Monitors operators in real time | Real-time transaction and bet feed, tax and commission totals, player protection data | Regulator interface |
| **Tenant operator (brand)** | A licensed brand on the Platform; Phase 1 (how many are live at launch: Q5) | Own brand, rules, payment methods, agents, shops and data, isolated from other brands | Its own back office |
| **Platform staff** | The company that runs the Platform | Create brands, suspend or reactivate them, watch status, licence expiry and totals; never see a brand's players, bets or money | Platform console (Next.js) |

## Feature requirements

Sixteen epics make up version 1. **P0** means required for launch, **P1** means ship at launch if ready (otherwise within 60 days), **P2** means a later phase. Each epic is traced to SRS requirements in SRS Appendix D.

**Release scope (updated 30 Sep 2026).** Release 1 = E1–E5, E7, E9 (retail shops), E10 (agents), E11–E16: pre-match only, online and in shops. Release 2 = the virtual-games part of E8, online only (selling virtuals in shops is deferred). E6 (live) and the casino part of E8 move to later releases regardless of the P0 marks below. The SRS tab specifies Releases 1 and 2 in full; the Technical Design tab covers retail in C19 and all client apps in C18.

| Epic | P0 (launch) | P1 | P2 (later) |
| --- | --- | --- | --- |
| **E1 Account & identity** | Phone + OTP registration, password login, 21+ age confirmation, national ID / Fayda number capture, password reset, session management, Amharic and English | Telegram Mini App login, Afaan Oromo, profile photo | Biometric login, social login |
| **E2 Wallet** | Cash and bonus balances, transaction history, real-time balance, withdrawal holds | Wallet-to-wallet transfer with OTP | Multi-currency |
| **E3 Payments** | Deposits and withdrawals via telebirr and CBE Birr; min/max limits; withdrawal approval rules; reconciliation | M-Pesa, Chapa or SantimPay aggregator, bank transfer | Cards, other gateways per tenant |
| **E4 Sports catalogue & pre-match** | Sports, countries, leagues, fixtures, 40+ market types, search, favourites, popular and today's matches | Full market depth (1,000+ market types), stats and head-to-head widget | Bet builder |
| **E5 Bet slip & placement** | Singles, accumulators (up to 30 legs), system bets, odds-change acceptance settings, booking codes, shared slips, max-win and stake limits, tax and bonus preview | Multiple saved slips, quick-bet | Bet builder slips |
| **E6 Live betting** | Live match list, real-time odds push, scoreboards, bet delay, auto-suspension on events | Match tracker animation | Live streaming |
| **E7 Settlement & cash-out** | Automatic settlement from the feed, voids and resettlement, bet history, winnings to wallet | Full and partial cash-out | Auto cash-out rules |
| **E8 Casino & virtuals** | One aggregator: slots, crash games (Aviator-type), virtual sports; wallet integration; responsible-gaming limits apply | Lobby personalisation, jackpots display | Live dealer, own instant games |
| **E9 Retail shops** | Self-service terminals (browser in kiosk mode, no login) that turn a slip into a numeric slip code; cashier POS: load code, sell, print receipt with barcode, scan to pay out, cancel within window, shift and Z report; payout rules and big-win approval; shop cash limit | Local print bridge (ESC/POS, cash drawer), SMS ticket check | Offline-tolerant POS, cash-accepting terminals |
| **E10 Agents** | Agents and shops (brand → agent → shop, one agent level; every shop under an agent, the brand's own shops under a brand agent), shop cash positions, float top-ups, two-sided cash settlements, commission rules and weekly statements, web agent portal | Agent-assisted online player deposits | Master agents (regional supervisors), agent-level promotions |
| **E11 Bonuses & promotions** | Accumulator bonus table, free bets, welcome bonus with wagering rules, promo codes | Cashback (lost-by-one), referral program, tournaments / leaderboards | Missions, XP levels, spin wheel, quizzes |
| **E12 Compliance & responsible gambling** | Deposit, stake and loss limits; self-exclusion; reality checks; AML rules and flags; KYC review queue; tax engine; audit log; regulator reporting interface | Automated suspicious-pattern detection | Affordability checks |
| **E13 Trading & risk** | Liability per market and event, stake limits per player / market, suspend and re-price, margin settings, alerts | Player risk segmentation, bet delay per player | Own odds compilation |
| **E14 Back office** | Role-based admin, player 360°, bet and ticket search, manual adjustments with 4-eyes approval, finance reports, content CMS (banners, pages) | Promotion builder UI, BI dashboards | Custom report builder |
| **E15 Notifications & channels** | Push notifications, SMS (OTP, receipts), in-app inbox, Telegram support link | Telegram betting bot, SMS betting short code | USSD, WhatsApp |
| **E16 Multi-tenancy & configuration** | Tenant ID on every record, per-tenant config (branding, limits, tax, bonus, payment methods, languages), tenant-isolated data; platform console: create a brand (tenant, domains, licence, branding, first admin), suspend or reactivate it, feature flags, watch status, licence expiry and totals | Platform statement per brand, if the Platform charges by GGR or outlet (Q1) | Self-service tenant onboarding, per-tenant odds margins, platform access to a brand's data by the brand's grant (Q4) |

## Key user journeys

J1, J3, J4 and J5 define Release 1; J2 describes live betting for a later release. Each has a time budget that becomes an acceptance test.

### J1 First bet (online player) — under 3 minutes from install

1. Opens the app; home shows today's popular matches without login (under 300 KB of data).
2. Taps odds; the selection goes into the bet slip, which prompts sign-up.
3. Registers with phone number, OTP, password, date of birth (21+) and ID number; accepts terms and sets an optional deposit limit.
4. Deposits with telebirr: enters amount, approves on the telebirr prompt, sees the balance update within 30 seconds.
5. Enters a stake; the slip shows tax, bonus and potential win; places the bet and gets a ticket ID.
6. Receives a push notification when the bet settles; winnings land in the wallet.

### J2 Live bet during a match (later release)

1. Opens Live; scores and odds update in place without refreshing.
2. Adds a selection; if odds move before confirming, the slip shows old and new odds and applies the player's acceptance setting (accept any, accept higher, ask).
3. Places the bet; it waits out the live bet delay (configurable, 5–10 s) and is accepted or rejected with a clear reason.
4. Optionally cashes out at the offered value before the match ends.

### J3 Withdrawal

1. Requests a withdrawal to their telebirr or CBE Birr account.
2. Rules run automatically: KYC status, wagering on bonuses, AML thresholds, daily limits.
3. Low-risk requests are paid automatically; others go to a finance review queue.
4. Player sees status (pending, processing, paid, rejected with reason); the median is under 30 minutes.

### J4 Shop ticket (retail player and cashier)

1. The customer walks into a shop and taps matches on a terminal (no login, no money on the terminal); the slip shows odds and potential win.
2. They press **Get code**; the terminal shows an 8-digit slip code and a QR code, then clears itself for the next customer.
3. The cashier types or scans the code in the POS; the slip reloads at current odds, with any change highlighted. The customer pays cash, the cashier enters the stake and presses Sell.
4. A ticket with a ticket ID and barcode prints immediately (under 3 seconds from Sell).
5. The customer checks the result at the shop, on the ticket-check web page, or by SMS (P1).
6. The cashier scans the barcode to pay a winning ticket; the platform pays each ticket once, asks for ID above a threshold and sends big wins to head office for approval. The payout comes out of the shop's cash and shows in the shift's Z report.

### J5 Regulator view

1. Every bet, settlement, deposit, withdrawal and balance change is sent to the regulator interface within the required time.
2. Daily totals (turnover, GGR, tax, levy) reconcile with the ledger to the birr.
3. Self-excluded and limit data can be exported on request.

## Release plan

&#91;embedded content: Release plan · 5 phases, 3 gates, licence track\]

No real-money traffic before Gate C. Gates map to the Build Plan milestones: Gate A = M1, Gate B = M2–M3 (beta with test money, shops included), Gate C = licence and regulator certification before public launch. Virtual games sit behind their own switch, so Release 2 can slip without touching the pre-match launch. Dates become real once team size and the directive date are known.

## Non-goals, assumptions, risks, open questions

### Non-goals for version 1

- Compiling our own odds: we buy a feed and set margins on top of it.
- Building casino games: all games come through one aggregator.
- Serving players outside Ethiopia, or unlicensed operators as tenants.
- Crypto payments, P2P payment agents or any rail the regulator hasn't approved.
- Live video streaming, betting exchange, peer-to-peer betting.

### Assumptions

- The relaunch directive allows online, live and retail betting and casino-style games. If casino is excluded, Epic 8 is switched off by configuration.
- A licence can be obtained by an Ethiopian-owned company we control or partner with.
- One odds-feed supplier covers pre-match and live for football plus at least 10 other sports.
- telebirr and CBE Birr will offer merchant APIs to licensed operators.
- Data may be hosted with a cloud provider; if local hosting is required, the design runs in an Ethiopian data centre (see SRS non-functional requirements).

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Directive delayed or restricts products | High | High | Keep every product behind a switch; ship pre-match first if needed |
| Regulator interface spec changes late | High | Medium | Isolate reporting in its own service with an adapter layer |
| Scope too large for the team in the time | High | High | Phase gates (Build Plan milestones); live can slip a phase; retail is in Release 1 but behind its own switch, so the online launch never waits for it |
| Settlement or ledger bug loses money | Medium | High | Double-entry ledger, idempotency keys, daily reconciliation, resettlement tooling, test suites built from feed replays |
| Feed outage during big matches | Medium | High | Auto-suspend markets on feed loss; second feed supplier as a P2 option |
| Payment provider refuses betting merchants | Medium | High | Start merchant onboarding as soon as the licence application is filed; support 3+ rails |
| Fraud: bonus abuse, multi-accounting, match fixing | High | Medium | Device fingerprinting, KYC matching, bonus rules, trader alerts |
| DDoS and attacks on match days | Medium | High | CDN with DDoS protection, rate limits, pen-test before launch |

### Open questions

- [ ] Which products does the new directive permit, and what are the licence fees, capital and bank-guarantee requirements?
- [ ] What is the regulator interface: real-time push, batch file or direct database access, and in what format?
- [ ] Must data be hosted in Ethiopia?
- [ ] Which odds-feed supplier and casino aggregator, at what price?
- [ ] Brand name, and which company holds the licence?
- [ ] Team size and budget for the build (drives the phase dates).
- [ ] Does the directive license each shop (outlet) separately, allow self-service terminals, and set a claim period for unclaimed retail winnings?
- [ ] Platform and retail hierarchy (`docs/design/platform-retail-hierarchy.md` §7): how a brand pays the Platform (Q1), brand agents (Q2), the shop manager (Q3), platform access to brand data (Q4), brands live at launch (Q5), who reports to the regulator (Q6), brand-agent portal logins (Q7), withdrawals while a brand is suspended (Q8).
