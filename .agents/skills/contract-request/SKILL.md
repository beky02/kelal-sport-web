---
name: contract-request
description: Write up a change the web app needs from the API contract (a missing field, endpoint, enum value, error code or example) for the backend repo, which owns the contract. Use when a task needs something contracts/openapi.yaml does not have. Never edit contracts/ here.
argument-hint: <what the web app needs>
---

# Contract request

Needed: $ARGUMENTS

The contract is owned by the backend repo (`../kelal backend/contracts`). This repo only holds a synced
copy, so the change is made there with its `/contract-change` skill, then synced here.

1. **Confirm it's really missing.** Search `contracts/openapi.yaml` (and `/v1/dictionary`,
   `/v1/config/public`) for the data under another name. Derive it from what exists if that is honest
   (e.g. countries from dictionary tournaments) — and say so in the task plan instead of requesting.
2. **Keep it additive** (TD-01): new optional fields, new endpoints, new enum values, new error codes. If
   only a breaking change would do, stop and explain the alternatives to the user.
3. Write `docs/contract-requests/<NNN>-<slug>.md` (next number; create the folder if needed):

   ```md
   ---
   status: proposed # proposed → accepted → in-contract → synced
   requested_by: F<id>
   ---

   # <title>

   ## Why the web app needs it — the screen, what a player sees without it today

   ## Proposed change — exact YAML for contracts/src/*.yaml (schema, path, example), in

                                       the contract's style; examples consistent with the shared fixtures

   ## Clients affected — web, Flutter app, terminal/POS

   ## Until it lands — what the UI does meanwhile (e.g. leaves the column empty)
   ```

4. Tell the user: the request file, and that someone runs `/contract-change` in the backend repo with it.
   After that lands: `pnpm contract:sync` here, set the request to `synced`, and finish the UI.
5. Never work around a missing contract field by calling an undocumented endpoint, inventing a shape, or
   hardcoding data that should come from the API.
