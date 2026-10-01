---
id: F0
title: Wire the catalogue to the contract through route handlers
status: done
depends_on: []
contract_tags: [Catalogue]
touches_money: false
touches_ui: true
---

# F0 — Wire the catalogue to the contract

## Goal

The board, sidebar, event page and search read the contract's catalogue operations through this app's own
route handlers, not the hand-written mock, so the screens show exactly what Prism (and later the backend)
serves.

## Read first

- `../kelal backend/docs/build-plan.md` §2 F0
- `../kelal backend/docs/engineering-decisions.md` D3 (tenant header, browser never calls the API), D5
  (dictionary, name templates, 30 s refresh), D7 (mock-to-real by tag, Gregorian dates), D8 (no live)
- `contracts/openapi.yaml`: `GET /v1/dictionary`, `/v1/sports`, `/v1/events`, `/v1/events/{id}`, `/v1/search`

## Scope

In: generated types (`pnpm api:types`); server-side `openapi-fetch` client with `X-Tenant-Id`,
`Accept-Language`, `X-Request-Id`, routed by tag (D7); mappers to the domain types; route handlers under
`/api/catalogue/*`; Problem-format `ApiError`; 30 s polling with realtime off; Gregorian default with the
Ethiopian calendar as a preference; Release 2 flags for live and cash out.

Out: bets, wallet, auth, responsible gaming (still on the mock repository until F4–F7).

## Acceptance criteria

- [x] **AC-1** The home page renders the three contract matches from Prism (Saint George v Fasil Kenema,
      Arsenal v Chelsea, Real Madrid v Barcelona), each under its dictionary tournament.
- [x] **AC-2** The browser makes no request to the API host; only `/api/catalogue/*`.
- [x] **AC-3** Mappers are tested against the contract's own examples (`tests/unit/catalogue-mappers.test.ts`).
- [x] **AC-4** A suspended market shows locks, not prices (Real Madrid v Barcelona).
- [x] **AC-5** Event page shows the fixture's groups from the dictionary and filled name templates
      (`Total 2.5`, `Over 2.5`).
- [x] **AC-6** Live link and `/live` gone, cash out hidden, realtime off by default (D8).

## Notes

- 2026-10-01: done on `main` before the task workflow existed. Evidence in `F0/verification.md`.
- Contract requests raised: `docs/contract-requests/001`–`003` (board markets, crests, rounds).
