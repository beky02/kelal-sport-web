---
id: F2a
title: Language in the URL, tenant default language, D7 routes with redirects
status: todo
depends_on: [F0]
contract_tags: [Config, Catalogue]
touches_money: false
touches_ui: true
---

# F2a — Language in the URL and D7 routes

## Goal

Public pages live under `/am/…` and `/en/…`, a visitor without one lands in their stored language or the
tenant's default (Amharic for `demo`), and every link uses the D7 / C18 paths, with the old paths and the
app's unprefixed deep links redirecting.

## Read first

- `docs/decisions.md` **FD2** (language in the URL) and **FD3** (routes) — the decisions this carries out
- `docs/backend/engineering-decisions.md` D7 (deep links)
- `docs/backend/design/components/c18-client-apps.md` §4.1, §4.3, §9
- `contracts/openapi.yaml`: `GET /v1/config/public` (`languages`, `default_language`)
- Next.js: `node_modules/next/dist/docs/` — `proxy` (middleware is renamed in this version), dynamic
  segments, `redirects` in `next.config.ts`, `generateStaticParams`
- Existing: `src/config/routes.ts`, `src/stores/ui.store.ts` (`lang`), `src/lib/i18n/*`, `src/app/*`

## Scope

In:

- `src/app/[lang]/…` for the public pages (home, sport, league, match, search, terms/privacy/help);
  `lang` validated against the tenant's `languages`.
- Proxy: no segment → redirect to the stored choice (cookie) or `default_language`; never authorisation.
- `<html lang>` from the segment; the language switch navigates to the other prefix and records the
  choice; the UI store follows the URL.
- Routes: `/{lang}/match/[id]`, `/{lang}/league/[id]`, `/{lang}/sport/[slug]` (sport out of the query);
  `date`/`filter` stay query parameters. 308 from `/event/*`, `/competition/*`; unprefixed `/match/{id}`
  redirects to the prefixed page. All paths written only in `routes.ts`.
- Catalogue loaders fetch one language (`Accept-Language` from the segment) instead of `both()`; the
  domain `Localized` pairs stay (filled from the one language) so components don't change in this task.
- `loadPublicConfig` in `lib/server` (cached per tenant) — if F1 or F3 has not already built it.

Out: server-rendered lists and the search screen (F2b); account pages keep no segment (FD2).

## Acceptance criteria

- [ ] **AC-1** `GET /` with no cookie redirects to `/am` for the `demo` tenant (Prism config), and to
      `/en` with a stored `en` choice (route test or Playwright).
- [ ] **AC-2** `/xx/…` for a language the tenant does not offer returns 404.
- [ ] **AC-3** `/event/fx_arsenal_chelsea` → 308 → `/am/match/fx_arsenal_chelsea`;
      `/competition/t_epl` → `/am/league/t_epl`; `/match/fx_arsenal_chelsea` → `/am/match/fx_arsenal_chelsea`.
- [ ] **AC-4** Switching language on a match page lands on the same match under the other prefix.
- [ ] **AC-5** `<html lang>` matches the segment; catalogue upstream calls send that `Accept-Language`
      only (one call per operation, not two).
- [ ] **AC-6** `pnpm ui` updated to the new paths; all screens pass in both languages.
