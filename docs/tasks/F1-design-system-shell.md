---
id: F1
title: Tenant theme from /v1/config/public, Ethiopic font, component gallery
status: todo
depends_on: [F0]
contract_tags: [Config]
touches_money: false
touches_ui: true
---

# F1 — Design system and shell

## Goal

One build serves every tenant: the root layout reads `/v1/config/public` on the server and applies the
tenant's brand colours, name, logo, languages and support links. The tokens, both themes, the Ethiopic
font and every state of the odds button are visible on one gallery page in both languages.

## Read first

- `../kelal backend/docs/engineering-decisions.md` D7 (theme token keys, fonts, money formats)
- `../kelal backend/docs/design/components/c18-client-apps.md` §4.3, §4.5, §8
- `contracts/openapi.yaml`: `GET /v1/config/public` (`PublicConfig`, `brand.colors`)
- Existing: `src/app/globals.css`, `src/app/layout.tsx`, `src/config/constants.ts` (placeholder `SYSTEM`,
  `LICENCE`, helpline), `src/components/ui/*`

## Scope

In:

- `lib/server/config.ts` loader + route; config fetched once per request in the root layout (server),
  cached per tenant.
- Map `brand.colors` keys (D7: `primary`, `primary_contrast`, `accent`, `background`, `surface`, `text`,
  `text_muted`, `border`, `odds_up`, `odds_down`, `danger`, `success`) onto the existing CSS variables; the
  current values stay as defaults for missing keys.
- Brand name, logo, support (Telegram, phone) and licence copy from config instead of `config/constants.ts`
  placeholders; `real_money_enabled: false` shows a clear notice and disables placing.
- Noto Sans Ethiopic subset (WOFF2) via `next/font`, alongside the Latin UI font.
- `/dev/components` (development only): tokens, both themes, odds button in normal, selected, suspended,
  price-up and price-down states, buttons, fields, sheet — in English and Amharic.

Out: per-tenant language lists in the URL (open decision 2), PWA.

## Acceptance criteria

- [ ] **AC-1** With Prism's config, the header shows the tenant's brand name and the primary colour from
      `brand.colors.primary` (test on the mapper + screenshot).
- [ ] **AC-2** A config missing colour keys falls back to the defaults (unit test).
- [ ] **AC-3** No placeholder licence/helpline strings remain in components; they come from config.
- [ ] **AC-4** `/dev/components` shows every odds-button state in both languages (`pnpm ui` screenshot);
      it returns 404 in production builds.
- [ ] **AC-5** Ethiopic text renders in the subset font (computed `font-family` check in Playwright).

## Verification

- `pnpm verify`

## Notes

`/v1/config/public` also carries the betting `RuleSet` — F3 consumes it; load it once here.
