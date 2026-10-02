---
id: B8
title: C04 payments with MockPaymentProvider; C12 limits and self-exclusion (milestone M2)
status: todo
depends_on: [B2, B5]
components: [C04, C12]
contract_tags: [Payments, Wallet, Responsible gambling]
touches_money: true
---

# B8 — Payments and responsible gambling

## Goal
Register → deposit (mock) → bet → settle → withdraw works end to end (M2), with responsible-gambling limits
and self-exclusion enforced.

## Read first
- `docs/design/components/c04-payments.md`, `c12-rg-aml.md`
- `docs/design/td-01-api-standards.md` (inbound webhook rule: store raw, verify, process idempotently)
- `docs/engineering-decisions.md` D2, D6 (`PAYMENT_PROVIDERS=mock`)
- `contracts/openapi.yaml`, tags `Payments`, `Wallet`, `Responsible gambling`

## Scope
In: payment provider adapter interface; `MockPaymentProvider` with the dev page `/dev/pay/{id}` (local only)
to approve, fail or time out; deposit with `next_action` (redirect, ussd_push, app_sdk); webhook handling;
payout accounts; withdrawal rule chain and `WITHDRAW_LOCK/PAID/RELEASE`; real-money switch enforcement; RG
deposit/loss/stake limits with increase cool-off, self-exclusion and cooling-off.
KYC gate: withdrawals call `modules/kyc/interface.py` when `kyc.required_for_withdrawal` is true (`KYC_REQUIRED`); if B12 isn't merged yet, keep the flag false in the seed and add the check behind the interface stub.
Out: real providers (B11), AML case management UI (B10).

## Acceptance criteria
- [ ] **AC-1** The M2 journey runs as one automated end-to-end test against the real API with mocks.
- [ ] **AC-2** Duplicate webhooks credit once; a webhook with a bad signature is stored and rejected.
- [ ] **AC-3** Withdrawal above balance → `WALLET_INSUFFICIENT_FUNDS`; with active bonus wagering → `PAY_ACTIVE_BONUS_WAGERING`; amount outside method range → `PAY_AMOUNT_OUT_OF_RANGE`.
- [ ] **AC-4** Limit decreases apply immediately, increases only after the configured cool-off; reaching a limit → `RG_LIMIT_REACHED`; self-excluded players cannot log in to bet or deposit (`RG_SELF_EXCLUDED`).
- [ ] **AC-5** With `real_money_enabled() == false`, deposit, bet and withdraw return 503 `REAL_MONEY_DISABLED`.
- [ ] **AC-6** `/dev/pay/*` does not exist outside `ENV=local` (test).
