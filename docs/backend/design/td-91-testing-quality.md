# TD-91 Testing & Quality

Money correctness is proven by tests before launch, not by players afterwards. The strategy leans on three assets unique to betting: golden slip calculations, recorded feed days, and ledger invariants.

## 1. Test pyramid

| Level | Scope | Tools | Runs |
| --- | --- | --- | --- |
| Unit | Domain rules: slip calculator, taxes, bonus rules, state machines, name matching | pytest, hypothesis (property tests) | Every PR |
| Golden | `contracts/golden/*.csv`: slips → expected quotes; settlement scenarios → expected payouts | pytest + Dart test + Vitest on the same CSV (Dart for the Android app, TypeScript for all Next.js apps) | Every PR |
| Module integration | Module + real Postgres/Redis/NATS (testcontainers); RLS; outbox atomicity | pytest + testcontainers | Every PR (affected modules) |
| Contract | OpenAPI diff; provider adapters vs recorded fixtures; event JSON schemas | oasdiff, schemathesis, recorded HTTP (respx / vcr) | Every PR |
| Feed replay | Recorded provider days replayed through C05 → C06 → C08 (synthetic bets) → C10 | Replay harness | Nightly + before release |
| End-to-end | PRD journeys J1, J3, J4 and J5 (J2 is live betting, later release) on real devices | Flutter integration tests (Patrol), Playwright for web | Before release |
| Load | Peak profile (NFR-P1, P3, P6) | k6 or Locust with realistic slips | Before any money-path release |
| Security | OWASP ZAP baseline, auth tests, dependency and secret scans; annual pen test | ZAP, gitleaks, pip-audit | Weekly + pre-launch |
| Chaos | Kill pods, drop the feed connection, slow payments, Redis failover | Litmus or manual game days | Monthly in staging |

## 2. Invariants checked continuously

These run as property tests in CI **and** as queries in production monitoring:

1. Every ledger transaction sums to zero.
2. Each account's cached balance = sum of its entries.
3. No player cash, bonus or locked account is negative (except `PLAYER_DEBT`).
4. Every settled bet has exactly one active settlement row, and its payout equals `slipcalc.quote(settled=True)` under its rules version.
5. Sum of open bet net stakes (after stake tax) = `HOUSE_OPEN_STAKES` balance.
6. Every reportable outbox event has a regulator delivery row within 5 minutes.
7. Redis liability counters match the recomputation from open bets (± 0).

## 3. Golden test format

`contracts/golden/slips.csv` (366 rows); columns and rules in `contracts/golden/README.md` and Engineering Decisions D1.

Expected values are computed by hand or in a reviewed spreadsheet, never by the code under test. Finance signs off the file before launch.

## 4. Feed replay harness

1. Record: store raw messages for 7 full match days (weekend peaks included) from the trial feed.
2. Generate synthetic bets on those fixtures (random singles, accumulators, systems; stakes and timing drawn from realistic distributions).
3. Replay messages at 10× speed through C05; place synthetic bets at their recorded timestamps.
4. Assert: no bet accepted on a suspended market; every bet settled; payouts match an independent settlement oracle (a simple script built from the provider's final results); invariants hold.

## 5. Load test profile

| Scenario | Rate | Duration | Pass criteria |
| --- | --- | --- | --- |
| Browse (lists, match detail) | 2,000 req/s | 30 min | p95 < 200 ms at origin, CDN hit rate > 80% |
| Place bets (70% multiples, 25% singles, 5% systems) | 150/s sustained, 600/s spikes of 5 min | 30 min | p95 < 800 ms, p99 < 1.5 s, 0 ledger breaks |
| Deposits + callbacks | 20/s | 30 min | 0 double credits |
| Settlement of one fixture with 10,000 open bets | Burst | — | < 60 s |
| Login / OTP | 50/s | 10 min | Provider rate limits respected |

## 6. Definition of done (per component)

- [ ] Requirements in the component page covered by tests, with IDs referenced in test names (e.g. `test_BET_05_rejects_started_fixture`).
- [ ] Golden tests updated if rules changed.
- [ ] OpenAPI and event schemas updated; no breaking diff.
- [ ] Metrics and alerts for new failure modes.
- [ ] Audit entries for new staff actions.
- [ ] Security review for new external inputs.

## 7. Release checklist (Gate C)

- [ ] All PRD journeys pass on 3 real low-end devices over 3G.
- [ ] Feed replay of 7 days: 100% correct settlement.
- [ ] Load test at the SRS peak profile (600 bets/s bursts) passed.
- [ ] Penetration test: no open high or critical findings.
- [ ] 14 consecutive days of zero reconciliation breaks in staging (with test money).
- [ ] Regulator integration certified; delivery SLO met for 7 days.
- [ ] Runbooks written and rehearsed (one game day).
- [ ] Backups restored successfully in the last 30 days.
- [ ] Licence recorded; real-money switch reviewed by two people.

## Retail and web tests (added 30 Sep 2026)

| Area | What is tested | How |
| --- | --- | --- |
| Retail money | Section 7 invariants of C19; 50 parallel payouts of one ticket give exactly one payment | pytest + real PostgreSQL (Testcontainers) |
| Retail rules | Cancel window, payout location, ID and approval thresholds, sales hours, shop cash limit | Table-driven unit tests |
| Retail security | Terminal token on cashier routes → 403; staff login from an unknown device → 403; tampered barcode MAC → 404 | API tests |
| Shop flow end to end | Terminal code → POS sale → printed HTML receipt (PDF only for back-office reprints) → settlement → scan → pay → Z report balances | Playwright against the Next.js terminal and POS apps in Chrome |
| Printing | Silent print of the HTML receipt (PDF only for back-office reprints) on each supported printer model | Manual checklist during the pilot, then per shop at installation |
| Web layouts | Every screen at 360, 800 and 1280 px widths; Amharic and English | Playwright screenshot comparisons |
| Web load | First-load JavaScript < 150 KB gzip; LCP < 2.5 s on throttled 3G; repeat visit served from the service worker | size-limit + Lighthouse CI |
| Browsers | Player web in Chrome, Firefox and WebKit; terminal and POS in Chrome kiosk | Playwright matrix |
