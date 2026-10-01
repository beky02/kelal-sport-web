# KelalSport — web

Sportsbook frontend for Ethiopia: odds, live scores, and a bet slip that shows
its working. Built from the design project **Kelal Sport Ethiopia**
(`Kelal Sport Canvas.dc.html`), with the backend as a separate service.

```bash
pnpm install
cp .env.example .env.local
pnpm dev          # http://localhost:3000
```

The catalogue comes from the API contract (`contracts/openapi.yaml`, owned by the
backend repo) through this app's route handlers. Locally the API is **Prism**
serving the contract's examples on `:4010` — the backend's `make up` starts it,
or run `pnpm mock`. Bets, wallet, auth and responsible gaming still use the
in-repo mock repository until tasks F4–F7 rewire them (`docs/tasks/`).

| Script               |                                                              |
| -------------------- | ------------------------------------------------------------ |
| `pnpm dev`           | dev server (Turbopack)                                       |
| `pnpm mock`          | Prism on :4010 (if the backend's compose isn't running it)   |
| `pnpm check`         | typecheck, lint, Prettier, unit + component tests            |
| `pnpm verify`        | check + generated types + contract drift + build + UI check  |
| `pnpm ui`            | every screen, phone and desktop, English and Amharic → PNGs  |
| `pnpm api:types`     | regenerate `src/lib/api/schema.d.ts` from the contract       |
| `pnpm contract:sync` | copy `contracts/` from the backend repo and regenerate types |
| `pnpm test:watch`    | tests in watch mode                                          |

Working with Claude Code: open the session in this folder and run `/task F3`
(see `CLAUDE.md` and `docs/tasks/README.md`).

## Stack

Next.js App Router · TypeScript · Tailwind v4 · TanStack Query · Zustand · Zod ·
Radix · lucide-react · Vitest + Testing Library

Next.js is used as the **application shell only**. The sportsbook is a highly
interactive client app that happens to live inside it; no API routes, no server
actions, no betting logic. The backend stays independent.

## What is built

- **Sportsbook board** — competitions, fixtures, 1X2 / double chance / total
  goals, live scores and minutes, odds movement, suspended markets, favourites,
  day picker, search, filters in the URL.
- **Event page** — the full book for one fixture: every market and line, grouped
  by category.
- **Bet slip** — single / multiple / system, stake and quick chips, both
  Ethiopian taxes, the per-ticket cap, a step-by-step calculation panel,
  same-match conflict detection, suspension handling, accept-odds-changes (per
  pick or all), a stake rejection that offers the fix, guest booking codes, and
  placement against a mock engine that returns a ticket.
- **My bets** — open / settled / won / lost, ticket detail with the full money
  trail and a barcode, cash out in whole or in part, and transactions.
- **Wallet** — balance and withdrawable, daily limit, deposit and withdrawal
  through six providers: method, amount, confirm, then polling to success or
  failure. Withdrawals gated on ID verification.
- **Auth** — phone, SMS code, password, Fayda KYC, login and password reset, in a
  dialog over the page so a built slip is never lost to a navigation.
- **Responsible gaming** — deposit and loss limits, session reminders, breaks and
  self-exclusion. A break is account state, so it locks every price and survives
  navigation.
- **Profile** — theme, language, Ethiopian clock, data saver, notifications, ID
  status, log out.
- **System states** — offline, maintenance, age gate, reality check, session
  expiry, deposit limit reached.
- **Realtime layer** — validated message contract, reconnect with backoff,
  heartbeat, ref-counted topic subscriptions, and cache patching that preserves
  object identity so one price moving re-renders one button.
- **Bilingual** — English and Amharic throughout, including script-aware
  typography and the Ethiopian calendar and clock.
- **Dark and light**, no flash on load.
- **Responsive** — 248/fluid/340 at ≥1440px, 228/fluid/312 at ≥1280px, sidebar +
  board ≥1024px, single column below, with the slip as a bottom sheet and the
  sidebar as a drawer.

### Still to do

- `/terms`, `/privacy`, `/help` and `/telegram` are content pages with no design;
  they render `components/feedback/PhasePlaceholder.tsx`. Delete that component
  when the last one is written.
- The ticket and booking barcodes are representative, not machine-readable. They
  need real Code 128 before agent shops scan tickets — only `pattern()` in
  `components/ui/Barcode.tsx` has to change.
- Deposit and loss limits are local state. They belong to the account and must
  move to the backend: a limit that lives in one browser is not a limit (F7).
- Notification preferences are local for the same reason.
- Everything else is in `docs/tasks/` (F1–F10), in build-plan order.

## Layout

```
src/
├── app/                 routes, providers, design tokens, api/ route handlers
├── components/
│   ├── ui/              primitives (Button, Segmented, Sheet, OddsButtonView…)
│   ├── layout/          header, sidebar, shell
│   └── feedback/        empty / error / placeholder states
├── features/            one folder per domain: api · components · hooks · lib · types
│   ├── sportsbook/  events/  markets/  odds/  competitions/  sports/
│   ├── bet-slip/        selections, payout maths, the slip UI
│   └── wallet/
├── lib/
│   ├── api/             browser client, Zod schemas, generated contract types,
│   │                    mappers (contract → domain), mock repository (until F7)
│   ├── server/          server only: upstream client, catalogue loaders, respond()
│   ├── query/           QueryClient, query keys
│   ├── i18n/            catalogues, formatting, Ethiopian calendar
│   ├── websocket/       contract, client, cache patching, dev simulator
│   └── utils/
├── stores/              ui · session
├── config/              env · routes · constants
└── types/
```

## Configuration

Copy `.env.example` to `.env.local`.

| Variable                                                   |                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| `API_BASE_URL`                                             | server only: the API — Prism `http://localhost:4010` locally   |
| `API_REAL_URL`, `API_REAL_TAGS`                            | server only: send these contract tags to the real backend (D7) |
| `DEFAULT_TENANT`, `TENANT_HOST_MAP`                        | server only: `X-Tenant-Id` by host (D3)                        |
| `NEXT_PUBLIC_USE_MOCKS`                                    | `true` serves the mock repository for not-yet-rewired features |
| `NEXT_PUBLIC_REALTIME`                                     | `off` (Release 1, polls every 30 s) · `simulate` · `on`        |
| `NEXT_PUBLIC_WS_URL`                                       | realtime gateway (Release 2)                                   |
| `NEXT_PUBLIC_FEATURE_LIVE`, `NEXT_PUBLIC_FEATURE_CASH_OUT` | Release 2 screens, off by default (D8)                         |

The browser never calls the API: it calls `/api/*` here, and the route handlers
call the API with the tenant header (D3). Nothing secret goes in a
`NEXT_PUBLIC_*` variable; it reaches the browser.

## The money rule

The frontend never decides money. The slip's figures must come from the shared
calculator `contracts/golden/ts/slipcalc.ts` (Engineering Decisions D1) with the
tenant's rule set from `/v1/config/public`; the engine re-prices on placement
and wins. Until F3 lands, `features/bet-slip/lib/calculate.ts` is a float
estimate that differs from D1, and the tax rates, max-win cap, licence number and
helpline in `config/constants.ts` are **placeholders**.

## Tests

`pnpm test` — 118 tests. `pnpm ui` — 44 screen checks.

The ones to keep an eye on:

- `tests/unit/catalogue-mappers.test.ts` — contract → domain mapping, using the
  contract's own examples (`tests/contract.ts`), so a contract change that breaks
  a screen fails here.
- `tests/unit/calculate.test.ts` — payout maths in all three modes, the cap,
  conflicts, suspensions, balance. Anchored on the design's own reference slip
  (1.62 × 3.05 × 1.38 at a 100 stake → ETB 507.64 under the old float maths; F3
  replaces it with the D1 figure).
- `tests/component/BetSlip.test.tsx` — the journey that matters most: a price
  moves while the pick is in the slip, and the bet cannot proceed until the user
  accepts it.
- `tests/unit/realtime.test.ts` — the identity-preservation contract the board's
  render performance depends on.
- `tests/unit/i18n.test.ts` — the two catalogues cannot drift.
- `tests/unit/ethiopian-date.test.ts` — calendar conversion, round-tripped across
  a leap cycle.

- `tests/e2e/screens.spec.ts` (`pnpm ui`) — every screen at 375 and 1440 px in
  English and Amharic, failing on console errors, sideways scroll, raw message
  keys or unfilled placeholders. Uses the installed Chrome; screenshots land in
  `test-results/ui/`.

## Translations

Most Amharic comes from the design project's own string tables. Strings that had
to be composed are listed in `src/lib/i18n/messages/TRANSLATION-NOTES.md` and
need a native speaker's review before launch.
