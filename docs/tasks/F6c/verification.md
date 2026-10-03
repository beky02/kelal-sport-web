# F6c — verification

## Tests proven

Each new acceptance test was seen failing against the behaviour it guards, then restored.

- `withdrawals-mappers` "sends a saved account by its id and a new number as account, never both" —
  `toWithdrawalRequest` sending a saved account as `account` and a new number by id.
- `withdrawals-mappers` "leaves out an account on a method the contract added after this build" — the
  provider filter dropped.
- `withdrawals-mappers` "keeps the API's rejection reason as sent, and leaves what it didn't send empty"
  — `rejectionReason` always null.
