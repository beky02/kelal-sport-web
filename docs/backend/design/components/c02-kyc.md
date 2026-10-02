# C02 KYC & Verification

## 1. Purpose & scope

C02 proves each player is a real adult with one account before money leaves the platform. It implements KYC-01 to KYC-07 and feeds duplicate signals to C12 (AML) and C11 (bonus abuse).

## 2. Research notes

| Topic | Finding / decision | Source |
| --- | --- | --- |
| Fayda eKYC | Approved partners can request an OTP to the ID holder's phone, authenticate, then call an eKYC service that returns verified demographic data. Requests are JWS-signed; sensitive payloads are encrypted with a per-request AES-GCM session key. A dev environment is available. | [Fayda Platform API spec](https://nidp.atlassian.net/wiki/spaces/FAPIQ/pages/633733136/Fayda+Platform+API+Specification) |
| Partner onboarding | Partner submits a partner-API-key request with use case; a partner manager approves it | Same |
| Fallback | Manual document review with selfie; optional vendor automation (e.g. Smile ID) | Implementation Guide §5.3 |
| When to require KYC | Common practice: let players register and bet small amounts, and require verification before the first withdrawal. Confirm against the new directive (TBD-1). | Industry practice |

## 3. Responsibilities & boundaries

- **Owns**: KYC cases, documents, Fayda verification records, duplicate-account signals, KYC status transitions.
- **Does not own**: the player record (C01; C02 updates the mirrored status via event), withdrawal decisions (C04 checks status).
- **Must not**: keep ID photos longer than policy; expose other players' data in duplicate checks.

## 4. Internal structure

| Package | Contents |
| --- | --- |
| `kyc/domain` | `KycCase` state machine, `NameMatcher` (Amharic/Latin transliteration-aware fuzzy match), `DuplicateScorer` |
| `kyc/service` | `FaydaVerificationService`, `DocumentUploadService`, `ReviewService`, `DuplicateDetectionService` |
| `kyc/adapters/fayda.py` | Signing (JWS), session-key encryption, OTP, auth and eKYC calls, response decryption |
| `kyc/api` | Player routes `/v1/kyc/*`; staff routes `/v1/admin/kyc/*` |

## 5. Data model

```sql
create table kyc.kyc_case (
  id           uuid primary key,
  tenant_id    uuid not null,
  player_id    uuid not null,
  method       text not null check (method in ('fayda','manual','vendor')),
  status       text not null check (status in ('pending','verified','rejected','expired','needs_info')),
  reason_code  text,                         -- e.g. NAME_MISMATCH, DOC_UNREADABLE
  verified_name text,
  verified_dob  date,
  reviewer_id   uuid,                        -- staff (manual)
  decided_at    timestamptz,
  expires_at    timestamptz,                 -- re-verification date if policy requires
  version       int not null default 1,
  created_at    timestamptz not null default now()
);
create index ix_kyc_case_player on kyc.kyc_case (tenant_id, player_id, created_at desc);
create index ix_kyc_case_queue on kyc.kyc_case (tenant_id, status, created_at) where status = 'pending';

create table kyc.kyc_document (
  id          uuid primary key,
  tenant_id   uuid not null,
  case_id     uuid not null references kyc.kyc_case(id),
  kind        text not null check (kind in ('id_front','id_back','selfie','other')),
  object_key  text not null,                 -- encrypted object in storage
  sha256      bytea not null,
  mime_type   text not null,
  size_bytes  int not null,
  delete_after timestamptz not null,
  created_at  timestamptz not null default now()
);

create table kyc.fayda_verification (
  id              uuid primary key,
  tenant_id       uuid not null,
  case_id         uuid not null references kyc.kyc_case(id),
  fayda_txn_id    text not null,
  auth_result     text not null check (auth_result in ('success','failed','error')),
  response_digest bytea,                     -- hash of decrypted response for audit
  created_at      timestamptz not null default now()
);

create table kyc.duplicate_signal (
  id           uuid primary key,
  tenant_id    uuid not null,
  player_id    uuid not null,
  other_player uuid not null,
  signal       text not null check (signal in ('device','payout_account','national_id','name_dob','ip_cluster')),
  score        numeric(4,2) not null,
  status       text not null default 'open' check (status in ('open','dismissed','confirmed')),
  created_at   timestamptz not null default now()
);
```

## 6. API

```json
// POST /v1/kyc/fayda/otp
{ "fayda_number": "FIN1234567890" }
// 202
{ "case_id": "0192f4…", "otp_sent_to": "+2519…567", "expires_in": 300 }

// POST /v1/kyc/fayda/verify
{ "case_id": "0192f4…", "otp": "123456" }
// 200
{ "status": "verified" }                    // or needs_info with reason_code

// POST /v1/kyc/documents  (multipart: case_id, kind, file)
// 201
{ "document_id": "…", "case_status": "pending" }
```

Staff: `GET /v1/admin/kyc/cases?status=pending`, `POST /v1/admin/kyc/cases/{id}/decision` with `{"decision": "verified" | "rejected" | "needs_info", "reason_code": "…", "note": "…"}`.

## 7. Events

| Publishes | Consumers |
| --- | --- |
| `kyc.status_changed` | C01 (mirror), C04 (unlock withdrawals), C13 (report), C14 (notify) |
| `kyc.duplicate_detected` | C12 (AML), C11 (hold bonus), C15 (queue) |

| Consumes | Action |
| --- | --- |
| `player.registered` | Run duplicate checks (device, name + DOB) |
| `payment.payout_account_added` | Check whether the account belongs to another player |

## 8. Key flows

**Fayda path**: create case (pending) → adapter requests OTP → player enters OTP → adapter calls auth + eKYC → decrypt → `NameMatcher.match(registered_name, verified_name)` and compare DOB.

- Match score ≥ 0.9 and DOB equal → **verified**.
- Score 0.7–0.9 → **pending** for manual review.
- Below 0.7 or DOB differs → **needs\_info** (`NAME_MISMATCH`).

**Name matching**: Ethiopian names are often written in Latin with different spellings (e.g. Tesfaye / Tesfay, Kebede / Kabede). Normalise both to lowercase Latin, transliterate Ge'ez script to Latin with one table, drop vowels for a phonetic key, then use Jaro–Winkler similarity per name part.

**Duplicate score**: device shared (0.4) + same payout account (0.5) + same national-ID hash (1.0) + same name and DOB (0.6) + same IP /24 within 24 h (0.1); signals at ≥ 0.5 open a review item.

## 9. Configuration

`kyc.required_for_withdrawal` (true), `kyc.required_after_deposit_total` (optional threshold), `kyc.fayda_enabled`, `kyc.name_match_verify` (0.9), `kyc.name_match_review` (0.7), `kyc.doc_retention_days` (per policy; placeholder 365 after account closure).

## 10. Edge cases & failure modes

- **Fayda unavailable**: offer manual upload immediately; retry Fayda later without losing the case.
- **Player has no Fayda yet** (roll-out incomplete): manual route with kebele ID, passport or driving licence.
- **Minor detected at verification**: close the account, void open bets, refund deposits, and report per policy.
- **Document upload over slow 3G**: client compresses to under 1 MB before upload; resumable upload is not needed at this size.

## 11. Tests

- Contract tests against the Fayda dev environment (recorded fixtures for CI).
- Name-matcher test set of 200 real-world spelling variants (anonymised), with target precision/recall.
- Access tests: documents readable only by `kyc:review` staff; signed URLs expire in 5 minutes.
