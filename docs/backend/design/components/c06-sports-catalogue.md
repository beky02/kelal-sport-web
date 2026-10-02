# C06 Sports Catalogue

## 1. Purpose & scope

C06 turns the feed's global data into what each tenant's players browse: enabled sports and leagues, fixtures, markets and prices with the tenant margin, translated names, and search. It implements CAT-01 to CAT-08 and targets NFR-P2 and NFR-P5 (low data).

## 2. Research notes

| Observation | Design response |
| --- | --- |
| HuluSport sends a 2.4 MB “coredata” file plus 1.4 MB of fixtures on first load | Versioned dictionary (\~40–80 KB gzipped) cached on device; fixtures paged by 20 |
| 1xBet/Melbet use small, paged feeds with numeric market IDs and a separately cached market-name dictionary; `max-age=10` pre-match | Same pattern: IDs in lists, names from the dictionary; 10 s edge cache |
| Market names are templates with specifiers (`Total {total}`) | Templates stored once in the dictionary; the client renders names |

## 3. Data ownership model

- **Global tables** (no `tenant_id`, written only by C05): `sport`, `category`, `tournament`, `competitor`, `fixture`, `market_template`, `outcome_template`, `market`, `outcome` (raw odds).
- **Tenant overlay tables** (with `tenant_id`, written by C15/C16): `tenant_sport`, `tenant_tournament`, `tenant_market_template`, `tenant_margin_rule`, `featured_fixture`, `market_override`.
- **Displayed price** = `apply_margin(raw_odds, tenant_rule)`, computed at read time and cached per tenant (arithmetic is cheap; one global odds copy stays the source of truth).

## 4. Internal structure

| Package | Contents |
| --- | --- |
| `catalogue/write` | Interface used by C05: `upsert_fixture`, `upsert_market`, `set_market_status`, `suspend_producer` |
| `catalogue/read` | `DictionaryBuilder`, `EventListQuery`, `EventDetailQuery`, `SearchQuery`, `PriceService` (margin + rounding) |
| `catalogue/api` | `/v1/dictionary`, `/v1/sports`, `/v1/events`, `/v1/events/{id}`, `/v1/events/popular`, `/v1/search` |
| `catalogue/i18n` | Translation table + fallback (am → en → provider name) |

## 5. Data model

```sql
create table catalogue.sport (id uuid primary key, provider_urn text unique, name text not null, icon text, sort int);
create table catalogue.category (id uuid primary key, sport_id uuid not null references catalogue.sport(id),
  provider_urn text unique, name text not null, country_code char(2));
create table catalogue.tournament (id uuid primary key, category_id uuid not null references catalogue.category(id),
  provider_urn text unique, name text not null);
create table catalogue.competitor (id uuid primary key, provider_urn text unique, name text not null, abbreviation text);

create table catalogue.fixture (
  id            uuid primary key,
  provider_urn  text unique not null,
  tournament_id uuid not null references catalogue.tournament(id),
  home_id       uuid references catalogue.competitor(id),
  away_id       uuid references catalogue.competitor(id),
  start_time    timestamptz not null,
  status        text not null check (status in ('not_started','live','suspended','ended','closed','cancelled','postponed','abandoned')),
  is_outright   boolean not null default false,
  updated_ts_ms bigint not null            -- last provider timestamp applied
);
create index ix_fixture_start on catalogue.fixture (start_time) where status = 'not_started';

create table catalogue.market_template (
  id uuid primary key, provider_market_id text unique not null,
  name_template text not null,             -- e.g. 'Total {total}'
  group_code text not null,                -- main, goals, halves, handicap, corners, player
  sort int not null default 100,
  is_variant boolean not null default false
);
create table catalogue.outcome_template (
  id uuid primary key, market_template_id uuid not null references catalogue.market_template(id),
  provider_outcome_id text not null, name_template text not null, sort int,
  unique (market_template_id, provider_outcome_id)
);

create table catalogue.market (
  id            uuid primary key,
  fixture_id    uuid not null references catalogue.fixture(id),
  template_id   uuid not null references catalogue.market_template(id),
  specifiers    text not null default '',  -- canonical 'hcp=1:0|total=2.5', sorted keys
  status        text not null check (status in ('active','suspended','deactivated','settled','cancelled')),
  producer_id   int not null,
  updated_ts_ms bigint not null,
  unique (fixture_id, template_id, specifiers)
);
create table catalogue.outcome (
  id             uuid primary key,
  market_id      uuid not null references catalogue.market(id),
  outcome_tpl_id uuid not null references catalogue.outcome_template(id),
  odds_raw       numeric(10,3),
  active         boolean not null default true,
  unique (market_id, outcome_tpl_id)
);

-- tenant overlays
create table catalogue.tenant_tournament (tenant_id uuid, tournament_id uuid, enabled boolean not null default true,
  sort int, primary key (tenant_id, tournament_id));
create table catalogue.tenant_margin_rule (
  id uuid primary key, tenant_id uuid not null,
  scope text not null check (scope in ('global','sport','tournament','market_template')),
  scope_id uuid, margin_pct numeric(5,2) not null,   -- extra margin to apply
  min_odds numeric(10,3) not null default 1.01, created_at timestamptz not null default now()
);
create table catalogue.featured_fixture (tenant_id uuid, fixture_id uuid, sort int, until timestamptz,
  primary key (tenant_id, fixture_id));
create table catalogue.translation (entity text, entity_id uuid, lang text, name text,
  primary key (entity, entity_id, lang));
create table catalogue.dictionary_version (tenant_id uuid, lang text, version bigint, built_at timestamptz,
  primary key (tenant_id, lang));
```

## 6. API

```json
// GET /v1/dictionary?version=41   → 304 if current, else:
{
  "version": 42,
  "sports": [{ "id": "s1", "name": "እግር ኳስ", "icon": "football" }],
  "tournaments": [{ "id": "t9", "sport_id": "s1", "country": "GB", "name": "Premier League" }],
  "market_templates": [{ "id": "m17", "name": "Total {total}", "group": "goals",
     "outcomes": [{ "id": "o12", "name": "Over {total}" }, { "id": "o13", "name": "Under {total}" }] }]
}

// GET /v1/events?sport=s1&date=2026-10-04&limit=20&cursor=…
{ "items": [{
    "id": "f_0192…", "tournament_id": "t9", "home": "Arsenal", "away": "Chelsea",
    "start_time": "2026-10-04T14:00:00Z", "markets_count": 184,
    "main": { "id": "mk_…", "template_id": "m1", "specifiers": {}, "status": "active",
              "outcomes": [{ "id": "oc_ac_1", "tpl": "o1", "odds": "2.10", "active": true },
                           { "id": "oc_ac_x", "tpl": "o2", "odds": "3.40", "active": true },
                           { "id": "oc_ac_2", "tpl": "o3", "odds": "3.30", "active": true }] } }],
  "next_cursor": "…" }

// GET /v1/events/{id}?groups=main,goals
{ "id": "f_0192…", "status": "not_started", "markets": [
  { "id": "mk_…", "template_id": "m17", "specifiers": { "total": "2.5" }, "status": "active",
    "outcomes": [{ "id": "oc_…", "tpl": "o12", "odds": "1.85", "active": true }] } ] }
```

List views carry the real outcome ID (`id`) next to the template ID (`tpl`), so a tap on odds in a list goes straight into the bet slip, booking or placement without loading the match first (fixed 30 Sep 2026; earlier drafts sent `[outcome_tpl, odds]` pairs, which lacked the ID). Names still come from the dictionary, so a 20-fixture page stays around 10 KB gzipped; the CI size check below applies. The exact shape is `EventSummary` in `contracts/openapi.yaml`.

## 7. Pricing with margin

The provider's odds already include its margin. Our extra margin is applied per outcome as `new = 1 / (1/raw + m/n)`, where `m` = margin\_pct / 100 (the added margin) and `n` the number of active outcomes in the market, then floored to 2 decimals; if the result is below `min_odds` the outcome is suspended (never priced up). Flooring protects the house.

## 8. Events

| Consumes | Action |
| --- | --- |
| `feed.odds_changed` | Invalidate list caches containing the fixture (tag-based: `fx:{id}`) |
| `feed.bet_stop`, `feed.producer_down/up` | Status already written by C05; invalidate caches |
| `config.changed` (catalogue keys) | Rebuild dictionary, bump version |

## 9. Configuration

`catalogue.page_size` (20), `catalogue.horizon_days` (14), `catalogue.main_market_by_sport` (football: 1X2; basketball: moneyline incl. OT; tennis: match winner), `catalogue.cache_ttl_s` (10), `catalogue.default_lang` (am).

## 10. Edge cases

- **Fixture starts** → remove from pre-match lists at `start_time` even if the feed is late, and reject bets (BET-05).
- **Missing translations** → fall back to English, then provider names; untranslated names are logged for the translation backlog.
- **Outrights** (e.g. league winner) are listed in a separate “Outrights” tab with their own settlement timing.

## 11. Tests

Snapshot tests of response shapes and sizes (fail CI if a list page exceeds 12 KB gzipped); margin maths property tests (displayed odds ≤ raw odds; odds below min\_odds are suspended, never shown); cache invalidation tests.
