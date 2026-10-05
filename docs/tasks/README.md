# Tasks

Each file here is one unit of work for the `/task` workflow (`.claude/skills/task/SKILL.md`):
**plan → implement → verify → finish**, on its own branch, ending in one reviewable PR.

The screens already exist — they were built from the design before the contract did. Most tasks are
"rewire this screen to the contract": replace the mock repository behind it with a route handler on the
real operations, map the contract's data onto the domain types, and fix what the contract and the
Engineering Decisions say differently. The order follows the Build Plan's frontend track
(`docs/backend/build-plan.md` §2).

| ID                                            | Title                                                                                                  | Depends on         | Backend piece | Status |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------ | ------------- | ------ |
| [F0](F0-contract-wiring.md)                   | Wire the catalogue to the contract through route handlers                                              | —                  | —             | done   |
| [F1](F1-design-system-shell.md)               | Tenant theme from `/v1/config/public`, Ethiopic font, component gallery                                | F0                 | B1            | todo   |
| [F2a](F2a-language-routes.md)                 | Language in the URL, tenant default language, D7 routes with redirects                                 | F0                 | B1            | todo   |
| [F2b](F2b-catalogue-screens.md)               | Server-rendered catalogue, popular, lazy market groups, paging, phone search                           | F2a                | B4            | todo   |
| [F3](F3-slip-calculator.md)                   | Slip on slipcalc (D1), rules from config, bookings and `/b/[code]`                                     | F0                 | B3            | done   |
| [F3a](F3a-slip-calculator.md)                 | Split from F3: slip on slipcalc (D1), rules from config, money as strings                              | F0                 | B3            | done   |
| [F3b](F3b-bookings.md)                        | Split from F3: booking codes and `/b/[code]`                                                           | F3a                | B3            | done   |
| [F4](F4-auth-session.md)                      | Auth through route handlers and an httpOnly session cookie; KYC                                        | F0                 | B5, B12       | done   |
| [F4a](F4a-session-login.md)                   | Split from F4: session cookie, login with the new-device OTP, logout, `/api/me`, trusted proxy         | F0                 | B5            | done   |
| [F4b](F4b-register-kyc.md)                    | Split from F4: register with the SMS code, reset the password, verify with Fayda                       | F4a                | B5, B12       | done   |
| [F5](F5-place-bet-my-bets.md)                 | Place bet with `Idempotency-Key` and the 409 flow; My bets; `/t/[ticket]`                              | F3a, F3b, F4       | B6            | done   |
| [F5a](F5a-place-bet.md)                       | Split from F5: place a bet, a key per intent, the 409 flow and every refusal's fix; Code 128           | F3a, F3b, F4       | B6            | done   |
| [F5b](F5b-my-bets-ticket-check.md)            | Split from F5: My bets and ticket detail from the contract, cursor paging; `/t/[ticket]`               | F5a                | B6            | done   |
| [F6](F6-wallet.md)                            | Wallet: balances, deposits with `next_action`, withdrawals, payout accounts, history                   | F4                 | B8            | done   |
| [F6a](F6a-balances-history.md)                | Split from F6: balances and history from the contract, money as strings                                | F4                 | B8            | done   |
| [F6b](F6b-deposits.md)                        | Split from F6: methods and limits, deposits driven by `next_action`, every deposit status              | F6a                | B8            | done   |
| [F6c](F6c-withdrawals.md)                     | Split from F6: withdrawals with payout accounts, every withdrawal status, cancel                       | F6b                | B8            | done   |
| [F7](F7-account-rg-inbox.md)                  | Account, limits, self-exclusion, reality check, promotions, inbox; delete the mocks                    | F4                 | B8, B13       | todo   |
| [F7a](F7a-responsible-gambling.md)            | Split from F7: limits, breaks and self-exclusion on the account; RG refusals everywhere                | F4, F6a            | B8            | done   |
| [F7b](F7b-account-reality-check.md)           | Split from F7: profile preferences, active devices, the reality check from the server                  | F4                 | B5, B8        | done   |
| [F7c](F7c-promotions-inbox.md)                | Split from F7: promotions, my bonus and free bets, promo codes, the inbox                              | F4                 | —             | todo   |
| [F7d](F7d-content-mocks.md)                   | Split from F7: content pages from the API; the mock repository deleted                                 | F6c, F7a, F7b, F7c | B1            | todo   |
| [F7e](F7e-reality-check-figures.md)           | Split from F7b: the reality check's figures and play session from the API (after contract request 012) | F7b                | B8            | todo   |
| [F8a](F8a-workspace.md)                       | Convert to a pnpm + Turborepo workspace: `apps/player`, shared packages                                | F7                 | —             | todo   |
| [F8](F8-terminal.md)                          | Shop terminal app                                                                                      | F8a                | B9            | todo   |
| [F8b](F8b-terminal-activation.md)             | Split from F8: terminal activation, the device key and signed requests                                 | F8a                | B9            | todo   |
| [F8c](F8c-terminal-slip-code.md)              | Split from F8: kiosk sportsbook and slip to code                                                       | F8b                | B9            | todo   |
| [F9](F9-pos.md)                               | Cashier POS app                                                                                        | F8a                | B9            | todo   |
| [F9a](F9a-pos-device-shift.md)                | Split from F9: POS device, staff login, shifts and cash                                                | F8a                | B9            | todo   |
| [F9b](F9b-pos-sell-print.md)                  | Split from F9: sell from a slip code, print the receipt                                                | F9a                | B9            | todo   |
| [F9c](F9c-pos-pay-cancel.md)                  | Split from F9: scan a ticket, pay it, cancel it                                                        | F9b                | B9            | todo   |
| [F10](F10-agent-backoffice.md)                | Agent portal, then back office (Refine)                                                                | F8a                | B9, B10       | todo   |
| [F10a](F10a-agent-portal.md)                  | Split from F10: agent portal                                                                           | F8a                | B9            | todo   |
| [F10b](F10b-backoffice-shell.md)              | Split from F10: back office shell, staff sign-in, dashboard, audit, staff and roles                    | F8a                | B10           | todo   |
| [F10c](F10c-backoffice-players.md)            | Split from F10: players and compliance                                                                 | F10b               | B10           | todo   |
| [F10d](F10d-backoffice-finance.md)            | Split from F10: finance and the four-eyes approvals queue                                              | F10b               | B10           | todo   |
| [F10e](F10e-backoffice-trading.md)            | Split from F10: trading, risk and settlement                                                           | F10b, F10d         | B10           | todo   |
| [F10f](F10f-backoffice-marketing-settings.md) | Split from F10: marketing and tenant settings                                                          | F10b, F10d         | B10           | todo   |
| [F10g](F10g-backoffice-retail.md)             | Split from F10: retail administration                                                                  | F10b, F10d         | B10           | todo   |

F1, F2a, F3 and F4 only need F0 and can go in any order. Recommended order: **F3** (every slip number is
currently a float estimate that differs from the backend), F1, F2a, F2b, F4, F5, F6, F7, F8a, F8–F10.
Whichever of F1, F2a and F3 runs first builds `loadPublicConfig` (`/v1/config/public`, cached per
tenant); the others reuse it. The "Backend piece" column says when a screen
can move from Prism to the real API (`API_REAL_TAGS`, D7) — none of the tasks wait for it. One exception:
the server refuses `Bookings` in `API_REAL_TAGS` until contract request 004 (the player's IP and device)
and a trusted-proxy setting land.

F6 through F10 are split into sub-tasks of about one reviewable PR each (F6a–F6c, F7a–F7d, F8b–F8c,
F9a–F9c, F10a–F10g; F8a, the workspace, stays one task): run `/task` with the sub-task's id. The parent's
criteria name the sub-task that carries each one, and a parent is done when all its sub-tasks are.

## Decisions

The open questions found while writing these tasks are decided in [`docs/decisions.md`](../decisions.md)
(2026-10-01): **FD1** one web workspace, converted in F8a · **FD2** language in the URL, tenant default
(Amharic for `demo`), in-house i18n kept · **FD3** D7 deep links and C18 route names with redirects ·
**FD4** no `decimal.js`; strings in, BigInt santim when computed · **FD5** Search takes Live's tab slot
until Release 2. Each task's "Read first" names the decisions it carries out.

## Status values

`todo` → `in_progress` (planning) → `planned` (plan approved; implementing) → `verifying` → `done`, or
`blocked` (reason in the task file). The workflow updates the `status:` line in the task file and this table
**on the task branch**; the status reaches main when you merge. A task can start only when its
dependencies are `done` on main.

## Files per task

```
docs/tasks/F3-slip-calculator.md   the task: goal, specs to read, scope, acceptance criteria
docs/tasks/F3/plan.md              written in phase 1 (approved before coding)
docs/tasks/F3/verification.md      written in phase 3: every check, its evidence and every review finding
```

## Writing a new task

Copy `_template.md`. The acceptance criteria are what the verifier checks, so make each one observable:
a test, a command output, a screenshot from `pnpm ui`, a Prism exchange. "Works correctly" is not a
criterion.
