# C14 Notifications

## 1. Purpose & scope

C14 sends every message to players through push (FCM), SMS (local gateways with failover) and the in-app inbox, from translated templates. It enforces consent and quiet hours. It implements NOT-01 to NOT-05 and serves C01's OTP delivery.

## 2. Research notes

| Topic | Finding | Design |
| --- | --- | --- |
| Push | FCM HTTP v1 API with OAuth service account; free | Direct integration; no third-party layer needed at first |
| SMS in Ethiopia | Local A2P providers (AfroMessage, SMSEthiopia, GeezSMS) route to Ethio Telecom and Safaricom; OTP APIs available | Primary + fallback provider behind one interface |
| Unicode SMS | Amharic (Ge'ez script) uses UCS-2: 70 characters per part vs 160 | Short Amharic templates; OTP texts under 70 chars |
| Competitors | Push via FCM, in-app inbox with unread count, Telegram support links | Same |

## 3. Internal structure

| Part | Role |
| --- | --- |
| `notify/templates` | Template registry keyed `code + channel + lang`, Jinja-style variables, version |
| `notify/router` | Decides channels per message type and player preferences |
| `notify/channels/fcm.py` | FCM v1 sender; handles invalid tokens (deletes them) |
| `notify/channels/sms.py` | `SmsSender` with providers `afromessage`, `smsethiopia`; failover on error or timeout |
| `notify/inbox` | Inbox items and unread counts |
| `notify/campaigns` | Segment → schedule → throttled send (P1) |

## 4. Data model

```sql
create table notify.template (
  id uuid primary key, tenant_id uuid not null, code text not null,
  channel text not null check (channel in ('push','sms','inbox')), lang text not null,
  title text, body text not null, version int not null, active boolean not null default true,
  unique (tenant_id, code, channel, lang, version)
);

create table notify.message (
  id uuid primary key, tenant_id uuid not null, player_id uuid,
  code text not null, channel text not null, provider text,
  to_address text,                     -- masked phone or token id
  status text not null check (status in ('queued','sent','delivered','failed','suppressed')),
  provider_ref text, error text, category text not null check (category in ('transactional','security','marketing')),
  created_at timestamptz not null default now(), sent_at timestamptz, delivered_at timestamptz
) partition by range (created_at);

create table notify.inbox_item (
  id uuid primary key, tenant_id uuid not null, player_id uuid not null,
  title text not null, body text not null, deep_link text,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index ix_inbox_unread on notify.inbox_item (tenant_id, player_id) where read_at is null;

create table notify.push_token (
  token text primary key, tenant_id uuid not null, player_id uuid not null,
  platform text not null, app_version text, updated_at timestamptz not null default now()
);
```

## 5. Message catalogue (Release 1)

| Code | Trigger event | Channels | Category |
| --- | --- | --- | --- |
| `OTP` | C01 call (sync) | SMS | security |
| `WELCOME` | `player.registered` | inbox, push | transactional |
| `DEPOSIT_OK` / `DEPOSIT_FAILED` | `payment.deposit_*` | push, inbox | transactional |
| `WITHDRAWAL_PAID` / `_REJECTED` | `payment.withdrawal_*` | SMS, push, inbox | transactional |
| `BET_WON` | `bet.settled` (won) | push, inbox | transactional |
| `BET_RESETTLED` | `bet.resettled` | push, inbox | transactional |
| `KYC_VERIFIED` / `KYC_NEEDS_INFO` | `kyc.status_changed` | push, inbox | transactional |
| `NEW_DEVICE_LOGIN` | `player.login` (new device) | SMS | security |
| `BONUS_GRANTED` / `BONUS_EXPIRING` | C11 events / daily job | push, inbox | marketing |
| `SHIFT_VARIANCE` | `retail.shift_closed` (variance above `retail.shift.variance_alert`) | SMS to the agent | transactional |
| `RETAIL_PIN_RESET` | C19 cashier PIN reset | SMS to the cashier | security |

Example template (Amharic, 55 characters): `OTP`: “የማረጋገጫ ኮድዎ {{code}} ነው። ለማንም አይስጡ።” (“Your verification code is {{code}}. Don't share it.”); final wording by a native editor.

## 6. API

`POST /v1/devices` `{fcm_token, platform, app_version}` · `GET /v1/inbox?cursor=` · `POST /v1/inbox/read` `{ids: [...]}` or `{all: true}` · `GET /v1/inbox/unread-count` · Staff `POST /v1/admin/campaigns` `{segment, template_code, send_at}` (P1).

## 7. Rules

- **Suppression**: marketing is never sent to self-excluded players, players without consent, or between 22:00 and 07:00 EAT (it is queued to 07:00). Security and transactional messages always go out.
- **SMS failover**: primary provider timeout of 5 s or a 5xx → retry once on the fallback; OTP messages never retry more than once (to avoid duplicate codes).
- **Rate limits**: at most 5 marketing pushes per player per week.

## 8. Tests

Template rendering in both languages (missing variables fail CI), suppression rules, failover path with a mocked provider outage, invalid-token cleanup.
