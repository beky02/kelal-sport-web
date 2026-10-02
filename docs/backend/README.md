# Docs

Exported from the design doc "Sportsbook Platform — PRD & SRS" (Claude Docs) on 1 Oct 2026. When a decision
changes, update the design doc and re-export the changed tab here, or edit here and mirror it back. Never let
the two drift.

## Which document wins

When two sources disagree, the higher one wins (and the lower one is a bug to fix):

1. `contracts/openapi.yaml` and `contracts/golden/` — executable, tested
2. `engineering-decisions.md` — decisions taken after the readiness review
3. `design/components/cNN-*.md` and `design/td-*.md` — component and cross-cutting designs
4. `product/srs.md`, then `product/prd.md` — requirements and product intent

Some component pages still show older examples (ticket numbers ending in `-4`, odds 1.85 in C19, the C16
array form of `acca_bonus_table`); the higher sources above already correct them.

## Map

| File | Use it for |
|---|---|
| `product/prd.md` | Why: goals, users, journeys, release scope |
| `product/srs.md` | What: numbered requirements (BET-01, WAL-02, …), NFRs, appendices |
| `engineering-decisions.md` | D1 slip rules · D2 ledger · D3 tenancy/security/IDs · D4 schema fixes · D5 catalogue/fake feed · D6 local stack · D7 frontend · D8 scope · D9 open questions |
| `build-plan.md` | Order of work, mocks for every third party, milestones |
| `implementation-guide.md` | Build-vs-buy, stack rationale, how the pieces fit |
| `design/td-00-architecture.md` | Modules, layout, module rules, cross-cutting concerns |
| `design/td-01-api-standards.md` | Errors, idempotency, pagination, auth headers, versioning |
| `design/td-02-data-architecture.md` | Schemas, RLS, partitions, events, Redis keys |
| `design/td-90-infra-security-ops.md` | Deployment, security controls, operations |
| `design/td-91-testing-quality.md` | Test strategy, invariants, load tests |
| `design/components/` | C01–C19, one page per component |
| `tasks/` | The work queue for the `/task` workflow |
