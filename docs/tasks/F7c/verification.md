# F7c — verification (F7ca — promotions)

## Tests proven

Each new acceptance test, once green, was run against a deliberately broken implementation and failed;
the code was then restored.

| Test                                                                                                                                               | What was broken                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `promotions-route` › forwards the browser's Idempotency-Key and the code to POST /v1/promo-codes/redeem                                            | The loader sent a fresh `crypto.randomUUID()` instead of the browser's        |
| `promotions-route` › reads the offers in the UI's language without the player's session                                                            | The offers read carried an `Authorization` header                             |
| `promotions-route` › answers 401 without a session and sends nothing (bonuses)                                                                     | The route read the bonuses with a made-up session instead of refusing         |
| `promotions-route` › refuses a redeem without a key, from another site, without the CSRF header, or with a body other than a code, sending nothing | `assertSameOrigin` skipped; separately, the body schema's `.strict()` dropped |
| `promotions-mappers` › keeps an offer's image only when it is https                                                                                | Any URL but `javascript:` kept                                                |
| `promotions-mappers` › maps the active bonus's wagering required and done and its expiry as the API's strings                                      | `wageringDone` mapped from `wagering_required`                                |
| `config-mappers` › carries the tenant's bonuses switch, on unless the config says false (F7ca)                                                     | Written before `features.bonuses` existed: failed, then passed                |
