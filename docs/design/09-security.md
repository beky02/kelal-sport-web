# 09 — Security

A real-money product: the rules below are the frontend's share of OWASP ASVS L2 (TD-90), D3 and C18
§4.4, as built and reviewed in F3b and F4a. The security review's findings and what was done about them
are in `docs/tasks/F3b/verification.md` and `docs/tasks/F4/verification.md`.

## The boundaries

| Rule                                 | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The browser never calls the API (D3) | `apiClient` only knows `/api/`; `lib/server/*` is `server-only`; the route handlers add `X-Tenant-Id`, `Accept-Language`, `X-Request-Id`, and `Authorization` from the session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Tokens never reach the browser       | Sealed in the httpOnly cookie; the login answer is a player summary; `/api/me` is the profile; the Playwright check reads `document.cookie`, `localStorage`, `sessionStorage` and every `/api` body after a real login                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Who is signed in is the API's answer | `/api/me` on every load and on focus; no browser flag; player caches dropped on every session change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| The proxy only redirects             | `src/proxy.ts` checks that a cookie exists and sends guests to log in (and answers `/t/{x}` without a ticket number with a 404, repeating nothing from the address); every route handler re-reads the session and the API checks every token (CVE-2025-29927)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Money waits for the server           | No optimistic placement, deposit, withdrawal or cash out. One `Idempotency-Key` per bet: a bet with no answer stays unconfirmed — Try again sends the same request with the same key until a ticket comes back, and a different bet goes only by the player's explicit choice, never the same picks at the same prices under a new key (F5a). Placing is scoped to the signed-in player: hidden from a guest, dropped when someone else signs in, and Try again reads `/api/me` afresh first (within the attempt's 30 s), so a tab that missed a sign-in elsewhere sends nothing for the next player. Deposits (F6b) and withdrawals (F6c) the same way: one key per intent, the same key on Try again after no answer, `/api/me` asked first; each flow is the signed-in player's alone and starts afresh for anyone else. A withdrawal's cancel takes no key (the contract has none, and a repeat can only be refused) |
| Secrets stay out of the repo         | `.env.local` is never read or printed; nothing sensitive in code, tests, fixtures, logs or screenshots; `SESSION_SECRET` is required in production and the server refuses to start without it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## The session cookie

AES-256-GCM, 96-bit random nonce per seal, HKDF-SHA256 key from `SESSION_SECRET` with the cookie version
as info and as associated data, so a `v1` cookie cannot be presented as another version and the secret
serves nothing else. HttpOnly, SameSite=Lax, Path=/, no Domain, Secure (always in production; otherwise
only behind a trusted edge that says HTTPS), `__Host-` prefix in production so no sibling subdomain can
plant one; the first same-named cookie that opens counts. The tenant is sealed in. 30-day Max-Age; the
API's refresh token, not the cookie, ends the session. `SESSION_SECRET_PREVIOUS` for rotation. A refused
refresh clears it.

## CSRF (C18 §4.4)

Every POST route handler, bookings included, refuses unless all of: `Sec-Fetch-Site` is absent,
`same-origin` or `none`; `Origin`, when present, is this request's own host; the request carries
`X-Requested-With: KelalSport` (which forces a preflight this app never answers, so no other origin can
send it); the body is JSON. A DELETE (removing a payout account, cancelling a withdrawal — F6c) passes
the same checks but the last, `assertSameOrigin(request, { json: false })`: it has no body, it is never a
CORS-simple method, so no other origin can send one without that preflight, and no form can send one at
all. `apiClient` adds the header to every request that isn't a GET. This is the custom-header
defence rather than a per-session token: the browser cannot read the httpOnly cookie to derive one, and a
double-submit cookie would add nothing over SameSite=Lax plus these checks. GETs need none. A per-session
token is not planned; if a reviewer or the regulator asks for one, the place to add it is `csrf.ts` and
`apiClient`, nowhere else.

## Trusted proxy (F4 AC-7, contract request 004)

`X-Forwarded-Host`, `-Proto` and `-For` are ignored unless `TRUSTED_PROXY_HOPS` is set, and then only the
entry our edge appended (the n-th from the right) is read; a forged forwarded host can neither pick the
tenant nor make a cookie Secure over plain HTTP. The player's address is read for contract request 004
but not yet sent; `Auth` and `Bookings` stay off the real API until it lands, enforced in
`lib/server/config.ts`.

## Redirects

`/login?next=` is honoured only for a path on this site (`safeNextPath`: starts with `/`, not `//` or
`/\`, printable ASCII); anything else goes home. The proxy's redirect `Location` is relative.

A deposit's `redirect` next action (F6b) is followed only to a provider page on
`PAYMENT_REDIRECT_HOSTS`: `https:`, the default port, no user name or password, and a host name on the
list exactly — no wildcards, so a subdomain or a longer name ending in a listed one is refused. The
route handler checks it before the URL reaches the browser (`isAllowedProviderUrl`); a refused page
becomes "can't continue here" and is logged by its host alone. Unset in production the list is empty,
so every redirect is refused until hosts are configured (fail closed); a malformed entry stops the
server at startup; in development and tests it is the contract examples' two hosts. What reaches the
browser is the page as the allow-list parsed it (`allowedProviderUrl` returns its `href`), never the
API's raw string; the browser re-checks `https:` in its schema and before leaving. Where the provider
sends the player back (`return_url`) is built by the route handler from a host the tenant owns in
`TENANT_HOST_MAP` (`ownedOrigin`) — never a host a request merely arrived on, nor anything the browser
said (its request may not carry one); a tenant with no host there leaves it to the API. For the way back the tab keeps only the deposit's id
and the player's id in `sessionStorage` — no token, amount or balance — and resumes it only for that
player.

## What the browser receives from a failure

A Problem reduced to the contract's fields (`type`, `title`, `status`, `code`, `detail`, `request_id`,
`errors[]`); anything else the API put in an error body is dropped. A refresh failure other than 401
becomes a generic Problem (the refresh token was in that request). Route-handler bodies are capped
(4 KiB login, 16 KiB bookings and bets) and validated with strict Zod schemas before anything is sent
on; a malformed code never reaches an upstream path. `POST /api/bets` (F5a) and `POST /api/deposits`
(F6b, 4 KiB, a contract method and amount and nothing else) also require a UUID `Idempotency-Key` (400
otherwise), forward it unchanged and never make one, and require a session for this tenant (401) — all
before the body goes upstream. Prism's `Prefer` (`code=NNN`, `example=name` or
both) is forwarded only under `next dev` and never to the real API (route test with `API_REAL_TAGS`).

## Logging

Route handlers log nothing from a request body; `console.error` sees only non-API failures. Phone
numbers are masked where the design allows (the profile's identity row); tokens never appear in any
message.

## Rendering

No `dangerouslySetInnerHTML` except the static theme script; every string from the API is rendered as
text. CSP with nonces, HSTS, `X-Frame-Options: DENY` and `Referrer-Policy` are set at the edge and in
`next.config.ts` when the deployment is built (C18 §7). Dependencies are kept current (Renovate) and
Next.js and React security releases are applied within 48 hours (C18 §2).

## Known limits and follow-ups

- Refresh deduplication is per process: one replica, or sticky `/api/*`, until it moves to Redis or the
  backend adds a reuse grace window.
- An explicit mock/real flag for `API_BASE_URL` (F3b SEC3) so a bearer can never go to a mock base
  outside development.
- The device cookie is a first-party tracking identifier and needs a line in the privacy notice.
