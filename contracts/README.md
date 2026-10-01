# contracts/

The API contract for the sportsbook platform. **Contract first**: this spec is the source of truth. The FastAPI backend implements it; the Next.js apps and the Flutter app generate their types from it.

```
contracts/
├─ openapi.yaml        # GENERATED bundle — what clients, Prism and CI use
├─ src/                # edit these
│  ├─ 01_head_player.yaml         info, conventions, player API
│  ├─ 02_retail_agent_admin.yaml  terminal, cashier POS, agent portal, back office
│  └─ 03_components.yaml          schemas, parameters, responses, shared mock examples
├─ build.py            # bundles src/ → openapi.yaml (inlines shared examples, marks public routes,
│                      #   adds X-Tenant-Id / X-Request-Id everywhere and device-signature headers to terminal/POS routes)
├─ golden/             # slip-calculator golden tests: rules.json, slips.csv, reference + TypeScript calculators
└─ redocly.yaml        # lint rules
```

Put this folder at the root of the platform monorepo (`platform/contracts/`).

## Everyday commands

```bash
python3 build.py                                         # after editing src/
npx @redocly/cli lint openapi.yaml                       # must say "valid"
npx @stoplight/prism-cli mock openapi.yaml -p 4010       # mock API on http://localhost:4010
npx @redocly/cli preview-docs openapi.yaml               # browsable docs
```

## Using the mock from the frontend

Point the Next.js apps at the mock:

```bash
# client/web/apps/player/.env.local
API_BASE_URL=http://localhost:4010
```

Prism returns the example data in the spec. The fixtures are consistent across endpoints: the same three matches (Saint George v Fasil Kenema, Arsenal v Chelsea, Real Madrid v Barcelona), outcome IDs such as `oc_ac_1`, booking code `7KQ2M9X`, slip code `48291735` and retail ticket `R7K2-M9XP-K` (barcode `R7K2M9XPK.3F9A0C21B7`).

Useful headers while building screens:

| Header | Effect |
|---|---|
| `Prefer: code=409` | Return the 409 response (e.g. odds changed on `POST /v1/bets`) |
| `Prefer: example=odds_changed` | Pick a named example (see each response's `examples`) |
| `Prefer: example=approval_pending` | e.g. big-win payout waiting for head office on the POS |
| `Prefer: dynamic=true` | Random data generated from the schemas (for stress-testing layouts) |

Prism also validates requests: a wrong body, a missing `Idempotency-Key` or a missing `Authorization` header returns 400/401 with the reason, so you find contract mistakes before the backend exists. Prism is stateless: placing a bet does not change `GET /v1/bets`. Use MSW handlers in the web app if a screen needs stateful behaviour.

## Generating clients

```bash
# TypeScript types for client/web/packages/api
npx openapi-typescript contracts/openapi.yaml -o client/web/packages/api/src/schema.d.ts
# then use openapi-fetch:  const api = createClient<paths>({ baseUrl })

# Dart client for the Flutter app
npx @openapitools/openapi-generator-cli generate -i contracts/openapi.yaml -g dart-dio -o client/mobile/packages/api
```

## Backend conformance (CI)

1. FastAPI exports its schema: `python -m app.export_openapi > build/backend-openapi.json`.
2. `npx oasdiff breaking contracts/openapi.yaml build/backend-openapi.json` must report nothing.
3. Schemathesis runs property-based tests of the running backend against this spec: `schemathesis run contracts/openapi.yaml --base-url http://localhost:8000`.

## Rules for changing the contract

- Add fields and endpoints freely; never remove or rename within `/v1` (TD-01).
- Money and odds are decimal strings; IDs are opaque strings; times are UTC ISO 8601.
- Every error uses `Problem` with a `code` from `ErrorCode`. Add new codes there first.
- Every money-moving or bet/ticket-creating POST requires `Idempotency-Key`.
- Keep the shared examples in `03_components.yaml` consistent (same fixtures, same numbers). The example numbers follow the placeholder tax rules in `/v1/config/public` (15% stake tax, 15% win tax over 1,000 ETB).

## Local development defaults (Engineering Decisions D3)

- Tenant: the Next.js server always sends `X-Tenant-Id: demo` (from `TENANT_HOST_MAP`); the API also accepts `DEV_DEFAULT_TENANT=demo` when `ENV=local`.
- The browser never calls the API directly (it calls Next.js route handlers), so the API needs no CORS. Prism enables CORS anyway.
- Public catalogue routes accept an optional player or terminal token (`security: [{}, playerAuth, terminalAuth]`); with a terminal token the retail rule set and margins apply.
- Terminal and POS routes require `X-Device-Id`, `X-Device-Timestamp` and `X-Device-Signature`; Prism only checks that they are present.
