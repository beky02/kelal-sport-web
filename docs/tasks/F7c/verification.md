# F7c — verification (F7ca — promotions)

## Review brief

- **What:** a new `/promotions` page (no screen existed): offers from `/v1/promotions` for anyone; for a player,
  the bonus with the API's wagering figures and expiry, free bets with their conditions (`/v1/me/bonuses`),
  and a promo-code form (`POST /v1/promo-codes/redeem`). F7c was split; the inbox is F7cb.
- **Server:** `src/lib/server/promotions.ts`, `src/lib/api/mappers/promotions.ts`, `src/lib/api/promotion-schemas.ts`,
  routes `src/app/api/{promotions,me/bonuses,promo-codes/redeem}/route.ts`.
- **Browser:** `src/features/promotions/*` — the key-per-intent store (`stores/promo.store.ts`), outcome and notice
  rules (`lib/redeem.ts`), hooks, four components; entry points in `MainNav`, `ProfileView`, `MobileTabBar`
  behind the tenant's new `features.bonuses`; `forgetPlayer` drops `bonusKeys`; `moneyArrived` marks it stale.
- **Risk:** the redeem's `Idempotency-Key` rule (decision 10: same key only after no answer, same code, same
  player; memory only), refusals by `code` (decision 11), the https-only image and plain-text terms
  (decisions 5–6), the one `no-img-element` lint exception.
- **User's decisions (plan gate):** the split; the fallback lines when the API sends no `message` (decision 12).
- **Not done:** the inbox (F7cb); using a free bet or bonus money on the slip; forfeiting; Markdown terms (F7d).

## Automated gate

| Check                                           | Command                                  | Result                                                                                    |
| ----------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Typecheck, lint, format, unit + component tests | `pnpm check`                             | PASS — 86 files, 1,754 tests; lint 0 errors (2 warnings, both on `main` before this task) |
| Generated types                                 | `pnpm api:check`                         | PASS                                                                                      |
| Contract drift                                  | `node scripts/contract-sync.mjs --check` | PASS — `contracts/` and `docs/backend/` match the backend                                 |
| Build                                           | `pnpm build`                             | PASS — `/promotions` and the three routes compiled                                        |
| Host split                                      | `node scripts/check-host-split.mjs`      | PASS                                                                                      |
| UI screens and e2e                              | `pnpm ui`                                | PASS — 713 passed, **3 flaky** (see Gaps)                                                 |

Final `pnpm verify` (2026-10-09): exit 0 — `713 passed (9.4m)`, `3 flaky`.

## Acceptance criteria

| AC    | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-11 | PASS   | `promotions-mappers` (contract examples: offers, active bonus, free bets, https-only image), `promotions-route` (offers public in the UI's language; bonuses with the session, 401 without), `Promotions` component tests (offers, wagered line "ETB 850.00 of ETB 2,500.00 wagered", expiry "17 Oct 2026, 12:00", free bet conditions, empty, failures, guest, player switch, entry points) — all green; screens `promotions`, `promotions-guest`, `promotions-none`, `promotions-bonus-failed`, `promotions-offers-failed` × en/am × 375/1440, looked at                                 |
| AC-12 | PASS   | `promotions-route` (key and code forwarded; refusals before upstream; PROMO_* passed through by code), `promotions-redeem` (outcome rule, notice per code, key-per-intent store), `Promotions` (same key on Try again and on Redeem after no answer; new key for another code or after an answer; PROMO_INVALID keeps the code to edit; PROMO_ALREADY_USED; granted re-reads bonus and wallet; pending_deposit offers Deposit) — all green; screens `promotions-redeemed`, `promotions-redeemed-pending`, `promotions-code-invalid`, `promotions-code-used`, `promotions-code-unconfirmed` |

## Self-review

- **Money moves:** a redeem re-reads `bonusKeys`, `walletKeys` and `transactionKeys` once the API has
  answered; nothing is patched. Found and fixed here: a completed deposit (which can grant a bonus or apply a
  code that waited for it, C11 §5) did not mark the bonus stale — `moneyArrived` now invalidates `bonusKeys`
  too. `DepositPolling` › "… and marks the bonus stale" failed before the fix (`expected false to be true`)
  and passes after it.
- **New values:** `wageringDone`/`wageringRequired` are shown only in `MyBonusSection`'s wagered line (in that
  order, tested), `amount` only beside the title, a free bet's `stake` only in its own row; the bar uses
  `percentOf(done, required)`.
- **Async tests:** each component test waits for the data it asserts on (`findByText` on the loaded figure or
  message, `waitFor` on the request count); the entry-point tests read config the render helper seeds.
- **Personal data:** `bonusKeys` is in `forgetPlayer` (test: another player signs in → the bonus is read
  again); the promo intent carries its owner and a Try again asks `/api/me` first (test). Offers are public.
- **Route handlers:** session on `/api/me/bonuses` and the redeem; CSRF, UUID key, strict 4 KiB body on the
  redeem; `no-store` on all three; `Prefer` only under `next dev` and never to the real API — each tested
  (`promotions-route`).
- **Screens:** ten `promotions-*` screens, en/am × 375/1440, looked at; two fixes made from them (offer cards
  stretched to their neighbour's height; the bonus's Try again blended into its box). Loading is skeletons,
  covered by component tests, not screenshotted — as for the other account pages.
- **Docs:** plan Files and AC→tests names match the code; 00-overview, 01-screens, 02-journeys, 05-errors,
  09-security and the translation notes updated; README and task statuses current.

## Tests proven

Each new acceptance test, once green, was run against a deliberately broken implementation and failed;
the code was then restored.

| Test                                                                                                                                               | What was broken                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `promotions-route` › forwards the browser's Idempotency-Key and the code to POST /v1/promo-codes/redeem                                            | The loader sent a fresh `crypto.randomUUID()` instead of the browser's                  |
| `promotions-route` › reads the offers in the UI's language without the player's session                                                            | The offers read carried an `Authorization` header                                       |
| `promotions-route` › answers 401 without a session and sends nothing (bonuses)                                                                     | The route read the bonuses with a made-up session instead of refusing                   |
| `promotions-route` › refuses a redeem without a key, from another site, without the CSRF header, or with a body other than a code, sending nothing | `assertSameOrigin` skipped; separately, the body schema's `.strict()` dropped           |
| `promotions-mappers` › keeps an offer's image only when it is https                                                                                | Any URL but `javascript:` kept                                                          |
| `promotions-mappers` › maps the active bonus's wagering required and done and its expiry as the API's strings                                      | `wageringDone` mapped from `wagering_required`                                          |
| `config-mappers` › carries the tenant's bonuses switch, on unless the config says false (F7ca)                                                     | Written before `features.bonuses` existed: failed, then passed                          |
| `promotions-redeem` › treats no answer as unanswered, a 401 as the session's, and every code as a refusal                                          | A 429 classed as a refusal                                                              |
| `promotions-redeem` › names the field's problem the API sent on VALIDATION_FAILED                                                                  | The first `errors[]` entry's message used, whatever its field                           |
| `promotions-redeem` › ignores an answer for a key that is no longer the open one                                                                   | `unanswered(key)` applied to whichever intent is open                                   |
| `Promotions` › sends the same Idempotency-Key when a code with no answer is tried again                                                            | Every try made a new key                                                                |
| `Promotions` › makes a new key for another code, and for the same code once it was answered                                                        | An unanswered intent reused for any code                                                |
| `Promotions` › says the code isn't valid on PROMO_INVALID and keeps it to edit                                                                     | `PROMO_INVALID`'s fix dropped (no focus, no `aria-invalid`)                             |
| `Promotions` › says the code was already used on PROMO_ALREADY_USED                                                                                | `PROMO_ALREADY_USED` fell through to the generic refusal                                |
| `Promotions` › shows the API's message on a granted code and reads the bonus and the wallet again                                                  | The wallet and history invalidations removed                                            |
| `Promotions` › says the code was accepted when the API sends no message, and offers Deposit when it waits for a deposit                            | The Deposit link never shown                                                            |
| `Promotions` › sends nothing while a code is on its way, and nothing empty                                                                         | Both one-at-a-time guards (store and form) removed; separately, the code sent untrimmed |
| `Promotions` › offers Verify when the API asks for an ID first                                                                                     | `KYC_REQUIRED`'s fix dropped                                                            |
| `Promotions` › keeps a code with no answer for Try again when the player comes back                                                                | The field started empty                                                                 |
| `Promotions` › sends nothing on Try again when someone else is signed in now                                                                       | The `/api/me` owner check before a repeat removed                                       |
| `Promotions` › shows the active bonus's wagered and required amounts and its expiry exactly as the API sends them                                  | Done and required swapped                                                               |
| `Promotions` › lists each free bet with its stake, conditions and expiry                                                                           | The per-pick odds condition hidden                                                      |
| `Promotions` › says there is no active bonus and no free bets when the API has none                                                                | "No active bonus" removed                                                               |
| `Promotions` › offers Try again when the bonus can't be read, and still shows the offers                                                           | Try again read nothing                                                                  |
| `Promotions` › offers Try again when the offers can't be read, and says when there are none                                                        | Try again read nothing                                                                  |
| `Promotions` › asks a guest to log in and still shows the offers                                                                                   | The guest prompt never shown                                                            |
| `Promotions` › shows neither a guest's prompt nor a bonus until /api/me has answered                                                               | Guest decided without waiting for `/api/me`                                             |
| `Promotions` › shows an offer's image, but not with data saver on                                                                                  | Data saver ignored                                                                      |
| `Promotions` › moves to the code field from an offer that needs a code                                                                             | Enter code did nothing                                                                  |
| `Promotions` › shows each offer's title, summary and dates from /api/promotions                                                                    | A start date shown as "Until"                                                           |
| `Promotions` › drops the player's bonus when another player signs in                                                                               | `bonusKeys.all` left out of `forgetPlayer`                                              |
| `Promotions` › is in the desktop nav and the phone's Menu while the tenant offers bonuses                                                          | The Menu row removed                                                                    |
| `Promotions` › is in neither when the tenant has no bonuses                                                                                        | The nav link shown whatever `features.bonuses` says                                     |
| `Promotions` › lights the phone's Menu tab                                                                                                         | `/promotions` left out of `tabFor`                                                      |

## Gaps

- **Flaky (not this task's):** three terminal kiosk tests, en · phone, failed once in the full run and passed on
  retry — `kiosk-code-paused`, `kiosk-code-refused`, `kiosk-league`. First error, each:
  `expect(getByRole('heading', { name: /^Football/, level: 2 })).toBeVisible()` — element not found within
  5,000 ms. They ran back to back at the run's slowest point (neighbours took 24–31 s). Run alone with
  `--retries=0`, all 12 variants pass; no terminal code reads anything this task changed. Risk: none to
  F7ca; the kiosk board's 5 s wait is tight under load.
- **Prism has no `PROMO_*` example:** the refusals are proven by route and component tests and shown by screens
  that answer the route with the Problem; the real API's status for them (404/409/422) is unknown, which is why
  the UI switches on `code` only.
- **Loading state** is skeletons, covered by component tests, not screenshotted (as for the other account pages).
