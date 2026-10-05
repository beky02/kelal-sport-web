# Backend proposals

Changes to the backend's product and design documents (PRD, SRS, component pages) that this repo needs or
that the product owner decided while working here. The backend owns those documents; each file here is a
draft for someone to apply there, after which `pnpm contract:sync` brings the updated copy into
`docs/backend/`. A change to the API contract itself is a contract request (`docs/contract-requests/`).

| #                                           | Proposal                                                                                                                         | Raised           | Status |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| [001](001-platform-and-retail-hierarchy.md) | The platform layer, and one retail chain: Platform → Brand → Agent → Shop (brand agents, no master agents, the platform console) | 2026-10-05 (FD6) | draft  |

Status: `draft` → `agreed` (backend accepted) → `in-docs` (the backend docs are updated and synced here).
