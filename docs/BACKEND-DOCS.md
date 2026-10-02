# Backend docs (copy)

`docs/backend/` is a verbatim copy of the backend repo's `docs/` folder — engineering decisions (D1–D9),
the component design pages (C01–C19), the product docs and the backend's own task files. The backend repo
owns them; this repo reads only the copy.

- Refresh: `pnpm contract:sync` (copies `contracts/` and `docs/backend/` together, then regenerates types).
- Check for drift: `pnpm contract:sync --check` (also run by `pnpm verify`).
- Never edit files under `docs/backend/` by hand; change them in the backend repo and sync.

First copied 2026-10-02 from backend commit `482dc06`.
