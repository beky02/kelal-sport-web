---
id: B12
title: C02 KYC with FakeFayda
status: todo
depends_on: [B5]
components: [C02]
contract_tags: [KYC]
touches_money: false
---

# B12 — KYC (C02)

## Goal
Players verify their identity through the Fayda flow (mocked by `FakeFayda`) or by uploading documents, so
withdrawals that require KYC (config `kyc.required_for_withdrawal`) can be gated.

## Read first
- `docs/design/components/c02-kyc.md`
- `docs/build-plan.md` §1 (FakeFayda behaviour: FIN ending 0 = verified, 1 = needs_info, 2 = provider down)
- `docs/design/td-90-infra-security-ops.md` (PII handling, storage of documents)
- `contracts/openapi.yaml`, tag `KYC`: `POST /v1/kyc/fayda/otp`, `POST /v1/kyc/fayda/verify`, `POST /v1/kyc/documents`

## Scope
In: kyc schema, `FakeFayda` adapter behind `KYC_PROVIDER`, document upload storage (local filesystem
adapter for dev), KYC status on the player, `kyc.duplicate_detected` event, `KYC_REQUIRED` enforcement hook
for C04 withdrawals (`modules/kyc/interface.py`).
Out: real Fayda (B11), manual review UI (B10).

## Acceptance criteria
- [ ] **AC-1** All three `KYC` operations implemented; `make conformance` passes for the tag.
- [ ] **AC-2** FakeFayda outcomes: FIN ending 0 → verified, 1 → needs_info, 2 → `KYC_PROVIDER_UNAVAILABLE` (one test each).
- [ ] **AC-3** The same national ID on a second player → `REG_ID_TAKEN` (or the contract's code) and a `kyc.duplicate_detected` event.
- [ ] **AC-4** National IDs and documents never appear in logs or API responses beyond what the contract returns; upload size/type limits enforced (`PayloadTooLarge` per contract).
