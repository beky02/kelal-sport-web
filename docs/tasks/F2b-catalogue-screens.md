---
id: F2b
title: Server-rendered catalogue, popular, lazy market groups, paging, phone search
status: todo
depends_on: [F2a]
contract_tags: [Catalogue]
touches_money: false
touches_ui: true
---

# F2b — Catalogue screens

## Goal

Every catalogue screen works against Prism the way C18 describes: public lists arrive as HTML for 3G,
odds refresh every 30 s while visible, the match page loads its main group first, lists page with the
cursor, and phones get search.

## Read first

- `docs/decisions.md` **FD5** (Search takes Live's tab slot)
- `docs/backend/engineering-decisions.md` D5 (lists, cursor, search ≥ 2 chars, dictionary
  versions, caching layers)
- `docs/backend/design/components/c18-client-apps.md` §4.1 (rendering per route), §8 (budgets)
- `docs/backend/design/components/c06-sports-catalogue.md`
- `contracts/openapi.yaml`: `/v1/events` (cursor), `/v1/events/popular`, `/v1/events/{id}?groups=`,
  `/v1/search`, `/v1/dictionary` (`version`, 304)
- Existing: `src/lib/server/catalogue.ts`, `src/lib/api/mappers/catalogue.ts`, `src/features/sportsbook`,
  `src/features/search`, `src/components/layout/MobileTabBar.tsx`

## Scope

In:

- Server Components for `/{lang}`, sport and league pages with ISR 15 s, hydrating the TanStack Query
  cache so the client keeps polling (30 s, paused while the tab is hidden).
- Home: popular (`/v1/events/popular`) and today.
- Match page: main group server-rendered; other groups fetched when their tab opens (`groups=`).
- Infinite scroll with `next_cursor`.
- Dictionary: send `version`, keep the cached copy on 304.
- Search: ≥ 2 characters (D5). Phone and tablet search screen at `/{lang}/search` reusing `useSearch`
  and the header's result rows; the tab bar's second slot is Search when `features.live` is off (FD5).

Out: `/odds/[slug]` SEO pages; contract requests 001–003 (finish when they land).

## Acceptance criteria

- [ ] **AC-1** `/am` returns the three contract matches in the initial HTML — Playwright with JavaScript
      disabled.
- [ ] **AC-2** Odds refetch every 30 s while visible and stop while hidden (hook test, fake timers).
- [ ] **AC-3** `/am/match/fx_arsenal_chelsea` renders the main group; opening Goals requests
      `groups=goals` (network assertion).
- [ ] **AC-4** A 304 from `/v1/dictionary` keeps the cached dictionary (loader test).
- [ ] **AC-5** One character sends no search request; "ars" shows Arsenal v Chelsea; on a 375 px phone the
      tab bar shows Sports · Search · Bet slip · My bets · Menu with the slip centred (`pnpm ui` screenshot).
- [ ] **AC-6** A suspended market shows locks on board and match page.
- [ ] **AC-7** Home first-load JS stays under 150 KB gzip (`pnpm build` output recorded).
