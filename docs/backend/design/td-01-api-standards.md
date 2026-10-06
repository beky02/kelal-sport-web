# TD-01 API Design Standards

All clients use one REST/JSON API. The contract is `contracts/openapi.yaml`, written contract-first (decision of 30 Sep 2026): the file is the source of truth, the frontends generate their types from it and build against a Prism mock of it, and the FastAPI backend must conform to it (see §9). Breaking changes are caught by diffing it (e.g. [oasdiff](https://github.com/Tufin/oasdiff)).

## 1. Surfaces

| Surface | Base path | Callers | Auth |
| --- | --- | --- | --- |
| Player API | `/v1/...` | Flutter app, Next.js player web | Player JWT (optional on public reads) |
| Staff API | `/v1/admin/...` | Back-office front end | Staff JWT + 2FA session, permission strings |
| Shop terminal | /v1/retail/terminal\*, /v1/retail/slip-codes | Terminal app (Next.js) | Terminal token + device signature |
| Cashier POS | /v1/retail/\* | POS app (Next.js) | retail\_staff token + device signature |
| Agent portal | /v1/agent/\* | Agent portal (Next.js) | Agent token (password + OTP) |
| Platform console | /v1/platform/\* (tag `Platform`, not tenant-scoped) | Platform console (Next.js) | Platform token (password + TOTP), audience `platform`, no tenant (C16 section 9; contract change pending) |
| Provider webhooks | `/hooks/{provider}/...` | Payment providers, SMS delivery reports | Provider signature / IP allow-list |
| Game wallet (R2) | `/games/{provider}/...` (separate service) | Virtual-games provider | Signature + IP allow-list |
| Internal | none (in-process interfaces + NATS) | Modules | mTLS inside the cluster |

## 2. Conventions

| Topic | Rule | Example |
| --- | --- | --- |
| Versioning | Major version in path (`/v1`). Additive changes are allowed; removals need `/v2` and 6 months of overlap. | `/v1/bets` |
| Naming | Plural nouns, kebab-case paths, snake\_case JSON fields | `/v1/payment-methods`, `potential_payout` |
| IDs | UUIDv7 strings; ticket IDs and booking codes are short human codes | `"id": "0192f3a4-…"`, `"ticket_id": "K7Q2-M9XP-4"` |
| Money | Decimal **string** with 2 decimals plus a currency field; never floats | `"stake": "100.00", "currency": "ETB"` |
| Odds | Decimal string, 2–3 decimals | `"odds": "1.85"` |
| Time | ISO 8601 UTC with `Z` | `"placed_at": "2026-10-03T14:05:22Z"` |
| Language | `Accept-Language: am` or `en`; responses carry translated `name` fields | — |
| Tenant | Resolved from host; `X-Tenant-Id` accepted for non-browser clients | — |
| Auth | `Authorization: Bearer <access_token>` | — |
| Idempotency | `Idempotency-Key: <uuid>` **required** on every POST that moves money or creates a bet; stored 24 h | — |
| Request ID | Client may send `X-Request-Id`; server always returns `X-Request-Id` and `traceparent` | — |
| Pagination | Cursor-based: `?limit=20&cursor=<opaque>`; response has `next_cursor` (null at end) | See §3 |
| Filtering | Explicit query params; dates as `from`/`to` | `?status=open&from=2026-10-01` |
| Caching | Public catalogue: `Cache-Control: public, max-age=10` + `ETag`; private data: `no-store` | `If-None-Match` → 304 |
| Compression | Brotli or gzip on all JSON | — |
| Rate limits | 429 with `Retry-After`; headers `RateLimit-Limit`, `RateLimit-Remaining` | — |
| Status codes | 200 OK, 201 created, 202 accepted (async), 204 no content, 304, 400 malformed, 401, 403, 404, 409 conflict (odds changed, state conflict), 422 business rule, 429, 5xx | — |

## 3. Envelopes

List response:

```json
{
  "items": [ { "...": "..." } ],
  "next_cursor": "eyJpZCI6IjAxOTJmM2E0In0"
}
```

Error response (RFC 7807, `application/problem+json`):

```json
{
  "type": "https://api.example.et/errors/odds-changed",
  "title": "Odds have changed",
  "status": 409,
  "code": "BET_ODDS_CHANGED",
  "detail": "2 selections changed price.",
  "request_id": "req_01J9…",
  "errors": [ { "field": "legs[1].odds", "code": "ODDS_CHANGED", "current": "1.72" } ]
}
```

Clients switch on `code`, never on `title` or `detail` (which are translated).

## 4. Error code registry (prefix = component)

| Code | HTTP | Meaning |
| --- | --- | --- |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong phone or password |
| `AUTH_LOCKED` | 423 | Too many failed attempts |
| `AUTH_OTP_INVALID` / `AUTH_OTP_EXPIRED` / `AUTH_OTP_RATE_LIMITED` | 422 / 422 / 429 | OTP problems |
| `REG_PHONE_TAKEN` / `REG_ID_TAKEN` / `REG_UNDERAGE` | 409 / 409 / 422 | Registration rules |
| `KYC_REQUIRED` | 403 | Action needs verified KYC |
| `WALLET_INSUFFICIENT_FUNDS` | 422 | Balance too low |
| `PAY_METHOD_UNAVAILABLE` / `PAY_AMOUNT_OUT_OF_RANGE` / `PAY_PROVIDER_ERROR` | 422 / 422 / 502 | Payment problems |
| `BET_ODDS_CHANGED` | 409 | Re-price outside policy |
| `BET_MARKET_SUSPENDED` / `BET_EVENT_STARTED` | 409 | Selection not available |
| `BET_STAKE_TOO_LOW` / `BET_STAKE_TOO_HIGH` / `BET_MAX_PAYOUT` | 422 | Stake rules |
| `BET_RELATED_SELECTIONS` / `BET_TOO_MANY_LEGS` | 422 | Slip shape |
| `BET_LIMIT_EXCEEDED` | 422 | Trader limit or liability |
| `RG_LIMIT_REACHED` / `RG_SELF_EXCLUDED` / `RG_COOLING_OFF` | 403 | Responsible-gambling blocks |
| `BOOKING_NOT_FOUND` / `BOOKING_EXPIRED` | 404 / 410 | Booking codes |
| `IDEMPOTENCY_MISMATCH` | 422 | Same key, different body |
| `REAL_MONEY_DISABLED` | 503 | No licence configured (CFG-04) |

## 5. Endpoint catalogue — player API

| Method | Path | Auth | Idem. | Component | Purpose |
| --- | --- | --- | --- | --- | --- |
| POST | `/v1/auth/otp` | — | — | C01 | Send OTP to a phone (purpose: register, login, reset) |
| POST | `/v1/auth/register` | — (challenge\_id + otp in the body) | — | C01 | Create account |
| POST | `/v1/auth/login` | — | — | C01 | Phone + password → tokens |
| POST | `/v1/auth/refresh` | refresh token | — | C01 | Rotate tokens |
| POST | `/v1/auth/logout` | player | — | C01 | Revoke session |
| POST | `/v1/auth/password/reset` | — (challenge\_id + otp in the body) | — | C01 | Set new password |
| GET | `/v1/me` | player | — | C01 | Profile, KYC status, flags |
| PATCH | `/v1/me` | player | — | C01 | Language, marketing consent |
| GET / DELETE | `/v1/me/sessions`, `/v1/me/sessions/{id}` | player | — | C01 | Devices |
| POST | `/v1/kyc/fayda/otp` | player | — | C02 | Start Fayda verification |
| POST | `/v1/kyc/fayda/verify` | player | — | C02 | Complete with OTP |
| POST | `/v1/kyc/documents` | player | — | C02 | Upload ID images (multipart) |
| GET | `/v1/wallet` | player | — | C03 | Balances |
| GET | `/v1/wallet/transactions` | player | — | C03 | History (cursor) |
| GET | `/v1/payment-methods` | player | — | C04 | Methods, limits for this player |
| POST | `/v1/deposits` | player | yes | C04 | Start deposit |
| GET | `/v1/deposits/{id}` | player | — | C04 | Status |
| POST | `/v1/withdrawals` | player | yes | C04 | Request withdrawal |
| GET | `/v1/withdrawals/{id}` | player | — | C04 | Status |
| DELETE | `/v1/withdrawals/{id}` | player | — | C04 | Cancel while pending review |
| GET | `/v1/dictionary` | public | — | C06 | Versioned reference data |
| GET | `/v1/sports` | public | — | C06 | Sports with fixture counts |
| GET | `/v1/events` | public | — | C06 | Paged fixtures + main markets |
| GET | `/v1/events/{id}` | public | — | C06 | All markets for a fixture |
| GET | `/v1/events/popular` | public | — | C06 | Featured fixtures |
| GET | `/v1/search` | public | — | C06 | Teams and leagues |
| POST | `/v1/slips/quote` | public | — | C07 | Server-side slip calculation (optional check) |
| POST | `/v1/bets` | player | yes | C08 | Place bet |
| GET | `/v1/bets` | player | — | C08 | My bets (status, cursor) |
| GET | `/v1/bets/{id}` | player | — | C08 | Bet detail |
| POST | `/v1/bookings` | public | — | C09 | Create booking code |
| GET | `/v1/bookings/{code}` | public | — | C09 | Load slip from code |
| GET | `/v1/tickets/{ticket_id}` | public | — | C09 | Ticket check (anonymised) |
| GET | `/v1/promotions` | public | — | C11 | Active offers |
| GET | `/v1/me/bonuses` | player | — | C11 | Bonus balances, wagering progress, free bets |
| POST | `/v1/promo-codes/redeem` | player | yes | C11 | Redeem a code |
| GET / PUT | `/v1/me/limits` | player | — | C12 | RG limits |
| POST | `/v1/me/self-exclusion` | player | — | C12 | Self-exclude or take a break |
| GET | `/v1/inbox` | player | — | C14 | Messages |
| POST | `/v1/inbox/read` | player | — | C14 | Mark read |
| POST | `/v1/devices` | player | — | C14 | Register FCM token |
| GET | `/v1/config/public` | public | — | C16 | Branding, flags, limits for the client |
| GET | `/v1/app/version` | public | — | C18 | Minimum and latest app versions |
| GET | `/v1/games` | public | — | C17 | Virtual lobby (R2) |
| POST | `/v1/games/{id}/launch` | player | — | C17 | Launch session (R2) |

## 6. Endpoint catalogue — staff API (`/v1/admin`)

| Method | Path | Permission | Component | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/auth/login`, `/auth/totp` | — | C15 | Staff login + TOTP |
| GET | `/players`, `/players/{id}` | `players:read` | C15 | Search, 360° view |
| POST | `/players/{id}/status` | `players:write` | C15 | Suspend, close, reopen |
| POST | `/players/{id}/notes` | `players:write` | C15 | Add note |
| POST | `/adjustments` | `wallet:adjust` (+ approver) | C03 | Manual adjustment request |
| POST | `/approvals/{id}/decision` | Depends on the approval kind (e.g. `wallet:approve`) | C03 | Second approval; one four-eyes queue for all approval kinds |
| GET | `/kyc/cases`, POST `/kyc/cases/{id}/decision` | `kyc:review` | C02 | KYC queue |
| GET | `/withdrawals?status=review`, POST `/withdrawals/{id}/decision` | `payments:approve` | C04 | Withdrawal queue |
| GET | `/reconciliation/breaks` | `finance:read` | C03 | Recon breaks |
| GET | `/bets`, `/bets/{id}` | `bets:read` | C08 | Search bets |
| GET | `/risk/liability?fixture=` | `trading:read` | C08 | Liability |
| PUT | `/risk/limits` | `trading:write` | C08 | Limits |
| POST | `/markets/{id}/suspend`, `/markets/{id}/reopen` | `trading:write` | C06 | Manual suspension |
| POST | `/settlements/manual` | `bets:settle_manual` (+ approver) | C10 | Manual settle / void |
| GET | `/feed/health` | `trading:read` | C05 | Producer status, lag |
| CRUD | `/bonus-rules`, `/promo-codes` | `marketing:write` | C11 | Bonus setup |
| GET | `/aml/alerts`, POST `/aml/alerts/{id}/decision` | `aml:review` | C12 | AML queue |
| GET | `/reports/{type}?from&to` | `reports:read` | C13 | Finance and regulator reports |
| GET | `/audit-log` | `audit:read` | C13 | Audit search |
| CRUD | `/cms/banners`, `/cms/pages` | `cms:write` | C15 | Content |
| POST | `/campaigns` | `marketing:write` | C14 | Push campaign |
| GET / PUT | `/config`, `/config/versions` | `config:write` | C16 | Tenant configuration |
| CRUD | `/staff`, `/roles` | `admin` | C15 | Staff and roles |

## 7. Webhooks and callbacks (inbound)

| Path | From | Verification | Handler |
| --- | --- | --- | --- |
| `/hooks/telebirr/notify` | telebirr | RSA signature with telebirr public key | C04 |
| `/hooks/chapa/webhook` | Chapa | HMAC-SHA256 (`Chapa-Signature` / `x-chapa-signature`) | C04 |
| `/hooks/mpesa/{callback}` | M-Pesa Ethiopia | IP allow-list + reference match | C04 |
| `/hooks/sms/{provider}/dlr` | SMS provider | Token + IP allow-list | C14 |
| `/games/{provider}/{balance\|debit\|credit\|rollback}` | Virtual-games provider | Provider signature + IP allow-list | C17 |

Rule for every inbound call: store the raw body and headers first, verify, then process idempotently by the provider's reference. Always return 2xx for a duplicate that was already processed.

## 8. Live updates (later releases)

The pre-match release uses HTTP polling of cacheable endpoints. Live betting (later) will add `wss://…/v1/live` with `subscribe` / `unsubscribe` messages and `snapshot` + `delta` frames carrying a sequence number. It is reserved in the design so Release 1 clients need no change.

## 9. The contract file (added 30 Sep 2026)

`contracts/openapi.yaml` (OpenAPI 3.1, 137 paths, 132 schemas) now holds every endpoint on this page plus the retail, agent-portal and back-office routes from C15 and C19. It passes Redocly lint and has been run as a Prism mock. It is edited as three source files and bundled by `contracts/build.py`; see `contracts/README.md`.

Headers declared on every operation: optional `X-Tenant-Id` (tenant code) and `X-Request-Id`; terminal and POS operations also require the device-signature headers. `ETag`/`If-None-Match` and `RateLimit-*` headers are applied by the API gateway and are not declared per operation.

**Workflow**

1. Change the contract first (new field, endpoint or error code) in a pull request.
2. Frontend: regenerate types (`openapi-typescript` for the Next.js apps, `openapi-generator dart-dio` for Flutter) and build against the mock (`npx @stoplight/prism-cli mock contracts/openapi.yaml`). `Prefer: code=409` or `Prefer: example=<name>` returns error and edge-case examples.
3. Backend: implement; CI exports the FastAPI schema and runs `oasdiff breaking` against the contract, then Schemathesis against the running API. Any difference fails the build.

**Decisions and fixes made while writing it**

| Topic | Decision |
| --- | --- |
| Match lists | `main.outcomes[]` items carry the real outcome `id` plus `tpl` and `odds` (C06), so list taps go straight into the slip |
| Booking and slip-code legs | One `PricedLeg` shape: `fixture_name`, `market_name`, `outcome_name`, `odds`, `odds_at_code`, `changed`, `available`, `reason` |
| Retail ticket response | Carries a `receipt` object with everything the POS prints; the PDF stays for back-office reprints |
| Error codes | Retail problems use the same `code` field as everything else; the full list is the `ErrorCode` enum. Added: `AUTH_OTP_UNAVAILABLE`, `AUTH_TOKEN_EXPIRED`, `VALIDATION_FAILED`, `NOT_FOUND`, `RATE_LIMITED`, `PERMISSION_DENIED`, `SERVICE_UNAVAILABLE`, `KYC_PROVIDER_UNAVAILABLE`, `PAY_WITHDRAWAL_NOT_CANCELLABLE`, `PAY_ACTIVE_BONUS_WAGERING`, `BET_TOO_MANY_LINES`, `BET_FREE_BET_INVALID`, `PROMO_INVALID`, `PROMO_ALREADY_USED`, `APPROVAL_SELF_NOT_ALLOWED` and 18 `RETAIL_*` codes |
| Payout accounts | New `GET/POST /v1/me/payout-accounts` and `DELETE /v1/me/payout-accounts/{id}`; withdrawals take `payout_account_id` |
| New small endpoints | `GET /v1/inbox/unread-count`, `GET /v1/banners`, `GET /v1/retail/terminal`, `GET /v1/retail/shifts/current(/tickets)`, `POST /v1/retail/tickets/{no}/reprint`, `GET /v1/retail/settlements/pending`, `POST /v1/retail/settlements/{id}/confirm`, agent login in two steps, `POST /v1/agent/shops/{code}/staff` and `/terminals` |
| Config routes | `GET /v1/admin/config`, `GET/POST /v1/admin/config/versions`, `POST /v1/admin/config/versions/{v}/activate` (as in C16) |
| Approvals | One four-eyes queue `GET /v1/admin/approvals` + `POST /v1/admin/approvals/{id}/decision` for adjustments, manual settlements, config changes and retail limit changes |
| Terminal and POS requests | Signed with the device key: `X-Device-Id`, `X-Device-Timestamp` (±30 s), `X-Device-Signature` (ECDSA P-256 over method, path, timestamp and body hash) |
| Public routes | Every route without `security` is explicitly public (`security: []`) |
