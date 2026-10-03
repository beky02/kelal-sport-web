---
id: F7d
title: Split from F7 — content pages from the API; the mock repository deleted
status: todo
depends_on: [F6c, F7a, F7b, F7c]
contract_tags: [Config]
touches_money: false
touches_ui: true
---

# F7d — Content pages and the mocks' removal

Split from [F7](F7-account-rg-inbox.md) (2026-10-03, before planning). Last of F6 and F7: the mocks it
deletes serve payments until F6c and responsible gaming and session activity until F7a and F7b.

## Goal

`/terms`, `/privacy` and `/help` render the tenant's published pages, and the in-repo mock repository and
`NEXT_PUBLIC_USE_MOCKS` are gone: every screen reads the contract.

## Read first

- `contracts/openapi.yaml`: `GET /v1/pages/{slug}`
- Existing: `src/lib/api/mock/*`, `src/config/env.ts` (`useMocks`), `PhasePlaceholder`,
  `tests/unit/realtime.test.ts` (built on the mock's fixtures)

## Scope

In: the content pages, server-rendered and cached per tenant and language as the contract allows,
replacing `PhasePlaceholder`; delete `src/lib/api/mock/` and the env flag; port `realtime.test.ts`'s
fixtures to contract examples.

## Acceptance criteria

- [ ] **AC-3** `src/lib/api/mock/` no longer exists and `pnpm verify` passes.
- [ ] **AC-4** Content pages render from `/v1/pages/{slug}`.
