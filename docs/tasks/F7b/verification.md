# F7b — verification

## Tests proven

Each new acceptance test was seen failing against the behaviour it guards, then the code was restored.

- `account-route` › refuses a cross-site PATCH and one without the CSRF header — `assertSameOrigin`'s refusal ignored in `PATCH /api/me`.
- `account-route` › refuses an id that can't be one before it reaches the upstream path — the `API_ID_PATTERN` check skipped.
- `account-route` › sends the consent as the contract names it and answers what the API kept, not what was asked — `updateAccount` answering the asked values over the API's (first written with an answer equal to the request, it stayed green; rewritten so the API keeps consent off).
- `account-route` › GET /api/me/sessions answers 401 without a session and sends nothing — a guest answered `[]`.
- `account-mappers` › keeps what the API left out as null — a missing `ip` mapped to `""`.
- `Profile` › switching language as a player saves it on the account — `useChangeLanguage` no longer saving.
- `Profile` › a guest's language stays on this device and nothing is sent — the save sent for a guest too.
- `Profile` › says the language isn't saved on the account until it is, and Save sends it — the "Not saved" row removed.
- `Profile` › Offers shows the account's consent, waits for the API and shows its answer — the switch showing the asked value while saving.
- `Profile` › shows the consent the API kept, not the one asked for — `/api/me`'s entry patched with what was asked instead of the API's answer.
- `Profile` › a refused save says so with the API's words and offers Try again; an unanswered save asks to check the connection — `SaveProblem` rendering nothing.
- `AuthDialog` › logging in on another device takes the account's language — `useLogin` not taking it.
- `RegisterFlow` › registering keeps the language just chosen — registration taking `/api/me`'s language too.
