# Software Requirements Specification

Sportsbook Platform · Release 1 (pre-match sports betting) and Release 2 (virtual games) · Version 1.0 draft · Sep 29, 2026 · @Bereket

> **Companion tabs.** This SRS states *what* the system must do. The **Technical Design** tab states *how*: system architecture (TD-00), API conventions (TD-01), data conventions and the event catalogue (TD-02), one page per component C01–C19 (purpose, research, module structure, DDL, endpoints with JSON examples, events, algorithms, config, edge cases, tests), then deployment (TD-90) and the test strategy (TD-91). Requirement IDs here map to component pages there.

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines what the Sportsbook Platform must do for its first two releases. Its readers are the development team, QA, the product owner, integration partners (odds-feed, payment and game providers), auditors, and the Ethiopian Lottery Service (ELS) during licensing. The structure follows ISO/IEC/IEEE 29148:2018. Every requirement has a unique ID and a verification method so it can be traced to design, code and tests.

### 1.2 Scope

The Platform lets adults in Ethiopia bet on sports and play virtual games on their phones and the web and in retail shops, with player money held in a regulated wallet.

| Release | Contents | Status |
| --- | --- | --- |
| **Release 1 — Pre-match sportsbook, online and in shops** | Registration and KYC, wallet and ledger, deposits and withdrawals, sports catalogue from an odds feed, bet slip, bet placement, booking codes, settlement, bet history, accumulator and welcome bonuses, responsible gambling, notifications, back office, regulator reporting, per-tenant configuration and a platform console that creates and runs brands (how many brands are live at launch is open, Q5); retail shops (self-service terminals, cashier POS, printed tickets, payouts, shifts) and agents (brand and partner agents, one level, cash settlement, commission); player web built in Next.js, responsive for desktop and phones | Specified in full here |
| **Release 2 — Virtual games** | Virtual football and other virtual sports from one provider, launched in the app, settled through the same wallet | Specified in full here (§4.17) |
| **Later releases** | Live (in-play) betting, cash-out, casino aggregator, offline shop POS and cash-accepting terminals, Telegram and SMS betting, self-service brand onboarding, master agents | Out of scope for this SRS; the design must not block them (§2.5) |

### 1.3 Definitions, acronyms and abbreviations

| Term | Definition |
| --- | --- |
| Accumulator (multi, parlay) | One bet combining 2 or more selections; wins only if all win. Odds multiply. |
| Bet stop | Feed signal to suspend a market immediately. |
| Booking code | Short code that stores an unplaced slip so it can be loaded on another device or in a shop. |
| Brand (operator, tenant) | A licensed betting operator running on the Platform, with its own players, rules, domains, back office and shops. All its data carries its `tenant_id`. |
| Agent; brand agent; partner agent | An agent runs shops for a brand; every shop has exactly one. A brand agent holds the shops the brand runs itself; a partner agent is a separate business. One agent level in Phase 1 (no master agents). |
| Platform (company); platform console; platform staff | The company that runs this system and the brands on it; its staff create and run brands from the platform console (4.21), separate from every brand's back office. |
| Slip code | 8-digit code a shop terminal shows for a slip; the cashier loads it to sell the ticket (C19). |
| Terminal | Self-service PC or touch screen in a shop running the betting site in a locked browser, with no login and no money. |
| Cashier POS | The cashier's web app in a shop: sells tickets from slip codes, prints receipts, pays out, runs shifts. |
| Z report | End-of-shift report: expected cash, counted cash by denomination, and the variance. |
| ELS | Ethiopian Lottery Service, the betting regulator. |
| Fixture / event | A scheduled sports match. |
| GGR | Gross gaming revenue = stakes − winnings. |
| Idempotency key | Client-generated unique ID that makes a request safe to retry. |
| KYC | Know your customer: identity verification. |
| Ledger | Append-only double-entry record of all money movements. |
| Market | A betting question on a fixture, e.g. 1X2 or Over/Under 2.5. |
| Outcome / selection | One possible answer in a market, with odds. |
| Producer | A feed source within the odds provider, e.g. pre-match producer. |
| RG | Responsible gambling. |
| RGS | Remote game server of a game provider. |
| RNG | Random number generator (virtual games). |
| Settlement | Resolving a bet as won, lost, void or partially won/lost. |
| Slip / ticket | A placed or draft bet: selections, stake, type. |
| Specifier | Parameters defining a market line, e.g. `total=2.5`. |
| TBD | To be determined; listed in Appendix C. |

### 1.4 References

| ID | Document |
| --- | --- |
| R-1 | PRD tab of this document |
| R-2 | Implementation & Integration Guide tab of this document |
| R-3 | Proclamation 535/2007 (National Lottery Administration) and Council of Ministers Regulation 160/2009 |
| R-4 | Sports Betting Lottery Directive 172/2021 and its successor directive (TBD-1) |
| R-5 | Personal Data Protection Proclamation 1321/2024 |
| R-6 | Odds-feed provider integration documentation (e.g. Sportradar Unified Odds Feed) |
| R-7 | Payment-provider API documentation: telebirr, CBE Birr, M-Pesa Ethiopia, Chapa |
| R-8 | Virtual-games provider integration documentation (Release 2) |
| R-9 | ISO/IEC/IEEE 29148:2018, OWASP ASVS 4.0, GLI-33 (event wagering) |

### 1.5 Document overview

Section 2 describes the product and its environment. Section 3 defines interfaces to users, hardware, software and networks. Section 4 specifies each system feature with its stimulus/response sequence and numbered functional requirements. Section 5 covers quality attributes and business rules. Section 6 and the appendices hold state models, open items and traceability.

Each requirement is written as “The system shall …” and tagged with a priority and a verification method:

- **Priority**: M = must, S = should, C = could.
- **Verification**: T = test, I = inspection, D = demonstration, A = analysis.

## 2. Overall description

### 2.1 Product perspective

The Platform is a new, self-contained system, not a component of an existing product. It is built as one backend (a modular monolith) with three separate services: odds-feed ingestion, regulator reporting and, from Release 2, the game-provider wallet gateway. Several third-party systems supply data, money movement and games; the Platform owns the player, the wallet, the bets and all records.

&#91;embedded content: Context diagram · 2 user groups, 7 external systems\]

### 2.2 Product functions

| # | Function | Release |
| --- | --- | --- |
| F1 | Register, verify and authenticate players | 1 |
| F2 | Hold player funds in a double-entry wallet | 1 |
| F3 | Take deposits and pay withdrawals through Ethiopian payment rails | 1 |
| F4 | Import fixtures, markets and odds from an odds provider | 1 |
| F5 | Let players browse, search and build bet slips | 1 |
| F6 | Validate, price and accept pre-match bets | 1 |
| F7 | Store and load slips by booking code | 1 |
| F8 | Settle bets from provider results and pay winnings | 1 |
| F9 | Apply bonuses, taxes and limits | 1 |
| F10 | Protect players (limits, self-exclusion, reality checks) | 1 |
| F11 | Notify players by push, SMS and in-app inbox | 1 |
| F12 | Give staff a back office for players, trading, finance and content | 1 |
| F13 | Report every transaction to the regulator | 1 |
| F14 | Offer virtual sports games paid from the same wallet | 2 |
| F15 | Retail shops: self-service terminals, cashier POS, printed tickets, payouts, shifts (4.19) | 1 |
| F16 | Agents: brand and partner agents (one level; every shop under an agent), cash settlement, commission (4.20) | 1 |
| F17 | Platform console: create, run and watch brands (4.21) | 1 |

### 2.3 User classes and characteristics

| User class | Description | Frequency | Technical skill | Key needs |
| --- | --- | --- | --- | --- |
| Player | Adult 21+, mostly Android, pays by telebirr / CBE Birr; many on 3G and prepaid data | Daily to weekly | Low to medium; Amharic-first for many | Fast, data-light, trustworthy payouts |
| Shop customer | Anonymous adult betting with cash in a shop, often without a smartphone | Daily to weekly | Low | Simple terminal, printed ticket, quick payout |
| Cashier / shop manager | Shop staff selling tickets and paying winnings; the manager also approves cancels and closes shifts | Daily, all day | Low to medium | Fast keyboard and scanner flow, reliable printing, clear cash totals |
| Agent (partner or brand agent) | Runs a group of shops for a brand, or the brand's own shops (brand agent); collects cash; a partner earns commission | Daily | Medium | Shop figures, cash owed, commission statements |
| Retail administrator | Brand staff managing agents, shops, terminals and payout approvals | Daily | Medium | Hierarchy control, limits, approval queue |
| Customer support agent | Operator staff answering players | Daily | Medium | Full player view, safe adjustments |
| Trader / risk manager | Watches exposure, suspends markets, sets limits | During events | High | Real-time liability and control |
| Finance officer | Reconciles payments, approves withdrawals, files tax | Daily | Medium | Accurate reports, approval queues |
| Compliance officer | KYC review, AML alerts, RG cases, regulator requests | Daily | Medium | Evidence, audit trail |
| Marketing manager | Banners, promotions, push campaigns | Weekly | Low to medium | Easy CMS, bonus setup |
| System administrator | Configuration, users, roles | As needed | High | Safe, audited changes |
| Platform staff | Staff of the company running the Platform; create brands, suspend or reactivate them, watch their status and totals; see no player data | As needed | High | Safe brand setup, licence-expiry warnings, per-brand totals |
| Regulator (ELS) | Receives reports; may inspect | Continuous / on request | High | Complete, timely, reconciled data |

### 2.4 Operating environment

| Component | Environment |
| --- | --- |
| Player mobile app | Android 8.0+ (API 26+), iOS 14+ later; built with Flutter; distributed as APK from the website until an app-store listing is possible (see R-2 §7) |
| Player web | Responsive, server-rendered Next.js web app: current Chrome, Edge, Firefox, Safari 16+; screens from 360 px to desktop; installable as a PWA. Proxy browsers such as Opera Mini get readable HTML and a ticket check that works without JavaScript |
| Shop terminal | Chrome or Chromium in kiosk mode on Windows or Linux PCs, touch screen optional; landscape 1280 px+ |
| Cashier POS | Chrome in kiosk mode with silent printing; 80 mm (or 58 mm) thermal receipt printer; USB barcode scanner in keyboard mode |
| Agent portal | Current Chrome, Edge, Firefox or Safari on desktop or phone |
| Back office | Desktop Chrome or Edge, 1280 px+ |
| Backend | Linux containers (Kubernetes or managed containers) in an Ethiopian data centre or a nearby cloud region, per TBD-3 |
| Database | PostgreSQL 16+; Redis 7+; message bus (NATS JetStream) |
| Networks | Ethio Telecom and Safaricom Ethiopia 3G/4G; must tolerate 300 ms+ latency and brief drops |

### 2.5 Design and implementation constraints

- **DC-1** Money shall be stored as integer santim (1 ETB = 100 santim); odds as fixed-precision decimals. No floating-point money arithmetic.
- **DC-2** All times are stored in UTC and shown in East Africa Time (UTC+3); the Ethiopian calendar may be offered as a display option.
- **DC-3** Except the global tenancy, platform, feed and catalogue tables (Technical Design TD-02), every table carries a `tenant_id` from day one, even though Release 1 has one tenant, so later operators can be added without migration.
- **DC-4** Modules shall not read each other's tables; they call module interfaces or consume events.
- **DC-5** Real-money operation is blocked by a configuration switch until a valid ELS licence number is recorded.
- **DC-6** The system shall comply with the successor to Directive 172/2021 (TBD-1); where this SRS conflicts with it, the directive prevails.
- **DC-7** Personal data handling shall comply with Proclamation 1321/2024 (consent, purpose limitation, data-subject rights, cross-border transfer rules).
- **DC-8** Designs for later releases (live betting, cash-out, casino, offline shop POS) shall be possible without breaking Release 1 APIs.

### 2.6 User documentation

- In-app help: how to bet, bet types, rules per market, deposit and withdrawal guides (Amharic and English).
- Terms and conditions, privacy notice, responsible-gambling page, betting rules.
- Back-office user manual per role; runbooks for operations and incidents.
- API reference (OpenAPI 3.1) for all client-facing endpoints.

### 2.7 Assumptions and dependencies

| ID | Assumption / dependency | Impact if false |
| --- | --- | --- |
| AS-1 | ELS will relaunch licensing and permit online pre-match betting | No real-money launch; product waits |
| AS-2 | Virtual games will be permitted under the new directive | Release 2 stays off by configuration |
| AS-3 | An odds provider will contract with an Ethiopian operator at an affordable price | Must change feed choice |
| AS-4 | telebirr and CBE Birr (directly or via an aggregator) will onboard a licensed betting merchant | Fewer deposit options at launch |
| AS-5 | Fayda eKYC access can be obtained as a relying party | Fall back to manual ID document review |
| AS-6 | Hosting outside Ethiopia is allowed, or local data-centre capacity is available | Hosting plan changes (TBD-3) |

## 3. External interface requirements

### 3.1 User interfaces

Player app and web share one design system, Amharic and English, dark and light themes. Minimum touch target 44 px; key screens usable one-handed on a 360 px screen.

| Screen | Purpose | Key elements |
| --- | --- | --- |
| UI-01 Home | Entry point, works logged out | Popular matches, today, leagues shortcuts, banners, search |
| UI-02 Sport / league list | Browse fixtures | Date tabs (today, tomorrow, next days), league groups, 1X2 odds per row, market switcher |
| UI-03 Match detail | All markets for one fixture | Market groups (main, goals, halves, handicap, player), collapsible, odds buttons |
| UI-04 Bet slip | Build and place bets | Selections, single/multi/system tabs, stake input with quick amounts, odds-change setting, tax, bonus, potential win, booking-code button |
| UI-05 Register / login | Account access | Phone, OTP, password, date of birth, ID number, terms and 21+ confirmation, optional deposit limit |
| UI-06 Wallet | Balances and money movement | Cash, bonus and locked balances, deposit, withdraw, transaction history |
| UI-07 Deposit / withdraw | Payments | Method picker (telebirr, CBE Birr, …), amount, status screen |
| UI-08 My bets | History | Open / settled tabs, ticket detail, share, re-bet |
| UI-09 Check ticket | Look up any ticket or booking code | Code entry, result |
| UI-10 Promotions | Bonuses and free bets | Active offers, wagering progress |
| UI-11 Account and RG | Profile, KYC, limits, self-exclusion | Limit editor, exclusion options, session reminder settings |
| UI-12 Inbox | Messages | List, read state |
| UI-13 Virtual games (R2) | Lobby and game view | Game tiles, embedded game, balance bar |
| UI-14 Terminal home and slip | Self-service slip building in a shop | Large touch targets, sports and today's matches, slip with potential win, Get code button, idle reset |
| UI-15 Terminal slip code | Show the code to take to the cashier | 8-digit code in large type, QR code, validity time, auto-clear |
| UI-16 POS sell | Sell a ticket for cash | Code entry or scan, re-priced legs with changes highlighted, stake, 21+ tick box, Sell (F9), print |
| UI-17 POS pay and cancel | Pay winners, cancel within the window | Scan, ticket status, payable amount, ID capture above threshold, approval status, cancel with reason |
| UI-18 POS shift | Open and close a shift | Opening cash, cash in and out, denomination count, Z report print |
| UI-19 Agent portal | Manage a group of shops | Shop list with today's figures, cash held, settlements, commission statements |
| UI-BO | Back office | Player 360°, bets, trading, payments, reports, CMS, settings, audit log |

UI-01 to UI-13 exist in the Flutter Android app and in the Next.js player web with the same content and flows. On the web they adapt to three layouts: phone (under 640 px, bottom navigation, slip as a bottom sheet), tablet (640–1023 px, collapsible menu, slip drawer) and desktop (1024 px and wider, three columns with the slip always visible). UI-14 to UI-19 are separate Next.js apps sharing the same UI packages (C18).

### 3.2 Hardware interfaces

Player devices are standard phones and PCs. Retail shops (Release 1) add: terminal PCs or touch screens running Chrome in kiosk mode; at each cashier counter an 80 mm (or 58 mm) thermal receipt printer driven through the operating-system driver and Chrome's silent printing, and a USB barcode scanner in keyboard mode (Code 128 and QR). A cash drawer and direct ESC/POS printing through a local print bridge are P1. No device needs software beyond Chrome and the printer driver.

### 3.3 Software interfaces

| ID | External system | Direction | Protocol / format | Purpose | Release |
| --- | --- | --- | --- | --- | --- |
| SI-01 | Odds-feed provider (e.g. Sportradar UOF, LSports Trade360, OddsMatrix) | In | AMQP / RabbitMQ push + REST recovery API; XML or JSON | Fixtures, markets, odds, bet stops, results, settlements | 1 |
| SI-02 | telebirr (Ethio Telecom) | Both | HTTPS REST, RSA-signed requests, notify-URL callbacks | Deposits (C2B), withdrawals (B2C) | 1 |
| SI-03 | CBE Birr (Commercial Bank of Ethiopia) | Both | HTTPS API per bank merchant agreement (TBD-4) or via aggregator | Deposits, withdrawals | 1 |
| SI-04 | Payment aggregator (Chapa, SantimPay or ArifPay) | Both | HTTPS REST, HMAC-signed webhooks | Additional rails: M-Pesa, banks, cards | 1 (S) |
| SI-05 | SMS gateway (e.g. AfroMessage, SMSEthiopia, GeezSMS) | Out | HTTPS REST | OTP, receipts, alerts | 1 |
| SI-06 | Fayda national ID (NIDP) | Out | HTTPS REST, JWS-signed, encrypted payloads | ID authentication and eKYC | 1 (S) |
| SI-07 | Firebase Cloud Messaging | Out | HTTPS (FCM HTTP v1) | Push notifications | 1 |
| SI-08 | ELS regulator system | Out | TBD-2 (assumed HTTPS push + daily files) | Regulatory reporting | 1 |
| SI-09 | Virtual-games provider (e.g. GoldenRace, Kiron, Betradar Virtual Sports) | Both | Game launch URL + seamless-wallet callbacks (HTTPS, signed) | Virtual games | 2 |
| SI-10 | Object storage (S3-compatible) | Both | HTTPS | KYC documents, exports | 1 |

### 3.4 Communications interfaces

- **CI-1** All external traffic uses HTTPS with TLS 1.2 or higher; HSTS on web domains.
- **CI-2** The client API is REST/JSON under `/v1`, documented in OpenAPI 3.1, gzip or Brotli compressed.
- **CI-3** Errors use RFC 7807 problem JSON with a stable machine-readable `code`.
- **CI-4** Webhooks from providers are received on dedicated endpoints, verified by signature or IP allow-list, and stored raw before processing.
- **CI-5** Public catalogue responses carry `Cache-Control` and `ETag` so a CDN and the app can cache them.
- **CI-6** SMS messages use a registered alphanumeric sender ID and support Amharic (Unicode) text.

## 4. System features

Each feature lists its description and priority, the stimulus/response sequence, and numbered functional requirements. Requirement IDs use the feature prefix (e.g. BET-07). Features 4.1–4.16 and 4.18–4.21 are Release 1; 4.17 is Release 2.

### 4.1 Registration and authentication (REG)

**Description and priority.** Players create an account with a verified phone number and sign in securely. Priority: High.

**Stimulus/response.**

1. Player enters a phone number → system checks it isn't registered and sends a 6-digit OTP by SMS.
2. Player enters the OTP → system verifies it and shows the details form.
3. Player submits name, date of birth, ID number, password and accepts terms → system validates, creates the account and wallet, and signs the player in.
4. Player signs in on a new device → system asks for an OTP if the tenant requires it.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| REG-01 | The system shall register players using an Ethiopian mobile number (+2519… or +2517…) verified by a 6-digit SMS OTP valid for 5 minutes. | M | T |
| REG-02 | The system shall limit OTP sends to 3 per number per 15 minutes and 10 per day, and OTP attempts to 5 per code. | M | T |
| REG-03 | The system shall collect full name, date of birth, national ID or Fayda number, password, and acceptance of terms and privacy notice with a recorded timestamp and version. | M | T |
| REG-04 | The system shall reject registration when the player is younger than the configured minimum age (default 21). | M | T |
| REG-05 | The system shall enforce unique phone number and unique ID number per tenant. | M | T |
| REG-06 | Passwords shall be at least 8 characters, checked against a breached-password list, and stored with Argon2id. | M | I |
| REG-07 | The system shall issue a 15-minute access token and a 30-day rotating refresh token bound to the device; reuse of a rotated refresh token shall revoke the whole session family. | M | T |
| REG-08 | The system shall lock sign-in for 15 minutes after 5 failed attempts and notify the player by SMS. | M | T |
| REG-09 | The system shall support password reset by SMS OTP. | M | T |
| REG-10 | Players shall be able to view and sign out of their active devices. | S | D |
| REG-11 | The system shall let players choose Amharic or English and remember the choice. | M | D |
| REG-12 | The system shall capture a referral or promo code at registration when provided. | C | T |

### 4.2 KYC and age verification (KYC)

**Description and priority.** Confirms each player is a real adult with one account, before any withdrawal. Priority: High.

**Stimulus/response.**

1. Player enters an ID number at registration → system attempts Fayda verification (OTP to the ID-linked phone) and records the result.
2. If Fayda is unavailable or fails → player uploads ID photos and a selfie; case goes to the compliance review queue.
3. Compliance officer approves or rejects → player is notified; withdrawals unlock on approval.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| KYC-01 | The system shall keep a KYC status per player: unverified, pending, verified, rejected, expired. | M | T |
| KYC-02 | The system should verify identity through the Fayda eKYC API and store the returned name and date of birth for matching. | S | T |
| KYC-03 | The system shall accept manual document upload (ID front/back, selfie; JPEG/PNG/PDF, ≤ 5 MB each) stored encrypted. | M | T |
| KYC-04 | The system shall block withdrawals until KYC status is verified. | M | T |
| KYC-05 | The system shall flag accounts whose verified name or date of birth does not match registration data. | M | T |
| KYC-06 | The system shall flag possible duplicate accounts by ID number, device fingerprint and payout account. | M | T |
| KYC-07 | The system shall require re-verification when the payout account name does not match the verified name. | S | T |

### 4.3 Wallet and ledger (WAL)

**Description and priority.** Holds all player and house money in an append-only double-entry ledger. Every other feature that moves money calls the wallet. Priority: High.

**Stimulus/response.** A module requests a posting (e.g. debit stake) with an idempotency key → wallet validates balances, writes balanced entries in one transaction, and returns the new balances; a repeated key returns the first result.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| WAL-01 | The system shall record every money movement as a ledger transaction whose entries sum to zero. | M | T, A |
| WAL-02 | Each player shall have cash, bonus and locked accounts; the house shall have open-stakes (HOUSE\_OPEN\_STAKES), gross-gaming-revenue (HOUSE\_GGR), bonus-cost, tax-payable and provider-clearing accounts. | M | I |
| WAL-03 | Ledger entries shall be append-only; corrections shall be reversing transactions linked to the original. | M | T |
| WAL-04 | Every posting shall require an idempotency key unique per tenant; a duplicate shall return the original result without a second posting. | M | T |
| WAL-05 | The system shall reject postings that would make a player account negative. | M | T |
| WAL-06 | Balance reads shall reflect all committed postings (read-your-writes). | M | T |
| WAL-07 | The system shall show players a paginated transaction history with type, amount, balance after, time and reference. | M | D |
| WAL-08 | The system shall run an automated end-of-day reconciliation: sum of accounts, ledger vs payment-provider reports, and ledger vs regulator totals; breaks raise an alert. | M | T |
| WAL-09 | Manual adjustments shall require a reason and a second approver above a configurable amount (default 1,000 ETB). | M | T |

### 4.4 Deposits (DEP)

**Description and priority.** Players fund their wallet from mobile money or bank rails. Priority: High.

**Stimulus/response.**

1. Player picks telebirr and enters 500 ETB → system validates limits, creates a pending payment and calls the provider.
2. Provider shows the payment prompt on the player's phone (USSD push or app) or returns a checkout URL → player approves with PIN.
3. Provider calls the notify URL → system verifies the signature, confirms status with a query call, credits the wallet, and notifies the player.
4. If no callback within 2 minutes → system polls the provider; after the timeout (default 15 min) marks the payment expired.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| DEP-01 | The system shall offer deposits through telebirr and CBE Birr at launch, and through M-Pesa and one aggregator when contracted. | M | D |
| DEP-02 | The system shall enforce per-method minimum and maximum amounts and daily totals (defaults: 20 ETB min, 100,000 ETB max per transaction). | M | T |
| DEP-03 | The system shall create a unique merchant reference per attempt and store the full provider request and response. | M | I |
| DEP-04 | The system shall credit the wallet only after a signature-verified callback or a successful status query, never on the client's word. | M | T |
| DEP-05 | Callback processing shall be idempotent by provider reference; duplicates shall not double-credit. | M | T |
| DEP-06 | The system shall poll pending payments older than 2 minutes and expire them after a configurable timeout. | M | T |
| DEP-07 | The system shall apply deposit limits set by the player (RG-01) before calling the provider. | M | T |
| DEP-08 | The system shall show the player a clear status: pending, successful, failed or expired, with the provider reference. | M | D |
| DEP-09 | Late successful callbacks for expired payments shall still credit the wallet and alert finance. | M | T |

### 4.5 Withdrawals (WDR)

**Description and priority.** Players cash out winnings to their own mobile-money or bank account. Priority: High.

**Stimulus/response.**

1. Player requests 2,000 ETB to telebirr → system checks KYC, bonus wagering, limits and AML rules, then moves the amount from cash to locked.
2. Low-risk request → system pays through the provider's B2C API; on confirmation, it posts the payout and notifies the player.
3. Flagged request → goes to the finance review queue; approve pays out, reject returns funds to cash with a reason.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| WDR-01 | The system shall allow withdrawals only to an account registered to the player's verified phone number or name. | M | T |
| WDR-02 | The system shall enforce min/max amounts and daily count and value limits per method. | M | T |
| WDR-03 | The system shall move the amount from cash to locked when the request is accepted. | M | T |
| WDR-04 | The system shall run automatic rules: KYC verified, no active bonus wagering, not self-excluded, AML thresholds, velocity, first-withdrawal check. | M | T |
| WDR-05 | Requests passing all rules and under the auto-approve limit (default 10,000 ETB) shall be paid automatically. | M | T |
| WDR-06 | Other requests shall enter a review queue with the reason; finance can approve or reject with a mandatory note. | M | D |
| WDR-07 | On provider failure, the system shall retry idempotently up to 3 times, then mark failed and return funds to cash. | M | T |
| WDR-08 | Players shall be able to cancel a withdrawal while it is still pending review. | S | T |
| WDR-09 | The system shall apply withholding tax on winnings at withdrawal if the tenant's tax configuration requires it. | S | T |

### 4.6 Odds-feed ingestion (FEED)

**Description and priority.** Imports fixtures, markets, odds and results from the contracted odds provider and keeps them current. It runs as a separate service. Priority: High.

**Stimulus/response.**

1. Provider publishes an odds change → feed service validates, maps IDs, updates the odds store and publishes an internal event within 1 second.
2. Provider publishes a bet stop → affected markets are suspended immediately.
3. Connection or producer is lost → service suspends affected markets, reconnects, calls the provider's recovery API from the last processed timestamp, and reopens markets after the snapshot completes.
4. Provider publishes a settlement → service stores it and emits a settlement event (see 4.10).

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| FEED-01 | The system shall consume the provider's push feed (AMQP / RabbitMQ) for fixtures, odds changes, bet stops, bet cancellations, settlements and rollbacks. | M | T |
| FEED-02 | The system shall persist every raw message with receipt time before acknowledging it, and keep raw messages for at least 90 days. | M | I |
| FEED-03 | The system shall map provider sports, categories, tournaments, competitors, markets and outcomes to internal IDs, including market name templates and specifiers. | M | T |
| FEED-04 | The system shall apply bet stops within 1 second of receipt. | M | T |
| FEED-05 | The system shall monitor provider heartbeats (e.g. `alive` messages) and suspend all markets of a producer within 10 seconds of missing heartbeats or a producer-down signal. | M | T |
| FEED-06 | On reconnect, the system shall run the provider's recovery procedure from the last processed timestamp within the provider's recovery window (e.g. 72 h pre-match for Sportradar), queue stateful messages until recovery completes, then resume. | M | T |
| FEED-07 | The system shall process odds updates in order per fixture and discard updates older than the stored version. | M | T |
| FEED-08 | The system shall apply the tenant's margin adjustment (global and per sport) to provider odds and round to 2 decimals. | M | T |
| FEED-09 | The system shall expose feed health (lag, message rate, producer status) to monitoring and the back office. | M | D |
| FEED-10 | Only fixtures starting within the configured horizon (default 14 days) and in enabled sports and leagues shall be offered. | M | T |

### 4.7 Sports catalogue and browsing (CAT)

**Description and priority.** Lets players find fixtures and markets quickly with little mobile data. Priority: High.

**Stimulus/response.** Player opens Football → app loads the cached dictionary (if the version is unchanged), then requests the first page of today's fixtures with main-market odds → player scrolls → next page loads.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| CAT-01 | The system shall serve reference data (sports, countries, leagues, market templates, translations) as a versioned dictionary returned only when the client's version is stale. | M | T |
| CAT-02 | The system shall list fixtures paged (default 20), filterable by sport, league, country, date and “popular”, with main-market odds. | M | T |
| CAT-03 | The system shall return all active markets for a fixture on request, grouped by market group. | M | T |
| CAT-04 | The system shall search teams and leagues by name in Amharic and English, returning results within 300 ms. | M | T |
| CAT-05 | The system shall hide or mark suspended markets and remove fixtures once they start (pre-match only in Release 1). | M | T |
| CAT-06 | The system shall let back-office staff set featured matches and league order. | M | D |
| CAT-07 | Public catalogue responses shall be cacheable at the edge for 10 seconds with ETags. | M | T |
| CAT-08 | Players shall be able to mark favourite leagues and teams. | S | D |

### 4.8 Bet slip and bet placement (BET)

**Description and priority.** Players combine selections, see potential winnings including tax and bonus, and place bets that the system validates, re-prices and accepts atomically. Priority: High.

**Stimulus/response.**

1. Player taps odds → selection is added to the slip on the device; the slip recalculates totals locally.
2. Player enters a stake and taps Place bet → app sends selections, the odds shown, stake, bet type, odds-change policy and an idempotency key.
3. System validates the player, markets and limits; re-prices each selection; applies the odds-change policy; computes tax and bonus; debits the stake and stores the bet in one transaction → returns 201 with the ticket.
4. If odds moved beyond the policy → returns 409 with new odds; app shows old and new odds for confirmation.
5. If a rule fails → returns 422 with a reason code the app translates.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| BET-01 | The system shall support single bets, accumulators of 2 to N selections (N configurable, default 30), and system bets (e.g. 2/3, 3/4, 4/5, Trixie, Yankee). | M | T |
| BET-02 | The system shall reject a slip containing two selections from the same fixture, unless the market pair is configured as combinable. | M | T |
| BET-03 | The system shall validate stake against min stake (default 5 ETB), max stake per bet, and the player's RG limits. | M | T |
| BET-04 | The system shall cap potential payout at the configured maximum win (default 1,000,000 ETB) and reject or reduce stake per tenant setting. | M | T |
| BET-05 | The system shall re-read current odds and market status for every selection at placement and reject suspended, closed or started markets. | M | T |
| BET-06 | The system shall apply the player's odds-change policy: accept none, accept higher only, accept any. | M | T |
| BET-07 | The slip calculator shall compute total odds, accumulator bonus, stake tax, win tax, withholding tax and net potential payout from the tenant's rule set, with identical results in the app preview and on the server. | M | T |
| BET-08 | Stake debit and bet creation shall happen in one atomic transaction keyed by the client's idempotency key. | M | T |
| BET-09 | Each accepted bet shall receive a unique ticket ID (10–12 characters, check digit, no ambiguous characters) and store the odds taken per selection. | M | T |
| BET-10 | The system shall enforce trader limits: max stake and max liability per player, market, fixture and sport (BO-06 to BO-09). | M | T |
| BET-11 | The system shall allow the bonus balance to be used for stakes according to the bonus rules (4.12). | M | T |
| BET-12 | Bet placement shall complete within 800 ms at the 95th percentile under peak load (NFR-P1). | M | T |
| BET-13 | The app shall keep the slip on the device across restarts and allow up to three parallel slips. | S | D |
| BET-14 | The system shall support free-bet stakes from the bonus engine. | S | T |

### 4.9 Booking codes and shared slips (BKG)

**Description and priority.** Lets a player save a slip as a short code to load on another device or share with friends. Priority: Medium.

**Stimulus/response.** Player taps Book → system stores the selections and returns a 6–8 character code → another user enters the code → system returns the selections with current odds, dropping unavailable ones with a notice.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| BKG-01 | The system shall create booking codes without login, valid for a configurable period (default 24 h or until the first fixture starts). | M | T |
| BKG-02 | Loading a code shall return current odds and flag selections that are no longer available. | M | T |
| BKG-03 | Booking-code creation shall be rate-limited per device and IP. | M | T |
| BKG-04 | Players shall be able to share a placed bet as a link that others can copy into their own slip. | S | D |

### 4.10 Settlement (SET)

**Description and priority.** Resolves every bet from provider results and pays winnings automatically. Priority: High.

**Stimulus/response.**

1. Provider sends settlement for a market → system records each outcome's result and void factor.
2. When all selections of a bet are resolved → system computes the payout, posts winnings and tax entries, marks the bet won, lost or void, and notifies the player.
3. Provider sends a rollback → system reverses the affected settlement entries, reopens the bets, and re-settles on the next settlement.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| SET-01 | The system shall settle outcomes as won, lost, void, half-won or half-lost from provider settlement messages. | M | T |
| SET-02 | Void selections shall count as odds 1.00 in accumulators and system bets; if all are void, the stake is refunded. | M | T |
| SET-03 | Winnings shall be credited within 60 seconds of the final settlement message, net of taxes. | M | T |
| SET-04 | The system shall process provider bet-cancel and rollback messages by reversing entries and notifying affected players. | M | T |
| SET-05 | Traders shall be able to settle, void or resettle manually with a reason, subject to 4-eyes approval above a configurable amount. | M | D |
| SET-06 | Bets still open 72 hours after a fixture's scheduled end shall be flagged for manual review. | M | T |
| SET-07 | Settlement shall be idempotent: reprocessing the same message shall not change balances. | M | T |
| SET-08 | Settlement of a bet shall use the odds stored at placement, never current odds. | M | T |

### 4.11 Bet history and ticket check (HIS)

**Description and priority.** Players see their bets and anyone can check a ticket's status. Priority: Medium.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| HIS-01 | Players shall see open and settled bets, newest first, filterable by date range and status. | M | D |
| HIS-02 | Ticket detail shall show each selection, odds taken, result, stake, taxes, bonus and payout. | M | D |
| HIS-03 | The ticket-check screen shall show status and payout for a ticket ID without exposing the owner's identity. | M | T |
| HIS-04 | Players shall be able to re-add the selections of a past bet to a new slip. | C | D |

### 4.12 Bonuses and promotions (BON)

**Description and priority.** Rule-driven incentives funded from a separate bonus balance. Priority: Medium.

**Stimulus/response.** Player places a 6-leg accumulator with every leg at 1.30 or higher → slip shows an 8% bonus → on a win, the bonus is paid as a separate ledger entry from the bonus-cost account.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| BON-01 | The system shall apply an accumulator bonus from a table of leg count → bonus percentage, with minimum odds per leg and a maximum bonus amount. | M | T |
| BON-02 | The system shall grant a welcome bonus on first deposit (percentage, cap, min deposit) credited to the bonus balance. | S | T |
| BON-03 | Bonus funds shall carry wagering requirements: turnover multiple, minimum odds, minimum selections, expiry. | S | T |
| BON-04 | Bonus funds shall convert to cash when wagering completes, and expire otherwise. | S | T |
| BON-05 | The system shall issue free bets with a fixed stake, eligibility rules and expiry; winnings exclude the stake. | S | T |
| BON-06 | The system shall support promo codes with total and per-player usage limits and date windows. | S | T |
| BON-07 | A player shall be warned, and must confirm, before a withdrawal forfeits incomplete bonus funds. | S | D |

### 4.13 Responsible gambling and AML (RG)

**Description and priority.** Protects players and prevents money laundering. Likely mandatory under the new directive. Priority: High.

**Stimulus/response.** Player sets a weekly deposit limit of 1,000 ETB → limit applies at once → a deposit that would exceed it is refused with a clear message → raising the limit takes effect only after 24 hours.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| RG-01 | Players shall be able to set daily, weekly and monthly limits on deposits, stakes and net losses; decreases apply immediately, increases after 24 hours. | M | T |
| RG-02 | Players shall be able to self-exclude for 6 months, 1 year, 5 years or permanently; exclusion blocks login-to-bet, deposits and marketing within 1 minute, and remaining funds can be withdrawn. | M | T |
| RG-03 | Players shall be able to take a short break (24 h, 7 days, 30 days). | S | T |
| RG-04 | The system shall show a reality-check reminder after a configurable session length (default 60 min) with time played and net result. | S | D |
| RG-05 | The system shall display responsible-gambling information and a helpline link on every page footer and in the app menu. | M | I |
| RG-06 | The AML engine shall raise alerts for: single deposits or withdrawals over a threshold, deposits withdrawn with little betting, many small deposits (structuring), payout account changes, and matches to a watch list. | M | T |
| RG-07 | Alerted withdrawals shall be held until a compliance officer clears them. | M | T |
| RG-08 | All RG and AML actions shall be recorded in the audit log. | M | I |

### 4.14 Notifications (NOT)

**Description and priority.** Tells players about their money and bets through push, SMS and an in-app inbox. Priority: Medium.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| NOT-01 | The system shall send a push notification when a bet is settled as won, and when a deposit or withdrawal completes or fails. | M | T |
| NOT-02 | The system shall send SMS for OTPs, withdrawals and security events, using a primary and a fallback SMS provider. | M | T |
| NOT-03 | The system shall keep an in-app inbox with read/unread state. | M | D |
| NOT-04 | Marketing messages shall only go to players who opted in, not to self-excluded players, and not between 22:00 and 07:00 EAT. | M | T |
| NOT-05 | Message templates shall exist in Amharic and English with variables. | M | I |

### 4.15 Back office (BO)

**Description and priority.** The web console staff use to run the operation. Priority: High.

| ID | Area | Requirement | Pri | Ver |
| --- | --- | --- | --- | --- |
| BO-01 | Access | Role-based access for support, trader, finance, compliance, marketing and admin, with least privilege and per-role permission sets. | M | T |
| BO-02 | Access | Staff login with password plus TOTP two-factor authentication; session timeout 30 min idle. | M | T |
| BO-03 | Players | Player 360°: profile, KYC, balances, transactions, bets, limits, notes, devices, AML alerts. | M | D |
| BO-04 | Players | Search players by phone, name, ID number, ticket ID. | M | T |
| BO-05 | Players | Suspend or close accounts, reset passwords, change status, with reason and audit. | M | T |
| BO-06 | Trading (BO-T) | Real-time liability per outcome, market, fixture and sport, including accumulator exposure. | M | T |
| BO-07 | Trading | Set max stake and max liability per sport, league, fixture, market and player; set margin per sport. | M | T |
| BO-08 | Trading | Suspend or reopen fixtures and markets manually. | M | D |
| BO-09 | Trading | Alerts for large bets, liability thresholds and players with abnormal win patterns. | M | T |
| BO-10 | Trading | Manual settlement and resettlement with 4-eyes approval (SET-05). | M | D |
| BO-11 | Finance | Deposit and withdrawal lists, withdrawal approval queue, reconciliation reports and breaks. | M | D |
| BO-12 | Finance | Daily and monthly reports: turnover, GGR, bonuses, taxes, by sport and channel; export CSV/XLSX. | M | T |
| BO-13 | Compliance | KYC review queue, AML alert queue, RG cases, regulator exports. | M | D |
| BO-14 | Marketing | CMS for banners, promo pages and help content in both languages, with scheduling. | M | D |
| BO-15 | Marketing | Create and manage bonus rules and promo codes (4.12). | S | D |
| BO-16 | Admin | Manage staff users, roles, configuration (4.18), and view the audit log. | M | D |

### 4.16 Regulatory reporting and audit (REP)

**Description and priority.** Sends the regulator a complete, timely record of betting and money, and keeps an immutable audit trail. The exact interface depends on the new directive (TBD-2), so it is isolated in its own service with an adapter. Priority: High.

**Stimulus/response.** A bet is placed → the betting module writes the bet and an outbox record in the same transaction → the reporter service reads the outbox, transforms the record to the regulator format, sends it, and marks it acknowledged; failures are retried with backoff and never dropped.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| REP-01 | The system shall record reportable events (registration, KYC change, deposit, withdrawal, bet placed, bet settled, bet voided, balance adjustment, self-exclusion) in a transactional outbox. | M | T |
| REP-02 | The reporter shall deliver each event to the regulator interface within the directive's deadline (target under 60 seconds), with at-least-once delivery and regulator-side de-duplication by event ID. | M | T |
| REP-03 | The system shall generate daily and monthly summary reports (turnover, winnings, GGR, taxes, levy, active players) that reconcile to the ledger to the santim. | M | T |
| REP-04 | The system shall compute and record the regulator levy and taxes per bet, per the tenant tax configuration. | M | T |
| REP-05 | The system shall keep an append-only audit log of staff logins, data access to player records, configuration changes, manual adjustments and settlements, with actor, time, IP, before and after values. | M | I |
| REP-06 | Audit logs, ledger and bet records shall be retained at least 7 years or as the directive requires. | M | I |
| REP-07 | The system shall produce on-demand exports for the regulator: player list with KYC status, self-exclusions, limits, and full history for a named player. | M | D |

### 4.17 Virtual games — Release 2 (VRT)

**Description and priority.** Adds virtual football and other virtual sports from one licensed provider, played inside the app with the Platform wallet. The provider runs the games, video and RNG on its remote game server; the Platform handles the player, wallet, limits and reporting. Online only in Release 2; shop terminals do not offer virtual games yet. Priority: High for Release 2.

**Stimulus/response.**

1. Player opens Virtuals and picks Virtual League → system checks the product is enabled and the player is eligible, then requests a launch session from the provider and opens the returned game URL in an embedded view.
2. Player places a virtual bet in the game → provider calls the Platform's debit callback → system checks balance and RG limits, debits the stake and returns the new balance.
3. The virtual event finishes → provider calls the credit callback with winnings (or a zero credit for a loss) → system credits the wallet.
4. Provider cancels a round → provider calls rollback → system reverses the debit.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| VRT-01 | The system shall integrate one virtual-games provider through its launch API and a seamless-wallet interface (balance, debit, credit, rollback). | M | T |
| VRT-02 | Wallet callbacks shall be authenticated (signature or token plus IP allow-list), idempotent by provider transaction ID, and answered within 300 ms at p95. | M | T |
| VRT-03 | The system shall link every virtual transaction to the provider's round ID and game ID and store the provider's request and response. | M | I |
| VRT-04 | RG limits and self-exclusion shall apply to virtual stakes and losses exactly as to sports bets. | M | T |
| VRT-05 | The system shall show a virtual-games lobby with the provider's games, enabled and ordered from the back office. | M | D |
| VRT-06 | The system shall reconcile daily the Platform's virtual transactions against the provider's report and raise breaks. | M | T |
| VRT-07 | Virtual-game turnover, winnings and GGR shall be reported to the regulator separately from sports betting. | M | T |
| VRT-08 | The system shall let operators turn virtual games off entirely by configuration. | M | T |
| VRT-09 | The provider's RNG shall hold a current certificate from an accredited test lab (e.g. GLI or BMM) for the games offered. | M | I |
| VRT-10 | The launch view shall work on a 3G connection; the provider's lite mode shall be used where available. | S | D |

### 4.18 System configuration (CFG)

**Description and priority.** Makes business rules data, not code, and prepares for more operators later. Priority: High.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| CFG-01 | The system shall store per-tenant configuration: branding, domains, languages, currency, min/max stake, max win, max legs, tax rules, bonus tables, payment methods and limits, enabled sports and products, legal texts. | M | I |
| CFG-02 | Configuration changes shall be versioned, audited, and applied without redeployment. | M | T |
| CFG-03 | Every request shall resolve a tenant from the domain or API key and every data access shall be scoped to it. | M | T |
| CFG-04 | A global real-money switch shall block deposits, bets and withdrawals when no valid licence is configured (DC-5). | M | T |
| CFG-05 | Feature flags shall allow products (sports, virtuals) and features (booking codes, bonuses) to be enabled per tenant. | M | T |

### 4.19 Retail shops — terminals and cashier POS (RET)

**Description and priority.** Lets an operator sell pre-match bets for cash in shops. Customers build a slip on a self-service terminal without logging in and get a slip code; the cashier loads the code, takes the cash and prints a ticket; winners are paid at the counter by scanning the ticket. Design: Technical Design C19. Priority: High for Release 1 (behind its own switch, so the online launch does not depend on it).

**Stimulus/response.**

1. Customer builds a slip on a terminal and taps Get code → system stores the selections and shows an 8-digit slip code and QR code, then clears the terminal.
2. Cashier enters or scans the code → system returns the legs at current odds, marks changed and unavailable legs.
3. Cashier enters the stake and presses Sell → system runs placement with shop limits, records the retail ticket, posts the cash to the shop, and returns a receipt that prints at once.
4. Customer returns with a winning ticket; cashier scans it → system checks status, location rule and thresholds, pays it once and records the payout against the shift.
5. Cashier closes the shift with a cash count → system produces a Z report with the variance.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| RET-01 | The system shall model each tenant's retail network as agents and shops: every shop belongs to exactly one agent and every agent to the tenant (one agent level; no master agents in Phase 1). An agent is a partner agent or a brand agent, which holds the shops the brand runs itself. Terminals, cashiers and shop managers are attached to shops. Creating a shop without an agent, or an agent under another agent, shall be refused. | M | T |
| RET-02 | A terminal shall be activated once with a one-time code and bound to its shop and a browser device key; revoking it shall take effect on its next request. | M | T |
| RET-03 | A terminal shall let anyone browse enabled sports and build a slip without logging in, and shall never place bets, hold money or show player data. | M | T |
| RET-04 | On request, a terminal shall obtain an 8-digit slip code, valid until the earlier of the configured lifetime and the first leg's start, show it with a QR code, and then reset; an idle terminal shall reset after the configured time. | M | T |
| RET-05 | Cashiers and shop managers shall log in with username and PIN only from an activated POS device of their own shop; 5 failed PINs shall lock the account. | M | T |
| RET-06 | A cashier shall open a shift with a counted opening cash amount before selling, and the system shall maintain the shift's expected cash after every movement. | M | T |
| RET-07 | Loading a slip code shall re-price every leg from the current catalogue, highlight changed odds and remove started or suspended legs. Selling shall run the standard placement checks with retail and shop limits, record the ticket with channel, shop, terminal, cashier and shift, and mark the code consumed. | M | T |
| RET-08 | Every sold ticket shall print a receipt with the ticket ID and check character, a barcode carrying an HMAC, legs and odds, stake, taxes, potential win, claim deadline and shop; reprints shall be marked COPY and logged. | M | D |
| RET-09 | Scanning a ticket shall show its status. The system shall pay a won or void ticket exactly once, only where the configured location rule allows, capturing the customer's ID above the ID threshold and requiring head-office approval above the approval threshold. | M | T |
| RET-10 | A cashier shall cancel a ticket only within the configured window after sale, before the first leg starts, in the same open shift and within the daily cancel limit; other cancels need a shop manager or head office. Every cancel shall be audited. | M | T |
| RET-11 | Closing a shift shall require a count by denomination and produce a Z report with expected cash, counted cash and variance; variances above the threshold shall alert the agent. | M | T |
| RET-12 | Sales in a shop shall be blocked while its cash held exceeds the shop's maximum, and payouts shall respect the shop's daily payout cap. | M | T |
| RET-13 | Every retail money movement (sale, win, void, cancel, payout, unclaimed, float, settlement, commission) shall be posted double-entry to shop and agent accounts, and the nightly shop invariants shall hold. | M | T, A |
| RET-14 | Every retail sale, payout and cancel shall be reported to the regulator with channel, shop (and outlet licence reference), terminal and cashier. | M | T |
| RET-15 | When the API cannot be reached, the POS shall block sell, pay and cancel and show the connection state; nothing shall be sold offline. | M | T |
| RET-16 | Winning or void tickets not claimed within the configured claim period shall expire and be posted as unclaimed winnings. | M | T |
| RET-17 | ESC/POS printing and cash-drawer control through a local print bridge. | S (P1) | D |

### 4.20 Agents (AGT)

**Description and priority.** Gives agents a web portal to run their shops and settle cash with the operator, and pays them commission. Every shop has an agent: the brand's own shops sit under a brand agent, which works like any other agent but settles straight to the brand's bank and earns no commission unless the brand sets a plan. Design: Technical Design C19, `platform-retail-hierarchy.md`. Priority: High for Release 1.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| AGT-01 | An agent shall see only its own shops: their status and today's and period figures (turnover, payouts, cancels, GGR, cash held, open shifts). | M | T |
| AGT-02 | An agent shall be able to add and deactivate cashiers and terminals in its own shops; shop limits and commission plans shall be changed only by the operator. | M | T |
| AGT-03 | Cash collected from a shop shall be recorded by the agent and confirmed by the shop manager before it is posted; unconfirmed or disputed settlements shall be flagged. Settlements from agent to operator shall carry a bank or payment reference. A brand agent's collected cash shall go straight to the brand's bank account. | M | T |
| AGT-04 | Float given to a shop for payouts shall be recorded and confirmed the same way. | M | T |
| AGT-05 | The system shall calculate commission weekly per agent or shop from its plan (net revenue or turnover, tiers, negative carry-forward), produce PDF and CSV statements, and accrue commission in the ledger. An agent or shop without a plan (usually a brand agent) shall accrue nothing. | M | T |
| AGT-06 | Agents shall log in with phone, password and OTP; all agent actions shall be audited. | M | T |
| AGT-07 | Agents shall be able to take cash from online players and credit their wallets (agent-assisted deposits). | S (P1) | T |

### 4.21 Platform (PLT)

**Description and priority.** The company that runs the Platform creates and runs brands (tenants) from a platform console that is separate from every brand's back office. Platform staff see each brand's status and totals, never its players, bets or money. Design: `platform-retail-hierarchy.md`, Technical Design C16 (section 9), C01, C13. Priority: High for Release 1; how much of it is needed on day one depends on how many brands are live at launch (open question Q5).

**Stimulus/response.** Platform staff enter a new brand's legal name, code, licence, domains, branding and languages and its first admin's email → system creates the tenant in `setup` with configuration version 1 from a template and emails the invitation → the brand's admin signs in to its back office and prepares the brand → platform staff set the brand `active`, and real money is on while its licence is valid.

| ID | Requirement | Pri | Ver |
| --- | --- | --- | --- |
| PLT-01 | Platform staff shall create a brand with legal name, code, licence number and expiry, a domain for each app (player web, API, back office, terminal, POS, agent portal), branding and languages, a first configuration version from a template, and the brand's first back-office admin, invited by email. Repeating a creation shall not create a second brand. | M | T |
| PLT-02 | Platform staff shall move a brand between setup, active and suspended, with a reason; real money shall be enabled only for an active brand with a valid licence (CFG-04). | M | T |
| PLT-03 | Platform staff shall set feature flags per brand and read its configuration versions; after creation only the brand activates configuration versions (four-eyes for betting, payments and RG). | M | T |
| PLT-04 | Platform staff shall see, per brand, its status, licence expiry (with a warning before it), active configuration version, health, active players, turnover and GGR. | M | D |
| PLT-05 | Platform staff shall log in with password plus TOTP and receive a token of their own audience that is not tied to a tenant; a platform token shall be refused by every brand endpoint and a brand token by every platform endpoint. | M | T |
| PLT-06 | Platform staff shall not see players' personal data, bets or money within a brand, only the aggregates in PLT-04 (open question Q4: access granted by a brand). | M | T |
| PLT-07 | Every platform action shall be audited with actor, time, IP, the brand it touched, and before and after values. | M | T |
| PLT-08 | If the Platform charges brands by GGR or by outlet (open question Q1), the system shall produce a monthly platform statement per brand from the brand's reported totals, and shall never post it to the brand's ledger. | S | T |

## 5. Non-functional requirements

The load profile is sized for Release 1 plus 3x headroom. Peak is assumed to be a Saturday of European football:

- 50,000 concurrent users.
- 150 bets per second sustained.
- 600 bets per second for 5 minutes before the 17:00 and 19:30 EAT kick-offs.

### 5.1 Performance

| ID | Requirement | Ver |
| --- | --- | --- |
| NFR-P1 | Bet placement p95 < 800 ms, p99 < 1.5 s at peak. | T |
| NFR-P2 | Catalogue and match-detail API p95 < 200 ms at the origin; dictionary and fixture lists served from CDN cache where possible. | T |
| NFR-P3 | Wallet callback (virtual games) p95 < 300 ms. | T |
| NFR-P4 | Odds change visible in the API < 2 s after receipt from the provider (pre-match). | T |
| NFR-P5 | App cold start to usable home < 3 s on a mid-range Android on 3G; home screen data < 300 KB; APK < 25 MB. | T |
| NFR-P6 | Settlement of a fixture with 10,000 open bets completes in < 60 s. | T |
| NFR-P7 | Player web: first-load JavaScript on the home page < 150 KB gzip; Largest Contentful Paint < 2.5 s on throttled 3G; repeat visits load the app shell from the service worker. Enforced in CI (size-limit, Lighthouse CI). | T |
| NFR-P8 | Cashier POS: barcode scan to ticket status < 1 s p95; Sell to receipt printing < 3 s p95 on a shop 4G link. | T |

### 5.2 Safety and money integrity

| ID | Requirement | Ver |
| --- | --- | --- |
| NFR-S1 | No money may be created or lost by any failure: all postings are ACID; the ledger balances at every commit. | T, A |
| NFR-S2 | Every money-moving API is idempotent; retries never double-post. | T |
| NFR-S3 | On feed failure the system suspends markets rather than accept bets on stale odds. | T |
| NFR-S4 | Daily reconciliation must show zero unexplained breaks; any break pages on-call. | T |

### 5.3 Security

| ID | Requirement | Ver |
| --- | --- | --- |
| NFR-SEC1 | The system shall meet OWASP ASVS 4.0 level 2. | I, T |
| NFR-SEC2 | TLS 1.2+ for all traffic; HSTS; certificate pinning in the mobile app. | I |
| NFR-SEC3 | Personal data (ID numbers, documents, phone) encrypted at rest with keys in a managed KMS/HSM; field-level encryption for ID numbers. | I |
| NFR-SEC4 | No secrets in client code or repositories; secrets in a vault with rotation. | I |
| NFR-SEC5 | Web sessions use httpOnly, Secure, SameSite cookies; mobile tokens in the platform keystore. | I |
| NFR-SEC6 | Rate limits and bot protection on login, OTP, registration, booking and bet endpoints; WAF and DDoS protection at the edge. | T |
| NFR-SEC7 | Staff access requires 2FA; production database access only through audited break-glass accounts. | I |
| NFR-SEC8 | Independent penetration test before launch and yearly; no open high or critical findings at launch. | I |
| NFR-SEC9 | Device fingerprinting to detect multi-accounting and bonus abuse. | T |

### 5.4 Reliability and availability

| ID | Requirement | Ver |
| --- | --- | --- |
| NFR-R1 | Availability 99.9% per month for betting, wallet and payments; 99.5% for back office. | A |
| NFR-R2 | Recovery point objective 0 for ledger and bets (synchronous replica); recovery time objective 30 minutes. | T |
| NFR-R3 | Planned maintenance only 03:00–09:00 EAT and never during featured fixtures. | I |
| NFR-R4 | Loss of one availability zone or node shall not stop betting. | T |

### 5.5 Other quality attributes

| ID | Attribute | Requirement | Ver |
| --- | --- | --- | --- |
| NFR-Q1 | Usability | Amharic and English complete at launch; key journeys tested with 10+ real users; WCAG 2.1 AA contrast. | D |
| NFR-Q2 | Maintainability | Module boundaries checked in CI; 80% unit-test coverage for slip calculator, ledger, settlement; OpenAPI contracts versioned. | I |
| NFR-Q3 | Observability | Distributed tracing from app to ledger; dashboards and alerts for error rate, latency, feed lag, payment success rate, reconciliation. | D |
| NFR-Q4 | Scalability | Stateless API nodes scale horizontally; feed service and database scale independently. | T |
| NFR-Q5 | Portability | Runs on any Kubernetes; no cloud-specific services on the money path, so it can move to an Ethiopian data centre. | I |
| NFR-Q6 | Privacy | Consent records, data-subject requests answered within 30 days, data minimisation, per Proclamation 1321/2024. | I |

### 5.6 Business rules

Defaults below are configurable per tenant and must be confirmed against the new directive.

| ID | Rule | Default |
| --- | --- | --- |
| BR-01 | Minimum age | 21 |
| BR-02 | Minimum stake / maximum stake per bet | 5 ETB / 50,000 ETB |
| BR-03 | Maximum payout per bet | 1,000,000 ETB |
| BR-04 | Maximum selections per accumulator | 30 |
| BR-05 | Minimum odds per leg to count for accumulator bonus | 1.30 |
| BR-06 | Accumulator bonus table | 3 legs 3%, 5 legs 8%, 8 legs 15%, 10 legs 25%, 15 legs 50%, 20+ legs 100% (placeholder) |
| BR-07 | Taxes and regulator levy | Rates from the directive (TBD-1); engine supports stake tax, win tax, withholding tax and turnover levy with thresholds |
| BR-08 | Deposit min / max | 20 ETB / 100,000 ETB per transaction |
| BR-09 | Withdrawal auto-approve limit | 10,000 ETB |
| BR-10 | Booking code validity | 24 hours or first kick-off |
| BR-11 | Bet void rules | Abandoned or postponed > 48 h → void; otherwise per provider settlement and published betting rules |

## 6. Other requirements

| ID | Requirement |
| --- | --- |
| OR-1 | **Localisation**: all player text in Amharic and English from resource files; numbers use Latin digits; dates shown Gregorian by default, with an Ethiopian-calendar option. |
| OR-2 | **Legal content**: terms, privacy notice, betting rules and RG pages are versioned; players re-accept on material change. |
| OR-3 | **Data retention**: player data kept while the account is open plus 7 years (or as the directive requires); raw feed messages 90 days; application logs 90 days. |
| OR-4 | **Data residency**: if the directive requires local hosting, production data stays in Ethiopia (NFR-Q5). |
| OR-5 | **Accessibility of odds display**: decimal odds, 2 decimals, never rounded up. |

## Appendix A — State models

&#91;embedded content: State models · bet, deposit, withdrawal, virtual round\]

Green states pay the player; red states end without payout. A settled bet returns to Open on a provider rollback (SET-04), so settlement entries are always reversible. Withdrawal funds sit in the locked balance from Requested until Paid, and return to cash if Rejected. Every transition is timestamped, attributed and written to the regulator outbox (REP-01).

## Appendix B — Core data entities

Except the global tenancy, platform, feed and catalogue tables (Technical Design TD-02), every table carries `tenant_id`, `created_at` and `updated_at`; money is integer santim; IDs are UUIDv7 except ticket IDs.

| Entity | Key attributes | Owner feature |
| --- | --- | --- |
| player | id, phone, name, dob, national\_id (encrypted), kyc\_status, status, language, risk\_segment | REG, KYC |
| device / session | player\_id, device\_fingerprint, refresh\_token\_hash, fcm\_token, last\_seen | REG |
| kyc\_case | player\_id, method (fayda, manual), documents, decision, reviewer | KYC |
| account | owner\_type, owner\_id, kind (cash, bonus, locked, house …), currency | WAL |
| ledger\_txn / ledger\_entry | txn: type, idempotency\_key, reference; entry: account\_id, amount ±, balance\_after | WAL |
| payment | player\_id, provider, direction, amount, status, merchant\_ref, provider\_ref, raw payloads | DEP, WDR |
| sport / category / tournament / competitor | provider\_urn, i18n names, enabled, order | FEED, CAT |
| fixture | provider\_urn, tournament\_id, home, away, start\_time, status | FEED, CAT |
| market\_template | provider\_market\_id, name\_template, outcome templates, group | FEED |
| market / outcome | fixture\_id, template\_id, specifiers, status; odds, active, result, void\_factor | FEED, SET |
| bet / bet\_selection | ticket\_id, player\_id, type, stake, total\_odds, bonus, taxes, status; outcome\_id, odds\_taken, result | BET, SET |
| booking | code, selections, expires\_at | BKG |
| bonus\_rule / player\_bonus / free\_bet / promo\_code | rules, wagering required/done, expiry | BON |
| rg\_limit / self\_exclusion | type, period, amount, effective\_from, until | RG |
| aml\_alert | rule, subject, status, resolution | RG |
| virtual\_round | provider, game\_id, round\_id, stake, win, status, provider\_txn\_ids | VRT |
| outbox\_event / audit\_log | event type, payload, sent\_at, ack; actor, action, before, after, ip | REP |
| tenant / tenant\_config | domain, brand, version, settings | CFG |
| agent / shop | agent: kind (brand, partner), name, commission plan; shop: agent\_id (required), code, limits | RET, AGT |
| platform\_staff / platform\_audit\_log | email, password, TOTP, status; actor, action, brand touched, before, after (global, not tenant-scoped) | PLT |

## Appendix C — To be determined

| ID | Open item | Owner | Needed by |
| --- | --- | --- | --- |
| TBD-1 | New ELS directive: permitted products, taxes and levy rates, age, advertising rules | Founder / legal | Before Gate B |
| TBD-2 | Regulator reporting interface: format, transport, deadlines | ELS | Before Gate C |
| TBD-3 | Data-residency requirement and hosting location | Legal | Before infrastructure build |
| TBD-4 | CBE Birr direct merchant API vs via aggregator | Finance | Phase 1 |
| TBD-5 | Odds provider selection and contract | Founder | Phase 0 |
| TBD-6 | Virtual-games provider selection | Founder | Release 2 start |
| TBD-7 | Fayda relying-party approval | Compliance | Before launch |

Gates and phases map to Build Plan milestones (Gate A = M1, Gate B = M2–M3, Gate C = licence and certification).

## Appendix D — Traceability (PRD → SRS)

| PRD epic | SRS feature(s) | Release |
| --- | --- | --- |
| E1 Account & identity | 4.1 REG, 4.2 KYC | 1 |
| E2 Wallet | 4.3 WAL | 1 |
| E3 Payments | 4.4 DEP, 4.5 WDR | 1 |
| E4 Sports catalogue & pre-match | 4.6 FEED, 4.7 CAT | 1 |
| E5 Bet slip & placement | 4.8 BET, 4.9 BKG | 1 |
| E7 Settlement | 4.10 SET, 4.11 HIS | 1 |
| E8 Casino & virtuals | 4.17 VRT (virtuals only) | 2 |
| E11 Bonuses | 4.12 BON | 1 |
| E12 Compliance & RG | 4.13 RG, 4.16 REP | 1 |
| E13 Trading & risk | 4.15 BO-06 to BO-10 | 1 |
| E14 Back office | 4.15 BO | 1 |
| E15 Notifications | 4.14 NOT | 1 |
| E16 Multi-tenancy | 4.18 CFG, 4.21 PLT | 1 |
| E9 Retail shops, E10 Agents | 4.19 RET, 4.20 AGT | Release 1 |
| E6 Live, casino part of E8 | Not in this SRS | Later |
