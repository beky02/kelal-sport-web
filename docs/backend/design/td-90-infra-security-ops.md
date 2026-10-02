# TD-90 Infrastructure, Security & Operations

This page covers how the platform runs: environments, deployment, security controls, observability and incident handling. Hosting location is open until the directive sets data-residency rules (TBD-3), so everything below is portable Kubernetes. Hosting options are in the Implementation Guide §9.

## 1. Environments

| Env | Purpose | Data | Money | Feed |
| --- | --- | --- | --- | --- |
| `local` | Developer laptop (docker compose: Postgres, Redis, NATS, MinIO, mock providers) | Seed data | Fake | Recorded replay |
| `dev` | Shared integration, auto-deploy on merge | Synthetic | Provider sandboxes | Provider trial / replay |
| `staging` | Pre-production, production-like sizing; load and security tests; provider certification | Anonymised copies | Sandboxes | Provider test feed |
| `prod` | Live | Real | Real (after the licence switch) | Production feed |

## 2. Production topology (initial sizing)

| Component | Size | HA |
| --- | --- | --- |
| Kubernetes nodes | 4 × (8 vCPU, 32 GB) | 2 zones / 2 racks |
| `api` | 4–12 pods (HPA on CPU and p95) | Stateless |
| `worker` | 3–6 pods | Stateless; leader lock for schedules |
| `feed` | 1 active + 1 standby per producer group | Leader election via Redis lock |
| `reporter`, `games` | 2 pods each | — |
| Next.js web apps: player web, terminal, POS, agent portal, back office | Standalone Node containers, 2+ replicas each | Stateless; behind Cloudflare |
| PostgreSQL | Primary 8 vCPU / 64 GB / NVMe + synchronous standby + async read replica | CloudNativePG or managed; PgBouncer in front |
| Redis | 3-node (primary + 2 replicas, Sentinel) | AOF persistence |
| NATS JetStream | 3-node cluster | Replicated streams (R=3) |
| Object storage | S3-compatible, versioned, encrypted | Cross-site replication |

## 3. CI/CD pipeline

1. **PR**: ruff, mypy, import-linter (module boundaries), unit tests, golden slip tests (Python, Dart and TypeScript), web bundle-size and Lighthouse budgets, npm audit, OpenAPI diff, secret scan (gitleaks), dependency scan, SQL migration lint.
2. **Merge to main**: build container images (signed), integration tests with testcontainers, deploy to `dev` via Argo CD.
3. **Release**: tag → deploy to `staging` → smoke tests, feed replay and settlement check, load test (for money-path changes) → manual approval → `prod` rolling deploy with automatic rollback on error-rate or latency alerts.
4. **Migrations**: expand/contract pattern only (add columns, backfill, switch, drop later). No destructive migration in the same release as the code that stops using the column.
5. **Freeze windows**: no deploys during featured matches or 12:00–02:00 EAT on weekends.

## 4. Security controls

| Area | Control |
| --- | --- |
| Edge | Cloudflare WAF (OWASP rules), bot management, rate limiting, DDoS protection; origin accepts traffic only from Cloudflare |
| Transport | TLS 1.2+; HSTS; mTLS between services in the cluster (service mesh or cert-manager-issued certificates) |
| Secrets | HashiCorp Vault or cloud KMS; short-lived database credentials; nothing in images or git |
| Data at rest | Disk encryption; field-level encryption for national IDs and KYC docs (envelope encryption with KMS) |
| Identity | Players: Argon2id + OTP; staff: password + TOTP, admin UI behind Cloudflare Access / IP allow-list |
| Least privilege | Separate DB roles per deployable; app roles cannot bypass RLS or update ledger entries |
| App security | OWASP ASVS L2 checklist; input validation with Pydantic; output encoding; CSRF protection on cookie sessions |
| Mobile | Certificate pinning, root/jailbreak detection (warn), obfuscation, no secrets in the APK |
| Supply chain | Signed images (cosign), SBOM, pinned dependencies, weekly dependency updates |
| Testing | Penetration test before launch and yearly; bug bounty later |
| Logging | No PII, tokens or OTPs in logs; phone numbers masked |

## 5. Observability

| Signal | Tooling | Key items |
| --- | --- | --- |
| Metrics | Prometheus + Grafana | Request rate, error rate, p95/p99 per route; bets/s; rejection reasons; feed lag per producer; settlement backlog; payment success % per provider; regulator backlog age; DB connections; Redis memory |
| Logs | Loki (structlog JSON) | trace\_id, tenant, route, player ref (hashed) |
| Traces | OpenTelemetry → Tempo | App → API → Redis → Postgres → provider |
| Errors | Sentry (backend, Flutter, web) | Release-tagged |
| Business | Grafana dashboards on `reporting.daily_summary` and Redis counters | Turnover, GGR, active players |

### SLOs and alerts

| SLO | Target | Page when |
| --- | --- | --- |
| Bet placement success (non-business errors) | 99.9% | Burn rate over 1 h > 14× |
| Bet placement latency | p95 < 800 ms | p95 > 1.5 s for 5 min |
| Feed freshness | Lag < 2 s | Producer down or lag > 10 s |
| Payment success | > 95% per provider | < 85% for 15 min |
| Regulator delivery | 99% < 60 s | Backlog age > 5 min |
| Reconciliation | 0 breaks | Any break |

## 6. Runbooks (to be written before launch)

| Runbook | Trigger | First steps |
| --- | --- | --- |
| Feed producer down | Alert `feed_producer_down` | Confirm markets suspended; check provider status; follow recovery; notify traders |
| Payment provider degraded | Success < 85% | Disable method in config; show banner; contact provider |
| Settlement backlog | Backlog > 10k for 10 min | Scale workers; check stuck fixtures; verify ledger locks |
| Reconciliation break | Any break | Freeze affected payouts; investigate by reference; post correction with approval |
| Database failover | Primary lost | Confirm automatic promotion; verify RPO 0 on ledger; run internal reconciliation |
| Suspected breach | Security alert | Incident commander; isolate; preserve logs; notify under Proclamation 1321/2024 and the regulator |
| DDoS on match day | Traffic spike | Cloudflare “under attack” mode; raise rate limits for logged-in players only |

## 7. Backup and disaster recovery

RPO 0 for ledger and bets (synchronous standby); RTO 30 min. WAL archiving plus nightly base backups to a second site; monthly restore drill with reconciliation; infrastructure fully reproducible from Terraform and Helm.
