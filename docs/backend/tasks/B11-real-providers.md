---
id: B11
title: Real provider adapters as accounts arrive
status: todo
depends_on: [B8]
components: [C01, C02, C04, C05, C13, C14]
contract_tags: []
touches_money: true
---

# B11 — Real providers

## Goal
Swap each mock for the real provider without touching business code: SMS, Chapa (sandbox first), telebirr,
CBE Birr, Fayda, the odds-feed trial, the regulator interface. One sub-task per provider (B11-sms, B11-chapa, …).

## Read first
- `docs/build-plan.md` §1 (mock ↔ real table)
- The component page for the provider; the provider's own API documentation (link it in the plan)
- `docs/design/td-90-infra-security-ops.md` (secrets, outbound HTTP, webhooks)

## Acceptance criteria (each provider)
- [ ] **AC-1** The adapter passes the same test suite as its mock (shared contract tests for the adapter interface).
- [ ] **AC-2** Timeouts, retries with backoff and a circuit breaker on every outbound call; failures map to the contract's provider error codes.
- [ ] **AC-3** Webhooks: signature verified, raw payload stored first, processed idempotently.
- [ ] **AC-4** Credentials only from the environment/secrets; nothing in code, logs or test fixtures.
