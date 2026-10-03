---
name: task
description: Run one frontend backlog task end to end — plan, implement, verify (spec, security, money, quality, UI), finish. Usage /task F3 or /task F3 auto
argument-hint: <task-id> [auto]
disable-model-invocation: true
---

# Task workflow: plan → implement → verify → finish

Task: **$0**. Mode: **$1** (`auto` = don't stop for plan approval; anything else = stop once after planning).

You are the single agent that owns this task from plan to verified result. Work through the phases in
order. Keep `docs/tasks/$0/` up to date as you go — it is how the user (and you, after a compaction) knows
where things stand. Create a task list with one item per phase and tick it off.

Stop and ask the user (even in auto mode) only when: the specs conflict in a way the precedence rule in
CLAUDE.md doesn't settle, a product rule is undecided (taxes, limits, payouts, regulator behaviour, copy
about money), the task needs a contract change, or something irreversible is required (push, deleting
data, changing the golden files).

## Phase 0 — Start or resume

1. Find the task file: `docs/tasks/$0-*.md`. If it doesn't exist, stop and say so.
2. **Resume?** If a branch `task/$0-*` already exists (`git branch --list 'task/$0-*'`), switch to it, read
   the task file's `status`, `docs/tasks/$0/plan.md` and `verification.md` if they exist, and
   `git log main..HEAD`, then continue at the phase matching the status: `in_progress` → Phase 1;
   `planned` → Phase 2 (first plan step without a commit); `verifying` → Phase 3; `blocked` → report the
   recorded reason and ask how to proceed. Skip steps 3–6.
3. **Fresh start.** Switch to `main`; `git status` must be clean (if not, stop and show what's dirty).
4. Check `depends_on` **on main**: each dependency's task file must say `status: done`. If not, stop and
   name it.
5. Check the stack: Prism answers (`curl -s -o /dev/null -w '%{http_code}' -H 'X-Tenant-Id: demo' -H 'Accept-Language: en' http://localhost:4010/v1/sports`
   → 200; else ask the user to run `make up` in the backend or `pnpm mock`), and
   `pnpm contract:sync --check` passes (else ask whether to sync first). Run `pnpm check` on main; if it
   fails before you touched anything, report it and stop.
6. Create branch `task/$0-<slug>` from main. Set `status: in_progress` in the task file and the table in
   `docs/tasks/README.md`.

## Phase 1 — Plan

1. Read the task file, then every source under "Read first" (whole sections, not skims), then the
   contract operations it names in `contracts/openapi.yaml` (request, responses, every error code and
   named example). Read the existing code you will touch and the `frontend-patterns` skill. For broad
   exploration use the Explore subagent to keep this context clean. Next.js here is newer than your
   training data — read the relevant page in `node_modules/next/dist/docs/` before using an API.
2. Write `docs/tasks/$0/plan.md` with exactly these sections:
   - **Understanding** — the goal in your own words, 3–5 sentences.
   - **Spec conflicts and decisions** — every disagreement between sources, which wins and why
     (precedence rule), and every assumption. Unresolvable ones → ask the user now.
   - **Design** — contract operations → `lib/server` loader → mapper → route handler → `features/*/api`
     → hook → components; domain type changes; query keys; error codes handled and what the UI offers for
     each; i18n keys added; feature flags.
   - **Files** — every file to create or change, one line each on why.
   - **Acceptance criteria → tests** — a table: AC id | test file + test name | how it proves the AC.
     Every AC needs at least one row. Include the `pnpm ui` screens that show it.
   - **Risks** — money, security, accessibility, performance; how each is covered.
   - **Out of scope** — what you will deliberately not do.
   - **Sub-tasks** — if the task is too big for one reviewable PR (> ~1,500 changed lines or several
     unrelated areas), split it into `docs/tasks/$0a-*.md`, `$0b-*.md` from `_template.md`, each with its
     own acceptance criteria, then continue with only the first one.
3. Plan gate:
   - Mode not `auto`: show a short summary (decisions, files, AC→test table, risks) and ask with
     AskUserQuestion: "Approve plan" / "Change something" / "Stop". Apply changes and re-ask until approved.
   - Mode `auto`: proceed, but record "auto-approved" at the top of plan.md.
4. Set `status: planned` in the task file and README table and commit the plan: `$0: plan`.

## Phase 2 — Implement

For each step of the plan:

1. Write the tests for the acceptance criteria the step covers first; run them and see them fail for the
   right reason.
2. Implement until they pass. Follow CLAUDE.md non-negotiables, AGENTS.md conventions and the
   `frontend-patterns` skill.
3. **Prove each new acceptance test.** Once it is green, break the behaviour it guards once — flip a
   comparison, drop an invalidation, return early — see the test fail, and restore. A test that stays
   green is rewritten (the usual cause: it asserts before the data it checks has arrived). List each under
   "Tests proven" in `docs/tasks/$0/verification.md`: test name — what you broke.
4. **Look at the screens the step changed.** Add or adjust them in `tests/e2e/screens.spec.ts`, run
   `pnpm ui --grep "<screens>"` and open the four PNGs of each (en/am × phone/desktop). Check:
   - every state is there and has a screenshot: loading, empty with a next step, error with Try again,
     guest;
   - Amharic is translated and readable: labels at least 12 px in the body font, no `uppercase` or
     `tracking-*`;
   - anything that acts or links looks like it (a chevron, a button);
   - money, dates and times follow 06-language;
   - nothing overflows or truncates at 375 px.
5. Run `pnpm check` (the Stop hook also runs it). Fix the root cause of failures; never weaken a test, add
   `// @ts-expect-error`, `eslint-disable`, `.skip` or `.only`, or loosen a Zod schema to get green
   without saying so in the plan.
6. Commit: `$0: <what this step did>`.

Rules while implementing:

- Stay inside the plan's file list. If you must go outside it, add the file to plan.md with the reason.
- Need something the contract lacks? Stop and ask; if approved, write it up with `/contract-request`.
  Never invent a response shape or call an endpoint that is not in `contracts/openapi.yaml`.
- Don't touch `contracts/`, `src/lib/api/schema.d.ts` or `contracts/golden/`.

## Phase 3 — Verify

Set `status: verifying`.

### 3a. Self-review

About five minutes, before the gate and the reviewers: the checks below catch what reviewers kept finding
(F5b, F6a). Fix what fails, then record one line per item under "Self-review" in verification.md.

- **Money moves:** every action that moves money or places a bet invalidates every affected query root
  (balance, history, bets) and nothing is patched in the browser.
- **New values:** for each value the task introduces or rewires, grep where it is shown or compared; each
  place uses it, not a neighbour (the slip's alert once showed the stake as the balance).
- **Async tests:** every test waits for the data it asserts on, not for something already on screen.
- **Personal data:** everything only a player may see sits under a query key the session watcher drops,
  with a behavioural test that switches the player.
- **Route handlers:** session checked on every call, inputs validated before they reach an upstream URL,
  `no-store`, Prism's `Prefer` only under `next dev` and never to the real API — each with a test.
- **Screens:** every state has a screenshot (Phase 2, step 4).
- **Docs:** the plan's Files list and AC→tests names match the code; design pages, translation notes and
  the README status are current.

### 3b. Automated gate

1. **Dev server.** `pnpm ui` reuses the running `next dev`, which may be the user's. Check it first:
   `curl -s http://localhost:3000/__nextjs_server_status` answers, and one request to a route this task
   changed returns what its tests expect. If a route answers 5xx while its unit tests pass — typically
   after a server module gained a new export — read `.next/dev/logs/next-development.log`, then restart it
   in place: `curl -X POST 'http://localhost:3000/__nextjs_restart_dev?invalidateFileSystemCache'` (the
   `next dev` process keeps running; never kill the user's server).
2. Run `pnpm verify` (check, generated types, contract drift, build, UI screens). All must pass. Fix and
   re-run until green (max 5 attempts; then stop and report what fails and why). Playwright retries a
   failed test once: a test that passed only on retry is listed under Gaps as flaky, with its first error.
   If Prism is down, record it as a gap rather than skipping silently.

### 3c. Review brief and panel

Write a **Review brief** at the top of verification.md, at most 12 lines: what changed, grouped by concern,
with the files; where the risk is; which decisions were the user's (plan gate answers); what is
deliberately not done. Reviewers start from it.

Choose the panel from the diff (`git diff --name-only main...HEAD` and `git diff main...HEAD`):

- `spec-verifier` — always.
- `quality-reviewer` — always.
- `money-reviewer` — when the task file has `touches_money: true` or the diff touches the slip, odds,
  stakes, taxes, payouts, balances, deposits, withdrawals, tickets or `src/lib/money.ts`.
- `security-reviewer` — when the diff touches `src/app/api/**`, `src/lib/server/**`, `src/proxy.ts`,
  `src/lib/session-cookie.ts`, `src/config/env.ts`, `next.config.*`, `instrumentation.ts`, `package.json`,
  `pnpm-lock.yaml` or `.env.example`, or adds `dangerouslySetInnerHTML`, `window.location`, `target="_blank"`
  or an `href` that is not a `routes.*` value.
- `ui-checker` — when the task changes anything a player sees; name the screens.

Launch the chosen reviewers **in parallel in one message**. Give each: the task id, the task file,
`docs/tasks/$0/plan.md`, `docs/tasks/$0/verification.md` (the brief) and the diff command
`git diff main...HEAD`, and tell it: the gate has passed (don't re-run `pnpm check`, `pnpm build`,
`pnpm ui` or `pnpm verify`; single tests are fine); stay in your lane; aim to finish in about 25 tool
calls. They review; they don't edit.

### 3d. Triage and fix

In `docs/tasks/$0/verification.md`, under the brief:

- **Automated gate** — each check with PASS/FAIL/WARN and the command; paste the final `pnpm verify`
  summary.
- **Acceptance criteria** — AC | status | evidence (test name + result, or command + output excerpt, or
  screenshot file).
- **Tests proven** — from Phase 2: test name — what was broken to see it fail.
- **Review findings** — BLOCKER, MAJOR and MINOR findings: id | reviewer | severity | summary | decision
  (fixed in <commit> / rejected because … / follow-up). A finding several reviewers raised gets one row,
  with the others named in it. Notes go below the table, one line each, with no decision needed.
- **Gaps** — anything not verified (e.g. Prism down, behaviour Prism cannot simulate, a flaky test) and the
  risk it leaves.

Fix every BLOCKER and MAJOR finding (a test first where it's a behaviour bug). Reject a finding only with a
concrete reason (it contradicts a higher source, or it's out of scope) written in the table. A MINOR
finding is fixed only if it takes under about five minutes in a file the task already touches; otherwise it
is a one-line follow-up.

After fixes there is no full re-review:

- Each fix needs a test that fails without it and passes with it; record both runs in verification.md.
  That confirms the fix. (For a finding about a weak test, the proof is the strengthened test failing
  against the bug it now guards.)
- Re-run a reviewer only for a BLOCKER it raised, and only on that finding: give it the finding id, the
  fix commit and the test, and ask it to confirm that finding alone — it does not review the diff again.
- MINOR findings and notes never trigger a re-review.
- Run `pnpm check` and `pnpm ui --grep "<screens the fixes touched>"` after fixes; the full `pnpm verify`
  runs once, before Phase 4.

Max 3 rounds; if a BLOCKER is still open after them, set `status: blocked` with the reason and stop.

## Phase 4 — Finish

1. Tick the acceptance criteria in the task file; set `status: done` (task file and README table).
2. Final commit: `$0: verified`.
3. Report to the user, briefly:
   - what was built (2–4 bullets) and the branch name;
   - evidence: `pnpm verify` result, test count, golden rows, UI screens checked;
   - review findings fixed vs. rejected vs. follow-up (counts, plus anything important);
   - what the user must do next: review and merge `task/$0-…` into main (offer to push and open a PR with
     `gh` — only after they say yes), plus anything they must decide (including any contract requests);
   - the next task that is now unblocked.
