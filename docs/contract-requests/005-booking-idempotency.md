---
status: proposed
requested_by: F3b
---

# Accept `Idempotency-Key` on `POST /v1/bookings`

## Why the web app needs it

Book bet (F3b) calls `POST /v1/bookings`. On a flaky connection the player taps again, or the request is
retried after a timeout whose first attempt actually succeeded. Without a key, each retry mints another
code. That is harmless for money, but:

- each extra code spends one of the player's 20 bookings per device per hour (BKG-03);
- the code on screen and the one the player already shared can differ.

The web app's rules already send one `Idempotency-Key` per booking intent and reuse it on retry (as for
bets). The contract's convention only requires the key "on every request that moves money or creates a
bet or ticket", and `createBooking` doesn't declare it, so the backend has no reason to honour it.

## Proposed change

An optional header (additive — clients that don't send it keep working):

```yaml
# contracts/src/03_components.yaml → components.parameters
IdempotencyKeyOptional:
  name: Idempotency-Key
  in: header
  required: false
  description: >-
    Optional on operations that create something harmless to repeat (a booking code). When present it
    works like IdempotencyKey: stored 24 h; the same key returns the first response; the same key with
    a different body → 422 IDEMPOTENCY_MISMATCH.
  schema: { type: string, format: uuid }
  example: 3f0c8b8e-6a3d-4c1e-9d0f-1b2a3c4d5e6f
```

```yaml
# contracts/src/01_head_player.yaml → paths./v1/bookings.post
parameters:
  - { $ref: "#/components/parameters/IdempotencyKeyOptional" }
```

And in `info.description`:

```yaml
- `Idempotency-Key` is required on every request that moves money or creates a bet or ticket, and
  accepted on `POST /v1/bookings`.
```

## Clients affected

- **Web**: already sends the key (F3b). No change after the sync, except that the generated types now
  list it.
- **Flutter app, terminal**: may send it; nothing breaks if they don't.

## Until it lands

The web sends the header anyway. Prism and the backend ignore an undeclared header, so a retried booking
may create a second code, and the slip shows the latest one.
