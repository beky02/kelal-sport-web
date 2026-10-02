# Tasks

Each file here is one unit of work for the `/task` workflow (`.claude/skills/task/SKILL.md`):
**plan → implement → verify → finish**, on its own branch, ending in one reviewable PR.

| ID | Title | Depends on | Milestone | Status |
|---|---|---|---|---|
| [B0](B0-skeleton.md) | Skeleton: DB session + RLS helpers, outbox, idempotency, readiness, CI | — | — | done |
| [B1](B1-tenancy-config.md) | C16 tenancy and configuration, seeded `demo` tenant | B0 | — | planned |
| [B2](B2-ledger.md) | C03 ledger: post, reverse, balances, invariants | B0 | — | todo |
| [B3](B3-slip-calculator.md) | C07 slip calculator passes the golden CSV | — | — | todo |
| [B4](B4-fake-feed-catalogue.md) | C05 fake feed and C06 catalogue | B1 | M1 | todo |
| [B5](B5-identity.md) | C01 identity with console SMS; C14 sender interface | B1 | — | todo |
| [B6](B6-placement-booking.md) | C08 bet placement; C09 bookings and ticket check | B2, B3, B4, B5 | — | todo |
| [B7](B7-settlement.md) | C10 settlement from fake-feed results; accumulator bonus (C11) | B6 | — | todo |
| [B8](B8-payments-rg.md) | C04 payments (mock provider); C12 limits and self-exclusion | B2, B5 | M2 | todo |
| [B9](B9-retail.md) | C19 retail network | B6, B7 | M3 | todo |
| [B10](B10-backoffice-reporting.md) | C15 admin APIs with audit and approvals; C13 reporting to FileSink | B7, B8, B9 | M4 | todo |
| [B11](B11-real-providers.md) | Real provider adapters as accounts arrive | B8 | Gate C | todo |
| [B12](B12-kyc.md) | C02 KYC with FakeFayda | B5 | — | todo |
| [B13](B13-promotions-inbox-cms.md) | C11 promotions, C14 inbox and devices, banners and pages | B5, B7 | — | todo |

B3 has no dependencies and can be done first. Large tasks (B6, B9, B10) should be split during planning:
the plan phase may create `B9a`, `B9b`, … files and run them one at a time.

## Status values

`todo` → `in_progress` (planning) → `planned` (plan approved; implementing) → `verifying` → `done`, or `blocked`
(reason in the task file). The workflow updates the `status:` line in the task file and this table **on the task
branch**; the status reaches main when you merge. A task can start only when its dependencies are `done` on main.

## Files per task

```
docs/tasks/B3-slip-calculator.md   the task: goal, specs to read, scope, acceptance criteria
docs/tasks/B3/plan.md              written in phase 1 (approved before coding)
docs/tasks/B3/verification.md      written in phase 3: every check, its evidence and every review finding
```

## Writing a new task

Copy `_template.md`. The acceptance criteria are what the verifier checks, so make each one observable:
a test, a command output, an HTTP exchange. "Works correctly" is not a criterion.
