---
status: proposed
requested_by: F8b
---

# The device signature's exact signing string; how a revoked terminal and a bad signature are answered; named terminal examples; 004 for terminal routes

## Why the web app needs it

F8b activates the shop terminal and signs every terminal call with its device key (D3, C19 §4.1). The key
is a WebCrypto ECDSA P-256 key made in the browser with `extractable: false`. The browser never calls the
API (D3), so it signs the **API call** — `GET /v1/retail/terminal`, not the web app's own route — and the
terminal's route handler forwards the signature with the token and `X-Device-Id`.

`components.parameters.DeviceSignature` says the signature is "Base64 ECDSA P-256 signature over
`METHOD\nPATH\nTIMESTAMP\nSHA256(body)`". The web and the backend have to produce the same bytes, and five
things in it are open:

1. **`SHA256(body)`: hex or base64.** Lowercase hex? Standard base64?
2. **The signature's form.** WebCrypto's `sign` returns IEEE P1363: the 64 bytes `r‖s`. Python's
   `cryptography` verifies DER by default (70–72 bytes). Which one is base64'd? And is it standard padded
   base64 or base64url?
3. **`PATH`.** Is it the path alone, or the path with the query string as sent? This matters from F8c on:
   the catalogue reads the terminal makes have queries. Is it percent-encoded as sent, or decoded? And is
   it the path the client called, or the path after any gateway prefix is stripped?
4. **No body.** Is it the SHA-256 of zero bytes (`e3b0c442…b855`), or an empty string in that position?
5. **`TIMESTAMP`.** The decimal string of `X-Device-Timestamp` exactly as sent, presumably.

The answers are also undefined in three places, which the screens depend on:

6. **A revoked terminal.** C19 §4.1 says revoking "logs it out on its next request". Does
   `GET /v1/retail/terminal` then answer `200` with `status: revoked`, or `401`? With which code? A revoked
   terminal must show "switched off" with no way forward, and a terminal whose token has merely expired must
   ask for a new code. The web can only tell them apart by the code.
7. **A bad signature or a stale timestamp.** Is it `401 AUTH_INVALID_CREDENTIALS` or
   `403 RETAIL_DEVICE_NOT_ALLOWED`? If it is the former, the web cannot tell it apart from a revocation.
8. **Activating with the code of a revoked or already-activated terminal.** Is that `404`, `410` or
   something else?

## Proposed change

The description of `DeviceSignature` in `contracts/src/03_components.yaml`, made exact. Below is what the
web sends today (F8b). It is the simplest for a browser: WebCrypto's own output, with no DER encoding
written by hand.

```yaml
DeviceSignature:
  name: X-Device-Signature
  in: header
  required: true
  description: >-
    Standard base64 (with padding) of the 64-byte IEEE P1363 ECDSA P-256 / SHA-256 signature (r‖s, as
    WebCrypto returns it) made with the device's non-extractable key over the UTF-8 string
    `METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + BODY_SHA256`, where METHOD is upper case, PATH is
    the request's path and query string exactly as sent (percent-encoded, starting `/v1/`), TIMESTAMP
    is the `X-Device-Timestamp` value as sent, and BODY_SHA256 is the lowercase hex SHA-256 of the exact
    body bytes (of zero bytes when there is no body:
    e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855).
  schema:
    type: string
    pattern: ^[A-Za-z0-9+/]{86}==$
```

A named example on each terminal operation, so the web can test every screen against Prism (the shared
`Gone` example is `BOOKING_EXPIRED`, which an activation never answers):

```yaml
# /v1/retail/terminals/activate → responses
'404': { content: { application/problem+json: { examples: { wrong_code: { value:
  { type: https://api.example.et/errors/not-found, title: No terminal has this code, status: 404,
    code: NOT_FOUND, request_id: req_01J9B30 } } } } } }
'410': { … examples: { activation_expired: { value:
  { type: https://api.example.et/errors/activation-expired, title: This activation code has expired,
    status: 410, code: RETAIL_ACTIVATION_EXPIRED, request_id: req_01J9B31 } } } }
'429': { headers: { Retry-After: { schema: { type: integer }, example: 1800 } }, … examples:
  { too_many_attempts: { value: { type: https://api.example.et/errors/rate-limited,
    title: Too many activation attempts, status: 429, code: RATE_LIMITED, request_id: req_01J9B32 } } } }

# /v1/retail/terminal (GET) → responses
'200': examples: { active: <today's example>, revoked: { value: { …, status: revoked } },
                   shop_closed: { value: { …, shop: { code: ADM-004, name: Adama Kebele 04, open_now: false } } } }
'401': examples: { revoked: { … code: AUTH_INVALID_CREDENTIALS }, token_expired: { … code: AUTH_TOKEN_EXPIRED } }
'403': { $ref: '#/components/responses/Forbidden' }    # with a device_not_allowed example (RETAIL_DEVICE_NOT_ALLOWED)
```

Points 6–8 answered in the operations' descriptions. For example: "A revoked terminal's token is refused
with `401 AUTH_INVALID_CREDENTIALS`; an expired one with `401 AUTH_TOKEN_EXPIRED`; a bad signature or a
timestamp outside ±30 s with `403 RETAIL_DEVICE_NOT_ALLOWED`".

**Request 004 should cover terminal routes as well.** Activation is limited to 5 attempts per IP per hour,
and C19 §12 allows an optional shop IP range. Through the web server, every shop has the server's address.
So `X-Client-IP` (004) has to be honoured on `Retail - terminal` operations from the platform's web
server. Without it, the sixth wrong code in any shop locks every shop out for an hour.

## Clients affected

- **Web terminal (this repo, F8b/F8c)**: signs as described above. If the backend's answer differs, one
  function changes (`canonicalRequest` in `src/features/terminal/lib/signing.ts`).
- **POS (`kelalsport-ops`, F9a)**: the same signature on every cashier call (D3).
- **Flutter app**: none.

## Until it lands

The web signs as described above. Prism only checks that the three headers are present, so nothing proves
the bytes match the backend until B9 is running. That is listed as a gap in F8b's verification. The web
treats `status: revoked` and `401 AUTH_INVALID_CREDENTIALS` as revoked, `401 AUTH_TOKEN_EXPIRED` as
"activation lapsed", and `403 RETAIL_DEVICE_NOT_ALLOWED` as "this PC isn't allowed". `Retail - terminal`
is refused in `API_REAL_TAGS`, as Bookings and Auth are, until 004 lands.
