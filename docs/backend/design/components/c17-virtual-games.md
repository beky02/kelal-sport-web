# C17 Virtual Games Gateway (Release 2)

## 1. Purpose & scope

C17 connects one virtual-games provider (Kiron or GoldenRace, per the Implementation Guide) to the platform wallet. It covers the game lobby, launch sessions, seamless-wallet callbacks, round records and daily reconciliation. It is a small separate service (`games`) because providers call it with strict latency budgets. It implements VRT-01 to VRT-10 and ships in Release 2.

## 2. Research notes

| Topic | Finding | Source |
| --- | --- | --- |
| Integration models | White label (provider licence), turnkey, or API/seamless wallet (operator licence, full UX ownership) | [GR8 Tech](https://gr8.tech/virtual-sports-betting-integration/) |
| RNG certification | Provider RNG must be certified by an accredited lab (e.g. GLI, standard GLI-33) | Same |
| Kiron.Lite | Data-light virtuals for African mobile; integrates via BetMan RGS + customer wallet API | [iGaming Afrika](https://igamingafrika.com/kiron-interactive-and-betika-kiron-lite-partnership-drives-fast-growth-in-kenya/) |
| GoldenRace | 100+ African operators; online, mobile and retail; events about every minute | [Intergame](https://www.intergameonline.com/sports-betting/insights/goldenrace-betting-on-africa) |
| Competitors | HuluSport/Shamo list GoldenRace and Kiron among casino providers; launched in an iframe from a lobby | Research doc |

## 3. Responsibilities & boundaries

- **Owns**: game catalogue cache, launch tokens, game sessions, provider transactions and rounds, reconciliation with the provider.
- **Calls**: C03 (postings via the ledger library in the same database), C12 (RG checks), C16 (flag `virtuals`).
- **Does not**: run game logic, odds or RNG (the provider does).

## 4. Data model

```sql
create table games.game (
  id uuid primary key, tenant_id uuid not null, provider text not null, provider_game_id text not null,
  name text not null, category text not null, thumbnail_key text, enabled boolean not null default true, sort int,
  unique (tenant_id, provider, provider_game_id)
);

create table games.game_session (
  id uuid primary key, tenant_id uuid not null, player_id uuid not null, game_id uuid not null,
  launch_token_hash bytea not null unique, currency char(3) not null default 'ETB',
  created_at timestamptz not null default now(), expires_at timestamptz not null, closed_at timestamptz
);

create table games.game_txn (
  id              uuid primary key,
  tenant_id       uuid not null,
  provider        text not null,
  provider_txn_id text not null,
  kind            text not null check (kind in ('debit','credit','rollback')),
  player_id       uuid not null,
  round_id        text not null,
  amount_santim   bigint not null,
  status          text not null check (status in ('ok','rejected','rolled_back')),
  reject_code     text,
  ledger_txn_id   uuid,
  request_body    jsonb not null,
  response_body   jsonb not null,
  created_at      timestamptz not null default now(),
  constraint uq_game_txn unique (tenant_id, provider, provider_txn_id)
);
create index ix_game_txn_round on games.game_txn (tenant_id, provider, round_id);

create table games.game_round (
  tenant_id uuid not null, provider text not null, round_id text not null,
  player_id uuid not null, game_id uuid, stake_santim bigint not null default 0, win_santim bigint not null default 0,
  status text not null check (status in ('open','closed','cancelled')),
  opened_at timestamptz not null default now(), closed_at timestamptz,
  primary key (tenant_id, provider, round_id)
);
```

## 5. Provider-facing wallet API (generic shape; field names follow the chosen provider's spec)

| Call | Request | Our response | Rules |
| --- | --- | --- | --- |
| `authenticate` | `{token}` | `{player_id, currency, balance}` | Token single-use, 60 s validity; exchanged for a session |
| `balance` | `{player_id, session_id}` | `{balance}` | cash + (optionally) bonus per config |
| `debit` | `{player_id, round_id, txn_id, amount, game_id}` | `{balance, txn_ref}` or error `INSUFFICIENT_FUNDS` / `PLAYER_BLOCKED` / `LIMIT_REACHED` | Idempotent by `txn_id`; RG check; ledger `GAME_STAKE` |
| `credit` | `{player_id, round_id, txn_id, amount}` | `{balance, txn_ref}` | Idempotent; amount 0 closes a lost round; ledger `GAME_WIN` |
| `rollback` | `{txn_id_to_rollback, txn_id}` | `{balance}` | Reverses a debit; unknown original → record a tombstone and return OK so a late debit is refused |

Security: HMAC or RSA signature over the body with a shared secret or certificate, a timestamp window of ± 30 s, and an IP allow-list. Every request and response is stored.

Ledger templates: `GAME_STAKE` = +PLAYER\_CASH, −GAMES\_CLEARING:{provider}; `GAME_WIN` = +GAMES\_CLEARING, −PLAYER\_CASH. The clearing account is squared against the provider's daily report.

## 6. Player API

`GET /v1/games` → lobby (enabled games, categories, thumbnails) · `POST /v1/games/{id}/launch` `{lang, device}` → `{url, session_id, expires_at}`. The app opens the URL in a WebView (Flutter `webview_flutter`), and the web opens it in an iframe.

## 7. Flows

**Debit handling** (target p95 < 300 ms):

1. Verify signature and IP → parse.
2. Look up `(provider, txn_id)`; if present, return the stored response.
3. Check `real_money_enabled`, player status, RG stake limit (C12, cached counters).
4. In one DB transaction: ledger post (player cash row lock) + `game_txn` + upsert `game_round` + outbox `game.debit`.
5. Respond with the new balance.

**Daily reconciliation**: download the provider's round report → match by round ID (stake, win) → breaks to C03 recon → publish `game.round_closed` for C13 summaries (turnover and GGR reported separately from sports).

## 8. Configuration

`games.provider`, `games.enabled` (flag `virtuals`), `games.use_bonus_balance` (false), `games.session_ttl_min` (240), provider credentials (secret store), `games.callback_ips[]`.

## 9. Edge cases

- **Debit timeout on the provider side** → provider sends rollback; we reverse if the debit was posted.
- **Credit for an unknown round** → accept and record (the provider is authoritative for results), then alert.
- **Player self-excludes during a round** → finish the round (credit allowed); new debits are rejected.
- **Provider outage** → lobby shows the game as unavailable (health check every 60 s).

## 10. Tests

The provider's certification suite in staging, an idempotency storm (same `txn_id` × 50 in parallel), latency under 200 callbacks/s, and reconciliation with injected mismatches.
