# F6c — verification

## Tests proven

Each new acceptance test was seen failing against the behaviour it guards, then restored.

- `withdrawals-mappers` "sends a saved account by its id and a new number as account, never both" —
  `toWithdrawalRequest` sending a saved account as `account` and a new number by id.
- `withdrawals-mappers` "leaves out an account on a method the contract added after this build" — the
  provider filter dropped.
- `withdrawals-mappers` "keeps the API's rejection reason as sent, and leaves what it didn't send empty"
  — `rejectionReason` always null.
- `withdrawals-route` "requests the withdrawal with the player's token and the browser's key (AC-8)",
  "forwards the browser's Idempotency-Key unchanged…", "sends the withdrawal again with the same key
  after refreshing…" — the route handler sending a fresh UUID instead of the browser's key.
- `withdrawals-route` "refuses a cancel from another site or without the CSRF header, but needs no JSON
  body" — `assertSameOrigin` dropped from `DELETE /api/withdrawals/[id]`; and, the other way, the
  DELETE demanding a JSON body (`{ json: false }` dropped: ten tests fail with 415).
- `withdrawals-route` "refuses an account that is not a mobile number…" and "refuses a body that is not
  a withdrawal…" — the `Phone` check removed from the schemas.
- `withdrawals-route` "answers 404 and sends nothing for a withdrawal id that can't be one" — the id
  check removed from the cancel.
