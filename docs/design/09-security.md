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
| The proxy only redirects and splits  | `src/proxy.ts` keeps each host to its own site (below, F8a); on the player's it checks that a cookie exists and sends guests to log in (and answers `/t/{x}` without a ticket number with a 404, repeating nothing from the address); every route handler re-reads the session and the API checks every token (CVE-2025-29927)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Money waits for the server           | No optimistic placement, deposit, withdrawal or cash out. One `Idempotency-Key` per bet: a bet with no answer stays unconfirmed — Try again sends the same request with the same key until a ticket comes back, and a different bet goes only by the player's explicit choice, never the same picks at the same prices under a new key (F5a). Placing is scoped to the signed-in player: hidden from a guest, dropped when someone else signs in, and Try again reads `/api/me` afresh first (within the attempt's 30 s), so a tab that missed a sign-in elsewhere sends nothing for the next player. Deposits (F6b) and withdrawals (F6c) the same way: one key per intent, the same key on Try again after no answer, `/api/me` asked first; each flow is the signed-in player's alone and starts afresh for anyone else. A withdrawal's cancel takes no key (the contract has none, and a repeat can only be refused) |
| Secrets stay out of the repo         | `.env.local` is never read or printed; nothing sensitive in code, tests, fixtures, logs or screenshots; `SESSION_SECRET` is required in production and the server refuses to start without it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## The host split (F8a, FD1)

One build serves two sites. A host in `TERMINAL_HOST_MAP` is a shop terminal's; every other host is the
player site (07-tenancy). The proxy runs on every page and route handler — everything but Next's own
`/_next/*`, `/favicon.ico` and `public/flags/`, excluded by path and never by extension, so
`/event/x.png` is still a page — and decides by the host the tenant is read from (`requestHost`: a
forwarded host only behind `TRUSTED_PROXY_HOPS`).

| Host     | Served                                                                                               | Anything else                                             |
| -------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Terminal | `/` (shows `/terminal`, no redirect), `/terminal`, `/terminal/*`, `/api/terminal`, `/api/terminal/*` | 404 — no login, account, wallet or `/api/me` on a shop PC |
| Player   | Everything but the terminal's paths                                                                  | `/terminal…` and `/api/terminal…`: 404                    |

A refused path is rewritten to Next's own 404 page (`/_not-found`) with status 404, so it reads exactly
as a route that doesn't exist and nothing of the other site renders. Paths are compared on segment
boundaries (`/terminals` is not the terminal's) and decoded as well as raw (`/%74erminal` is); on a
terminal host an undecodable path or one with a `.`/`..` segment is refused. Each root layout has its
own JavaScript: `pnpm verify` reads the build's client manifests and fails if a player route loads
`(terminal)` code or the terminal loads the player layout's (`scripts/check-host-split.mjs`). Unit tests
cover both hosts, the spellings and the matcher over every route and public file; a Playwright check
visits `localhost` and `terminal.localhost`.

The split is the proxy's. A request that skips it (CVE-2025-29927) reaches only what a guest could: a
player handler finds no session on a terminal host, because the cookie is bound to the player's host
(`__Host-`, no `Domain`). F8b's `/api/terminal/*` handlers must check `isTerminalHost` themselves too, so
a player host can never reach them even then.

Running on every route handler, the proxy makes Next hold each request body in memory for it — 10 MB by
default. `experimental.proxyClientMaxBodySize` is 32 KiB: above the largest body a handler accepts
(16 KiB, bets and bookings), so none is cut, and nobody can make the server hold megabytes per request.
A body with a `Content-Length` over a handler's cap is still refused with 413 before it is read.

## The session cookie

AES-256-GCM, 96-bit random nonce per seal, HKDF-SHA256 key from `SESSION_SECRET` with the cookie version
as info and as associated data, so a `v1` cookie cannot be presented as another version and the secret
serves nothing else. HttpOnly, SameSite=Lax, Path=/, no Domain, Secure (always in production; otherwise
only behind a trusted edge that says HTTPS), `__Host-` prefix in production so no sibling subdomain can
plant one; the first same-named cookie that opens counts. The tenant is sealed in. 30-day Max-Age; the
API's refresh token, not the cookie, ends the session. `SESSION_SECRET_PREVIOUS` for rotation. A refused
refresh clears it.

## CSRF (C18 §4.4)

Every POST and PUT route handler, bookings included, refuses unless all of: `Sec-Fetch-Site` is absent,
`same-origin` or `none`; `Origin`, when present, is this request's own host; the request carries
`X-Requested-With: KelalSport` (which forces a preflight this app never answers, so no other origin can
send it); the body is JSON. A DELETE (removing a payout account, cancelling a withdrawal — F6c) passes
the same checks but the last, `assertSameOrigin(request, { json: false })`: it has no body, it is never a
CORS-simple method, so no other origin can send one without that preflight, and no form can send one at
all. A PUT (setting a limit, F7a) passes all four: it carries a JSON body, and it is never CORS-simple
either. `apiClient` adds the header to every request that isn't a GET. This is the custom-header
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
`PUT /api/me/limits` and `POST /api/me/self-exclusion` (F7a) take a 4 KiB strict body — a contract limit
type and period with an amount above zero or whole minutes (never `amount: null`, which removes a limit),
or a contract kind and duration — and a session for this tenant, all before anything goes upstream. The
API revokes every session as it starts a break, so the route handler clears the session cookie with its
201; a refusal keeps it.

## Logging

Route handlers log nothing from a request body; `console.error` sees only non-API failures. Phone
numbers are masked where the design allows (the profile's identity row); tokens never appear in any
message.

## Rendering

No `dangerouslySetInnerHTML` except the static theme script; every string from the API is rendered as
text. No page can be framed, by another site or by this one: `next.config.ts` sends
`Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY` with every response —
pages, route handlers, the proxy's redirects and 404s, static files (F3b SEC6). `frame-ancestors` is
what current browsers obey, `X-Frame-Options` what older WebViews do. It matters most since F7a: a
permanent self-exclusion is a few clicks on `/responsible-gaming`, and SameSite=Lax keeps the session
out of a cross-site frame only in current browsers — not in every old Android WebView, and never for a
same-site page. A unit test holds the rule to Next's own path matcher (`pnpm check`); a Playwright check
reads the headers from the dev server and watches Chrome refuse the frame, from another site and from
this one. The rest of C18 §7 is still to come (SEC6), at the edge and in `next.config.ts` when the
deployment is built: CSP with nonces, which must keep `frame-ancestors 'none'`, HSTS and
`Referrer-Policy`. C18 §7's one exception, for Release 2's virtual-games provider, is not made.
Dependencies are kept current (Renovate) and Next.js and React security releases are applied within
48 hours (C18 §2).

## Known limits and follow-ups

- A body sent without `Content-Length` (chunked) and over 32 KiB reaches the handler cut: Next drops the
  chunk that crosses the limit and all after it, so the handler sees an empty or shortened body, usually
  refused as not JSON (422 rather than 413). Nothing reaches the API that the sender didn't send, and
  browsers always send `Content-Length` for these bodies; the edge should refuse large bodies outright
  (`client_max_body_size` or the like) when the deployment is built (SEC6).

- Refresh deduplication is per process: one replica, or sticky `/api/*`, until it moves to Redis or the
  backend adds a reuse grace window.
- An explicit mock/real flag for `API_BASE_URL` (F3b SEC3) so a bearer can never go to a mock base
  outside development.
- The device cookie is a first-party tracking identifier and needs a line in the privacy notice.
