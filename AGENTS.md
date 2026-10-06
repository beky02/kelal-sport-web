<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# KelalSport web

Sportsbook frontend for Ethiopia. The backend is a **separate service**
(`../kelal backend`, FastAPI) that owns the API contract. This repo renders
screens and runs the route handlers that call the API on the browser's behalf
(D3) — no business rules live here.

## The rule that matters most

The frontend never decides money. It displays state and collects actions.

Every number on the slip — stake per line, stake tax, gross, accumulator
bonus, win tax, net payout — comes from the shared slip calculator
`contracts/golden/ts/slipcalc.ts` (Engineering Decisions D1), which matches
the backend to the santim on all 366 golden rows. It is a _preview_; the
betting engine re-prices when the bet is placed and its answer is the one that
counts. Until F3 lands, `features/bet-slip/lib/calculate.ts` is a float
estimate known to differ from D1 — don't extend it, replace it.

Optimistic updates are fine for selecting odds, opening panels and switching
filters. They are not fine for placing a bet, depositing, withdrawing or cashing
out: those wait for the server.

## How data flows

```
browser ──/api/*──▶ route handler (src/app/api) ──openapi-fetch──▶ sportsbook API
        ◀─domain JSON── lib/server/* + lib/api/mappers/* ◀──contract JSON──
```

- The browser only calls this app's own `/api/*` route handlers. They add
  `X-Tenant-Id` (from the host, `TENANT_HOST_MAP`), `Accept-Language` and
  `X-Request-Id`, and hold the session token in an httpOnly cookie the browser
  never reads (D3, from F4).
- `lib/server/upstream.ts` routes each call by its contract tag: tags in
  `API_REAL_TAGS` go to the real backend, the rest to Prism (D7).
- `lib/api/mappers/` turns contract shapes into the domain types the
  components use. Mappers are pure and tested against the contract's own
  examples (`tests/contract.ts`).

## Where state lives

| Kind     | Home                                      | Examples                                       |
| -------- | ----------------------------------------- | ---------------------------------------------- |
| Server   | TanStack Query, fed by route handlers     | events, markets, competitions, wallet          |
| Realtime | `lib/websocket` → patches the Query cache | Release 2; off — prices poll every 30 s (D5)   |
| Client   | Zustand (`stores/ui.store.ts`)            | theme, language, clock, calendar, what is open |
| Bet slip | Zustand (`features/bet-slip/stores`)      | selections, mode, stake                        |
| Filters  | **The URL**                               | sport, date, filter                            |

Board filters go in the URL so refresh, back and sharing work. Don't move them
into a store. Don't copy query results into Zustand.

## Conventions

- **Contract first.** Every call goes through the generated types in
  `src/lib/api/schema.d.ts` (`pnpm api:types`, never edited by hand). The
  contract in `contracts/` is a copy of the backend's — update it with
  `pnpm contract:sync`, never by hand. Need a field or endpoint the contract
  lacks? That is a contract request to the backend (`/contract-request`), not
  a local workaround.
- **Money and odds are decimal strings on the wire** (`"1250.00"`, `"2.10"`).
  Parse at the boundary; never do float arithmetic on them. Odds become
  numbers only for display; slip maths uses the strings (slipcalc).
- **Names come from the dictionary.** The API returns one language per
  request; sport, tournament, market and outcome names are templates from
  `/v1/dictionary` (`Total {total}` → `Total 2.5`). The route handlers fetch
  both languages so the UI keeps its `Localized` pairs.
- **Tokens, not hex.** Colours, radii and fonts are CSS variables in
  `app/globals.css`, exposed as Tailwind utilities (`bg-surface`, `text-muted`,
  `rounded-lg`). A raw `#hex` in a component is a bug.
- **Both languages, always.** Add every string to `en.json` _and_ `am.json`;
  `tests/unit/i18n.test.ts` fails otherwise. Never concatenate translated
  fragments — add a key with a `{placeholder}`. Composed Amharic goes in
  `TRANSLATION-NOTES.md` for review.
- **Amharic is not just longer.** It needs more line height and no uppercasing.
  That is handled by tokens keyed off `<html lang>`; don't hardcode `uppercase`
  or `tracking-*` on a label.
- **Dates are Gregorian, times East Africa Time** in Release 1 (D7). The
  Ethiopian calendar and clock are preferences, never the default.
- **Validate at the boundary.** Upstream responses are typed by the generated
  schema; what a route handler returns to the browser is checked by the Zod
  schemas in `lib/api/schemas.ts`, which carry `satisfies z.ZodType<Domain>`
  so a schema and its interface cannot drift.
- **Release 2 stays behind flags.** Live betting, realtime and cash out are
  built but off (`config/features.ts`, D8). Don't remove them; don't ship them on.
- **Preserve identity in realtime updates.** `applyToBoard` returns untouched
  objects by reference, and rows are `memo`ised, so one price moving re-renders
  one button. `tests/unit/realtime.test.ts` guards this.
- **Compose, don't add props.** An `EventRow` is assembled from `TeamLine`,
  `EventMeta` and `OddsGroup`. Resist the 20-prop component.
- **The sportsbook is shared with the shop kiosk** (F8ca). Its pages and
  components read what is site-specific — the frame, realtime, favourites,
  data saver, price locks, links — from `features/sportsbook/chrome.tsx`, and
  language, clock and calendar from `lib/i18n/locale.tsx`; never from
  `stores/ui.store` directly. `scripts/check-host-split.mjs` fails the build if
  the terminal loads the player's store.
- **Safety state is server state.** A responsible-gaming break is read with a
  query, never a Zustand store. A break a user could end by reloading would not
  be one. Same for balance, withdrawable, limits and KYC status.
- **A custom breakpoint sorts before the built-ins.** Tailwind emits `wide:`
  ahead of `lg:`/`xl:`, so overlapping responsive rules are decided by source
  order, not width. `SportsbookShell` uses bounded ranges (`lg:max-xl:`,
  `xl:max-wide:`, `wide:`) for that reason — don't collapse it into a cascade.
- **Rejections carry their fix.** Errors are RFC 7807 Problems; switch on
  `code` (`BET_ODDS_CHANGED`…), never on `title`. `errors[]` carries `current`
  and `limit` — the UI offers the correction rather than reporting and stopping.
