# C09 Booking Codes & Ticket Check

## 1. Purpose & scope

C09 lets anyone save a slip as a short code and load it elsewhere, share a placed bet, and check any ticket's status without logging in. It implements BKG-01 to BKG-04 and HIS-03. Booking codes matter in Ethiopia: players share slips on Telegram, and in retail shops customers build a slip on a terminal and hand the code to the cashier (C19).

## 2. Research notes

| Competitor | Mechanism |
| --- | --- |
| HuluSport | Unauthenticated `POST /sport-data/bet.place/` creates a booked bet; `GET /shared-bet/{code}/` loads it |
| Melbet / 1xBet | `SaveCoupon` / `GetCoupon` endpoints; coupon codes pasted into the slip |

Design choice: a booking stores selections only (not odds or stake). Loading always re-prices from the current catalogue.

## 3. Data model

```sql
create table booking.booking (
  id           uuid primary key,
  tenant_id    uuid not null,
  code         text not null,                 -- 7 chars, Crockford base32, no 0/O/1/I
  channel      text not null default 'online' check (channel in ('online','retail')),
  shop_id      uuid,                          -- retail codes: shop where created
  terminal_id  uuid,                          -- retail codes: terminal that created it
  consumed_by_bet_id uuid,                    -- bet placed from this code
  bet_type     text not null,
  system_sizes int[],
  legs         jsonb not null,                -- [{outcome_id, fixture_id}]
  stake_hint_santim bigint,
  created_by   uuid,                          -- player id if logged in
  source_bet_id uuid,                         -- when shared from a placed bet
  earliest_start timestamptz not null,        -- min start time of legs
  expires_at   timestamptz not null,          -- min(created + 24h, earliest_start)
  loads        int not null default 0,
  created_at   timestamptz not null default now()
);
-- unique while the row exists; a nightly sweeper deletes expired rows before codes are reused
create unique index uq_booking_code on booking.booking (tenant_id, code);
create index ix_booking_exp on booking.booking (expires_at);
```

## 4. API

```json
// POST /v1/bookings     (no auth; rate-limited)
{ "bet_type": "multiple", "legs": [{ "outcome_id": "oc_01" }, { "outcome_id": "oc_77" }], "stake": "50.00" }
// 201
{ "code": "7KQ2M9X", "expires_at": "2026-10-04T13:55:00Z", "share_url": "https://example.et/b/7KQ2M9X" }

// GET /v1/bookings/7KQ2M9X
{ "code": "7KQ2M9X", "bet_type": "multiple", "stake_hint": "50.00",
  "legs": [ { "outcome_id": "oc_01", "fixture_name": "Arsenal v Chelsea", "market_name": "1X2", "outcome_name": "1", "odds": "1.85", "available": true },
            { "outcome_id": "oc_77", "available": false, "reason": "EVENT_STARTED" } ] }

// GET /v1/tickets/K7Q2-M9XP-4   (public, anonymised)
{ "ticket_id": "K7Q2-M9XP-4", "status": "won", "placed_at": "…", "stake": "100.00", "payout": "330.22",
  "legs": [ { "fixture_name": "Arsenal v Chelsea", "market_name": "1X2", "outcome_name": "1", "odds": "1.85", "result": "win" } ] }
```

## 5. Key rules

- Code generation: 7 random Crockford base32 characters (about 34 billion combinations). Retry on collision. No sequential codes, so they can't be guessed.
- Expiry: the earlier of 24 h or the first leg's kick-off; expired codes return `410 BOOKING_EXPIRED`.
- Ticket check hides the player's identity and requires the full ticket ID including its check character, which prevents enumeration.
- Rate limits: 20 bookings per device per hour; 60 loads per IP per minute.

## 6. Events and jobs

No events published. Daily sweeper deletes bookings expired more than 7 days ago; the `loads` count feeds a “popular slips” feature later.

## 7. Tests

Expiry logic at kick-off boundaries, re-pricing on load, collision retry, anonymisation of ticket checks.

## Retail slip codes (added for C19)

|  | Online booking | Retail slip code |
| --- | --- | --- |
| Created by | Anyone, `POST /v1/bookings` | A shop terminal, `POST /v1/retail/slip-codes` (terminal token) |
| Format | 7 Crockford base32 characters | 8 digits, shown as `4829 1735` plus a QR code |
| Uniqueness | Per tenant | Per tenant among live codes; digits are reused only after expiry |
| Lifetime | min(24 h, first kick-off) | min(`retail.code.ttl_minutes`, first kick-off) |
| Loaded by | Anyone | The cashier POS of the same shop (or any shop of the same agent, if configured) |
| After use | Can be loaded many times | Marked consumed by the ticket sold from it (`consumed_by_bet_id`) |

Both kinds live in `booking.booking`, distinguished by `channel`; re-pricing on load and the expiry sweeper are shared.
