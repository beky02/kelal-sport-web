# Tasks

Each file here is one unit of work for the `/task` workflow (`.claude/skills/task/SKILL.md`):
**plan → implement → verify → finish**, on its own branch, ending in one reviewable PR.

The screens already exist — they were built from the design before the contract did. Most tasks are
"rewire this screen to the contract": replace the mock repository behind it with a route handler on the
real operations, map the contract's data onto the domain types, and fix what the contract and the
Engineering Decisions say differently. The order follows the Build Plan's frontend track
(`../kelal backend/docs/build-plan.md` §2).

| ID                              | Title                                                                                | Depends on    | Backend piece | Status |
| ------------------------------- | ------------------------------------------------------------------------------------ | ------------- | ------------- | ------ |
| [F0](F0-contract-wiring.md)     | Wire the catalogue to the contract through route handlers                            | —             | —             | done   |
| [F1](F1-design-system-shell.md) | Tenant theme from `/v1/config/public`, Ethiopic font, component gallery              | F0            | B1            | todo   |
| [F2](F2-catalogue.md)           | Catalogue screens: server-rendered lists, `/match/[id]`, popular, search, dictionary | F0            | B4            | todo   |
| [F3](F3-slip-calculator.md)     | Slip on slipcalc (D1), rules from config, bookings and `/b/[code]`                   | F0            | B3            | todo   |
| [F4](F4-auth-session.md)        | Auth through route handlers and an httpOnly session cookie; KYC                      | F0            | B5, B12       | todo   |
| [F5](F5-place-bet-my-bets.md)   | Place bet with `Idempotency-Key` and the 409 flow; My bets; `/t/[ticket]`            | F3, F4        | B6            | todo   |
| [F6](F6-wallet.md)              | Wallet: balances, deposits with `next_action`, withdrawals, payout accounts, history | F4            | B8            | todo   |
| [F7](F7-account-rg-inbox.md)    | Account, limits, self-exclusion, reality check, promotions, inbox; delete the mocks  | F4            | B8, B13       | todo   |
| [F8](F8-terminal.md)            | Shop terminal app                                                                    | F3, workspace | B9            | todo   |
| [F9](F9-pos.md)                 | Cashier POS app                                                                      | F3, workspace | B9            | todo   |
| [F10](F10-agent-backoffice.md)  | Agent portal, then back office (Refine)                                              | F4, workspace | B9, B10       | todo   |

F1, F2, F3 and F4 only need F0 and can go in any order; F3 first is the best value (every slip number is
currently a float estimate that differs from the backend). The "Backend piece" column says when a screen
can move from Prism to the real API (`API_REAL_TAGS`, D7) — none of the tasks wait for it.

## Open decisions (ask before the task that needs them)

These are places where the design docs disagree with what is built, and no higher source settles it.

1. **Workspace layout (before F8).** C18 §3 puts the web apps in a pnpm/Turborepo workspace
   (`apps/player|terminal|pos|agent|admin`, `packages/api|slipcalc|ui|betslip|i18n`). This repo is a
   single Next.js app. Convert before F8, or keep separate repos per app?
2. **Language in the URL (F2).** C18 §4.3: `next-intl`, Amharic default, `/am/...` and `/en/...` paths
   for indexable pages. Built: language is a stored preference, English default, no URL segment.
3. **Route names (F2, F5).** D7 deep links are `/match/{id}`, `/b/{code}`, `/t/{ticket}`; C18 §4.1 adds
   `/sport/[slug]` and `/league/[id]`. Built: `/event/[id]`, `/competition/[id]`. Rename with redirects?
4. **`decimal.js` (F3).** C18 §4.2 says `decimal.js` for money with an ESLint rule banning `number`; D1
   (higher) defines the slip on BigInt rationals, which `slipcalc.ts` already does. Use slipcalc for the
   slip, and `decimal.js` (or plain strings) for everything else?
5. **Phone tab bar without Live (now).** With live betting off (D8) the phone bar has four tabs and the
   raised slip button sits second, not centred. Fill the slot (Search? Wallet?) or accept four?

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
