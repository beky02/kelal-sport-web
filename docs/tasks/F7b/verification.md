# F7b — verification

## Tests proven

Each new acceptance test was seen failing against the behaviour it guards, then the code was restored.

- `account-route` › refuses a cross-site PATCH and one without the CSRF header — `assertSameOrigin`'s refusal ignored in `PATCH /api/me`.
- `account-route` › refuses an id that can't be one before it reaches the upstream path — the `API_ID_PATTERN` check skipped.
- `account-route` › sends the consent as the contract names it and answers what the API kept, not what was asked — `updateAccount` answering the asked values over the API's (first written with an answer equal to the request, it stayed green; rewritten so the API keeps consent off).
- `account-route` › GET /api/me/sessions answers 401 without a session and sends nothing — a guest answered `[]`.
- `account-mappers` › keeps what the API left out as null — a missing `ip` mapped to `""`.
