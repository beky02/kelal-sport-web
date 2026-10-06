# C18 Client Apps (Flutter Android app + Next.js web)

## 1. Purpose & scope

C18 covers every front end. The Android app is built in **Flutter**; everything that runs in a browser is built in **Next.js** (decision of 30 Sep 2026). All of them call the same `/v1` API and use the same golden test file for slip totals.

| App | Stack | Where it runs | Users |
| --- | --- | --- | --- |
| **Player app** | Flutter | Android (APK), iOS later | Online players |
| **Player web** | Next.js (App Router) | Any browser, responsive from 360 px phones to desktop; installable as a PWA | Online players |
| **Shop terminal** | Next.js | Chrome kiosk on shop PCs | Walk-in customers (C19) |
| **Cashier POS** | Next.js | Chrome kiosk with silent printing | Cashiers, shop managers (C19) |
| **Agent portal** | Next.js | Any browser | Agents (C19) |
| **Back office** | Next.js + Refine | Desktop browser | Operator staff (C15) |
| **Platform console** | Next.js (stack details: the web repo's FD1) | Desktop browser, behind Cloudflare Access or an IP allow-list | Platform staff: create and run brands (C16 section 9) |

**Why this split.** Next.js renders pages on the server, so a phone on 3G gets readable odds as HTML before any JavaScript runs, search engines can index match pages, and Telegram link previews work without a separate service. It also gives the back office the React data-grid ecosystem. Flutter stays for Android, where offline storage, push and a native feel matter and where your Flutter experience pays off most. **The cost** is two UI codebases and the slip calculator written twice (Dart and TypeScript); the shared OpenAPI contract and one golden CSV that both must pass keep them in step.

C18 implements UI-01 to UI-19, the client side of RET-01 to RET-17 and AGT-01 to AGT-06, and NFR-P5, NFR-P7, NFR-P8 and NFR-Q1.

## 2. Research notes

| Finding | Design |
| --- | --- |
| Competitors ship React single-page apps of about 2.5 MB of JavaScript (HuluSport, Shamo.bet) and cache whole catalogues in `localStorage` | Server Components render lists as HTML; client JavaScript only for the slip and interactions; first-load JS budget under 150 KB (section 8) |
| Google Play restricts real-money gambling to approved countries; Ethiopia not found on the list | Android APK from our own domain + installable PWA ([Play policy](https://support.google.com/googleplay/android-developer/answer/9877032?hl=en)) |
| Players on 3G with prepaid data; many Amharic-first | Data budget per screen, Amharic default, Ethiopic font subset |
| CVE-2025-29927 (March 2025): a crafted header let requests skip Next.js middleware, bypassing auth checks done only there | Middleware only redirects; every authorisation check happens in the FastAPI API and in route handlers ([Snyk](https://snyk.io/blog/cve-2025-29927-authorization-bypass-in-next-js-middleware/)) |
| CVE-2025-55182 "React2Shell" (December 2025): critical remote code execution through React Server Components / Server Functions | Security releases of Next.js and React applied within 48 hours; Renovate alerts; few Server Actions, all input validated with zod ([Tenable](https://www.tenable.com/blog/react2shell-cve-2025-55182-react-server-components-rce), [Datadog](https://securitylabs.datadoghq.com/articles/cve-2025-55182-react2shell-remote-code-execution-react-server-components/)) |
| next-pwa is unmaintained; Serwist is its successor for App Router service workers | `@serwist/next` for the PWA ([Serwist docs](https://serwist.pages.dev/docs/next), [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps)) |
| Chrome can print silently to the default printer in kiosk mode (`--kiosk-printing`) | POS prints an HTML receipt with print CSS; no install on shop PCs |

## 3. Repository structure

The client code lives in the platform monorepo next to the backend, so the OpenAPI file and golden CSVs in `contracts/` are shared.

```
client/
├─ mobile/                        # Flutter Android app (section 10)
└─ web/                           # pnpm workspace + Turborepo
   ├─ apps/
   │  ├─ player/                  # www.{brand}      player web + PWA
   │  ├─ terminal/                # terminal.{brand} shop self-service
   │  ├─ pos/                     # pos.{brand}      cashier counter
   │  ├─ agent/                   # agents.{brand}   agent portal
   │  ├─ admin/                   # bo.{brand}       back office (Refine inside Next.js, C15)
   │  └─ console/                 # console.{platform domain} platform console (C16 section 9); not per brand
   └─ packages/
      ├─ api/                     # typed client generated from contracts/openapi.yaml; problem+json errors
      ├─ slipcalc/                # TypeScript port of C07 on decimal.js; runs the golden CSV
      ├─ ui/                      # tokens as CSS variables per tenant, Tailwind preset, Radix-based components, odds button
      ├─ catalogue/               # sport tree, event list, match detail (player, terminal, POS)
      ├─ betslip/                 # slip store + UI; mode = player | terminal | pos
      ├─ i18n/                    # next-intl messages: am, en (om later)
      └─ config/                  # eslint, tsconfig, tailwind presets
```

Rules: apps import packages, never each other; packages never import apps; `packages/api` is regenerated in CI from `contracts/openapi.yaml`, so an API change that breaks a client fails the build.

## 4. Player web architecture (Next.js App Router)

### 4.1 Rendering per route

| Route | Rendering | Cache | Why |
| --- | --- | --- | --- |
| `/`, `/sport/[slug]`, `/league/[id]` | Server Components | ISR, revalidate 15 s; odds refreshed on the client every 30 s while visible | Fast HTML on 3G, cheap to serve |
| `/match/[id]` | Server Component for the main market group; other groups loaded on tab open | ISR 15 s | Data budget per screen |
| `/odds/[slug]` | Static-ish SEO page with plain HTML odds and structured data | ISR 60 s | Search traffic ("Arsenal vs Chelsea odds") |
| `/b/[code]`, `/t/[ticket]` | Server-rendered with `generateMetadata` (Open Graph) | Dynamic | Telegram previews; ticket check works without JavaScript |
| `/account`, `/wallet`, `/bets`, `/deposit`, `/withdraw` | Client Components behind login | Never cached | Personal data |

### 4.2 Data, state and money

- **Server side**: Server Components call the FastAPI API over the internal cluster address, passing the tenant and language; responses are cached per tenant and language.
- **Browser side**: TanStack Query calls same-origin route handlers (`/api/*`), which forward to FastAPI with the session (backend-for-frontend). The browser never calls FastAPI directly and never holds an access token.
- **Slip**: a Zustand store in `packages/betslip`, persisted to `localStorage` (selections only, never tokens or balances); totals from `packages/slipcalc` with the tenant rule set from `/v1/config/public`.
- **Money and odds**: `decimal.js` everywhere; JavaScript `number` is banned for money by an ESLint rule; amounts cross the API as decimal strings (TD-01).
- **Placement**: an idempotency key is created when the player taps Place and reused on retry; a 409 shows old and new odds for acceptance, as in the app.

### 4.3 Tenancy, theming and language

One build serves every tenant. Middleware reads the host, resolves the tenant (cached), and passes it on in a header; the root layout loads the tenant's colours as CSS variables, logo and enabled languages from `/v1/config/public`. `next-intl` handles Amharic (default) and English, with the language in the URL (`/am/...`, `/en/...`) so each version is indexable.

### 4.4 Authentication

- Login and registration go through route handlers that call FastAPI and set an `httpOnly`, `Secure`, `SameSite=Lax` session cookie on the site's own domain; access tokens stay on the server. Mutations carry a CSRF token header.
- Middleware only redirects logged-out users away from account pages. **Authorisation is enforced by FastAPI on every call**, and route handlers re-check the session, so a middleware bypass (CVE-2025-29927) exposes nothing.
- Terminal: device-bound token in IndexedDB, requests signed with a non-extractable WebCrypto key (C19 4.1). POS: staff session cookie plus the POS device signature. Agent portal: same pattern as players, with OTP. Platform console: like the back office (password + TOTP), with a `platform` token held on the server; it is the one app that is not resolved to a tenant.

### 4.5 Responsive layout

| Width | Layout |
| --- | --- |
| < 640 px (phone) | Bottom navigation; bet slip as a bottom sheet with a floating counter; one column |
| 640–1023 px (tablet, small laptop) | Collapsible sports menu; events list; slip as a right drawer |
| ≥ 1024 px (desktop, terminal, POS) | Three columns: sports tree, events, bet slip always visible |

Touch targets at least 48 px (terminals are touch screens); odds buttons of fixed width so columns line up; tables become cards under 640 px; text zoom to 130% without clipping; Amharic strings tested for length.

### 4.6 PWA and offline

`@serwist/next` precaches the app shell, fonts and the dictionary, so repeat visits load instantly and the site can be installed from the browser menu. Offline, the player sees cached lists and their slip, and placing a bet is disabled with a clear message. Web push (Firebase Cloud Messaging web) is P1.

## 5. Terminal and POS (Next.js)

- **Terminal**: launched as `chrome --kiosk --app=https://terminal.{brand}` at boot. Client-rendered after activation; reuses the catalogue and slip packages in `terminal` mode; big touch layout; slip code shown large with a QR code (`qrcode` package); idle reset; no polling while idle.
- **POS**: launched with `--kiosk --kiosk-printing`. Keyboard-first (F2 new sale, F4 scan/pay, F9 sell, Esc back). A hook listens for scanner input (fast keystrokes ending in Enter) on every screen. Shift total and connection state always visible; Sell, Pay and Cancel disabled when offline.
- **Receipt printing**: the ticket response includes a receipt model; the POS renders a `Receipt` component (80 mm or 58 mm) into a hidden iframe with `@page { size: 80mm auto; margin: 0 }` and calls `print()`. Chrome's kiosk printing sends it to the default printer without a dialog. The barcode (Code 128) is drawn as SVG with JsBarcode and the QR code with `qrcode`. The server keeps a PDF version for reprints from the back office. P1: a local print bridge for ESC/POS and the cash drawer.

## 6. Key web packages

| Need | Package |
| --- | --- |
| Framework | `next` (App Router, `output: 'standalone'`), `react`, TypeScript strict |
| Styling and components | Tailwind CSS, Radix UI primitives (shadcn/ui style), CSS variables for tenant themes |
| Server state | `@tanstack/react-query` |
| Client state (slip) | `zustand` |
| API client | `openapi-typescript` + `openapi-fetch` (generated types from `contracts/openapi.yaml`) |
| Validation and forms | `zod`, `react-hook-form` |
| Money | `decimal.js` |
| Translations | `next-intl` |
| PWA | `@serwist/next` |
| Barcode and QR (POS, terminal) | `jsbarcode`, `qrcode` |
| Back office | `@refinedev/core` + `@refinedev/nextjs-router`, TanStack Table |
| Errors and tracing | `@sentry/nextjs` (with the backend trace ID header) |
| Tests | Vitest, Testing Library, Playwright |

## 7. Build and hosting

- Each web app builds to a Next.js `standalone` Docker image and runs on the same Kubernetes cluster as the API (2+ replicas each), behind Cloudflare.
- `/_next/static/*` files are content-hashed and cached for a year at the CDN; HTML pages follow their ISR settings.
- The ISR and data cache use a custom `cacheHandler` backed by Redis, so all replicas serve the same revalidated page.
- Headers: strict Content-Security-Policy with nonces, HSTS, `X-Frame-Options: DENY` (except where the virtual-games provider must be framed, R2), `Referrer-Policy: strict-origin-when-cross-origin`.
- Patching: Renovate for dependencies; Next.js and React security releases deployed within 48 hours.

## 8. Performance budgets

| Item | Budget |
| --- | --- |
| Player web: first-load JavaScript on the home page (gzip) | < 150 KB |
| Player web: home page HTML + data | < 100 KB |
| Player web: Largest Contentful Paint on throttled 3G (Lighthouse mobile) | < 2.5 s |
| Player web: repeat visit | App shell from the service worker; only data over the network |
| Match detail (main group) | < 15 KB of data |
| POS: scan to ticket status | < 1 s |
| POS: Sell to receipt printing | < 3 s |
| Android APK (per ABI) | < 25 MB |
| Android cold start to home on a mid-range phone on 3G | < 3 s |
| Android home screen data (warm dictionary) / first run | < 60 KB / < 300 KB |

The web budgets are enforced in CI with `size-limit` and Lighthouse CI; a pull request that breaks one fails.

## 9. SEO and very old browsers

Because pages are server-rendered, match and league pages are indexable with `sitemap.xml`, canonical URLs per language and sports-event structured data. Proxy browsers such as Opera Mini receive readable HTML; the ticket-check page is a plain form (a Server Action with progressive enhancement), so it works without JavaScript. Placing bets needs JavaScript.

## 10. Flutter Android app

```
client/mobile/lib/
├─ main.dart, app.dart          # bootstrap, router, theme
├─ core/
│  ├─ api/        # dio client, interceptors (auth refresh, idempotency, tenant, lang), generated OpenAPI models
│  ├─ db/         # Drift (SQLite): dictionary, favourites, slips, cached lists
│  ├─ money/      # Money + Decimal helpers
│  ├─ slipcalc/   # Dart port of C07, runs the same golden CSV
│  ├─ l10n/       # ARB files am / en
│  └─ telemetry/  # crash reporting, trace-id header
└─ features/      # auth, home, sports, search, betslip, mybets, wallet, kyc, promotions, account, inbox, virtuals (R2)
```

Each feature has `data/` (repositories over the API and local DB), `domain/` (models) and `ui/` (screens), with Riverpod providers.

| Need | Package |
| --- | --- |
| State | `flutter_riverpod` |
| Navigation and deep links | `go_router` (`/match/:id`, `/b/:bookingCode`, `/t/:ticket`, same paths as the web: /match/{id}, /b/{code}, /t/{ticket}) |
| HTTP | `dio` + a generated client from OpenAPI |
| Local DB | `drift` (SQLite) |
| Money | `decimal` |
| Secure storage | `flutter_secure_storage` (refresh token) |
| Push | `firebase_messaging` |
| WebView (R2) | `webview_flutter` |
| Images | `cached_network_image` (WebP from the CDN) |
| Crash reporting | `sentry_flutter` |

**Screens and calls** (same endpoints as the web): splash loads `/v1/config/public`, `/v1/app/version` and the dictionary (stored in Drift, 304 when unchanged); home and lists show cached data first and refresh in the background; match detail loads the main group, then others on tab open; the slip is local (up to 3 slips, persisted in Drift) with totals from the Dart `slipcalc`; balances are never cached.

**Release and update**: semantic versions; `/v1/app/version` returns `min_supported` and `latest`, and below the minimum the app shows a blocking update screen with a download link and checksum; staged rollout by serving the new APK to a share of update checks.

## 11. Tests

- **Shared**: the golden slip CSV runs in pytest, Dart tests and Vitest; any difference fails CI.
- **Web**: Vitest and Testing Library for components; Playwright end-to-end in Chrome, Firefox and WebKit for the player web, and in Chrome kiosk for terminal and POS (including the terminal code → POS sale → receipt → scan → pay flow and a silent-print check on the pilot printer); `size-limit` and Lighthouse CI budgets; axe accessibility checks.
- **Android**: widget tests per screen; integration tests on a real low-end device (2 GB RAM) over throttled 3G; text scale 1.3 and contrast checks.
