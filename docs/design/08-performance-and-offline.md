# 08 — Performance and offline

The player is on a prepaid 3G connection on a mid-range Android phone (PRD, NFR-P5, NFR-P7). Every
choice below is measured against that.

## Budgets (C18 §8)

| Item                                          | Budget                                                        | Enforced by                                 |
| --------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| First-load JavaScript on the home page (gzip) | < 150 KB                                                      | `size-limit` in CI (F2b records the number) |
| Home page HTML + data                         | < 100 KB                                                      | Lighthouse CI                               |
| Largest Contentful Paint on throttled 3G      | < 2.5 s                                                       | Lighthouse CI                               |
| Match detail, main group                      | < 15 KB                                                       | Size check on the response                  |
| A 20-fixture list page                        | ~10 KB gzip                                                   | The API's snapshot test (C06 §11)           |
| Repeat visit                                  | App shell from the service worker; only data over the network | PWA (later)                                 |

What keeps us under: Server Components for lists (HTML before JavaScript), IDs in lists and names from
the dictionary, no `decimal.js` (FD4 saved ~30 KB), Radix primitives rather than a component library,
one icon set, fonts subset and swapped.

## Rendering and caching (C18 §4.1, D5)

| Route                      | Rendering                                          | Cache                                                                                                                           | Status                                    |
| -------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Home, sport, league        | Server Components                                  | ISR 15 s on the server; the edge caches the API 10 s; the client refetches odds every 30 s while visible and stops while hidden | F2b (today client-fetched, polling built) |
| Match                      | Main group on the server, other groups on tab open | ISR 15 s                                                                                                                        | F2b                                       |
| `/b/[code]`, `/t/[ticket]` | Dynamic server render                              | Never cached; Open Graph in the head                                                                                            | Built                                     |
| Account pages              | Client, behind login                               | `no-store`; TanStack Query with deliberate `staleTime` per data kind (`STALE_TIME`)                                             | Built                                     |
| `/api/*`                   | Route handlers                                     | `Cache-Control: no-store` on every answer                                                                                       | Built                                     |

Prices can therefore be up to about 30 s old on screen; placement always re-prices (D5). With realtime
on (Release 2) prices arrive as messages patching the Query cache and nothing polls; `applyToBoard`
returns untouched objects by reference and rows are memoised, so one price moving re-renders one button.

## Data saver

The profile's Data saver switch (persisted) sends `?lite=1` to the catalogue route handlers, which drop
crests and flags; `TeamCrest` and `Flag` render nothing instead of an image. It is for a metered
connection, and it is the player's choice, not something inferred.

## Dictionary

Versioned per tenant and language; the client sends its version and keeps its copy on a 304 (D5, F2b).
The server holds it five minutes per tenant.

## Without JavaScript (C18 §9)

The ticket check `/t/[ticket]` and the booking page `/b/[code]` render as plain HTML and work in proxy
browsers such as Opera Mini and in Telegram's preview; the public lists are readable as HTML. Placing a
bet needs JavaScript. The ticket check's pages have no `<Suspense>` around the shell: a boundary that
suspends during the server render streams its content hidden until a script reveals it, which without
JavaScript is never. `/t`'s form is a plain GET (`next/form`), and every action on those pages is a link
(`tests/e2e/ticket.spec.ts` runs them with JavaScript off).

## Offline

A single watcher in the shell writes `navigator.onLine` to the system store; the offline banner says
odds may be stale and placing is paused; every odds button reads the flag. The slip persists in
`localStorage` (selections only — never tokens or balances), so a dropped connection loses nothing.

## PWA (C18 §4.6, later)

`@serwist/next` precaches the app shell, fonts and the dictionary; the site is installable from the
browser menu (Google Play does not list real-money gambling for Ethiopia). Offline the player sees
cached lists and their slip with placing disabled. Web push is P1.

## What is measured in CI today

`pnpm verify`: typecheck, lint, Prettier, 720 unit and component tests, generated types against the
contract, contract drift, the production build (the proxy listed), and the UI suite (20 screens × 2
languages × 2 widths plus the auth and booking specs). Budgets join it in F2b.
