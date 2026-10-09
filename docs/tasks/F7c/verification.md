# F7c — verification (F7ca — promotions)

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
