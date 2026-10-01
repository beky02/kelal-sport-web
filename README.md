# KelalSport — web

Sportsbook frontend for Ethiopia: odds, live scores, and a bet slip that shows
its working. Built from the design project **Kelal Sport Ethiopia**
(`Kelal Sport Canvas.dc.html`), with the backend as a separate service.

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Runs against an in-repo mock repository by default — no backend needed.

| Script            |                        |
| ----------------- | ---------------------- |
| `pnpm dev`        | dev server (Turbopack) |
| `pnpm build`      | production build       |
| `pnpm test`       | unit + component tests |
| `pnpm test:watch` | tests in watch mode    |
| `pnpm typecheck`  | `tsc --noEmit`         |
| `pnpm lint`       | ESLint                 |
| `pnpm format`     | Prettier               |

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
  move to the backend: a limit that lives in one browser is not a limit.
- Notification preferences are local for the same reason.

## Layout

```
src/
├── app/                 routes, providers, design tokens
├── components/
│   ├── ui/              primitives (Button, Segmented, Sheet, OddsButtonView…)
│   ├── layout/          header, sidebar, shell
│   └── feedback/        empty / error / placeholder states
├── features/            one folder per domain: api · components · hooks · lib · types
│   ├── sportsbook/  events/  markets/  odds/  competitions/  sports/
│   ├── bet-slip/        selections, payout maths, the slip UI
│   └── wallet/
├── lib/
│   ├── api/             client, Zod schemas, mock repository
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

| Variable                |                                          |
| ----------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_API_URL`   | backend REST base, versioned (`/api/v1`) |
| `NEXT_PUBLIC_WS_URL`    | realtime gateway                         |
| `NEXT_PUBLIC_USE_MOCKS` | `true` serves the in-repo repository     |
| `NEXT_PUBLIC_REALTIME`  | `off` · `simulate` · `on`                |

`NEXT_PUBLIC_REALTIME=simulate` drives the real parse → patch → re-render path
with no gateway, biased towards prices already in the slip so the
accept-odds-changes flow is visible. Switching to the backend is two env vars and
no UI changes — that is the point of `lib/api`.

Nothing secret goes in a `NEXT_PUBLIC_*` variable; it reaches the browser.

## The money rule

The frontend never decides money. `features/bet-slip/lib/calculate.ts` produces a
display estimate; the engine recomputes everything on placement and wins. The tax
rates and max-win cap in `config/constants.ts` are **placeholders** pending a
`/config` endpoint, as are the licence number and helpline copy.

## Tests

`pnpm test` — 92 tests.

The ones to keep an eye on:

- `tests/unit/calculate.test.ts` — payout maths in all three modes, the cap,
  conflicts, suspensions, balance. Anchored on the design's own reference slip
  (1.62 × 3.05 × 1.38 at a 100 stake → **ETB 507.64**).
- `tests/component/BetSlip.test.tsx` — the journey that matters most: a price
  moves while the pick is in the slip, and the bet cannot proceed until the user
  accepts it.
- `tests/unit/realtime.test.ts` — the identity-preservation contract the board's
  render performance depends on.
- `tests/unit/i18n.test.ts` — the two catalogues cannot drift.
- `tests/unit/ethiopian-date.test.ts` — calendar conversion, round-tripped across
  a leap cycle.

Playwright is not installed. When it is, the first journey to automate is the one
above, end to end in a browser.

## Translations

Most Amharic comes from the design project's own string tables. Strings that had
to be composed are listed in `src/lib/i18n/messages/TRANSLATION-NOTES.md` and
need a native speaker's review before launch.
