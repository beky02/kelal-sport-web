# Technical Design

This section is the engineering blueprint for Releases 1 and 2. It turns the SRS into buildable components: each has its own page with the same structure, so a developer (or a coding agent) can implement one component from its page alone.

**Stack decision.** Python 3.12 + FastAPI modular monolith, PostgreSQL 16, Redis 7, NATS JetStream; Flutter for the Android app and Next.js for every browser client (player web, shop terminal, cashier POS, agent portal, back office); Cloudflare at the edge. It matches your existing stack (FastAPI + Postgres modular monolith, Flutter). Python comfortably meets the load targets (150 bets/s sustained, 600/s bursts) with async I/O, a connection pooler and horizontal scaling. The feed consumer is the one place where Go could later be swapped in if message volume demands it.

## Pages

| Page | Contents |
| --- | --- |
| TD-00 Architecture | Principles, container and deployment views, bet request flow, repository layout, module rules, cross-cutting concerns |
| TD-01 API Standards | Conventions (auth, errors, idempotency, pagination, versioning, caching) and the full endpoint catalogue |
| TD-02 Data Architecture | Schemas per module, entity map, naming and money conventions, partitioning, retention, Redis keys, event catalogue |
| C01–C19 | One page per component (below) |
| TD-90 Infrastructure, Security & Ops | Environments, deployment, CI/CD, secrets, security controls, observability, runbooks |
| TD-91 Testing & Quality | Test pyramid, golden tests, feed replay, load and security tests, release checklist |

## Component map

| ID | Component | Python package | SRS features | Release | Depends on |
| --- | --- | --- | --- | --- | --- |
| C01 | Identity & Auth | `identity` | REG | 1 | C14, C16 |
| C02 | KYC & Verification | `kyc` | KYC | 1 | C01, C13 |
| C03 | Wallet & Ledger | `ledger` | WAL | 1 | C16 |
| C04 | Payments | `payments` | DEP, WDR | 1 | C03, C12, C02 |
| C05 | Odds Feed Ingestion | `feed` (separate service) | FEED | 1 | Odds provider |
| C06 | Sports Catalogue | `catalogue` | CAT | 1 | C05 |
| C07 | Slip Calculator & Rules | `slipcalc` (pure library) | BET-07, BR | 1 | C16 |
| C08 | Bet Placement & Risk | `betting` | BET, BO-06–09 | 1 | C03, C06, C07, C11, C12 |
| C09 | Booking Codes & Ticket Check | `booking` | BKG, HIS-03 | 1 | C06 |
| C10 | Settlement | `settlement` | SET | 1 | C05, C08, C03, C07 |
| C11 | Bonuses & Promotions | `bonus` | BON | 1 | C03, C07 |
| C12 | Responsible Gambling & AML | `compliance` | RG | 1 | C01, C03 |
| C13 | Regulator Reporting & Audit | `reporting` (reporter is a separate service) | REP | 1 | All (via outbox) |
| C14 | Notifications | `notify` | NOT | 1 | SMS, FCM |
| C15 | Back Office & Trading | `backoffice` + admin web | BO | 1 | All |
| C16 | Configuration & Tenancy | `tenancy` | CFG | 1 | — |
| C17 | Virtual Games Gateway | `games` (separate service) | VRT | 2 | C03, C12 |
| C18 | Client Apps | Flutter Android app; Next.js player web, terminal, POS, agent portal | UI | 1 | API |
| C19 | Retail Network | `retail`: agents, shops, terminals, cashiers, tickets, shifts, commission | RET, AGT | 1 | C01, C03, C08, C09 |

## Component page template

Every C-page uses the same sections:

1. **Purpose & scope**: what it does, the SRS requirements it implements.
2. **Research notes**: how the industry does it, with the choices made and why.
3. **Responsibilities & boundaries**: what it owns and what it must not do.
4. **Internal structure**: packages, classes and services inside the module.
5. **Data model**: PostgreSQL DDL for its tables.
6. **API**: endpoints with request and response examples.
7. **Events**: what it publishes and consumes.
8. **Key flows & algorithms**: step by step, with pseudo-code where it matters.
9. **Configuration**: tenant settings it reads.
10. **Errors, edge cases and failure modes**.
11. **Tests**: what must be proven before it ships.

## Build order (vertical slices)

1. C16 → C03 → C07 (foundations, no I/O to external providers)
2. C05 → C06 (trial feed live in the app)
3. C01 → C14 (register with OTP)
4. C08 → C10 → C09 (bet, settle, book)
5. C04 → C02 → C12 (money in and out, verified players)
6. C11 → C15 → C13 (bonuses, back office, reporting); C19 after C08 and C09 (shops: terminal codes, cashier sales, payouts)
7. C18 throughout; C17 for Release 2
