# Backend docs (copy)

`docs/backend/` holds the parts of the backend repo's `docs/` folder that the frontend reads — the
engineering decisions (D1–D9), the build plan, the API standards, the component design pages the
screens are built against, and the product docs (PRD, SRS). The backend repo owns them; this repo reads
only the copy. What is copied is the `DOCS_KEEP` list in `scripts/contract-sync.mjs`; the backend's own
task files, its implementation guide and its infrastructure pages are not.

- Refresh: `pnpm contract:sync` (copies `contracts/` and the listed docs together, then regenerates types).
- Check for drift: `pnpm contract:sync --check` (also run by `pnpm verify`) — only the listed files.
- Never edit files under `docs/backend/` by hand; change them in the backend repo and sync. To read
  another backend page, add it to `DOCS_KEEP` and sync.
- The frontend's own design docs, derived from these and the design project, live in `docs/design/`.

First copied 2026-10-02 from backend commit `482dc06`; trimmed to the allowlist the same day.
