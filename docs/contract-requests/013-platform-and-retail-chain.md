---
status: proposed
requested_by: FD6 (for F10a, F10g, F11)
---

# The Phase 1 retail chain (brand and partner agents, every shop under an agent) and the platform console's operations

## Why the web app needs it

The product owner fixed the Phase 1 chain as Platform → Brand → Agent → Shop
([backend proposal 001](../backend-proposals/001-platform-and-retail-hierarchy.md), FD6 here). Every
shop has an agent: shops the brand runs itself sit under a **brand agent**, and other shops under a
**partner agent**. There is one agent level. Above the brands, platform staff create and run brands from a
**platform console**.

The contract describes a different network and has no platform layer:

1. **Agent kind.** `Agent` can't say whether it is the brand's own or a partner. The back office (F10g)
   can't label agents, and the agent portal (F10a) can't show the right commission wording for a brand
   agent (usually none).
2. **Master agents.** `Agent.parent_id` and `level: [master_agent, agent]` describe a tree that Phase 1
   doesn't have. `GET /v1/admin/retail/agents` filters by `parent_id`.
3. **Shops without an agent.** `Shop.agent_id` is nullable ("owned by the operator"). Phase 1 has none.
4. **Errors on the retail admin operations.** `POST`/`PATCH /v1/admin/retail/agents` and `/shops` list
   only their 2xx answers: no 400, 401, 403 or 422, and no example of a refused agent or shop. F10g can't
   show what was refused.
5. **The platform console.** There are no operations for platform staff: sign-in, creating a brand, its
   domains and first admin, its status, and (depending on proposal 001, Q1) a statement per brand.

## Proposed change

Items 1, 4 and 5 are additive. Items 2 and 3 tighten what the server accepts. The fields stay, so master
agents can return later without a breaking change, but Phase 1 refuses them.

```yaml
# contracts/src/03_components.yaml → components.schemas
Agent:
  properties:
    kind:
      type: string
      enum: [brand, partner]
      description: brand = the brand's own shops (usually no commission); partner = a business running shops for the brand
    parent_id:
      description: Always null in Phase 1; a non-null value is refused (422)
    level:
      description: Always `agent` in Phase 1
Shop:
  required: [agent_id, code, name, region, city, max_cash_held]
  properties:
    agent_id:
      type: string # was [string, "null"]: every shop has an agent (brand or partner)
```

```yaml
# contracts/src/02_retail_agent_admin.yaml → paths
/v1/admin/retail/agents:
  post:
    responses:
      "400": { $ref: "#/components/responses/BadRequest" }
      "401": { $ref: "#/components/responses/Unauthorized" }
      "403": { $ref: "#/components/responses/Forbidden" }
      "422":
        $ref: "#/components/responses/Unprocessable"
        # named examples: parent_id given (Phase 1 has one agent level); phone already an agent's
# …the same four on PATCH /v1/admin/retail/agents/{id}, POST /v1/admin/retail/shops and
# PATCH /v1/admin/retail/shops/{id} (examples: agent_id missing or not this brand's; code taken)
```

`Shop.agent_id` becoming required isn't additive (TD-01). There are no clients of the retail admin
operations yet (F10g is `todo`), so the backend can choose between changing it before Release 1 and
keeping it nullable while refusing null.

**Platform operations (new tag `Platform`, a `platformAuth` scheme with its own token audience).** These
are listed so the console task (F11) knows what it needs. Their shapes are the backend's to design with
proposal 001.

| Operation                                                      | For                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `POST /v1/platform/auth/login`, `/totp`, `/refresh`, `/logout` | Platform staff sign-in with password and TOTP                                            |
| `GET`, `POST /v1/platform/tenants`                             | List brands; create one (code, legal name, licence number and expiry, default language)  |
| `GET`, `PATCH /v1/platform/tenants/{code}`                     | A brand's details; status `setup → active → suspended`                                   |
| `PUT /v1/platform/tenants/{code}/domains`                      | Its host for each app (`player_web`, `api`, `admin`, `terminal`, `pos`, `agent`)         |
| `POST /v1/platform/tenants/{code}/admins`                      | Invite the brand's first back-office admin                                               |
| `GET /v1/platform/tenants/{code}/config/versions`              | Its configuration history (read; activation stays the brand's)                           |
| `GET /v1/platform/statements?period=`                          | Per brand, the figures the platform charges on (only if proposal 001 Q1 picks B, C or D) |

## Clients affected

- **Web**: back office retail administration (F10g), agent portal (F10a), and the platform console (F11).
- **Flutter app**: none (players never see agents or brands' internals).
- **Terminal/POS**: none directly. A shop's agent decides where its tickets can be paid (`same_agent`).

## Until it lands

- F10g creates no master agents and no shops without an agent (FD6), using the fields the contract has.
  Agents aren't labelled brand or partner.
- F10a shows one agent's own shops; no subtree views.
- F11 (the platform console) waits: it has no operations to call.
