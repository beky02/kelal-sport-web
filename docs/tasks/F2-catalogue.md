---
id: F2
title: Catalogue screens — server-rendered lists, /match/[id], popular, search, dictionary
status: todo
depends_on: [F0]
contract_tags: [Catalogue]
touches_money: false
touches_ui: true
---

# F2 — Catalogue

## Goal

Every catalogue screen works against Prism the way C18 describes: public lists render on the server for
fast HTML on 3G, odds refresh every 30 s while visible, match pages load the main group first and the
others on tab open, and deep links follow D7.

## Read first

- `../kelal backend/docs/engineering-decisions.md` D5 (lists, cursor, search ≥ 2 chars, templates,
  caching layers), D7 (deep links)
- `../kelal backend/docs/design/components/c18-client-apps.md` §4.1 (rendering per route), §8 (budgets)
- `../kelal backend/docs/design/components/c06-sports-catalogue.md`
- `contracts/openapi.yaml`: `/v1/events` (cursor), `/v1/events/popular`, `/v1/events/{id}?groups=`,
  `/v1/search`, `/v1/dictionary` (`version`, 304)
- Existing: `src/lib/server/catalogue.ts`, `src/lib/api/mappers/catalogue.ts`, `src/features/sportsbook`

## Scope

In:

- Server Components for `/`, sport and league lists with ISR 15 s, hydrating the TanStack Query cache so
  the client keeps polling (30 s, paused when the tab is hidden).
- Home: popular (`/v1/events/popular`) and today.
- Match page at `/match/[id]` (redirect from `/event/[id]`); main group server-rendered, other groups
  fetched when their tab opens (`groups=`).
- Infinite scroll with `next_cursor`.
- Dictionary: send `version`, keep the cached copy on 304.
- Search: at least 2 characters (D5); results link to match and league pages.
- League page from the dictionary (`/league/[id]`, redirect from `/competition/[id]`).

Out: language in the URL (open decision 2 — ask first), `/odds/[slug]` SEO pages.

## Acceptance criteria

- [ ] **AC-1** `/` returns the three contract matches in the initial HTML (no client fetch needed to see
      them) — Playwright with JavaScript disabled.
- [ ] **AC-2** Odds refetch every 30 s while visible and stop while hidden (hook test with fake timers).
- [ ] **AC-3** `/match/fx_arsenal_chelsea` shows the main group first; opening Goals requests
      `groups=goals` (network assertion).
- [ ] **AC-4** `/event/fx_arsenal_chelsea` redirects to `/match/fx_arsenal_chelsea`.
- [ ] **AC-5** A 304 from `/v1/dictionary` keeps the cached dictionary (loader test).
- [ ] **AC-6** Search sends no request for one character and shows results for "ars".
- [ ] **AC-7** A suspended market (Prism example) shows locks on board and match page.

## Notes

Contract requests 001–003 affect these screens; finish them when they land.
