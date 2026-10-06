---
id: F8ca
title: Split from F8c — kiosk sportsbook: matches, picks and the kiosk's language
status: verifying
depends_on: [F8b]
contract_tags: [Catalogue, Config]
touches_money: false
touches_ui: true
---

# F8ca — Kiosk sportsbook

Split from [F8c](F8c-terminal-slip-code.md) (2026-10-06, while planning): the browsing half. The slip's
figures are [F8cb](F8cb-kiosk-slip.md); slip codes, the idle reset and the rate limit are
[F8cc](F8cc-slip-code.md).

## Goal

On an activated terminal of an open shop, a walk-in customer uses the player's sportsbook: the home board
by sport and day, a league's page, a match's whole book and search. They tap prices into a slip and read
everything in the language they choose. Nothing that needs a player account is there: no log in,
register, my bets, wallet, responsible gaming or favourites. A tenant that has switched shop betting off
shows no sportsbook.

## Read first

- `docs/decisions.md` **FD1** (the `(terminal)` group reuses `src/features/*`), **FD2** (the tenant's
  default language)
- `docs/backend/design/components/c19-retail-network.md` §4.2, §9.1, §11, §12; `c18-client-apps.md` §5
- `docs/backend/engineering-decisions.md` D3, D5 (prices poll every 30 s), D7, D8
- `contracts/openapi.yaml`: `GET /v1/sports`, `GET /v1/events`, `GET /v1/dictionary`,
  `GET /v1/config/public` (`features.retail`, `languages`, `default_language`)
- `docs/tasks/F8b/plan.md`, `docs/design/10-terminal.md`

## Scope

In (revised on the user's review, 2026-10-06):

- **The player's pages on the kiosk.** The home (`SportsbookView`), a league (`CompetitionView`) and a match
  (`EventDetailView`), with the player's sidebar (Top competitions, Sports, Countries; no Favourites), the
  header search and the slip's parts. They are composed in the kiosk's own shell, with a header showing the
  shop and the language switch.
- **One seam for both sites.** The pages and components read whatever is specific to a site (frame,
  realtime, data saver, price locks, favourites, the leagues drawer, open countries, links) from a static
  `SportsbookChrome` (`features/sportsbook/chrome.tsx`). The player provides it from its stores; the kiosk
  provides its own. The text hooks read a `LocaleProvider`, and `apiClient` reads the language and base path
  from `<html>`.
- **The terminal's reads.** `/api/terminal/catalogue/{sports,board,competitions/top,competitions/countries,
events/[id],search}` and `/api/terminal/config`, on the player's loaders, for activated terminals only.
  They answer before-kick-off matches only.
- **Language and switch.** The kiosk's language is the tenant's `default_language`, switched with one tap.
  `<html lang>` and `Accept-Language` follow it.
- **Shop betting off.** `features.retail: false` means betting isn't available at this terminal.

Out (do not build here):

- The slip's figures, the retail rule set, the stake keypad (F8cb).
- Slip codes, the QR code, the idle reset, the rate limit, no polling while idle (F8cc).
- Live (Release 2); anything that needs a player account.
- Catalogue reads signed as the terminal (contract request 015).

## Acceptance criteria

Each criterion must be proven by a named test, a command output or a `pnpm ui` screenshot in
`verification.md`.

- [ ] **AC-1** An activated terminal of an open shop shows the player's home board — sports, the day strip,
      the competitions with their matches and prices, the sidebar — read through `/api/terminal/*` only, and
      nothing that needs a player (no log in, register, my bets, wallet, responsible gaming or favourites);
      loading, empty (with a way back) and error (Try again) states each have a screenshot.
- [ ] **AC-2** Tapping a price puts the pick in the player's slip and tapping it again takes it out; each pick
      can be removed and the slip cleared. Sizes are the player's (the user's decision, 2026-10-06; this
      replaces "at least 48 px").
- [ ] **AC-3** The kiosk opens in the tenant's `default_language` (Amharic for `demo`); one tap switches
      every string, `<html lang>` and the `Accept-Language` of its calls.
- [ ] **AC-4** With `features.retail: false` the terminal says betting isn't available here and shows no
      board and no slip.
- [ ] **AC-5** The kiosk's routes answer 404 on a player host and 401 without an activated terminal,
      before calling the API; the terminal still loads nothing from `src/stores/` or the player's layout
      (`check-host-split.mjs`), and the player's screens read their language as before.
- [ ] **AC-6** A league opens on the kiosk's own page (`/terminal/competition/[id]`), from the sidebar, with
      its board.
- [ ] **AC-7** A match opens on the kiosk's own page (`/terminal/event/[id]`) with every market, from its
      row's "+N"; a match that has kicked off has no page there (pre-match only, D8).
- [ ] **AC-8** The header's search finds leagues and matches through the terminal and opens them on the
      kiosk's pages.

## Verification

- `pnpm verify` passes (it runs `scripts/check-host-split.mjs`)
- `pnpm ui --grep terminal`: the kiosk's screens in both languages at both widths

## Notes

- 2026-10-06: split from F8c while planning (about 3,500 changed lines in one PR).
- 2026-10-06: verified (`docs/tasks/F8c/verification.md`). Contract request 015 is proposed. A
  follow-up shares the price-to-slip wiring with the player's `OddsButton` (review Q11).
- 2026-10-06, the user's review: the kiosk's own large-format views looked unlike the site. The kiosk is
  now the player's home, league and match pages and search, without what needs a player, at the player's
  sizes (AC-2's 48 px dropped by the user). AC-6, AC-7 and AC-8 were added. Plan: "Rework" in
  `docs/tasks/F8c/plan.md`.
- 2026-10-06, the rework's review: the kiosk polls prices every 30 s whatever the realtime setting, locks
  them while offline, and carries the footer's licence, 21+ and helpline without its links (SRS RG-05).
  The player's Terms, Privacy and Help pages aren't reachable on a terminal host.
