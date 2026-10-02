# Tasks

Each file here is one unit of work for the `/task` workflow (`.claude/skills/task/SKILL.md`):
**plan → implement → verify → finish**, on its own branch, ending in one reviewable PR.

The screens already exist — they were built from the design before the contract did. Most tasks are
"rewire this screen to the contract": replace the mock repository behind it with a route handler on the
real operations, map the contract's data onto the domain types, and fix what the contract and the
Engineering Decisions say differently. The order follows the Build Plan's frontend track
(`docs/backend/build-plan.md` §2).

| ID                              | Title                                                                                          | Depends on   | Backend piece | Status      |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ------------ | ------------- | ----------- |
| [F0](F0-contract-wiring.md)     | Wire the catalogue to the contract through route handlers                                      | —            | —             | done        |
| [F1](F1-design-system-shell.md) | Tenant theme from `/v1/config/public`, Ethiopic font, component gallery                        | F0           | B1            | todo        |
| [F2a](F2a-language-routes.md)   | Language in the URL, tenant default language, D7 routes with redirects                         | F0           | B1            | todo        |
| [F2b](F2b-catalogue-screens.md) | Server-rendered catalogue, popular, lazy market groups, paging, phone search                   | F2a          | B4            | todo        |
| [F3](F3-slip-calculator.md)     | Slip on slipcalc (D1), rules from config, bookings and `/b/[code]`                             | F0           | B3            | done        |
| [F3a](F3a-slip-calculator.md)   | Split from F3: slip on slipcalc (D1), rules from config, money as strings                      | F0           | B3            | done        |
| [F3b](F3b-bookings.md)          | Split from F3: booking codes and `/b/[code]`                                                   | F3a          | B3            | done        |
| [F4](F4-auth-session.md)        | Auth through route handlers and an httpOnly session cookie; KYC                                | F0           | B5, B12       | in_progress |
| [F4a](F4a-session-login.md)     | Split from F4: session cookie, login with the new-device OTP, logout, `/api/me`, trusted proxy | F0           | B5            | planned     |
| [F4b](F4b-register-kyc.md)      | Split from F4: register with the SMS code, reset the password, verify with Fayda               | F4a          | B5, B12       | todo        |
| [F5](F5-place-bet-my-bets.md)   | Place bet with `Idempotency-Key` and the 409 flow; My bets; `/t/[ticket]`                      | F3a, F3b, F4 | B6            | todo        |
| [F6](F6-wallet.md)              | Wallet: balances, deposits with `next_action`, withdrawals, payout accounts, history           | F4           | B8            | todo        |
| [F7](F7-account-rg-inbox.md)    | Account, limits, self-exclusion, reality check, promotions, inbox; delete the mocks            | F4           | B8, B13       | todo        |
| [F8a](F8a-workspace.md)         | Convert to a pnpm + Turborepo workspace: `apps/player`, shared packages                        | F7           | —             | todo        |
| [F8](F8-terminal.md)            | Shop terminal app                                                                              | F8a          | B9            | todo        |
| [F9](F9-pos.md)                 | Cashier POS app                                                                                | F8a          | B9            | todo        |
| [F10](F10-agent-backoffice.md)  | Agent portal, then back office (Refine)                                                        | F8a          | B9, B10       | todo        |

F1, F2a, F3 and F4 only need F0 and can go in any order. Recommended order: **F3** (every slip number is
currently a float estimate that differs from the backend), F1, F2a, F2b, F4, F5, F6, F7, F8a, F8–F10.
Whichever of F1, F2a and F3 runs first builds `loadPublicConfig` (`/v1/config/public`, cached per
tenant); the others reuse it. The "Backend piece" column says when a screen
can move from Prism to the real API (`API_REAL_TAGS`, D7) — none of the tasks wait for it. One exception:
the server refuses `Bookings` in `API_REAL_TAGS` until contract request 004 (the player's IP and device)
and a trusted-proxy setting land.

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
