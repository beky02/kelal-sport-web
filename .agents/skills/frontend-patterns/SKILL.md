---
name: frontend-patterns
description: House patterns for the KelalSport web app — calling a contract operation through a route handler, mapping contract data to domain types, query hooks, error handling with Problem codes, i18n, feature flags and tests. Use when writing or reviewing feature code.
user-invocable: false
---

# Frontend patterns

Follow these unless the task's plan records a reason not to. `src/lib/server/catalogue.ts`,
`src/lib/api/mappers/catalogue.ts` and `src/app/api/catalogue/` are the worked example (F0).

## Reading from the API: the six layers

```ts
// 1. src/lib/server/<area>.ts — server only; typed by the generated schema
import "server-only";
export async function loadWallet(tenant: string, session: Session) {
  const api = upstream("Wallet", { tenant, lang: "en" });          // tag decides mock vs real (D7)
  const data = unwrap(await api.GET("/v1/wallet", { headers: auth(session) }));
  return toWallet(data);                                           // 2.
}

// 2. src/lib/api/mappers/<area>.ts — pure: contract shape → domain type. No fetch, no React.
export function toWallet(w: components["schemas"]["Wallet"]): WalletOverview { … }

// 3. src/app/api/<area>/route.ts — thin; respond() maps API errors to Problems unchanged
export function GET(request: Request) {
  return respond(request, ({ tenant }) => loadWallet(tenant, /* session from cookie, F4 */));
}

// 4. src/features/<area>/api/*.ts — browser; validates our own route's output
export const getWallet = (signal?: AbortSignal) =>
  apiClient.get("/wallet", walletSchema, { signal });            // walletSchema satisfies ZodType<WalletOverview>

// 5. src/features/<area>/hooks/*.ts — TanStack Query; key from lib/query/keys.ts with every input
// 6. components — read the hook; never fetch
```

- Names: fetch both languages with `both(...)` when the response carries display names; dictionary
  lookups through `lookup()`; templates through `fillTemplate()`.
- Money and odds: keep the contract's decimal strings in the domain type where anything is computed from
  them; convert to `number` only for display formatting.
- Lists: cursor pagination (`limit`, `cursor`, `next_cursor`) with `useInfiniteQuery`.

## Writing: POSTs that move money or create a bet/booking

- Create the `Idempotency-Key` (`crypto.randomUUID()`) when the player commits (taps Place / Confirm),
  keep it in component state or the mutation variables, and send the **same** key on every retry of that
  intent. A new intent (changed stake, accepted new odds) gets a new key.
- The route handler forwards the key; it never invents one.
- No optimistic update. On success, invalidate the affected queries (`walletKeys.all`, `betKeys.all`).

## Errors

```ts
if (error instanceof ApiError) {
  switch (
    error.code // ErrorCode from the contract
  ) {
    case "BET_ODDS_CHANGED": // 409: errors[].current has the new odds
      return offerNewOdds(error.errors);
    case "BET_STAKE_TOO_HIGH":
      return offerStake(error.errors.find((e) => e.field === "stake")?.limit);
  }
}
```

Every rejection the player can fix offers the fix (a button with the corrected value). Unknown codes show
`error.message` (the Problem's translated `title`) and a retry.

## Testing

- Mapper: `tests/unit/<area>-mappers.test.ts`, fixtures from `example("/v1/…")` in `tests/contract.ts`.
- Errors: Prism returns them with `Prefer: code=409` / `Prefer: example=<name>`; a route-handler test can
  call the loader with a stubbed `fetch` returning the contract's error example.
- Components: `tests/component/*.test.tsx` through `tests/component/render.tsx`; assert visible text and
  exact amounts.
- Screens: add new routes and states to `tests/e2e/screens.spec.ts`; `pnpm ui`, then look at the PNGs.

## Strings, flags, layout

- Every string in `src/lib/i18n/messages/en.json` and `am.json`; `{placeholders}`, never concatenation;
  composed Amharic listed in `TRANSLATION-NOTES.md`.
- Release 2 behaviour behind `features.*` from `src/config/features.ts`; gate at the call site, not
  inside a component that runs hooks.
- Tokens (`bg-surface`, `text-muted`) not hex; check 375 px for sideways scroll; touch targets ≥ 44 px.
