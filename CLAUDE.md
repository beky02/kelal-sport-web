# KelalSport web

Next.js 16 player web app for a multi-tenant sportsbook in Ethiopia. It talks to the FastAPI backend in
`../kelal backend` (which owns the API contract) through its own route handlers. Conventions, data flow
and the state table are in `AGENTS.md` (imported below) — read it before writing code.

## How work is done here

All feature work goes through the task workflow: **`/task <ID>`** (e.g. `/task F3`). It plans, implements
and verifies one task from `docs/tasks/`, and ends with a verification report. Don't start feature code
outside it. Small fixes (typo, one-line bug) can be done directly, but still finish with `pnpm check`.

## Commands

```bash
pnpm install
pnpm dev                  # app on :3000 (Next.js refuses a second dev server in this folder — reuse it)
pnpm mock                 # Prism on :4010 — only if the backend's `make up` is not already serving it
pnpm check                # fast gate: typecheck, lint, prettier, unit + component tests   (~10 s)
pnpm verify               # full gate: check + generated types + contract drift + build + UI screens
pnpm ui                   # every screen at 375 and 1440 px, English and Amharic → test-results/ui/*.png
pnpm api:types            # regenerate src/lib/api/schema.d.ts from contracts/openapi.yaml
pnpm contract:sync        # copy contracts/ and docs/backend/ from the backend repo, regenerate types
pnpm vitest run path/to/file.test.ts -t name    # one test (prefer while iterating)
```

Prism answers every request with the contract's examples (three matches: Saint George v Fasil Kenema,
Arsenal v Chelsea, Real Madrid v Barcelona). Ask for an error or a named example with
`curl -H 'Prefer: code=409' …` or `Prefer: example=odds_changed`.

## Sources of truth (higher wins)

1. `contracts/openapi.yaml` + `contracts/golden/` → 2. `docs/backend/engineering-decisions.md`
   (D1–D9) → 3. `docs/decisions.md` (FD1–FD5, this repo's decisions where the sources above leave a
   choice) → 4. `docs/backend/design/` (C18 is the web client) → 5. the claude.ai design
   project (look and copy) → 6. `docs/backend/product/`.

`docs/backend/` is a copy of the backend repo's `docs/` (engineering decisions, design pages, product docs),
kept current by `pnpm contract:sync` and checked by `pnpm contract:sync --check`. Read the copy; never read
files from the backend repo itself, and never edit the copy by hand.

If they conflict, follow the higher one and note it in the task's plan. If something isn't decided
anywhere, ask; don't invent product rules (taxes, limits, payouts, regulator behaviour, copy shown to
players about money).

## Non-negotiables

- **Money**: the slip shows what `contracts/golden/ts/slipcalc.ts` computes (D1) — nothing else. Money
  and odds are decimal strings; never `parseFloat`/`Number` them into arithmetic. Placing, depositing and
  withdrawing wait for the server; no optimistic money.
- **Browser never calls the API** (D3). Only `/api/*` route handlers in this app do, with `X-Tenant-Id`.
  Session tokens live in an httpOnly cookie set by a route handler; never in `localStorage`, never in JS.
- **Contract first**: request and response shapes come from the generated `schema.d.ts`. Never edit
  `contracts/` or `schema.d.ts` by hand. A missing field or endpoint is a `/contract-request` to the
  backend, not a local workaround or a made-up shape.
- **Golden CSV** is the slip spec. Never change `contracts/golden/` to make a test pass.
- **Idempotency**: every POST that moves money or creates a bet/booking sends an `Idempotency-Key`,
  created once per user intent and reused on retry.
- **Errors**: switch on the Problem `code`, never on `title`. Show the fix from `errors[]` when there is one.
- **Release 2 stays off**: live, realtime and cash out sit behind `config/features.ts` (D8).
- **Both languages**: every visible string in `en.json` and `am.json`; composed Amharic listed in
  `TRANSLATION-NOTES.md`.
- **Secrets**: never read or print `.env.local` or other env files; no tokens or credentials in code,
  tests, fixtures, logs or screenshots.

## Tests

- Test first for each acceptance criterion; name tests after the behaviour
  (`shows the new price and asks to accept it when the bet comes back 409`).
- Mappers are tested against the contract's own examples via `tests/contract.ts`, not hand-written copies.
- Slip numbers are tested against `contracts/golden/slips.csv`, row for row.
- Screens are checked by `pnpm ui`; look at the PNGs, don't only read the pass count.

## Git

- One branch per task: `task/<id>-<slug>`. Small commits: `F3: wrap slipcalc behind calculateBetSlip (D1)`.
- Never push, force-push, or open a PR without asking. Never commit `.env*` (except `.env.example`) or
  `test-results/`.

## When compacting

Keep: the current task ID and phase, the plan file path, acceptance-criteria status, failing checks and
open review findings, and the list of files changed.

@AGENTS.md
