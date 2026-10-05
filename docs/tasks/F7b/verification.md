# F7b — verification

## Review brief

- **Account preferences (AC-8)**: `PATCH /api/me` → `PATCH /v1/me` (`src/app/api/me/route.ts`, `lib/server/account.ts`, `lib/api/mappers/account.ts`); `features/profile/hooks/use-account.ts` (`useUpdateAccount`, `useChangeLanguage`); `ProfileView.tsx` (language row with "Not saved to your account" + Save; Offers = `marketing_consent`, not optimistic); header and age-gate switches save too; `useLogin` takes the account's language (`use-session.ts`), registration doesn't.
- **Devices (AC-9)**: `GET /api/me/sessions`, `DELETE /api/me/sessions/[id]` (CSRF, `API_ID_PATTERN`); `DevicesSection.tsx`; `accountKeys` dropped by `forgetPlayer`.
- **Reality check (AC-10)**: `RealityCheckWatcher` + `useRealityCheck` (`features/system/hooks/use-reality-check.ts`), clock in `features/system/lib/reality-check.ts`, visit in `stores/reality-check.store.ts` (sessionStorage); `SystemOverlays`/`SystemDialog` show time played only; the mock activity and its endpoint deleted; the RG session-reminder card read-only.
- **Risk**: three new route handlers; language adoption at login changes what e2e/screens see (Prism's player is `am`); the reality check's clock is the browser's until contract request 012.
- **User's decisions (plan gate)**: Q1 build the reality check now, clock = this visit, time only, figures in F7e after 012; Q2 the account's language at login, then every switch saved on it.
- **Deliberately not done**: staked/won/net (no contract field → request 012, task F7e); choosing the interval (no `MePatch` field); language in the URL (F2a); the other notification switches.

## Automated gate

| Check                                       | Command                                  | Result                                                |
| ------------------------------------------- | ---------------------------------------- | ----------------------------------------------------- |
| Typecheck, lint, Prettier, unit + component | `pnpm check`                             | PASS — 69 files, 1443 tests                           |
| Generated types                             | `pnpm api:check`                         | PASS                                                  |
| Contract drift                              | `node scripts/contract-sync.mjs --check` | PASS — contracts/ and docs/backend/ match the backend |
| Build                                       | `pnpm build`                             | PASS                                                  |
| Screens and e2e                             | `pnpm ui`                                | PASS — 570 passed, none on retry                      |

Final `pnpm verify`: `Tests 1443 passed (1443)` · `contracts/ matches the backend.` · `✓ Compiled successfully` · `570 passed (4.1m)`.

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
- `auth.spec` (e2e) › logging in on another device takes the language saved on the account — `useLogin` not taking it (first written without waiting for the login, it failed for the wrong reason; rewritten to wait on `<html lang>`).

## Self-review

- **Money moves:** nothing here moves money or places a bet. The only writes are `PATCH /v1/me` (language,
  consent) and `DELETE /v1/me/sessions/{id}`. The mock money figures (ETB 350/120/−230, a float `Math.abs`)
  are gone, and no figure is shown until the API gives one (F7e).
- **New values:** `flags.realityCheckMinutes` is read in two places, the watcher (`use-reality-check.ts:25`)
  and the RG card (`ResponsibleGamingView.tsx:42`), both the account's. `marketingConsent` is shown only on
  the Offers switch, from `/api/me`. A device shows `lastUsedAt`, never `createdAt` (request 012, item 5).
  The language row compares `player.language` with the page's `lang`, not a neighbour.
- **Async tests:** the Profile tests wait for the data they assert on (`findBy…`, `waitFor` on the
  requests), and the held answers (`patchAnswers`, `revokeAnswers`, `listAnswers`) assert the in-between
  state before releasing them. The reality-check tests run on fake timers with explicit ticks, including
  the tick TanStack Query uses to notify (a test artifact, explained in the test).
- **Personal data:** devices (IPs) sit under `accountKeys.all`, dropped by `forgetPlayer`, with a
  behavioural player-switch test (`Profile` › drops the devices when another player signs in). The
  reality-check store keeps only the player's id and times in `sessionStorage`. Signing out clears it, and
  another player replaces it (tests).
- **Route handlers:** each of `PATCH /api/me`, `GET /api/me/sessions` and `DELETE /api/me/sessions/{id}`
  checks the session (401 tests), validates input before the upstream URL or body (strict body schema; the
  id against `API_ID_PATTERN`), refuses cross-site requests and requests without the CSRF header, answers
  `no-store`, and sends `Prefer` only under `next dev` and never to the real API. Each has a test in
  `account-route.test.ts`.
- **Screens:** `profile`, `profile-language-unsaved`, `profile-devices-failed`, `profile-guest`,
  `reality-check` and `responsible-gaming` were looked at in en/am × phone/desktop. The devices' loading
  skeleton has no screenshot, as no earlier screen has one: the harness waits for the network to go quiet.
  Its rows were seen in the component render.
- **Docs:** plan Files and AC→tests updated under "Changes during implementation"; design pages 01, 02, 03,
  05, 07; translation notes; contract request 012 and its index; the F7e task and README rows.
