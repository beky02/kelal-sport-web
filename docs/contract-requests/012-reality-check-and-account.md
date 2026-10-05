---
status: proposed
requested_by: F7b
---

# The reality check's figures and play session; the interval's meaning and a way to set it; a session's start; a `PATCH /v1/me` example

## Why the web app needs it

F7b moved the account's preferences and devices onto the contract. Language and marketing consent change
through `PATCH /v1/me`, and the devices come from `GET /v1/me/sessions`. The reality check (RG-04) now opens
over any page every `Me.flags.reality_check_minutes`. RG-04 and C12 §2 want it to show "time played and net
result", and the design (02-journeys, 05-errors) wants the session's staked, won and net figures "from the
API, never computed in the browser". Six things are missing or undefined.

1. **The session's figures.** No operation returns what the player staked and won in a play session.
   `/v1/me/sessions` has times, platform and IP; `/v1/me/limits` has `used` per limit period, which is not a
   session; `/v1/wallet/transactions` would have to be added up in the browser, which D1 and the task rule
   out. The web shows **time played only**, with no money figures (task F7e adds them once this lands).
2. **When a play session starts.** C12 §7 times it server-side from `player.login`, but a `Session` lasts up
   to 30 days (C01 §9), so "since login" can be days. Nothing defines it for a client. Meanwhile the web
   counts from when the tab first showed the signed-in player, kept in `sessionStorage`: a reload doesn't
   restart it, but a new tab does.
3. **What `Me.flags.reality_check_minutes` means.** It is `integer | null` with no description. The web
   reads it as the interval in force for this player (theirs, else the tenant's). It reads `null` as "no
   reality check" and invents no interval of its own. Both readings need confirming. C16 §4 has
   `rg.reality_check_minutes` in the tenant config and 07-tenancy expected it in `/v1/config/public`, which
   has no `rg`. If `Me.flags` is the only source a player app needs, the description should say so.
4. **Choosing an interval.** The design's responsible-gaming page lets the player pick 30, 60, 90 or 120
   minutes. `MePatch` has only `language` and `marketing_consent`, so the web shows the account's
   interval read-only ("Every 60 min", or "Off").
5. **`Session.created_at` across a refresh.** C01 §8 rotates the refresh token into a new `session` row
   with the same `family_id`. If `created_at` is that row's, it resets every 15 minutes. The devices list
   shows "last active" only (`last_used_at`), so it doesn't depend on this, but the description should say
   whether `created_at` is the sign-in (the family's start) or the last rotation.
6. **A `PATCH /v1/me` 200 example.** Without one, Prism generates a `Me` from the schema
   (`kyc_status: unverified`, `excluded_until: "2019-08-24T14:15:22Z"`, `reality_check_minutes: 0`). After
   saving a preference against Prism, the web briefly shows a player on a break that ended in 2019. Only
   development is affected, but it hides real problems.

## Proposed change

Everything is additive: a new operation and schema, an optional `MePatch` property, descriptions and an
example. The figures match the shared fixtures (the contract's player, ETB).

```yaml
# contracts/src/01_head_player.yaml → paths
/v1/me/reality-check:
  get:
    tags: [Me]
    operationId: getRealityCheck
    summary: The current play session, for the reality check (RG-04)
    description: >
      What the reality check shows: when the play session began, the interval in force and when the next
      check is due, and what was staked and won in it. The server defines the play session (C12 §7);
      clients show these values and never compute them.
    security: [{ playerAuth: [] }]
    responses:
      "200":
        description: The current play session
        content:
          application/json:
            schema: { $ref: "#/components/schemas/RealityCheck" }
            example:
              started_at: "2026-10-03T11:00:00Z"
              interval_minutes: 60
              next_check_at: "2026-10-03T12:00:00Z"
              staked: "350.00"
              won: "120.00"
              net: "-230.00"
              currency: ETB
      "400": { $ref: "#/components/responses/BadRequest" }
      "401": { $ref: "#/components/responses/Unauthorized" }
      "404": { $ref: "#/components/responses/NotFound" }

/v1/me:
  patch:
    responses:
      "200":
        content:
          application/json:
            # The /v1/me example after `{ language: en }` (the request example).
            example:
              id: "01J9A7R0000000000000000001"
              phone: "+251911234567"
              full_name: Abebe Kebede
              date_of_birth: "1998-04-12"
              language: en
              status: active
              kyc_status: verified
              marketing_consent: false
              created_at: "2026-10-01T08:15:00Z"
              can_withdraw: true
              flags: { reality_check_minutes: 60 }
```

```yaml
# contracts/src/03_components.yaml → components.schemas
RealityCheck:
  type: object
  required: [started_at, interval_minutes, staked, won, net, currency]
  properties:
    started_at:
      $ref: "#/components/schemas/Timestamp"
      description: When the play session began, as the server defines it (state the rule — e.g. sign-in, or the first activity after N idle minutes)
    interval_minutes:
      type: [integer, "null"]
      description: The interval in force — the player's own, else the tenant's `rg.reality_check_minutes`; null when there is no reality check
    next_check_at:
      type: [string, "null"]
      format: date-time
      description: When the next check is due; null when there is none
    staked:
      $ref: "#/components/schemas/Money"
      description: Stakes placed in this play session (state whether before or after stake tax)
    won:
      $ref: "#/components/schemas/Money"
      description: Returns credited in this play session (state whether before or after win tax)
    net:
      $ref: "#/components/schemas/Money"
      description: won − staked, signed ("-230.00" is a loss)
    currency: { $ref: "#/components/schemas/Currency" }

Me:
  properties:
    flags:
      properties:
        reality_check_minutes:
          description: The reality-check interval in force for this player (theirs, else the tenant's `rg.reality_check_minutes`); null means no reality check

MePatch:
  properties:
    reality_check_minutes:
      type: [integer, "null"]
      minimum: 1
      description: The player's own reality-check interval, within the tenant's allowed values (state them, or list them in `/v1/config/public`); null returns to the tenant's

Session:
  properties:
    created_at:
      description: When this device signed in (the session family's start), unchanged by refresh rotation
```

If the backend prefers the figures on the current item of `/v1/me/sessions` (`current: true`) to a new
operation, the same fields there work just as well for the web.

## Clients affected

- **Web** (F7e): reads `/v1/me/reality-check` through a route handler when the check opens, and times
  the next one from `next_check_at` instead of its own visit clock. The figures appear in the dialog with
  the loss tint when `net` is negative. The responsible-gaming card offers the intervals once `MePatch`
  takes one.
- **Flutter app**: the same reality check (RG-04).
- **Terminal/POS**: none (no player session).

## Until it lands

- The reality check shows time played and Keep playing, Take a break and View my limits, with no money
  figures. It is timed from the visit, not the API's play session (F7b plan, decision 2).
- The session-reminder card shows the account's interval read-only.
- The devices list shows "last active" and never `created_at`.
- In development, saving a preference against Prism shows Prism's generated player until `/api/me` is
  read again.
