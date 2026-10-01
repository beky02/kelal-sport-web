---
status: proposed
requested_by: F3b
---

# Forward the player's IP and device from the web server

## Why the web app needs it

D3 makes the browser call only the web app's own `/api/*` route handlers, which call the API from the
Next.js server. So every request the API sees from the web comes from **the web server's address**, not
the player's. The limits that are written per IP or per device then apply to all web players at once:

- C09 / BKG-03: 20 booking codes per device per hour, 60 loads per IP per minute. With F3b, the
  twenty-first booking anywhere on the site in an hour gets `429 RATE_LIMITED` for everybody.
- td-00: the gateway's token buckets "per IP, device and player", and the stricter OTP and login buckets
  (C01). They hit the same problem as soon as F4 sends auth through the route handlers.
- Audit and fraud signals (IP on login, device on register/deposit/withdraw — implementation guide,
  KYC-06) would record the web server's address for every web player.

The contract has no header for "the end user this server call is for". The terminal/POS `X-Device-Id`
is a signed device identity for retail hardware, not a player's browser.

## Proposed change

Two optional headers on every operation, sent only by the platform's own web servers (the callers that
already send `X-Tenant-Id` on a browser's behalf):

```yaml
# contracts/src/03_components.yaml → components.parameters
ClientIp:
  name: X-Client-IP
  in: header
  required: false
  description: >-
    The end user's IP address (IPv4 or IPv6), sent by the platform's Next.js servers for the browser
    they are serving. Honoured only from trusted platform callers (the same trust that admits their
    X-Tenant-Id); from anyone else it is ignored and the connection's address is used. Used for per-IP
    rate limits and audit.
  schema: { type: string, maxLength: 45 }
  example: 196.188.120.7
ClientDevice:
  name: X-Client-Device
  in: header
  required: false
  description: >-
    Opaque, stable identifier of the end user's browser or app install (web: a random ID in a
    first-party httpOnly cookie set by the web server; Flutter: the install ID). Same trust rule as
    X-Client-IP for web servers; the app sends its own. Used for per-device rate limits (BKG-03).
    Not a signed device identity — retail hardware keeps X-Device-Id.
  schema: { type: string, maxLength: 64, pattern: "^[A-Za-z0-9_-]{8,64}$" }
  example: d_7f3c9a1e2b4d4f6a
```

```python
# contracts/build.py — add them to the parameters every operation gets
for extra in ("TenantId", "RequestId", "ClientIp", "ClientDevice"):
```

And one line in the `info.description` conventions:

```yaml
- Server-side clients acting for a browser send `X-Client-IP` and `X-Client-Device`; rate limits and
  audit use them when the caller is trusted.
```

How the API decides a caller is trusted (internal network, mTLS, a shared secret) is the backend's call.
The web side only needs the header names and the rule.

## Clients affected

- **Web (Next.js player app, later terminal/POS/agent apps on the same server pattern)**: every route
  handler adds both headers. The IP comes from the platform's own edge proxy; the device ID comes from a
  first-party cookie.
- **Flutter app**: calls the API directly, so the gateway already sees its IP; it may send
  `X-Client-Device` with its install ID for the per-device buckets.
- **Terminal / POS**: unchanged (`X-Device-Id` + signature).

## Until it lands

The web sends neither header. Against Prism nothing changes. Against the real API, per-IP and per-device
limits count all web players together. This has to land before `Bookings`, or `Auth` (F4), moves to the
real backend through `API_REAL_TAGS`.
