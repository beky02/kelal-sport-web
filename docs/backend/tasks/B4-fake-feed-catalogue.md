---
id: B4
title: C05 fake feed and C06 catalogue (milestone M1)
status: todo
depends_on: [B1]
components: [C05, C06]
contract_tags: [Catalogue]
touches_money: false
---

# B4 — Fake feed and catalogue

## Goal
Real catalogue endpoints with moving odds from the fake feed, so the web app switches its catalogue screens
from Prism to the real API (M1).

## Read first
- `docs/engineering-decisions.md` D5 (margin formula, fake feed behaviour, Redis keys and tags, dictionary, cursor, search, name templates, cache layers)
- `docs/design/components/c05-odds-feed.md`, `c06-sports-catalogue.md`
- `docs/design/td-02-data-architecture.md` (feed and catalogue schemas, Redis keys)
- `contracts/openapi.yaml`, tag `Catalogue` (`scripts/contract_check.py --missing Catalogue`)

## Scope
In: `feed` and global `catalogue` schemas (no RLS) plus tenant margin rules; `apps/feed` with the `FakeFeed`
adapter going through the normal pipeline (raw message → id mapping → catalogue → Redis → events); dictionary
builder; all Catalogue endpoints; margins applied at read time in C06; suspension rules. `dictionary_version`
in `GET /v1/config/public` (B1 serves the placeholder `0` from `modules/tenancy/service/public.py`; replace it
with the catalogue's dictionary version through the catalogue interface).
Out: real provider adapters (B11), live betting.

## Acceptance criteria
- [ ] **AC-1** Every `Catalogue` operation in the contract is implemented and `make conformance` passes for that tag.
- [ ] **AC-2** Fake feed seeds the contract fixtures (`fx_stgeorge_fasil`, `fx_arsenal_chelsea`, `fx_real_barca`, outcome IDs as in the contract) plus 3 generated leagues of 10 fixtures over 14 days.
- [ ] **AC-3** Margin: unit tests of `new = 1/(1/raw + m/n)` floored to 2 dp, most specific rule wins, and an outcome below `min_odds` is suspended, never clamped.
- [ ] **AC-4** Odds move every 5 s within D5 bounds (overround ≥ 1.05, odds 1.01–100); markets suspend at kick-off; scripted results are published 2 h after kick-off (tests with a frozen clock).
- [ ] **AC-5** Cursor pagination is stable while odds move; search requires ≥ 2 characters and matches translated names.
- [ ] **AC-6** Responses carry `Vary: Accept-Language, X-Tenant-Id` and cache headers per D5.
