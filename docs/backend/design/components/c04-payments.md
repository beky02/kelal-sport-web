# C04 Payments

## 1. Purpose & scope

C04 moves money between players' mobile-money or bank accounts and their wallet. It implements DEP-01 to DEP-09 and WDR-01 to WDR-09 through one provider-adapter interface.

## 2. Research notes

| Provider | Integration facts used in this design | Source |
| --- | --- | --- |
| telebirr | Merchant gets short code, merchant app ID, fabric app ID and app secret; apply fabric token → create RSA-signed order → checkout (web redirect or app) → notify URL → query order | [Developer portal](https://developer.ethiotelecom.et/docs/category/h5-c2b-web-payment-integration); community libraries |
| Chapa | Initialize transaction → hosted checkout → verify by `tx_ref`; HMAC-SHA256 webhooks; transfers API for payouts to banks and wallets | [Chapa docs](https://developer.chapa.co/integrations/webhooks) |
| M-Pesa Ethiopia | Daraja-style: OAuth token, STK push, B2C, transaction status, reversal | [developer.safaricom.et](https://developer.safaricom.et/) |
| ArifPay / SantimPay | Checkout sessions + B2C payouts; sandbox | [ArifPay portal](https://developer.arifpay.net/) |
| Market practice | Competitors list 30+ methods and also run P2P agent deposits; we use licensed rails only | Research doc |

## 3. Responsibilities & boundaries

- **Owns**: payment attempts, their state machines, provider requests, responses and webhooks, payout accounts, provider settlement lines.
- **Calls**: C03 to post money; C12 for limits and AML holds; C02 for KYC status; C14 to notify.
- **Publishes**: `payment.payout_account_added` when a payout account is created (consumed by C02 and C12), alongside the deposit and withdrawal events.
- **Must not**: credit on client-side success; send payouts to unverified accounts.

## 4. Internal structure

| Package | Contents |
| --- | --- |
| `payments/domain` | `Payment` aggregate + state machine, `Limits`, `WithdrawalRules` (rule chain) |
| `payments/adapters/` | `telebirr.py`, `cbebirr.py`, `mpesa_et.py`, `chapa.py`, `arifpay.py`, `santimpay.py`, `mock.py`; each implements `PaymentProvider` |
| `payments/service` | `DepositService`, `WithdrawalService`, `WebhookService`, `PollerJob`, `ProviderReconJob` |
| `payments/api` | `/v1/payment-methods`, `/v1/deposits`, `/v1/withdrawals`, `/hooks/*`, staff routes |

```python
class PaymentProvider(Protocol):
    code: str
    async def initiate_deposit(self, p: Payment) -> InitResult            # next_action: redirect | ussd_push | app_sdk
    async def query(self, p: Payment) -> ProviderStatus
    async def parse_webhook(self, raw: bytes, headers: dict) -> WebhookEvent   # verifies signature
    async def initiate_payout(self, p: Payment) -> InitResult
    async def query_payout(self, p: Payment) -> ProviderStatus
    async def settlement_report(self, day: date) -> list[SettlementLine]
```

## 5. Data model

```sql
create table payments.payment (
  id               uuid primary key,
  tenant_id        uuid not null,
  player_id        uuid not null,
  direction        text not null check (direction in ('deposit','withdrawal')),
  provider         text not null,          -- telebirr | cbebirr | mpesa_et | chapa | arifpay | santimpay | mock
  amount_santim    bigint not null check (amount_santim > 0),
  fee_santim       bigint not null default 0,
  currency         char(3) not null default 'ETB',
  status           text not null check (status in
                   ('initiated','pending','completed','failed','expired',
                    'requested','review','approved','processing','paid','rejected','cancelled')),
  merchant_ref     text not null,          -- our reference sent to provider
  provider_ref     text,                   -- provider's transaction id
  payout_account_id uuid,
  review_reason    text,
  decided_by       uuid,
  ledger_txn_id    uuid,
  expires_at       timestamptz,
  version          int not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint uq_payment_mref unique (tenant_id, merchant_ref)
);
create unique index uq_payment_pref on payments.payment (tenant_id, provider, provider_ref) where provider_ref is not null;
create index ix_payment_player on payments.payment (tenant_id, player_id, created_at desc);
create index ix_payment_pending on payments.payment (status, created_at) where status in ('pending','processing');

create table payments.payment_event (      -- raw provider traffic, append-only
  id          bigserial primary key,
  tenant_id   uuid not null,
  payment_id  uuid,
  provider    text not null,
  kind        text not null check (kind in ('request','response','webhook','query')),
  http_status int,
  headers     jsonb,
  body        bytea not null,
  signature_ok boolean,
  created_at  timestamptz not null default now()
);

create table payments.payout_account (
  id          uuid primary key,
  tenant_id   uuid not null,
  player_id   uuid not null,
  provider    text not null,
  account_ref text not null,                -- wallet phone or bank account
  holder_name text,
  verified    boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint uq_payout unique (tenant_id, provider, account_ref)
);

create table payments.provider_settlement_line (
  id uuid primary key, tenant_id uuid not null, provider text not null,
  business_date date not null, provider_ref text not null, amount_santim bigint not null,
  direction text not null, matched_payment_id uuid, created_at timestamptz not null default now()
);
```

## 6. API

```json
// GET /v1/payment-methods
{ "items": [
  { "code": "telebirr", "name": "telebirr", "deposit": { "min": "20.00", "max": "100000.00" },
    "withdrawal": { "min": "50.00", "max": "50000.00" }, "flow": "app_or_web" },
  { "code": "chapa", "name": "Bank / CBE Birr (Chapa)", "deposit": { "min": "50.00", "max": "100000.00" }, "flow": "redirect" }
]}

// POST /v1/deposits   (Idempotency-Key required)
{ "method": "telebirr", "amount": "500.00" }
// 201
{ "id": "0192f5…", "status": "pending", "next_action": { "type": "redirect", "url": "https://…" }, "expires_at": "…" }

// POST /v1/withdrawals   (Idempotency-Key required)
{ "method": "telebirr", "amount": "2000.00", "payout_account_id": "01J9A7X…" }
// or "account": "+251911234567" (raw wallet number) instead of payout_account_id; it is saved as a payout account
// 201
{ "id": "0192f6…", "status": "processing" }     // or "review"
```

## 7. State machines

- **Deposit**: initiated → pending → completed | failed | expired. A late success on an expired payment → completed + finance alert (DEP-09).
- **Withdrawal**: requested → (rules) → processing | review → approved → processing → paid | failed; review → rejected; requested/review → cancelled (player).

## 8. Key flows

**Deposit webhook** (idempotent):

```python
raw = await request.body()
await events.store(provider, kind="webhook", body=raw, headers=h)         # always first
evt = await adapter.parse_webhook(raw, h)                                # raises on bad signature
async with db.transaction():
    p = await repo.lock_by_merchant_ref(evt.merchant_ref)
    if p.status == "completed": return 200                                # duplicate
    confirmed = await adapter.query(p)                                    # double-check with provider
    if confirmed.status == "success" and confirmed.amount == p.amount:
        txn = await ledger.post(txn_type="DEPOSIT", idempotency_key=f"dep:{p.id}", ...)
        p.complete(provider_ref=confirmed.ref, txn_id=txn.id)
        outbox.add("payment.deposit_completed", p)
    elif confirmed.status == "failed": p.fail(confirmed.reason)
return 200
```

**Withdrawal rules chain** (first failure decides): `KycVerified` → `NotExcluded` → `NoActiveWagering` → `AccountOwnership` → `DailyLimits` → `AmlThresholds` → `FirstWithdrawalReview` → `AutoApproveLimit` (default 10,000 ETB).

**Pollers**: every 60 s, query `pending` deposits older than 2 min and `processing` payouts older than 5 min; expire deposits after 15 min.

## 9. Configuration

`payments.methods[]` (code, enabled, min, max, daily\_max, fee), `payments.deposit_timeout_min` (15), `payments.auto_approve_limit` (10,000 ETB), `payments.first_withdrawal_review` (true), `payments.max_withdrawals_per_day` (3).

## 10. Edge cases & failure modes

- **Amount mismatch** between callback and query → do not credit; alert finance.
- **Provider timeout on payout** → status unknown; never re-send blindly. Query first, then retry with the same merchant reference.
- **Provider outage** → circuit breaker marks the method unavailable in `/payment-methods`.
- **Chargebacks / reversals** (cards via aggregator) → reversal transaction to `SUSPENSE`, then investigate.

## 11. Tests

- Adapter contract tests against sandboxes, with recorded webhook fixtures and signature-verification tests (valid, tampered, replayed).
- State-machine tests for every allowed and forbidden transition.
- Chaos tests: webhook arrives before the create call returns; duplicate webhooks; callback after expiry.
