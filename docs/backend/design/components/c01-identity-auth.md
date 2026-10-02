# C01 Identity & Auth

## 1. Purpose & scope

C01 creates player accounts from a verified phone number, authenticates players, and manages sessions and tokens. It implements SRS REG-01 to REG-12 and supports RG-02 (session revocation on self-exclusion).

## 2. Research notes

| Topic | Practice adopted | Source |
| --- | --- | --- |
| Password storage | Argon2id, memory ≥ 19 MiB, 2 iterations; no composition rules, minimum 8 characters, block breached passwords | [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html) |
| Tokens | Short-lived access JWT + rotating refresh token with reuse detection (a reused refresh token revokes the whole family) | [OAuth 2.0 Security BCP (RFC 9700)](https://datatracker.ietf.org/doc/rfc9700/) |
| OTP | 6 digits, 5-minute expiry, attempt limits, stored hashed; SMS OTP is acceptable for phone verification but not as the only factor for staff | NIST 800-63B §5.1.3.3 |
| Market practice | Ethiopian betting sites use phone + password with SMS OTP at registration (seen on HuluSport, Shamo.bet, Melbet) | Research doc |

## 3. Responsibilities & boundaries

- **Owns**: player identity record, credentials, OTP challenges, sessions, devices, access/refresh tokens.
- **Does not own**: KYC verification (C02), balances (C03), RG status (C12). Registration calls C03 to open accounts, C12 to record optional limits, and emits `player.registered`.
- **Must not**: store raw OTPs or passwords; log phone numbers or tokens in plain text.

## 4. Internal structure

| Package | Contents |
| --- | --- |
| `identity/domain` | `Player`, `PhoneNumber` (E.164 validation for +2519/+2517), `Password` policy, `AgePolicy`, `OtpChallenge` |
| `identity/service` | `OtpService.send / verify`, `RegistrationService.register`, `AuthService.login / refresh / logout`, `SessionService.list / revoke`, `PasswordResetService` |
| `identity/repo` | SQLAlchemy models and repositories |
| `identity/api` | Routers under `/v1/auth`, `/v1/me` |
| `identity/interface.py` | `get_player(id)`, `revoke_all_sessions(player_id, reason)` for other modules |

## 5. Data model

```sql
create table identity.player (
  id                uuid primary key,
  tenant_id         uuid not null,
  phone_e164        text not null,
  full_name         text not null,
  date_of_birth     date not null,
  national_id_enc   bytea,               -- field-level encrypted (KMS)
  national_id_hash  bytea,               -- HMAC for uniqueness lookups
  language          text not null default 'am' check (language in ('am','en')),
  status            text not null default 'active'
                    check (status in ('active','suspended','self_excluded','closed')),
  kyc_status        text not null default 'unverified',  -- mirrored from C02 for fast reads
  marketing_consent boolean not null default false,
  referral_code     text,
  terms_version     text not null,
  terms_accepted_at timestamptz not null,
  version           int not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_player_phone unique (tenant_id, phone_e164),
  constraint uq_player_nid unique (tenant_id, national_id_hash)
);

create table identity.credential (
  player_id        uuid primary key references identity.player(id),
  tenant_id        uuid not null,
  password_hash    text not null,        -- argon2id encoded string
  failed_attempts  int not null default 0,
  locked_until     timestamptz,
  password_changed_at timestamptz not null default now()
);

create table identity.session (
  id                 uuid primary key,
  tenant_id          uuid not null,
  player_id          uuid not null references identity.player(id),
  family_id          uuid not null,      -- all rotations of one login
  refresh_token_hash bytea not null,
  device_id          uuid,
  user_agent         text,
  ip                 inet,
  created_at         timestamptz not null default now(),
  last_used_at       timestamptz not null default now(),
  expires_at         timestamptz not null,
  revoked_at         timestamptz,
  revoked_reason     text
);
create index ix_session_player on identity.session (tenant_id, player_id) where revoked_at is null;
create unique index uq_session_refresh on identity.session (refresh_token_hash);

create table identity.device (
  id              uuid primary key,
  tenant_id       uuid not null,
  player_id       uuid references identity.player(id),
  fingerprint     text not null,          -- from device SDK (C02 duplicate signals)
  platform        text check (platform in ('android','ios','web')),
  app_version     text,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);
create index ix_device_fp on identity.device (tenant_id, fingerprint);
```

OTP challenges live in Redis (`otp:{purpose}:{phone}`: code hash, attempts, expiry) because they are short-lived; each send is also logged in `notify.message` for audit.

## 6. API

**Send OTP** — `POST /v1/auth/otp`

```json
// request
{ "phone": "+251911234567", "purpose": "register" }
// 202 response
{ "challenge_id": "0192f3b1-…", "expires_in": 300, "resend_after": 60 }
```

**Register** — `POST /v1/auth/register`

```json
// request
{
  "challenge_id": "0192f3b1-…", "otp": "482913",
  "full_name": "Abebe Kebede", "date_of_birth": "1998-04-12",
  "national_id": "1234 5678 9012", "password": "••••••••",
  "language": "am", "accept_terms_version": "2026-10",
  "deposit_limit": { "period": "week", "amount": "1000.00" },
  "promo_code": "WELCOME", "device": { "fingerprint": "fp_…", "platform": "android", "app_version": "1.0.3" }
}
// 201 response
{
  "player": { "id": "0192f3b2-…", "phone": "+251911234567", "kyc_status": "unverified" },
  "tokens": { "access_token": "eyJ…", "expires_in": 900, "refresh_token": "rt_…" }
}
```

**Login** — `POST /v1/auth/login` with `{phone, password, device}` → same `tokens` object. If a new device needs OTP, it returns `202 {"otp_required": true, "challenge_id": …}`.

**Refresh** — `POST /v1/auth/refresh` `{refresh_token}` → new pair; the old refresh token is invalid from now on.

## 7. Events

| Publishes | When |
| --- | --- |
| `player.registered` | Account created (C11 welcome bonus, C13 report, C14 welcome message) |
| `player.login` | Successful login (C12 reality-check timer, analytics) |
| `player.status_changed` | Suspended, closed, reopened |

| Consumes | Action |
| --- | --- |
| `rg.self_excluded` | Revoke all sessions; set status `self_excluded` |
| `kyc.status_changed` | Update mirrored `kyc_status` |

## 8. Key flows

**Registration** (one DB transaction after OTP check):

1. Verify OTP challenge (hash compare, attempts ≤ 5, not expired); mark used.
2. Validate age ≥ `auth.min_age` (default 21) and phone format; hash the national ID for the uniqueness check.
3. Insert `player`, `credential`, `device`; call `ledger.open_player_accounts(player_id)` (same transaction, C03 interface).
4. If a deposit limit was chosen, call `compliance.set_limit(...)`.
5. Insert outbox `player.registered`; commit; issue tokens.

**Refresh rotation with reuse detection**:

```python
session = repo.find_by_refresh_hash(hash(token))
if session is None or session.expires_at < now:
    raise AuthInvalid
if session.revoked_at is not None:  # token already rotated = theft signal
    repo.revoke_family(session.family_id, reason="refresh_reuse")
    raise AuthInvalid
new = repo.rotate(session)  # revoke old, insert new with same family_id
return issue_tokens(new)
```

## 9. Configuration (C16)

`auth.min_age` (21), `auth.otp_length` (6), `auth.otp_ttl_s` (300), `auth.otp_max_sends_15m` (3), `auth.otp_max_sends_day` (10), `auth.lockout_attempts` (5), `auth.lockout_minutes` (15), `auth.new_device_otp` (true), `auth.access_ttl_s` (900), `auth.refresh_ttl_days` (30).

## 10. Errors, edge cases, failure modes

- **SMS provider down**: C14 fails over to the secondary provider; if both fail, return `503 AUTH_OTP_UNAVAILABLE` and do not count the attempt.
- **Phone re-cycled by the telecom**: login from a new device needs OTP on the phone; support can re-verify identity with KYC data.
- **Same national ID on two phones**: blocked by `uq_player_nid`; returns `REG_ID_TAKEN` without revealing the other account.
- **Clock skew on devices**: token expiry is checked on the server only.
- **Enumeration**: `POST /auth/otp` returns the same response whether or not the phone is registered, except for purpose `register`, which must reveal “already registered”. Rate limits mitigate enumeration.

## 11. Tests

- Unit: age policy on birthdays (turning 21 today), phone validation, password policy, refresh reuse detection.
- Integration: registration opens ledger accounts in the same transaction (roll back on failure), RLS prevents cross-tenant reads.
- Security: brute-force lockout, OTP rate limits, token tampering, JWT algorithm confusion.
- Load: login at 50/s, OTP send at 20/s without breaching SMS provider limits.

## Retail principals (added for C19)

Besides players and back-office staff, C01 issues tokens to three retail principal types. Each has its own JWT audience, so a token for one cannot call another's endpoints.

| Principal | How it signs in | Token | Allowed routes |
| --- | --- | --- | --- |
| `terminal` | One-time activation code, then a device key (WebCrypto, non-extractable) signs every request | 90-day access token, rotated silently; revocable from the portal | Public catalogue, `/v1/retail/slip-codes` (create), ticket check |
| `retail_staff` (cashier, shop manager) | Username + 6-digit PIN, only from an activated POS device of the same shop | Bearer token (audience retail\_staff), 12 h, held by the POS app's Next.js server; ends at shift close | `/v1/retail/*` cashier routes for its own shop |
| `agent` | Phone + password + OTP (same flow as players, separate user table) | Access 15 min + refresh 30 days | `/v1/agent/*` for its own subtree |

Agent credentials live in `identity.agent_credential` (agent\_id, tenant\_id, phone\_e164, password\_hash, failed\_attempts, locked\_until); all principals share `identity.session` with a `principal_type` column.

PIN lockout after 5 failures (manager or agent resets); all retail logins are written to the audit log with device and IP.
