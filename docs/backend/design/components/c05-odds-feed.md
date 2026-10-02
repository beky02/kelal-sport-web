# C05 Odds Feed Ingestion

## 1. Purpose & scope

C05 is a separate service that connects to the odds provider, keeps the catalogue and odds in sync, detects outages, recovers, and hands results to settlement. It implements FEED-01 to FEED-10, except FEED-08 (tenant margins), which C06 applies at read time. It is written against a provider-neutral internal model, so switching from Sportradar-style to LSports-style feeds means writing a new adapter, not a new service.

## 2. Research notes

| Topic | Finding | Source |
| --- | --- | --- |
| Message set | `odds_change`, `bet_stop`, `bet_settlement`, `rollback_bet_settlement`, `bet_cancel`, `rollback_bet_cancel`, `fixture_change`, `alive`, `snapshot_complete` | [Sportradar UOF messages](https://docs.sportradar.com/uof/data-and-features/messages) |
| Recovery | `initiate_request` with `after` timestamp (max 72 h for most producers, 10 h live); queue stateful messages until `snapshot_complete` | [UOF recovery](https://docs.sportradar.com/uof/error-handling/recovery-using-api) |
| Outage rule | Live: suspend all markets immediately on producer loss. No grace period in Release 1: all markets of a producer are suspended within 10 seconds of feed loss (FEED-05) | Same |
| LSports | RabbitMQ push + Snapshot API with `timestamp` filter for recovery; snapshot rate limits (full every 15 s) | [LSports Snapshot](https://docs.lsports.eu/u/trade/integration/apis/snapshot) |
| SDK option | Official Java/.NET SDKs exist, but not Python; we use `aio-pika` and parse XML/JSON ourselves | GitHub |

## 3. Responsibilities & boundaries

- **Owns**: the provider connection, raw message store, ID mapping, producer state, the current odds store (Redis + `catalogue` tables through C06's write interface), and normalised feed events.
- **Does not**: settle bets (C10), apply bet rules (C08), or serve players (C06).
- **Writes**: through `catalogue.write` interface functions, never direct SQL on another schema.

## 4. Internal structure

| Part | Responsibility |
| --- | --- |
| `connection/amqp.py` | Connect, bind queues with routing keys (filter sports and producers), prefetch, manual ack |
| `adapters/sportradar.py`, `adapters/lsports.py` | Parse provider messages into internal DTOs |
| `pipeline/` | persist raw → parse → map IDs → order check → apply → publish |
| `static/` | REST loaders: sports, tournaments, competitors, market descriptions, fixture schedule (daily and on `fixture_change`) |
| `producers/monitor.py` | Heartbeat tracking, down/up transitions, suspend-all |
| `recovery/` | Recovery requests, stateful-message queue, snapshot completion |

Three consumer lanes keep bet stops fast when settlements pile up:

1. **Lane 1**: `bet_stop` and `alive`.
2. **Lane 2**: `odds_change` and `fixture_change`.
3. **Lane 3**: settlements, cancels and rollbacks.

## 5. Internal model

```python
@dataclass(frozen=True)
class OddsChange:
    provider: str
    producer_id: int
    event_urn: str
    ts_ms: int
    event_status: str | None  # not_started, live, ended ...
    markets: list[MarketUpdate]  # template id, specifiers, status, outcomes[(id, odds, active)]


@dataclass(frozen=True)
class SettlementMsg:
    provider: str
    producer_id: int
    event_urn: str
    ts_ms: int
    certainty: int
    markets: list[MarketResult]  # outcomes[(id, result: win|lose, void_factor: 0|0.5|1, dead_heat_factor)]
```

## 6. Data model

```sql
create table feed.raw_message (
  id            bigserial,
  provider      text not null,
  routing_key   text not null,
  msg_type      text not null,
  event_urn     text,
  producer_id   int,
  provider_ts   timestamptz,
  received_at   timestamptz not null default now(),
  body          bytea not null,               -- zstd-compressed original
  primary key (id, received_at)
) partition by range (received_at);
create index ix_raw_event on feed.raw_message (event_urn, received_at);

create table feed.producer_state (
  provider        text not null,
  producer_id     int not null,
  status          text not null check (status in ('up','down','recovering')),
  last_alive_at   timestamptz,
  last_processed_ts_ms bigint,                 -- used as "after" for recovery
  recovery_request_id bigint,
  updated_at      timestamptz not null default now(),
  primary key (provider, producer_id)
);

create table feed.id_mapping (
  provider      text not null,
  entity        text not null check (entity in ('sport','category','tournament','competitor','fixture','market_template','outcome')),
  provider_id   text not null,                 -- e.g. sr:match:14021482
  internal_id   uuid not null,
  primary key (provider, entity, provider_id)
);
```

The feed data is shared by all tenants (odds are global), so these tables have no `tenant_id`. Tenant-specific margins and enablement are applied in C06.

## 7. Events published

`feed.odds_changed {fixture_id, market_id, outcomes[{id, odds, active}], status, version}` · `feed.bet_stop {fixture_id, market_ids|groups}` · `feed.settlement_received {fixture_id, results[]}` · `feed.rollback_received` · `feed.cancel_received {fixture_id, market_ids, start_time, end_time}` · `feed.producer_down/up {producer_id}`.

## 8. Key flows

**Message pipeline** (per message):

```python
async def handle(msg):
    raw_id = await raw_store.insert(msg)  # 1 persist first (FEED-02)
    dto = adapter.parse(msg)  # 2 parse
    ids = await mapper.resolve(dto)  # 3 map (creates unknown entities via static REST)
    if await ordering.is_stale(ids.fixture, dto.ts_ms):  # 4 drop out-of-order odds
        return await msg.ack()
    await apply(dto, ids)  # 5 update catalogue + Redis (one DB tx)
    await bus.publish(to_event(dto, ids), msg_id=raw_id)  # 6 publish (dedupe by msg_id)
    await producers.touch(dto.producer_id, dto.ts_ms)  # 7 progress marker
    await msg.ack()  # 8 ack last
```

**Producer down → recovery**:

1. `alive` missing for > 10 s, or `alive subscribed=0` → status `down`; publish `feed.producer_down`; C06 suspends all markets of that producer.
2. Reconnect; call recovery with `after = last_processed_ts_ms` (capped to the provider's window); status `recovering`.
3. While recovering: apply `odds_change` only if newer than stored; queue settlements, cancels and rollbacks.
4. On `snapshot_complete` with our request ID: process the queue, status `up`, publish `feed.producer_up`; C06 reopens markets that the snapshot shows as active.
5. If the gap exceeds the recovery window: full resync of fixtures in the horizon via REST, then treat as recovered.

## 9. Configuration

`feed.provider` (sportradar | lsports | oddsmatrix), credentials (secret store), `feed.sports_enabled[]`, `feed.horizon_days` (14), `feed.alive_timeout_s` (10), `feed.lanes.prefetch` (lane 1: 50, lane 2: 500, lane 3: 100).

## 10. Edge cases & failure modes

- **Unknown market template**: fetch the description from REST, cache it, then continue. If that fails, park the message and alert (never drop).
- **Variant markets** (e.g. correct score lists, player markets): outcome names come from a variant endpoint; cache per variant ID.
- **Fixture moved or postponed**: `fixture_change` → reload the fixture. If the start is moved beyond 48 h, settlement will void per BR-11.
- **Duplicate messages**: idempotent apply by `(fixture, market, ts_ms)`; bus de-dup by message ID.
- **Clock**: use provider timestamps for ordering, not local receive time.
- **Poison message**: after 3 parse failures, move it to a dead-letter queue, alert, and continue.

## 11. Tests

- Replay harness: feed a recorded day of raw messages at 10× speed and compare the final odds and results with the provider snapshot.
- Fault injection: drop the connection mid-stream, delay `alive` messages, reorder messages, and duplicate messages.
- Latency SLO test: bet stop to suspended-in-Redis under 1 s at p99.
