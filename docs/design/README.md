# Frontend design docs

Our own design documents for the web apps. They are derived from the backend's engineering decisions
(`docs/backend/engineering-decisions.md`, D1–D9), the component pages in `docs/backend/design/`, the SRS
and PRD in `docs/backend/product/`, this repo's decisions (`docs/decisions.md`, FD1–FD5) and the
claude.ai design project (look and copy). They say what a player sees and does and what the browser
and the route handlers are responsible for; the backend docs say what the API does. Where they disagree,
the precedence in `CLAUDE.md` decides and the page says so.

Each page names the task that builds or changes what it describes (`docs/tasks/`). "Built" means on
`main` or on a merged task branch today; a task id means that task delivers it.

| Page                                                           | Covers                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [00-overview.md](00-overview.md)                               | The apps, one build per tenant, the route map, languages, what is Release 2, the layouts                     |
| [01-screens.md](01-screens.md)                                 | Every player screen: purpose, states, data, actions, the design-project page and the `pnpm ui` screenshot    |
| [02-journeys.md](02-journeys.md)                               | The journeys as step tables: find a match → slip → place, book a code, register → verify, deposit, withdraw… |
| [03-session-and-account.md](03-session-and-account.md)         | Session cookie, login, OTP, logout, `/api/me` as the only truth, the proxy, KYC states                       |
| [04-slip-and-money.md](04-slip-and-money.md)                   | What the slip shows and why (D1 in player terms), money as strings, idempotency, the 409 flow, balances      |
| [05-errors-and-states.md](05-errors-and-states.md)             | Every Problem code a player can meet, by screen, with its message and its fix; the system states             |
| [06-language-and-format.md](06-language-and-format.md)         | Amharic and English rules, money, date and time formats, the calendar and clock preferences                  |
| [07-tenancy-and-theming.md](07-tenancy-and-theming.md)         | Host → tenant, `/v1/config/public`, tokens not hex, the component gallery                                    |
| [08-performance-and-offline.md](08-performance-and-offline.md) | Budgets, data saver, polling versus realtime, PWA scope, what works without JavaScript                       |
| [09-security.md](09-security.md)                               | The browser never calls the API, tokens never in the browser, CSRF, trusted proxy, what the proxy does       |

Three choices made when these were written (2026-10-02): one page per topic rather than one per screen
(the screens page lists them all, so a per-screen view is one table away); screenshots are named, not
embedded, because `pnpm ui` regenerates them and a stale picture is worse than none; the terminal, POS
and agent apps are summarised in the overview and get their own pages when F8–F10 start.

Keep these current: a task that changes a screen, a state, a route, a string rule or a security
boundary updates the page in the same PR, as it updates the task file.
