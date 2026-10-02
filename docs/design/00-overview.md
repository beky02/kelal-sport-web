# 00 — Overview

## What we build

Every browser-facing surface of the sportsbook is a Next.js app in this repo (FD1): the **player web**
now; the **shop terminal**, **cashier POS**, **agent portal** and **back office** later (F8–F10), as a
pnpm + Turborepo workspace converted in F8a. One build serves every tenant (brand): the host picks the
tenant, `/v1/config/public` supplies its name, colours, languages, features and betting rules
(C18 §4.3, D7). The Android app is Flutter and lives elsewhere; it calls the same API and runs the same
golden slip tests, and it shares our deep links (D7).

The web app is not a client of the API in the browser. The browser talks only to this app's own `/api/*`
route handlers, which call the API from the server with the tenant header and, for a player, the session
held in an httpOnly cookie (D3). No business rule lives here: the slip's numbers come from the shared
calculator (D1), everything else is displayed state and collected actions (AGENTS.md).

## Apps and users

| App           | Stack and runtime                                                           | Users                        | Status                                 |
| ------------- | --------------------------------------------------------------------------- | ---------------------------- | -------------------------------------- |
| Player web    | Next.js App Router, responsive 360 px → desktop, installable as a PWA later | Online players               | Built; F1–F7 rewire it to the contract |
| Shop terminal | Next.js, Chrome kiosk on shop PCs                                           | Walk-in customers (no login) | F8                                     |
| Cashier POS   | Next.js, Chrome kiosk with silent printing                                  | Cashiers, shop managers      | F9                                     |
| Agent portal  | Next.js, any browser                                                        | Agents                       | F10                                    |
| Back office   | Next.js + Refine                                                            | Operator staff               | F10                                    |

The player persona (PRD): an adult football fan on an Android phone, telebirr, patchy 3G, Amharic first.
Every budget and default follows from that (08-performance, 06-language).

## Route map (FD3, D7)

| Path                                                                                       | Rendering                                                                                | Status                                      |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| `/{lang}` (home)                                                                           | Server Components, ISR 15 s                                                              | Built as `/` today; `[lang]` segment in F2a |
| `/{lang}/sport/[slug]`                                                                     | Same                                                                                     | F2a (today `?sport=`)                       |
| `/{lang}/league/[id]`                                                                      | Same                                                                                     | F2a (today `/competition/[id]`, 308 after)  |
| `/{lang}/match/[id]`                                                                       | Main market group on the server, other groups on tab open                                | F2a/F2b (today `/event/[id]`)               |
| `/{lang}/search`                                                                           | Client, phone and tablet only (FD5)                                                      | F2b                                         |
| `/b/[code]`                                                                                | Server-rendered, Open Graph, no `[lang]` (shared from the app and Telegram)              | Built (F3b)                                 |
| `/t/[ticket]`                                                                              | Server-rendered, works without JavaScript                                                | F5                                          |
| `/my-bets`, `/my-bets/[id]`, `/wallet`, `/transactions`, `/profile`, `/responsible-gaming` | Client, behind login where there is nothing for a guest; never cached; no `[lang]` (FD2) | Built; account pages behind the proxy (F4a) |
| `/login`, `/register`                                                                      | The auth dialog over the sportsbook; `?next=` returns a player to where they were going  | Built (F4a)                                 |
| `/terms`, `/privacy`, `/help`                                                              | From `/v1/pages/{slug}`                                                                  | Placeholders today; F7                      |
| `/live`                                                                                    | Release 2                                                                                | Behind `features.live` (D8)                 |
| `/dev/components`                                                                          | The gallery, development only                                                            | F1                                          |

Unprefixed `/match/{id}`, `/b/{code}` and `/t/{ticket}` always work: they are the links the app and
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
(`docs/backend/build-plan.md` §2): F0 → F3 (slip) → F1, F2a, F2b → F4 → F5 → F6 → F7 → F8a → F8–F10.
Every task runs through `/task <id>` and ends with a verification report under `docs/tasks/<id>/`.
