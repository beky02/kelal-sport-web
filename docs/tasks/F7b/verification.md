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
- `Profile` › lists the devices from /api/me/sessions with this one marked — Sign out offered on this device too; this device sorted last.
- `Profile` › offers no sign-out for this device — the `current` check removed.
- `Profile` › signing another device out sends DELETE and removes it once the API answers — the row removed from the cache when the request starts; the list not read again after a 204.
- `Profile` › a device already gone leaves the list without an error — the 404 settling before the list is read again (it first stayed green against a broken 404 guard, because the row had already gone by the assertion; rewritten to hold the re-read and check no alert flashes; the guard it targeted could never show and was removed).
- `Profile` › a failed sign-out says so on that row with Try again — the row's `SaveProblem` given no error.
- `Profile` › a guest sees no devices and nothing is read — the section mounted for a guest.
- `Profile` › drops the devices when another player signs in — `accountKeys.all` left out of `forgetPlayer`.
- `reality-check` (unit) › comes due one interval after the visit starts; after an answer…; follows a changed interval — `nextCheckAt` an interval early.
- `RealityCheck` › opens after the account's interval of play, not a minute before; Keep playing… one interval later — the same.
- `RealityCheck` › follows the account's interval (30 min) — a fixed 60 minutes instead of `flags.realityCheckMinutes`.
- `RealityCheck` › never opens without an interval or for a guest — `null` taken as 60.
- `RealityCheck` › says hours and minutes when it opened late — the check opened over another dialog instead of waiting for it.
- `RealityCheck` › a reload neither restarts the clock nor skips a check that came due — the visit not kept in `sessionStorage`; `begin` restarting a running visit.
- `RealityCheck` › Keep playing…, follows…, Take a break… — `answer` not recording when.
- `RealityCheck` › Take a break and View my limits answer it and open Responsible gaming — those buttons only dismissing.
- `RealityCheck` › follows the account's interval (30 min) — minutes said as hours.
- `RealityCheck` › signing out and in again starts a new visit — the visit not ended for a guest (added after this break first stayed green).
- `ResponsibleGaming` › the session reminder shows the account's interval, and Off without one — the card showing a fixed 60.
