---
id: F8ca
title: Split from F8c — kiosk sportsbook: matches, picks and the kiosk's language
status: done
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

On an activated terminal of an open shop, a walk-in customer browses the shop's matches by sport and day
on a touch screen, taps prices into a slip, and reads everything in the language they choose. A tenant
that has switched shop betting off shows no sportsbook.

## Read first

- `docs/decisions.md` **FD1** (the `(terminal)` group reuses `src/features/*`), **FD2** (the tenant's
  default language)
- `docs/backend/design/components/c19-retail-network.md` §4.2, §9.1, §11, §12; `c18-client-apps.md` §5
- `docs/backend/engineering-decisions.md` D3, D5 (prices poll every 30 s), D7, D8
- `contracts/openapi.yaml`: `GET /v1/sports`, `GET /v1/events`, `GET /v1/dictionary`,
  `GET /v1/config/public` (`features.retail`, `languages`, `default_language`)
- `docs/tasks/F8b/plan.md`, `docs/design/10-terminal.md`

## Scope

In:

- The shared text and date hooks (`useTranslation`, `useRichTranslation`, `useDateTimeText`,
  `useLongDateTimeText`) read the language from a provider instead of the player's store, so the kiosk can
  use them; the player feeds it from its store as before.
- `/api/terminal/catalogue/sports`, `/api/terminal/catalogue/board` and `/api/terminal/config` on the
  player's loaders, for activated terminals only.
- The kiosk on `/terminal` (`/` on a terminal host): a top bar with the shop and a language switch; sport
  tabs; a day strip; the board's competitions and matches with their prices; a slip panel listing the
  picks (remove one, clear all), without figures. Large type and targets. Filters in the URL.
- The kiosk's language: the tenant's `default_language`, one tap to switch; `<html lang>` and the calls'
  `Accept-Language` follow.
- `features.retail: false` → betting isn't available at this terminal.

Out (do not build here):

- The slip's figures, the retail rule set, the stake keypad (F8cb).
- Slip codes, the QR code, the idle reset, the rate limit, no polling while idle (F8cc).
- Match detail with more markets, search, live (Release 2) on the kiosk.
- Catalogue reads signed as the terminal (contract request 015).

## Acceptance criteria

Each criterion must be proven by a named test, a command output or a `pnpm ui` screenshot in
`verification.md`.

- [x] **AC-1** An activated terminal of an open shop shows sport tabs, a day strip and the board's
      competitions with their matches and prices, read through `/api/terminal/*` only; loading, empty
      (with a way back to today) and error (Try again) states each have a screenshot.
- [x] **AC-2** Tapping a price puts the pick in the slip panel and tapping it again takes it out; each pick
      can be removed and the slip cleared; prices, tabs and buttons are at least 48 px high.
- [x] **AC-3** The kiosk opens in the tenant's `default_language` (Amharic for `demo`); one tap switches
      every string, `<html lang>` and the `Accept-Language` of its calls.
- [x] **AC-4** With `features.retail: false` the terminal says betting isn't available here and shows no
      board and no slip.
- [x] **AC-5** The kiosk's routes answer 404 on a player host and 401 without an activated terminal,
      before calling the API; the terminal still loads nothing from `src/stores/` or the player's layout
      (`check-host-split.mjs`), and the player's screens read their language as before.

## Verification

- `pnpm verify` passes (it runs `scripts/check-host-split.mjs`)
- `pnpm ui --grep terminal`: the kiosk's screens in both languages at both widths

## Notes

- 2026-10-06: split from F8c while planning (about 3,500 changed lines in one PR).
- 2026-10-06: verified (`docs/tasks/F8c/verification.md`). Contract request 015 is proposed. A
  follow-up shares the price-to-slip wiring with the player's `OddsButton` (review Q11).
