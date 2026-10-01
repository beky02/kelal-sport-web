---
id: FX
title: Short imperative title
status: todo
depends_on: []
contract_tags: [] # OpenAPI tags this task calls (they decide mock vs real, D7)
touches_money: false # true -> the money-reviewer runs in verification
touches_ui: true # true -> the ui-checker runs in verification
---

# FX — Title

## Goal

One paragraph: what a player can do when this is done, and why it matters.

## Read first

- `../kelal backend/docs/engineering-decisions.md` §Dx (wins over component pages)
- `../kelal backend/docs/design/components/cxx-....md` §n
- `contracts/openapi.yaml` operations: `GET /v1/...`
- Existing code: `src/features/...`

## Scope

In:

- ...

Out (do not build here):

- ...

## Acceptance criteria

Each criterion must be proven by a named test, a command output or a `pnpm ui` screenshot in
`verification.md`.

- [ ] **AC-1** ...
- [ ] **AC-2** ...

## Verification

- `pnpm verify` passes
- extra commands specific to this task (e.g. `curl -H 'Prefer: code=409' …`)

## Notes

Open questions, decisions taken during the task (with date), contract requests, follow-up tasks.
