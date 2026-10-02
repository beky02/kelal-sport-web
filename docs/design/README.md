# Frontend design docs — outline (for review)

Our own design documents for the web apps, derived from the backend's engineering decisions, the
component pages in `docs/backend/design/`, the SRS and the PRD, and the claude.ai design project (look
and copy). They say what a player sees and does; the backend docs say what the API does. Where they
disagree, the precedence in `CLAUDE.md` decides and the page notes it.

Proposed pages (each 2–4 screens of prose plus tables; no code):

| Page                            | Covers                                                                                                                                                        | Sources                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `00-overview.md`                | The apps (player web now; terminal, POS, agent, back office later), one build per tenant, the route map (FD3), languages (FD2), what is Release 2 (D8)        | C18 §1–4, D7–D8, FD1–FD5, PRD goals                                |
| `01-screens.md`                 | Every player screen with its purpose, states (loading, empty, error, guest, player), data it reads, actions it offers, and the design-project page it mirrors | design project, `tests/e2e/screens.spec.ts`, C18 §4.1, §4.5        |
| `02-journeys.md`                | The journeys as flows: find a match → slip → place (J1), book a code, register → verify, deposit, withdraw, self-exclude; each step's screen and API call     | PRD journeys, SRS REG/KYC/BET/PAY/RG, C01, C02, C04, C08, C09, C12 |
| `03-session-and-account.md`     | Session cookie, login, OTP, logout, `/api/me` as the only truth, proxy, KYC states and what each unlocks, the "safety state is server state" rule             | F4 plan and verification, D3, C01, C02, C18 §4.4                   |
| `04-slip-and-money.md`          | What the slip shows and why (D1 in player terms), money as strings (FD4), idempotency, the 409 flow, balances and withdrawable, tax copy rules                | D1, D9, C07, C08, C03, FD4                                         |
| `05-errors-and-states.md`       | The Problem codes a player can meet, grouped by screen, with the message and the fix each offers; offline, maintenance, reality check, limits                 | TD-01 §4, every task's error table, C12                            |
| `06-language-and-format.md`     | Amharic and English rules: catalogues, placeholders, line height, no uppercase, money/date/time formats, calendar and clock preferences, translation review   | FD2, D7, `TRANSLATION-NOTES.md`                                    |
| `07-tenancy-and-theming.md`     | Host → tenant, `/v1/config/public` (brand, colours, features, rules), tokens not hex, the component gallery                                                   | D3, D7, C16, C18 §4.3, F1                                          |
| `08-performance-and-offline.md` | Budgets (C18 §8), data saver, polling vs realtime (D5), PWA scope, what works without JavaScript                                                              | C18 §4.6, §8, §9, D5                                               |
| `09-security.md`                | The browser never calls the API, tokens never in the browser, CSRF, trusted proxy, open redirects, what the proxy does and does not do, secrets               | D3, C18 §4.4, F3b/F4 security reviews                              |

Questions for the review:

1. One page per topic as above, or one page per screen (closer to the design project)?
2. Should `01-screens.md` embed the `pnpm ui` screenshots, or only name them?
3. Do the terminal, POS and agent apps get their own pages now (from C19) or when F8–F10 start?
