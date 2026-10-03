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
- `withdrawal` "tells no answer from a final answer (AC-8)" — a 502 `PAY_PROVIDER_ERROR` treated as
  final (the deposit rule).
- `withdrawal` "names a review reason it knows, and never shows one it doesn't (AC-1)" — any reason
  passed through as a key.
- `withdrawal` "offers only an amount the method takes and the balance covers (AC-9)" — the cash
  ceiling dropped from `nearestAllowedAmount`.
- `withdrawal` "tells a cancel's answers apart…" — every 409 read as too late, whatever its code.
- `withdrawal` "knows which statuses are final and which can still be cancelled" — `approved` made
  cancellable.
- `WithdrawalPolling` "reads a withdrawal every 10 s until it is paid, and reads the balance again only
  when its status changes (AC-4)" — no re-read on a status change; and a re-read on every read.
- `WithdrawalPolling` "reads one in review once a minute, not every 10 s" — review on the 10 s beat.
- `WithdrawalPolling` "stops reading a withdrawal the API says isn't this player's" — a 404 that keeps
  polling.
- `WithdrawalPolling` "reads nothing while the tab is hidden…" — `refetchIntervalInBackground: true`.
