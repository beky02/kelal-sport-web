# Implementation & Integration Guide

Sep 29, 2026 · @Bereket

## 0. Overview

Build what holds the money and the rules; buy what supplies data, payments, messages and games. For Release 1 (pre-match) that means building nine components and integrating six kinds of provider. Release 2 (virtuals) adds one provider integration and a wallet gateway. Section numbers below match the SRS features they implement.

| Component | Build or buy | Why | SRS | Guide § |
| --- | --- | --- | --- | --- |
| Odds and sports data | **Buy** a feed; build the ingestion service | Compiling odds needs a trading team; every Ethiopian operator buys | FEED, CAT | 1 |
| Bet engine and slip calculator | **Build** | Core IP; taxes, bonuses and limits are local | BET, BKG | 2 |
| Settlement | **Build**, driven by the feed's results | Must post to your ledger | SET | 2 |
| Risk management | **Build** basic limits; **buy** managed trading later if volume justifies | MTS-type services cost a share of turnover | BO | 2 |
| Wallet and ledger | **Build** (optionally on an open-source ledger) | Everything depends on it; regulators audit it | WAL | 3 |
| Payments | **Buy** rails (telebirr, CBE Birr, M-Pesa, aggregator); build the adapter layer | No alternative | DEP, WDR | 4 |
| Identity, SMS, KYC, fraud | **Buy** SMS, Fayda eKYC, device fingerprinting; build flows | Standard services | REG, KYC | 5 |
| Virtual games (R2) | **Buy** a provider; build the wallet gateway | RNG and video need lab certification | VRT | 6 |
| Player apps | **Build** (Flutter app; Next.js player web, terminal, POS, agent portal, back office) | Your strength and main differentiator | UI | 7 |
| Back office | **Build** on an admin framework | Tailored to local operations | BO | 8 |
| Retail shops and agents (C19) | **Build** (terminal, POS, agent portal, shop and agent services) | White-label operators expect shops; cash and commission must post to your ledger | RET, AGT | TD C19 |
| Notifications, support, analytics | **Buy** (FCM, chat widget, analytics) | Commodity | NOT | 8 |
| Hosting, CDN, security | **Buy** infrastructure; build deployment | Commodity | NFR | 9 |

### Build order

1. **Ledger and wallet** first: every later piece writes to it, and it is the hardest to change.
2. **Odds-feed ingestion** on a trial feed: proves data mapping and recovery early.
3. **Bet engine + slip calculator + settlement**, tested by replaying recorded feed days.
4. **Registration, OTP, KYC** and **payments** (telebirr first, then CBE Birr).
5. **Flutter app and web**, then **back office** (players, trading limits, finance, CMS).
6. **Regulator reporter, RG and AML**, then hardening: load tests, penetration test, reconciliation for 14 days.
7. **Release 2**: virtual-games wallet gateway and lobby.

### Target architecture

&#91;embedded content: Target architecture for Releases 1 and 2\]

The 17 core modules (including retail, C19) map to SRS features and never read each other's tables. The three separate services run on their own because their load and failure patterns differ: the feed's message volume, the reporter's retries when the regulator is down, and the game wallet's 300 ms response budget.

## 1. Odds and sports data feed

Buy a B2B odds feed that includes settlement data, and build your own ingestion service around it. Shortlist LSports, OddsMatrix and Sportradar, and ask each for a trial. Cheap odds APIs are fine for prototypes but not for a licensed book: they lack settlement, bet stops and data rights.

### Providers

| Provider | Product | Delivery | Settlement data | SDKs / tools | Price signal | Fit |
| --- | --- | --- | --- | --- | --- | --- |
| [Sportradar / Betradar](https://docs.sportradar.com/uof/data-and-features/messages) | Unified Odds Feed (UOF); optional MTS managed trading | AMQP push (XML) + REST recovery and static data | Yes, incl. rollbacks and cancels | Official [Java](https://github.com/sportradar/UnifiedOddsSdkJava) and [.NET](https://github.com/sportradar/UnifiedOddsSdkNet) SDKs | Highest; API products from \~$1,250/month ([LSports](https://www.lsports.eu/blog/sports-data-cost/)), feed contracts higher | Industry standard; Convex brands' market format matches it |
| [LSports](https://www.lsports.eu/odds-feed/) | Trade360 (margined odds) or OddService (raw lines) | RabbitMQ push + [Snapshot API](https://docs.lsports.eu/u/trade/integration/apis/snapshot) for recovery | Yes | Official [.NET](https://github.com/lsportsltd/trade360-dotnet-sdk), [Java](https://github.com/lsportsltd/trade360-java-sdk), [Node.js](https://github.com/lsportsltd/trade360-nodejs-sdk) SDKs | Mid; not published | Strong in Africa; good value |
| [OddsMatrix (EveryMatrix)](https://oddsmatrix.com/faq/) | Bookmaker feed, 75+ sports | Push after initial dump, or pull every 30 s; XML (JSON available) | Yes, automated (\~99.99% claimed) | Connectors in Java, C#, JavaScript, PHP | Custom; **1-month free trial** | Easy to trial first |
| [FeedConstruct (BetConstruct)](https://www.feedconstruct.com/) | Odds feed + esports | Push API | Yes | Vendor tools | Custom | Popular in emerging markets |
| [Genius Sports](https://www.geniussports.com/) | Official league data and odds | Push API | Yes | Vendor tools | Premium | Official data rights; enterprise |
| [Kambi](https://www.kambi.com/) | Odds Feed+ | API | Yes | — | Enterprise | Usually sold with its full sportsbook |
| [BetsAPI](https://betsapi.com/docs/), [The Odds API](https://the-odds-api.com/) | Aggregated bookmaker odds | REST pull | Limited / none | — | Low (from tens of dollars/month) | Prototyping and demos only |

### How a push feed works

The provider pushes a stream of messages to your queue consumer. Using Sportradar UOF as the reference model:

| Message | Meaning | Your action |
| --- | --- | --- |
| `odds_change` | New prices and market status for a fixture | Update odds store; publish event |
| `bet_stop` | Suspend a group of markets now | Suspend within 1 s (FEED-04) |
| `bet_settlement` | Results per outcome (win, lose, void factor) | Record; trigger settlement |
| `rollback_bet_settlement` | A settlement was wrong | Reverse and reopen bets |
| `bet_cancel` / `rollback_bet_cancel` | Void markets for a period / undo | Void or restore affected selections |
| `fixture_change` | Start time, status or new fixture | Refresh fixture from REST |
| `alive` | Heartbeat per producer | Missing or `subscribed=0` → suspend and recover |
| `snapshot_complete` | Recovery request finished | Apply queued stateful messages, reopen |

Recovery: after an outage you call the provider's recovery endpoint with the timestamp of the last message you processed. Sportradar allows up to 72 hours back for most producers (10 hours for live odds). The provider replays current odds, then sends `snapshot_complete`. Until then, markets stay suspended ([Sportradar recovery docs](https://docs.sportradar.com/uof/error-handling/recovery-using-api)). LSports uses its Snapshot API the same way, with a `timestamp` filter.

### Integration steps

1. **Contract and trial**: get test credentials, the AMQP host, your bookmaker ID and an API token. Ask for sports and league coverage lists and Amharic-name support (usually none: you translate).
2. **Static data load**: through REST, load sports, categories, tournaments, market descriptions (templates with specifiers) and the fixture schedule for the next 3–14 days. Refresh daily.
3. **Consumer service**: if your backend is Java or .NET, use the official SDK (it handles parsing, recovery and caching). Otherwise, write a RabbitMQ/AMQP consumer in Python with aio-pika (the feed service) with separate queues for high-priority (odds, bet stops) and stateful (settlements) messages.
4. **Persist, then act**: save the raw message with a receipt timestamp, then map provider IDs to internal IDs, upsert fixtures, markets and odds, write current odds to Redis, and publish an internal event. Acknowledge only after the write.
5. **Health and recovery**: track heartbeats per producer; on loss, suspend that producer's markets, reconnect, run recovery, and reopen after the snapshot.
6. **Margins**: apply your margin on top of provider odds per sport (FEED-08); keep both raw and final odds.
7. **Settlement hand-off**: settlement messages go to a durable queue consumed by the settlement module (Guide §2).
8. **Provider certification**: most providers test your integration (recovery, bet stops) before switching on production.

### Pitfalls

- **Market templates**: names like `{$competitor1} ({hcp})` or `Total {total}` need specifier substitution; some markets are “variant” markets whose outcomes come from a separate endpoint.
- **Ordering**: process per fixture in order; drop updates older than the stored timestamp.
- **Postponed and abandoned matches**: follow your published rules (BR-11) and the provider's cancel messages.
- **Translation**: providers rarely supply Amharic; budget for translating \~200 common market templates and team names on demand.
- **Data volume**: pre-match feeds send millions of messages a day. Filter by sport and league at subscription, and store raw data in cheap storage.
- **Test with replays**: record a full weekend of messages and replay them in CI to test settlement.

## 2. Bet engine, settlement and risk

Build these yourself. They are your core logic, and local tax and bonus rules make off-the-shelf engines awkward. Keep them as pure functions with no I/O, so every rule is unit-testable and the same code (or a ported copy) runs in the app preview.

### 2.1 Slip calculator

A pure function takes selections, stake, bet type and a tenant rule set, and returns a breakdown.

```
calculate(selections, stake, betType, rules) → {
  totalOdds, combinations, stakeTax, netStake, grossWin,
  accumulatorBonus, winTax, withholdingTax, netPayout, cappedBy
}
```

- **Decimal maths**: use a decimal library (Python decimal / fractions on the server, Go `shopspring/decimal`, Java `BigDecimal`, JS `decimal.js`; Dart `decimal` in Flutter). Round only at the end, half-down for payouts. The golden rules use exact arithmetic (Engineering Decisions D1).
- **System bets**: enumerate combinations (n choose k); each is a sub-bet with stake = total stake ÷ combinations.
- **Taxes**: model each tax as a rule (base = stake, win or net win; rate; threshold; order of application) so the directive's rates are configuration.
- **Golden tests**: contracts/golden/slips.csv (366 rows), run by pytest, Dart tests and Vitest, so preview and server never disagree (BET-07).

### 2.2 Placement pipeline

1. **Authenticate**, then load the player's status, limits and risk segment (from cache).
2. **Check idempotency**: if the key was seen, return the stored response.
3. **Validate**: slip shape, related selections, stake limits, RG limits.
4. **Re-price**: read current odds and status from Redis; apply the odds-change policy; on a move, return 409 with new odds.
5. **Risk check**: compute the new liability per outcome and fixture and compare with limits. Use Redis counters updated atomically, for example a Lua script, or a per-fixture lock.
6. **Commit in one database transaction**: debit the stake (ledger), insert the bet and its selections, write outbox events for reporting and notifications.
7. **Respond** with the ticket.

Target: under 800 ms at p95. Most time goes to steps 4 and 6, so keep odds and limits in memory.

### 2.3 Settlement

- Consume settlement messages; store the result per outcome with `void_factor` (0, 0.5 or 1) and the feed's certainty flag.
- Find open selections on those outcomes (index `bet_selection(outcome_id, status)`), recompute each affected bet, and settle when all legs are resolved.
- Post winnings, bonus and tax entries in one ledger transaction per bet, idempotent by `(bet_id, settlement_version)`.
- Rollbacks: reverse the entries of that version, set the bet back to open, and wait for the next settlement.
- Batch by fixture: a popular match can have 10,000+ open bets, so process in chunks with a worker pool.

### 2.4 Risk management

| Level | What it is | When |
| --- | --- | --- |
| Built-in limits (Release 1) | Max stake, max win and max liability per player, market, fixture, sport; margin per sport; suspension tools; large-bet alerts | Launch |
| Player profiling | Segment players by closing-line value and win rate; lower their limits | 3–6 months after launch |
| Managed trading service | [Sportradar MTS](https://sportradar.com/betting-gaming/trading-risk-management/managed-trading-services/) accepts or rejects each ticket in real time, sets personalised bet delays and profiles customers, via its [Java](https://github.com/sportradar/MtsSdkJava) / [.NET](https://github.com/sportradar/MtsSdkNet) SDKs. LSports offers a similar managed trading service. | When turnover justifies the fee |

Pre-match risk is lower than live, so built-in limits are enough for Release 1 if you keep conservative max-win caps and watch sharp bettors.

## 3. Wallet and ledger

Build a double-entry ledger in PostgreSQL. It is a few hundred lines of carefully tested code, and it is the part auditors and the regulator will inspect. Consider an open-source ledger engine only if you outgrow PostgreSQL.

### Design

- **Accounts** per owner and kind: `player:cash`, `player:bonus`, `player:locked`, plus house accounts `HOUSE_OPEN_STAKES`, `HOUSE_GGR`, `HOUSE_BONUS_COST`, `TAX_PAYABLE_STAKE / TAX_PAYABLE_WIN`, `provider:telebirr_clearing`, and so on.
- **Transactions** group two or more **entries** whose amounts sum to zero. Store `balance_after` on each entry, and a cached balance on the account row updated in the same transaction.
- **Concurrency**: lock the player's account rows (`SELECT … FOR UPDATE`) in a fixed order to avoid deadlocks. Check that funds are sufficient under the lock.
- **Idempotency**: a unique index on `(tenant_id, idempotency_key)`; on conflict, return the stored result.
- **Immutability**: no UPDATE or DELETE on entries (enforce with database permissions or a trigger); corrections are reversing transactions.

### Example postings

| Event | Debit | Credit |
| --- | --- | --- |
| Deposit 500 ETB via telebirr | provider:telebirr\_clearing 500 | player:cash 500 |
| Place bet, stake 100 | player:cash 100 | HOUSE\_OPEN\_STAKES 100 |
| Bet wins 450 gross, 15% win tax on profit (placeholder) | HOUSE\_OPEN\_STAKES 100, HOUSE\_GGR 350 | player:cash 397.50, TAX\_PAYABLE\_STAKE 52.50 |
| Bet loses | HOUSE\_OPEN\_STAKES 100 | HOUSE\_GGR 100 |
| Withdrawal requested 300 | player:cash 300 | player:locked 300 |
| Withdrawal paid | player:locked 300 | provider:telebirr\_clearing 300 |

### Libraries and engines

| Option | What it is | When to use |
| --- | --- | --- |
| Plain PostgreSQL (recommended) | Tables + transactions as above | Release 1 and well beyond |
| [TigerBeetle](https://github.com/tigerbeetle/tigerbeetle) | Purpose-built open-source financial transactions database, very high throughput, double-entry built in | Very high volume later; adds a second datastore |
| [Formance Ledger](https://github.com/formancehq/ledger) | Open-source programmable ledger service | If you want a ready ledger API |

### Reconciliation job (nightly)

1. Sum of all entries = 0; every account's cached balance = sum of its entries.
2. Per payment provider: the platform's completed payments vs the provider's settlement report or statement, matched by provider reference.
3. Ledger totals vs the regulator report totals for the day.
4. Any difference creates a break ticket and alerts finance.

## 4. Payments in Ethiopia

Integrate telebirr directly (it has the most users), and reach CBE Birr, M-Pesa and banks through one aggregator such as Chapa, until volumes justify direct contracts. Every rail sits behind one adapter interface so the wallet never knows which provider was used.

Betting is a high-risk merchant category, and in December 2025 banks and payment providers were ordered to block betting transactions. Merchant onboarding therefore depends on your ELS licence. Start the conversations early, but expect contracts only after licensing.

### Providers

| Provider | Rails | API style | Payouts (B2C) | Docs / SDKs | Notes |
| --- | --- | --- | --- | --- | --- |
| **telebirr** (Ethio Telecom) | telebirr wallet | REST; fabric token + RSA-signed order; notify-URL callback; order query | Yes (separate B2C product) | [Developer portal: H5 C2B Web Payment](https://developer.ethiotelecom.et/docs/category/h5-c2b-web-payment-integration); community libraries ([Node.js](https://github.com/Solomonkassa/Nodejs-Telebirr-Integration), [PHP](https://github.com/MelakuDemeke/telebirr-php)) | Largest wallet; direct merchant contract with Ethio Telecom |
| **M-Pesa Ethiopia** (Safaricom) | M-Pesa wallet | Daraja-style REST: OAuth token, STK push (C2B), B2C, status, reversal | Yes | [developer.safaricom.et](https://developer.safaricom.et/) | Growing; same API family as Kenya's Daraja |
| **CBE Birr** (Commercial Bank of Ethiopia) | CBE Birr wallet | No public developer portal; bank merchant agreement | Via agreement | Contact CBE digital banking | Easier through an aggregator first (TBD-4) |
| [**Chapa**](https://developer.chapa.co/integrations/webhooks) | telebirr, CBE Birr, M-Pesa, banks, cards | REST: initialize transaction → hosted checkout or direct charge → verify; HMAC-SHA256 signed webhooks | Yes: transfers to banks and wallets, bulk | Official and community SDKs (Laravel, Python, NestJS) | Best-documented aggregator; test mode |
| [**ArifPay**](https://developer.arifpay.net/) | telebirr, CBE, M-Pesa and banks | REST checkout sessions, direct payment, webhooks | Yes (B2C disbursement) | Sandbox; [Laravel package](https://packagist.org/packages/arifpay/arifpay) | Alternative aggregator |
| [**SantimPay**](https://www.santimpay.com/) | Wallet, banks, mobile money | REST gateway (docs on onboarding) | Yes | [PyPI package](https://pypi.org/project/santimPay) | Used by current betting sites (seen in HuluSport config) |
| Others: AddisPay, Kacha, FenanPay | Various | REST | Varies | On request | Seen in competitor configs; secondary options |

### Adapter interface

```
interface PaymentProvider {
  initiateDeposit(amount, player, merchantRef) → {status, nextAction: redirect | ussd_push | app_sdk, providerRef}
  queryDeposit(merchantRef) → status
  handleWebhook(rawBody, headers) → {merchantRef, status, amount, providerRef}  // verifies signature
  initiatePayout(amount, account, merchantRef) → {status, providerRef}
  queryPayout(merchantRef) → status
}
```

### telebirr flow (direct)

1. **Onboard**: sign a merchant agreement with Ethio Telecom. You receive a short code, merchant app ID, fabric app ID and app secret, and you register your RSA public key.
2. **Token**: call the “apply fabric token” API with the fabric app ID and secret; cache the token until it expires.
3. **Create order**: send the order (merchant order ID, amount, title, notify URL, redirect URL, timeout) signed with your RSA private key. The response contains a prepay ID.
4. **Checkout**: web builds a signed checkout URL and redirects; the Flutter app passes the signed request to the telebirr app or opens the web checkout.
5. **Notify**: telebirr calls your notify URL. Verify the signature with telebirr's public key, then confirm with a query-order call before crediting (DEP-04).
6. **Timeouts**: poll query-order for pending orders (DEP-06).

The community libraries above show working request signing; confirm field names against the portal for your API version.

### Chapa flow (aggregator)

1. Create a Chapa business account; get test and live secret keys; set a webhook secret.
2. `POST` initialize transaction with amount, currency ETB, your `tx_ref`, callback and return URLs; redirect the player to the returned checkout URL.
3. On the webhook, verify `Chapa-Signature` / `x-chapa-signature` as an HMAC-SHA256 of the payload with your secret, then call verify with `tx_ref` before crediting.
4. Payouts: use the transfers API to the player's bank or wallet, then confirm by webhook or the verify-transfer endpoint.

### Operational rules

- Store every raw request, response and webhook (DEP-03); never trust the client's “success” screen.
- Name-match payouts: send only to the player's verified phone or name (WDR-01).
- Keep a provider clearing account per rail in the ledger, and reconcile daily with the provider's settlement report.
- Monitor success rate per rail; switch the default rail when one degrades.

## 5. Identity, SMS, KYC and fraud prevention

Build the authentication flows yourself, send OTPs through two local SMS providers, verify identity with Fayda where you can (manual review as fallback), and add device fingerprinting against multi-accounting.

### 5.1 Authentication (build)

- Phone + OTP registration, then password login; JWT access token (15 min) + rotating refresh token (REG-07).
- Store OTPs hashed with a short expiry in Redis; rate-limit per phone, device and IP (REG-02).
- Use a well-tested library for password hashing (Argon2id) and JWT; do not hand-roll crypto.
- Optional later: an identity server such as [Keycloak](https://www.keycloak.org/) or [Ory Kratos](https://www.ory.sh/kratos/) if you add staff SSO or many tenants. For Release 1, in-app auth is simpler.

### 5.2 SMS and OTP providers

| Provider | What | Notes |
| --- | --- | --- |
| [AfroMessage](https://www.afromessage.com/) | SMS API, OTP / 2FA API, bulk campaigns | Well-known local provider; developer-friendly API |
| [SMSEthiopia](https://smsethiopia.com/) | SMS API, OTP, bulk | States direct Ethio Telecom integration and INSA licensing; 100 free test SMS |
| [GeezSMS](https://geezsms.com/) | SMS API, bulk | Local alternative |
| [SMS.to](https://sms.to/gateway/ethiopia/), [EasySendSMS](https://www.easysendsms.com/gateway/Ethiopia) | International gateways with Ethiopian delivery | Fallback route; usually higher price and weaker delivery |

Implementation: one `SmsSender` interface; primary and fallback provider; delivery-report webhook; Amharic (Unicode) templates, where one SMS part holds 70 characters instead of 160, so keep OTP texts brief; register a sender ID (brand name).

### 5.3 KYC with Fayda (national ID)

The Fayda platform exposes OTP authentication, demographic and biometric authentication, and an eKYC service to approved partners ([Fayda API specification](https://nidp.atlassian.net/wiki/spaces/FAPIQ/pages/633733136/Fayda+Platform+API+Specification)).

1. **Apply as a relying partner** through the Fayda partner portal: describe the use case (age and identity verification for a licensed betting operator). Approval gives a partner ID and API key.
2. **Test** on the development environment with the provided credentials.
3. **Flow**: player enters their Fayda number (FIN/FAN) → your server calls the OTP-request service → Fayda sends an OTP to the ID-linked phone → player enters it → your server calls the eKYC service and receives verified name, date of birth and photo.
4. **Security**: requests are JWS-signed and sensitive data is encrypted with a per-request session key (AES-GCM). Keep keys in the KMS.
5. **Store** only what you need: verification result, name, date of birth, reference; not the photo unless required.

Fallback (KYC-03): document and selfie upload reviewed in the back office. A commercial provider such as [Smile ID](https://usesmileid.com/) (African ID and liveness checks) can automate this if Fayda access is delayed; check its Ethiopian coverage.

### 5.4 Fraud and multi-accounting

| Need | Options | How it's used |
| --- | --- | --- |
| Device fingerprinting | [SEON device intelligence](https://docs.seon.io/knowledge-base/device-intelligence/block-multi-accounting-with-device-fingerprinting), [Fingerprint](https://fingerprint.com/), or open-source FingerprintJS for web | Send the device ID on register, login, deposit and withdraw; flag many accounts per device (KYC-06) |
| Bonus abuse rules | Build | Same device, ID, payout account or IP across accounts → hold bonus |
| Bot and credential stuffing | Cloudflare bot management / Turnstile | On registration, login and OTP endpoints |
| Payment fraud | Provider-side checks + name matching | Payouts only to verified owner (WDR-01) |

## 6. Virtual games (Release 2)

Buy virtual games from one provider with strong African retail and mobile presence (GoldenRace or Kiron), integrated through a seamless wallet. The provider runs the RNG, video and game rounds on its remote game server; you own the player, the wallet, the limits and the reporting.

### Providers

| Provider | Strengths | Africa presence | Integration | Link |
| --- | --- | --- | --- | --- |
| **GoldenRace** | Virtual football leagues, racing, Spin2Win-style and keno; events roughly every minute; strong retail terminals; “Big5” multi-league feed | 100+ African operators (e.g. Betika, OdiBets) | Online, mobile and retail; seamless wallet; aggregator available | [goldenrace.com](https://goldenrace.com/), [Intergame profile](https://www.intergameonline.com/sports-betting/insights/goldenrace-betting-on-africa) |
| **Kiron Interactive** | Virtual sports and numbers games; **Kiron.Lite**, a data-light product built for African mobile networks | Strong (e.g. Betika in Kenya); already used by Convex brands | BetMan RGS + customer wallet API | [Kiron.Lite with Betika](https://igamingafrika.com/kiron-interactive-and-betika-kiron-lite-partnership-drives-fast-growth-in-kenya/) |
| **Betradar Virtual Sports** (Sportradar) | Virtual football league mode, basketball, tennis; high production quality | Global | Centralised game server; fits if you already use Sportradar | [betradar.com](https://betradar.com/virtual-sports-betting/football/) |
| **GlobalBet** | Virtual sports and lottery-style games | Emerging markets | API | [globalbet.com](https://www.globalbet.com/) |
| **Leap Gaming** | Mobile-first 3D virtual racing and sports | Global | Via aggregators or direct | [leap-gaming.com](https://leap-gaming.com/) |
| **Inspired Entertainment** | Premium virtuals, huge retail base | UK and Europe mainly | Direct, heavier infrastructure | [thegamblest overview](https://www.thegamblest.com/best-virtual-sports-betting-solution-providers/) |

**Recommendation**: shortlist Kiron (for Kiron.Lite's data use) and GoldenRace (for breadth and future retail). Ask both for RNG certificates, a demo, Amharic support and revenue-share terms.

### Integration models

| Model | What you build | Time | Fit |
| --- | --- | --- | --- |
| **Seamless wallet + launch URL (recommended)** | Wallet callback endpoints, launch service, lobby | 3–5 weeks | Your wallet stays the single balance |
| Transfer wallet | Move money in/out of a provider-held balance | 2–3 weeks | Simpler, but split balances and reconciliation pain |
| Full API (you render odds and results) | Your own virtual UI from provider data | Months | Only for deep customisation |

### Seamless-wallet integration steps

1. **Contract and credentials**: operator ID, secret or certificate, callback IP ranges, staging environment.
2. **Launch**: player taps a game → your server calls the provider's session API with player ID, currency ETB, language and a one-time token → returns a game URL → open it in a Flutter WebView (web: iframe).
3. **Wallet callbacks** your gateway must implement (names differ per provider):
   - `authenticate(token)` → player ID, balance, currency
   - `balance(playerId)`
   - `debit(playerId, amount, roundId, txId)` → check RG limits and balance, post stake, return balance
   - `credit(playerId, amount, roundId, txId)` → post winnings (0 for loss, to close the round)
   - `rollback(txId)` → reverse a debit that failed on the provider side
4. **Rules**: idempotent by provider `txId`; answer under 300 ms; never 5xx on a duplicate; return the provider's error codes for insufficient funds or blocked player.
5. **Reconciliation**: download the provider's daily round report and match it with your ledger (VRT-06).
6. **Certification**: the provider runs a test suite against your endpoints before go-live.

RNG games must be certified by an accredited lab such as GLI; you cannot deploy an uncertified game ([GR8 Tech](https://gr8.tech/virtual-sports-betting-integration/)). Ask the regulator whether a local certificate is also needed.

## 7. Apps and distribution

Ship a Flutter Android app distributed as a signed APK from your website, plus a responsive Next.js web app for desktop and phone browsers. Don't plan on Google Play at launch.

### 7.1 App-store rules

- **Google Play** allows real-money gambling apps only in selected countries, after an application, with a valid local licence, age gating, geo-fencing, AO rating and no Play billing ([Play policy](https://support.google.com/googleplay/android-developer/answer/9877032?hl=en)). I found no evidence Ethiopia is on the eligible list. Apply once licensed, but plan without it.
- **Apple App Store** (guideline 5.3) requires the licence holder as publisher, geo-restriction and a free app. Consider iOS after Android is stable.
- **What competitors do**: Convex brands such as Shamo.bet list no store link and prompt players to install a PWA; direct APK download is common across African betting.

### 7.2 Android APK distribution

1. Build release APKs split per ABI (arm64-v8a, armeabi-v7a) to keep each under 25 MB (NFR-P5).
2. Sign with a key held in a hardware or cloud KMS; never rotate it casually (updates must match the signature).
3. Host on your domain behind the CDN; show a SHA-256 checksum and install instructions in Amharic.
4. Build an in-app update check (`GET /v1/app/version`) with forced-update support for security fixes.
5. Expect Play Protect warnings on sideloaded apps; clear install guidance reduces drop-off.

### 7.3 Flutter implementation notes

| Concern | Suggested packages / approach |
| --- | --- |
| State management | Riverpod or Bloc; keep the slip in its own provider |
| Networking | `dio` with interceptors for auth refresh, idempotency keys and retry on network errors (never auto-retry a bet without the same key) |
| Money and odds | `decimal` package; shared golden tests with the server (Guide §2.1) |
| Local cache | Hive or Isar for dictionary, favourites and slips; ETag-aware HTTP cache for catalogue |
| Secure storage | `flutter_secure_storage` for refresh tokens |
| Push | `firebase_messaging` (FCM) |
| Localisation | `intl` + ARB files for Amharic and English; Ethiopic-capable font (e.g. Noto Sans Ethiopic) |
| Virtual games (R2) | `webview_flutter` with JavaScript enabled for the provider's game URL |
| Telemetry | Sentry or Firebase Crashlytics; OpenTelemetry trace ID in request headers |
| Data use | Paginate everything; images as WebP from CDN; no auto-refresh of lists on 3G |

### 7.4 Mobile web

- Build every browser surface in **Next.js** (decision of 30 Sep 2026): the player web, the shop terminal, the cashier POS, the agent portal and the back office, in one pnpm/Turborepo workspace with shared packages (C18). Server Components render match lists as HTML, which keeps first loads light on 3G, makes match pages indexable and gives Telegram link previews for free. Keep first-load JavaScript under 150 KB, never rely on middleware for authorisation, and patch Next.js and React security releases within 48 hours.
- Make it installable as a PWA (manifest + service worker) for players who won't sideload an APK.
- Share the OpenAPI-generated client and the slip-calculator golden tests with the app.

### 7.5 Telegram (later)

A Telegram Mini App can reuse the Next.js web app; authenticate by verifying Telegram's `initData` signature and linking to a verified phone. Competitors already use this channel heavily.

## 8. Back office, notifications, support and analytics

### 8.1 Back office (build on a framework)

Use an admin framework rather than building screens from scratch. Every back-office action calls the same backend APIs with staff permissions, and every change writes the audit log (REP-05).

| Option | Type | Notes |
| --- | --- | --- |
| [Refine](https://refine.dev/) | Open-source React admin framework | Decided (30 Sep 2026): Refine inside Next.js. Flexible, headless; good for a custom trading screen |
| [React-admin](https://marmelab.com/react-admin/) | Open-source React admin framework | Mature, many data providers |
| Flutter web | Your existing skill | Rejected: all browser apps are Next.js |
| [Retool](https://retool.com/) / [Appsmith](https://www.appsmith.com/) | Low-code internal tools | Fast for finance and ops queues; keep money logic in your backend |

Build order inside the back office: player 360° and search → withdrawal queue → trading limits and liability → KYC and AML queues → reports → CMS → bonus builder.

### 8.2 Notifications

| Channel | Provider | Notes |
| --- | --- | --- |
| Push | [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging) (HTTP v1 API) | Free; topic and per-device messages |
| SMS | Local providers from §5.2 | Transactional only; marketing SMS needs opt-in |
| In-app inbox | Build | Table + unread count endpoint |
| Campaigns (optional) | [OneSignal](https://onesignal.com/) or build on FCM | Segments, scheduling, quiet hours (NOT-04) |

### 8.3 Customer support

- Live chat widget: [Tawk.to](https://www.tawk.to/) (free, used by competitors), [Crisp](https://crisp.chat/) or [Intercom](https://www.intercom.com/).
- Telegram support account for players who prefer it.
- Link support tickets to player IDs in the back office; never ask players for passwords or OTPs.

### 8.4 Analytics and BI

| Need | Option |
| --- | --- |
| Product analytics (funnels, retention) | [PostHog](https://posthog.com/) (open source, can self-host) or Firebase Analytics |
| BI dashboards on business data | [Metabase](https://www.metabase.com/) on a read replica; later ClickHouse for volume |
| Attribution for campaigns and affiliates | Later: an affiliate platform (competitors use Alanbase) |

Don't send personal data or balances to third-party analytics; use pseudonymous IDs (Proclamation 1321/2024).

## 9. Infrastructure and hosting

Keep the platform portable: containers, PostgreSQL, Redis and a message bus, with no cloud-only services on the money path. Then hosting can follow whatever data-residency rule the directive sets (TBD-3). Put Cloudflare in front either way.

### Hosting options

| Option | What | Pros | Cons |
| --- | --- | --- | --- |
| **Wingu.Africa**, ICT Park, Addis Ababa | Carrier-neutral Tier III colocation and cloud, \~10 MW | Local; low latency to Ethio Telecom and Safaricom users; meets residency rules | You run more yourself; hardware lead times |
| **Raxio ET1**, ICT Park, Addis Ababa | Tier III colocation | Local; IFC-backed operator | Colocation only; bring your own servers |
| **Ethio Telecom** data centres | Telecom-run hosting and cloud services | Local; close to telebirr | Fewer self-service tools |
| **AWS Cape Town (af-south-1)** or European regions, or other cloud | Managed Kubernetes, managed PostgreSQL | Fastest to start; managed backups and failover | Data leaves Ethiopia; higher latency (\~60–150 ms); may conflict with the directive |

Source: [overview of Ethiopia's data centres](https://www.lolinemag.com/articles/inside-ethiopias-data-centers-who-owns-them-where-they-are-why-they-matter); [Wingu Ethiopia](https://www.wingu.africa/markets/ethiopia); [Raxio Ethiopia](https://www.raxiogroup.com/data-centres/ethiopia/).

**Practical path**: develop and test in a managed cloud; decide production hosting once the directive states residency rules. Stateless services and infrastructure-as-code make the move a redeploy.

### Reference stack

| Layer | Choice |
| --- | --- |
| Edge | Cloudflare: DNS, CDN for catalogue and APK, WAF, DDoS protection, bot management, Turnstile |
| Compute | Kubernetes (managed, or k3s on colocated servers); 3+ nodes across 2 zones or 2 sites |
| Database | PostgreSQL 16 with a synchronous standby and point-in-time recovery (e.g. CloudNativePG on Kubernetes, or a managed service) |
| Cache | Redis with persistence and replica |
| Messaging | NATS JetStream (decided) |
| Object storage | S3-compatible (MinIO locally, or cloud) with encryption |
| Secrets | HashiCorp Vault or cloud KMS |
| CI/CD | GitHub Actions or GitLab CI → container registry → Argo CD |
| Infrastructure as code | Terraform + Helm |
| Observability | OpenTelemetry → Grafana stack (Prometheus, Loki, Tempo); Sentry; on-call via PagerDuty or Grafana OnCall |
| Backups | Nightly full + continuous WAL archiving to a second site; restore drill monthly |

### Security checklist before launch

- [ ] OWASP ASVS L2 self-assessment and fixes
- [ ] Independent penetration test (web, API, APK)
- [ ] Secrets scanning in CI; no secrets in the app bundle
- [ ] Rate limits on login, OTP, booking, bet endpoints
- [ ] Staff 2FA; least-privilege roles; production access logging
- [ ] Load test at the SRS peak profile (600 bets/s bursts, which already includes 3× headroom)
- [ ] Disaster-recovery restore test
- [ ] 14 days of clean reconciliation

## 10. Provider shortlist and next steps

| Need | First choice | Alternatives | Next action |
| --- | --- | --- | --- |
| Odds feed | LSports Trade360 | OddsMatrix (free trial), Sportradar UOF, FeedConstruct | Request trials and quotes from 3; compare coverage, settlement accuracy, price |
| Managed trading (later) | — (built-in limits) | Sportradar MTS, LSports managed trading | Revisit 6 months after launch |
| Mobile money | telebirr direct | M-Pesa Ethiopia direct | Open merchant discussions; confirm post-relaunch policy on betting merchants |
| Aggregator | Chapa | ArifPay, SantimPay | Sandbox integration now (non-betting test merchant) |
| SMS / OTP | AfroMessage (primary) | SMSEthiopia or GeezSMS (fallback) | Register sender ID; test delivery on both networks |
| KYC | Fayda eKYC | Manual review; Smile ID | Apply as relying partner |
| Device fingerprinting | SEON or Fingerprint | Open-source FingerprintJS | Trial during beta |
| Virtual games (R2) | Kiron (Kiron.Lite) | GoldenRace, Betradar Virtual Sports | Demos + RNG certificates + commercial terms |
| Hosting | Managed cloud for dev; decide production after TBD-3 | Wingu.Africa, Raxio, Ethio Telecom | Get colocation quotes |
| Edge / security | Cloudflare | — | Set up at project start |

### First 30 days

- [ ] Register the operating company and prepare the licence application checklist (watch for the directive).
- [ ] Request odds-feed trials; start the ingestion prototype on the trial feed.
- [ ] Build the ledger and slip calculator with golden tests.
- [ ] Chapa sandbox deposit and payout end to end.
- [ ] AfroMessage OTP working in the Flutter app.
- [ ] Fayda partner application submitted.

### Sources

- Sportradar UOF: [messages](https://docs.sportradar.com/uof/data-and-features/messages), [recovery](https://docs.sportradar.com/uof/error-handling/recovery-using-api); [MTS](https://sportradar.com/betting-gaming/trading-risk-management/managed-trading-services/)
- LSports: [Snapshot API](https://docs.lsports.eu/u/trade/integration/apis/snapshot), [.NET SDK](https://github.com/lsportsltd/trade360-dotnet-sdk); [sports data cost](https://www.lsports.eu/blog/sports-data-cost/); [betting API comparison](https://www.lsports.eu/blog/sports-betting-apis/)
- [OddsMatrix FAQ](https://oddsmatrix.com/faq/)
- telebirr [developer portal](https://developer.ethiotelecom.et/docs/category/h5-c2b-web-payment-integration); [Chapa webhooks](https://developer.chapa.co/integrations/webhooks); [ArifPay developer portal](https://developer.arifpay.net/); [M-Pesa Ethiopia developer portal](https://developer.safaricom.et/)
- [Fayda Platform API specification](https://nidp.atlassian.net/wiki/spaces/FAPIQ/pages/633733136/Fayda+Platform+API+Specification)
- [AfroMessage](https://www.afromessage.com/), [SMSEthiopia](https://smsethiopia.com/)
- Virtuals: [GoldenRace in Africa](https://www.intergameonline.com/sports-betting/insights/goldenrace-betting-on-africa), [Kiron.Lite](https://igamingafrika.com/kiron-interactive-and-betika-kiron-lite-partnership-drives-fast-growth-in-kenya/), [provider overview](https://www.thegamblest.com/best-virtual-sports-betting-solution-providers/), [integration models](https://gr8.tech/virtual-sports-betting-integration/)
- [Google Play real-money gambling policy](https://support.google.com/googleplay/android-developer/answer/9877032?hl=en)
- [Ethiopia's data centres](https://www.lolinemag.com/articles/inside-ethiopias-data-centers-who-owns-them-where-they-are-why-they-matter)
- [SEON device fingerprinting](https://docs.seon.io/knowledge-base/device-intelligence/block-multi-accounting-with-device-fingerprinting)
