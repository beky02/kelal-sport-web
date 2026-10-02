---
id: BX
title: Short imperative title
status: todo
depends_on: []
components: [C0X]
contract_tags: []          # OpenAPI tags this task implements (scripts/contract_check.py --missing <tag>)
touches_money: false       # true -> the money-reviewer runs in verification
---

# BX — Title

## Goal
One paragraph: what exists when this is done and why it matters.

## Read first
- `docs/engineering-decisions.md` §Dx (wins over component pages)
- `docs/design/components/c0x-....md` §n
- `contracts/openapi.yaml` operations: `GET /v1/...`

## Scope
In:
- ...

Out (do not build here):
- ...

## Acceptance criteria
Each criterion must be proven by a named test or a command output in `verification.md`.

- [ ] **AC-1** ...
- [ ] **AC-2** ...

## Verification
- `make verify` passes
- extra commands specific to this task

## Notes
Open questions, decisions taken during the task (with date), links to follow-up tasks.
