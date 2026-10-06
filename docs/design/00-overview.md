# 00 — Overview

## What we build

The browser-facing apps live in two web projects (FD1):

- **This repo** is one Next.js app serving the **player web** and, from F8, the **shop terminal**. They
  are separate sites on their own hosts (`www.{brand}`, `terminal.{brand}`), each with its own root layout,
  split by the proxy (F8a).
- **`kelalsport-ops`** (F12) holds the **cashier POS**, **agent portal**, **back office** and the
  **platform console** above the brands (F9–F11, FD6).

One build serves every tenant (brand): the host picks the tenant, `/v1/config/public` supplies its name, colours, languages, features and betting rules
(C18 §4.3, D7). The Android app is Flutter and lives elsewhere; it calls the same API and runs the same
golden slip tests, and it shares our deep links (D7).

The web app is not a client of the API in the browser. The browser talks only to this app's own `/api/*`
route handlers, which call the API from the server with the tenant header and, for a player, the session
held in an httpOnly cookie (D3). No business rule lives here: the slip's numbers come from the shared
calculator (D1), everything else is displayed state and collected actions (AGENTS.md).

## Apps and users

| App              | Project, stack and runtime                                                     | Users                                            | Status                                      |
| ---------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------- |
| Player web       | This repo, `(player)`; responsive 360 px → desktop, installable as a PWA later | Online players                                   | Built; F1–F7 rewire it to the contract      |
| Shop terminal    | This repo, `(terminal)`; Chrome kiosk on shop PCs                              | Walk-in customers (no login)                     | Activation, signed calls, status (F8b); F8c |
| Cashier POS      | `kelalsport-ops`; Chrome kiosk with silent printing                            | Cashiers (and shop managers: open question, FD6) | F12, then F9                                |
| Agent portal     | `kelalsport-ops`; any browser                                                  | Agents, brand and partner (FD6)                  | F12, then F10a                              |
| Back office      | `kelalsport-ops`; Next.js + Refine                                             | A brand's own staff                              | F12, then F10b–F10g                         |
| Platform console | `kelalsport-ops`; any browser                                                  | Platform staff, above the brands (FD6)           | F12, then F11; waits for the backend        |

The player persona (PRD): an adult football fan on an Android phone, telebirr, patchy 3G, Amharic first.
Every budget and default follows from that (08-performance, 06-language).

## Who owns what (FD6)

The Phase 1 chain, fixed by the product owner
([backend proposal 001](../backend-proposals/001-platform-and-retail-hierarchy.md)):

```
Platform            platform staff: create, run and suspend brands      → platform console (F11)
└─ Brand            a licensed operator, one tenant                     → back office (F10b–F10g), player web
   └─ Agent         brand agent (the brand's own shops) or partner      → agent portal (F10a)
      └─ Shop       every shop has an agent
         ├─ Terminals   shop PCs, no login, activated once             → terminal (F8)
         └─ Cashiers    PIN on an activated counter PC                 → cashier POS (F9)
```

There are no master agents and no shops without an agent. Everything below the platform belongs to one
brand: its players, agents, shops, tickets and money are never seen by another brand, and a ticket is
paid only in that brand's shops (where exactly is the brand's `payout_where`, C19 §4.4). How a brand pays
the platform, and what platform staff may see inside a brand, are open (proposal 001, Q1 and Q4).

## Route map (FD3, D7)

| Path                                                                                       | Rendering                                                                                | Status                                       |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| `/{lang}` (home)                                                                           | Server Components, ISR 15 s                                                              | Built as `/` today; `[lang]` segment in F2a  |
| `/{lang}/sport/[slug]`                                                                     | Same                                                                                     | F2a (today `?sport=`)                        |
| `/{lang}/league/[id]`                                                                      | Same                                                                                     | F2a (today `/competition/[id]`, 308 after)   |
| `/{lang}/match/[id]`                                                                       | Main market group on the server, other groups on tab open                                | F2a/F2b (today `/event/[id]`)                |
| `/{lang}/search`                                                                           | Client, phone and tablet only (FD5)                                                      | F2b                                          |
| `/b/[code]`                                                                                | Server-rendered, Open Graph, no `[lang]` (shared from the app and Telegram)              | Built (F3b)                                  |
| `/t/[ticket]`, `/t`                                                                        | Server-rendered, works without JavaScript, Open Graph; `/t` is the check form            | Built (F5b)                                  |
| `/my-bets`, `/my-bets/[id]`, `/wallet`, `/transactions`, `/profile`, `/responsible-gaming` | Client, behind login where there is nothing for a guest; never cached; no `[lang]` (FD2) | Built; account pages behind the proxy (F4a)  |
| `/login`, `/register`                                                                      | The auth dialog over the sportsbook; `?next=` returns a player to where they were going  | Built (F4a)                                  |
| `/terms`, `/privacy`, `/help`                                                              | From `/v1/pages/{slug}`                                                                  | Placeholders today; F7                       |
| `/live`                                                                                    | Release 2                                                                                | Behind `features.live` (D8)                  |
| `/dev/components`                                                                          | The gallery, development only                                                            | F1                                           |
| `/terminal` (`/` on a terminal host)                                                       | The shop terminal, `(terminal)` root layout (10-terminal); 404 on a player host          | Activation and status (F8b); the kiosk (F8c) |

Every page above but `/terminal` is in the `(player)` route group, under the player's root layout;
`src/app/api/*` serves both sites, kept apart by the proxy (09-security, "The host split"). A URL that
matches no page gets Next's built-in 404 in its own bare page, not the player's layout (F8a; a branded
404 is a follow-up). Unprefixed `/match/{id}`, `/b/{code}` and `/t/{ticket}` always work: they are the links the app and
Telegram share, and redirect to the language-prefixed page where one exists. `routes.ts` is the only
place paths are written.

## Languages

Amharic and English, both complete at every release (NFR-Q1). The language goes in the URL for public
pages and is the tenant's default for a first visit — Amharic for `demo` (FD2). Account pages keep the
stored preference. See 06-language-and-format.

## Release 1 and Release 2 (D8)

Release 1 is pre-match only: no live board, no realtime odds (prices poll every 30 s, D5), no cash out.
That code exists and stays behind `config/features.ts`; nothing ships it on. Virtual games are Release 2
and online only. Telegram login is P1, not a launch channel.

## Layouts (C18 §4.5)

| Width        | Layout                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| < 768 px     | Board only, bottom tab bar: Sports · Search (Live in Release 2, FD5) · Bet slip (raised, centred, with its count) · My bets · Menu. The slip is a bottom sheet. |
| 768–1023 px  | Board only; the sports menu is a drawer from the header                                                                                                         |
| 1024–1279 px | Sidebar 228 px + board; the slip is a sheet                                                                                                                     |
| 1280–1439 px | Sidebar 228 · board · slip 312; search in the header                                                                                                            |
| ≥ 1440 px    | Sidebar 248 · board · slip 340                                                                                                                                  |

Only the middle column is fluid; odds buttons keep a fixed width so columns line up. Touch targets are
at least 44 px (48 px on terminals). Text zoom to 130 % must not clip. The ranges are bounded in CSS
(`lg:max-xl:` …) because Tailwind emits our `wide:` breakpoint before `lg:`/`xl:` (AGENTS.md).

## Where state lives (AGENTS.md)

| Kind     | Home                                       | Examples                                                   |
| -------- | ------------------------------------------ | ---------------------------------------------------------- |
| Server   | TanStack Query, fed by `/api/*`            | Events, markets, config, who is signed in, wallet, bets    |
| Realtime | `lib/websocket` patching the Query cache   | Release 2; off                                             |
| Client   | Zustand `ui.store` (persisted preferences) | Theme, language, clock, calendar, data saver, what is open |
| Bet slip | Zustand `bet-slip.store`                   | Selections, mode, stake, accepted odds changes             |
| Filters  | The URL                                    | Sport, date, filter                                        |

Safety state — who is signed in, KYC, balance, limits, a break — is always server state read with a
query, never a store a reload could clear.

## How the work is organised

The screens were built from the design before the contract existed; most tasks rewire a screen to the
contract through a route handler and a mapper. The order is the build plan's frontend track
(`docs/backend/build-plan.md` §2): F0 → F3 (slip) → F1, F2a, F2b → F4 → F5 → F6 → F7, then (FD1, revised
2026-10-05) F8a (the host split) → F8 (the terminal) here, and F12 → F9–F11 in `kelalsport-ops`.
Every task runs through `/task <id>` and ends with a verification report under `docs/tasks/<id>/`.
