# F7b — plan

Plan gate: approved 2026-10-05 (mode: interactive) — question 1: the reality check built now with the
clock counted from this visit, time played only, figures in F7e after contract request 012; question 2:
the account's language at login, then every switch saved on it.

The contract was synced on main first (`033406e`, additive: 503 on `POST /v1/auth/refresh` and
`PATCH /v1/me`), with the user's agreement.

## Understanding

A signed-in player's language and marketing consent become the account's, not this browser's: changing
either sends `PATCH /v1/me`, and what the API answers is what the screens show, on this device after a
reload and on another one after signing in. Profile gains the devices signed in to the account from
`GET /v1/me/sessions`, this one marked, with Sign out on each of the others (`DELETE /v1/me/sessions/{id}`).
The reality check stops being a mock nobody opens: it opens over any page every
`Me.flags.reality_check_minutes` of play, and shows only what the API gives — the made-up figures
(ETB 350 staked, 120 won) and `/me/session-activity`, an endpoint the contract doesn't have, go. The
contract has no session totals, so contract request 012 is written for them (the task's own rule).

## Spec conflicts and decisions

| #   | Question                                                                                                                                                                                                                                                                                                 | Decision and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The task file, 02-journeys and 05-errors want "the session's staked, won and net figures from the API". No operation in the contract returns them (`/v1/me/sessions` has times, platform and IP; nothing else is per play session).                                                                      | **Question 1.** The task's rule: "a `/contract-request` comes first — never a computation". Contract request **012** asks for them. Recommended: the reality check is built now with what the contract has (the interval and time played) and **no money figures**; the figures follow in a new task, **F7e**, once 012 is in the contract. The alternative holds AC-10 back whole until 012.                                                                                                                                                                                                       |
| 2   | "Time played": when does a play session start? 02-journeys says from `/v1/me/sessions`, but a session there is a device sign-in that lasts up to 30 days (C01 §9), so "you've been playing for 9 days" is possible. C12 §7 times it server-side from `player.login`. Nothing defines it for the browser. | **Question 1** (same answer). Recommended: **this visit** — the moment this tab first showed the signed-in player, kept in `sessionStorage` so a reload neither restarts the clock nor skips a check that came due; a new sign-in or another player restarts it. 012 asks the API to own the play session (`started_at`), and F7e switches to it. Alternative: the current session's `created_at` (login on this device).                                                                                                                                                                           |
| 3   | Where the interval comes from. The task file and 07-tenancy name `/v1/config/public` `rg.reality_check_minutes`; C16 §4 has `rg` in the tenant's config; the contract's `PublicConfig` has **no** `rg`. `Me.flags.reality_check_minutes` (integer or null) exists.                                       | Contract wins: **`Me.flags.reality_check_minutes`**, read with who is signed in (`/api/me`), taken as the account's effective interval (the player's or the tenant's). **Null → no reality check**: the browser invents no interval. 012 asks the backend to confirm both. 07-tenancy's row is corrected.                                                                                                                                                                                                                                                                                           |
| 4   | The responsible-gaming page's "Session reminder" card (F7a left it for F7b): an on/off switch and a 30/60/90/120 picker in local state. `MePatch` has only `language` and `marketing_consent`, so neither can be saved.                                                                                  | The card **shows the account's interval, read-only**: "Every {n} min" from `Me.flags`, or "Off" when null — no switch, no picker (a control that saves nowhere tells the player something untrue). Its note drops "and money spent" (nothing shows money until F7e). 012 asks for a way to set it (`MePatch.reality_check_minutes`, within the tenant's bounds).                                                                                                                                                                                                                                    |
| 5   | Which language wins when the device and the account differ.                                                                                                                                                                                                                                              | **Question 2.** Recommended: **the account's at sign-in, then every change is saved on it.** A login (not a registration — the player just chose) sets the UI to `player.language` from the `/api/me` read that ends it; after that, switching language anywhere (header, profile, the age gate) while signed in sends `PATCH /v1/me { language }`. A guest's switch stays on the device. That is what "survives another device" can mean without a URL rule (F2a is not done). Alternative: the device always wins and the account only records the latest choice (other devices never follow it). |
| 6   | FD2: "the stored preference follows the URL". The URL segment is F2a's (todo).                                                                                                                                                                                                                           | Out of scope here: F7b keeps the account and the stored preference in step; when F2a lands, the header switch navigates and this save rides along. Noted in 03-session.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 7   | Which switch is "marketing consent". Profile's Notifications has five local switches; "Offers — Off by default. Never sent during a break." is marketing.                                                                                                                                                | **Offers becomes the account's `marketing_consent`** (shown from `/api/me`, saved through `PATCH`). The other four stay local, as they are, until there is a notifications endpoint (C14; not in the contract).                                                                                                                                                                                                                                                                                                                                                                                     |
| 8   | Optimistic or not. AGENTS.md allows optimism for selections and panels; consent is a legal record and the language is the account's.                                                                                                                                                                     | **Not optimistic for the account**: the Offers switch shows the API's value, waits (disabled, `aria-busy`) while saving, and takes the `PATCH` answer (`Me`) into the `/api/me` cache — the server's answer, not a guess. The display language changes at once (a UI preference); whether it reached the account is shown on the profile row: "Saving…" while a save is in flight, and "Not saved to your account" with **Save** whenever the account's language differs from the one in use (a failed save, from the header or here).                                                              |
| 9   | Revoking a device: the contract allows any id, this one included.                                                                                                                                                                                                                                        | Sign out is offered on **other** devices only; this one has Log out (F4a). Nothing is removed until the API answers 204, then the list is read again. A 404 means it is already gone: the list is read again, no error. A 401 is the session-ended path (`/api/me` read again). Other refusals: an inline notice on that row with Try again.                                                                                                                                                                                                                                                        |
| 10  | What a device row shows. `Session`: `platform`, optional `user_agent` and truncated `ip`, `created_at`, `last_used_at`, `current`.                                                                                                                                                                       | The API's `user_agent` as the name ("Chrome 129 on Windows"), else the platform ("Android", "iPhone", "Web" — translated); "This device" for `current`; "Last active {date, time}" (06-language: Gregorian, EAT, the player's clock/calendar preference) and the IP as the API sent it. Current first, then by `last_used_at`, newest first — order only, no arithmetic.                                                                                                                                                                                                                            |
| 11  | `SystemDialog`'s `stats` (three numbers, the last tinted as a loss, `Math.abs` on a float).                                                                                                                                                                                                              | Removed with the mock. F7e adds the API's figures back as strings (FD4), with the sign the API gives.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 12  | Size.                                                                                                                                                                                                                                                                                                    | One PR (~1,300 lines with tests, two areas that share `/api/me`); no split beyond F7e.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Design

**Contract operations** (tag `Me`): `PATCH /v1/me` (`MePatch` → `Me`), `GET /v1/me/sessions`
(`{ items: Session[] }`), `DELETE /v1/me/sessions/{id}` (204). Errors: 400, 401, 404, 422, 503 on
`PATCH`; 400, 401, 404 on the others.

**Server** — `src/lib/server/account.ts` (new, `server-only`), each through `withSession` (refresh on a
lapsed token, as F4a): `updateAccount(ctx, session, patch): Player` (`toMePatch` → `PATCH /v1/me` →
`toPlayer`), `loadDeviceSessions(ctx, session): DeviceSession[]`, `revokeDeviceSession(ctx, session, id)`.

**Mappers** — `src/lib/api/mappers/account.ts` (new, pure): `toMePatch(AccountChange): MePatch` (only the
fields sent), `toDeviceSessions(items)` / `toDeviceSession(Session)` (absent → `null`, never guessed).

**Route handlers**

- `src/app/api/me/route.ts` gains `PATCH`: `assertSameOrigin` → `readForm(accountChangeSchema)` (strict:
  `language` ∈ `am|en` and/or `marketingConsent` boolean, at least one, nothing else) → session or 401 →
  `{ player }` (the `/api/me` shape, so the browser puts it straight into that cache).
- `src/app/api/me/sessions/route.ts` (new): `GET` → `DeviceSession[]`; session or 401.
- `src/app/api/me/sessions/[id]/route.ts` (new): `DELETE`: `assertSameOrigin({ json: false })`,
  `API_ID_PATTERN` before the id reaches the upstream path (404 otherwise), session or 401 → 204.
- All `no-store` (`respond`), `Prefer` only through `mockPreference` (dev only).

**Domain types** — `src/features/profile/types.ts` (new): `DeviceSession { id, platform: "android" | "ios"
| "web", userAgent: string | null, ip: string | null, createdAt, lastUsedAt, current }`; `AccountChange
{ language?: Lang; marketingConsent?: boolean }`. Zod in `lib/api/schemas.ts`: `deviceSessionsSchema`,
`accountChangeSchema` (route input), each `satisfies z.ZodType<…>`; `sessionActivitySchema` goes.

**Browser API** — `src/features/profile/api/account.ts` (new): `updateAccount(change)` (`apiClient.patch`,
added to `lib/api/client.ts`), `getDeviceSessions(signal)`, `revokeDeviceSession(id)`.

**Query keys** — `accountKeys = { all: ["account"], sessions(), update() }` (`update` is the mutation key).
`accountKeys.all` joins `forgetPlayer`, so a player switch drops the devices list.

**Hooks**

- `src/features/profile/hooks/use-account.ts` (new): `useUpdateAccount()` (mutation key
  `accountKeys.update()`; success → `setQueryData(sessionKeys.me(), view)`; 401 → `/api/me` read again);
  `useChangeLanguage()` → `(lang) => { setLang(lang); if signed in and the account's differs → save }`;
  `useDeviceSessions(enabled)`; `useRevokeDeviceSession()` (success or 404 → invalidate
  `accountKeys.sessions()`; 401 → `/api/me`).
- `src/features/auth/hooks/use-session.ts`: `useLogin` success, after `signedIn`, sets the UI language to
  the account's (decision 5). Registration doesn't.
- `src/features/system/hooks/use-reality-check.ts` (new) + `src/stores/reality-check.store.ts` (new,
  `persist` to `sessionStorage`: `{ playerId, startedAt, acknowledged }`) + `src/features/system/lib/
reality-check.ts` (new, pure: `checksDue`, `nextCheckAt`, `playedMinutes`). `RealityCheckWatcher`
  (mounted in `SportsbookShell` beside `SessionWatcher`): for a player with a positive
  `realityCheckMinutes`, begins the visit for that player id, sets one timeout to the next check, and opens
  `overlay: "reality"` when it is due (on mount too, when one came due across a reload) — waiting while
  another overlay is up. Every action in the dialog acknowledges the checks due so far, so the next one is
  one interval later.

**Components**

- `ProfileView`: language through `useChangeLanguage` plus the row's save state; Offers → the account's
  consent (decision 8); a new **Devices** section (`DevicesSection.tsx`, new) for a player: loading rows,
  the list, "Couldn't load your devices" + Try again, per-row Sign out with its own pending and error.
- `AppHeader`, `FullScreenNotice` (age gate): `useChangeLanguage` instead of `setLang`.
- `SystemOverlays`: the reality dialog reads `useRealityCheck()` for time played and its acknowledge; body
  "You've been playing for {duration}." (hours and minutes); no figures. Keep playing → acknowledge; Take a
  break and View my limits → acknowledge and open Responsible gaming (F7a).
- `SystemDialog`: `stats` removed (decision 11).
- `ResponsibleGamingView`: the session-reminder card read-only (decision 4).

**Errors** (by `code`/status, never `title`): `VALIDATION_FAILED` 422 on `PATCH` → "Couldn't save" with the
API's title and Try again; 401 → session-ended path; 404 on revoke → treated as gone; 503 / network →
Try again. Unknown codes: the API's title and Try again.

**i18n** (en + am, composed Amharic in TRANSLATION-NOTES): `profile.languageSaving`,
`profile.languageNotSaved`, `profile.languageSave`, `profile.offersFailed`, `profile.devices`,
`profile.thisDevice`, `profile.lastActive` ("Last active {time}"), `profile.platformAndroid`/`Ios`/`Web`,
`profile.signOutDevice`, `profile.signOutDeviceAria` ("Sign out {device}"), `profile.devicesFailed`,
`profile.signOutFailed`, `profile.tryAgain`; `system.realityPlayedMinutes` / `realityPlayedHours` /
`realityPlayedHoursMinutes`; `rg.sessionReminderEvery`, `rg.sessionReminderOff`, changed
`rg.sessionReminderBody`. Removed: `system.realityBody`, `realityStaked`, `realityWon`, `realityNet`.

**Feature flags** — none (Release 1).

## Files

| File                                                                                                                                            | Why                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/lib/server/account.ts` (new)                                                                                                               | `PATCH /v1/me`, sessions list and revoke for the signed-in player                            |
| `src/lib/api/mappers/account.ts` (new)                                                                                                          | `toMePatch`, `toDeviceSessions`                                                              |
| `src/app/api/me/route.ts`                                                                                                                       | `PATCH`                                                                                      |
| `src/app/api/me/sessions/route.ts`, `src/app/api/me/sessions/[id]/route.ts` (new)                                                               | Devices list; sign one out                                                                   |
| `src/features/profile/types.ts` (new)                                                                                                           | `DeviceSession`, `AccountChange`                                                             |
| `src/lib/api/schemas.ts`                                                                                                                        | `deviceSessionsSchema`, `accountChangeSchema`; `sessionActivitySchema` removed               |
| `src/lib/api/client.ts`                                                                                                                         | `apiClient.patch`                                                                            |
| `src/lib/query/keys.ts`                                                                                                                         | `accountKeys`                                                                                |
| `src/features/auth/hooks/use-session.ts`                                                                                                        | `forgetPlayer` drops `accountKeys.all`; login takes the account's language                   |
| `src/features/profile/api/account.ts`, `src/features/profile/hooks/use-account.ts` (new)                                                        | Browser calls and hooks                                                                      |
| `src/features/profile/components/ProfileView.tsx`, `DevicesSection.tsx` (new)                                                                   | Language and Offers on the account; devices                                                  |
| `src/components/layout/AppHeader.tsx`, `src/features/system/components/FullScreenNotice.tsx`                                                    | Language switches save on the account                                                        |
| `src/features/system/lib/reality-check.ts`, `hooks/use-reality-check.ts`, `src/stores/reality-check.store.ts` (new)                             | The reality check's clock                                                                    |
| `src/features/system/components/SystemOverlays.tsx`, `SystemDialog.tsx`                                                                         | Dialog from the account's interval; no mock figures                                          |
| `src/components/layout/SportsbookShell.tsx`                                                                                                     | Mount `RealityCheckWatcher`                                                                  |
| `src/features/responsible-gaming/components/ResponsibleGamingView.tsx`                                                                          | Session-reminder card read-only                                                              |
| `src/features/system/api/get-session-activity.ts`, `hooks/use-session-activity.ts` (deleted)                                                    | Called an endpoint the contract doesn't have                                                 |
| `src/lib/api/mock/repository.ts`, `src/config/constants.ts`                                                                                     | Remove `getSessionActivity`/`SessionActivity` and `SYSTEM.realityCheck`                      |
| `src/lib/i18n/messages/en.json`, `am.json`, `TRANSLATION-NOTES.md`                                                                              | Strings                                                                                      |
| `tests/unit/account-route.test.ts`, `account-mappers.test.ts`, `reality-check.test.ts` (new)                                                    | Routes, mappers, the clock                                                                   |
| `tests/component/Profile.test.tsx`, `RealityCheck.test.tsx` (new); `ResponsibleGaming.test.tsx`, `AuthDialog.test.tsx`, `RegisterFlow.test.tsx` | Behaviour; the read-only card; login's language; the player-switch drop                      |
| `tests/e2e/screens.spec.ts`, `tests/e2e/auth.spec.ts`                                                                                           | `profile` (devices), `profile-devices-failed`, `reality-check`; login now takes Prism's `am` |
| `docs/contract-requests/012-reality-check-and-account.md` (new), `README.md`                                                                    | Question 1                                                                                   |
| `docs/tasks/F7e-reality-check-figures.md` (new), `docs/tasks/README.md`                                                                         | The figures, after 012                                                                       |
| `docs/design/01-screens.md`, `02-journeys.md`, `03-session-and-account.md`, `05-errors-and-states.md`, `07-tenancy-and-theming.md`              | As built                                                                                     |

## Acceptance criteria → tests

| AC    | Test                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | How it proves it                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| AC-8  | `account-route.test.ts` › "PATCH /api/me sends only the changed fields to PATCH /v1/me and answers with the account"; "refuses a body the contract doesn't allow before anything goes upstream"; "refuses a cross-site PATCH and one without the CSRF header"; "answers 401 without a session and sends nothing"; "forwards Prefer only under next dev"                                                                                                                   | The route is the only writer, sends `MePatch` exactly, checks everything first |
| AC-8  | `account-mappers.test.ts` › "maps a change to MePatch with only what changed"                                                                                                                                                                                                                                                                                                                                                                                             | Contract shape                                                                 |
| AC-8  | `Profile.test.tsx` › "switching language as a player saves it on the account"; "a guest's language stays on this device and nothing is sent"; "Offers shows the account's consent, waits for the API and shows its answer"; "the saved consent is the one shown after a reload"; "a refused save says so and offers Try again"; "says the language isn't saved on the account until it is, and Save sends it"                                                             | The account, not the browser, holds both; a reload reads `/api/me`             |
| AC-8  | `AuthDialog.test.tsx` › "logging in on another device takes the account's language"; "keeps the page's language when the account couldn't be read after login"; `RegisterFlow.test.tsx` › "registering keeps the language just chosen, whatever /api/me says"; `auth.spec.ts` (e2e) › "logging in on another device takes the language saved on the account"                                                                                                              | "Another device"                                                               |
| AC-9  | `account-route.test.ts` › "GET /api/me/sessions maps the API's devices"; "DELETE /api/me/sessions/{id} refuses an id that can't be one, a cross-site call and a guest before anything goes upstream"; "DELETE answers 204 when the API revoked it"                                                                                                                                                                                                                        | Route checks                                                                   |
| AC-9  | `account-mappers.test.ts` › "maps the contract's sessions, missing fields as null"                                                                                                                                                                                                                                                                                                                                                                                        | Against `example("/v1/me/sessions")`                                           |
| AC-9  | `Profile.test.tsx` › "lists the devices from /api/me/sessions with this one marked"; "signing another device out sends DELETE and removes it once the API answers"; "offers no sign-out for this device"; "a device already gone leaves the list without an error"; "a failed sign-out says so on that row with Try again"; "a failed list offers Try again"; "drops the devices when another player signs in"                                                            | Behaviour, server-confirmed removal, personal data dropped                     |
| AC-9  | `pnpm ui` `profile`, `profile-devices-failed`, `profile-language-unsaved` (AC-8)                                                                                                                                                                                                                                                                                                                                                                                          | Both of Prism's devices, this one marked; the error state                      |
| AC-10 | `reality-check.test.ts` › "counts the checks due and the next one from the visit's start"                                                                                                                                                                                                                                                                                                                                                                                 | The arithmetic is time only                                                    |
| AC-10 | `RealityCheck.test.tsx` (fake timers) › "opens after the account's interval of play, not a minute before"; "Keep playing closes it and it opens again one interval later"; "follows the account's interval (30 min)"; "never opens without an interval or for a guest"; "a reload neither restarts the clock nor skips a check that came due"; "Take a break and View my limits acknowledge it and open Responsible gaming"; "shows the time played and no money figures" | The interval and every action; "the API's figures only" (none until F7e)       |
| AC-10 | `ResponsibleGaming.test.tsx` › "the session reminder shows the account's interval, and Off without one"                                                                                                                                                                                                                                                                                                                                                                   | Decision 4                                                                     |
| AC-10 | `pnpm ui` `reality-check` (`page.clock` moved past Prism's 60 minutes)                                                                                                                                                                                                                                                                                                                                                                                                    | The dialog, both languages, both widths                                        |

## Risks

- **Money**: no figure shown at all until the API gives it (F7e); the fake ETB 350/120/−230 and the float
  `Math.abs` go. Nothing moves money here.
- **Personal data**: devices (IPs) under `accountKeys.all`, dropped by `forgetPlayer` with a player-switch
  test; the PATCH answer replaces the `/api/me` entry, which is player-scoped already.
- **Security**: three route handlers — CSRF + origin on `PATCH`/`DELETE`, the id checked before it reaches
  the upstream path, strict body schema, session on every call, `no-store`, `Prefer` dev-only. Tested.
- **Reality check honesty**: the clock is the browser's until 012 (a reminder, not a block): a new tab
  starts a new visit. `sessionStorage` keeps a reload from dodging a due check. Recorded in 012 and F7e.
- **UX**: login switches the UI to the account's language (Prism's player is `am`): e2e login tests
  adjust; the profile row says when the account differs.
- **Accessibility**: Sign out buttons named per device, 44 px; the Offers switch `aria-busy` while saving;
  notices `role="alert"`; the dialog stays an `alertdialog` that clicking away doesn't close.
- **Performance**: the sessions list is read only on Profile; one timeout for the reality check, not an
  interval ticking every second.

## Out of scope

- The session's staked, won and net (F7e, after 012); setting the player's own interval (012).
- Language in the URL (F2a); password change (no operation); push registration (`/v1/devices`, the app's).
- The four other notification switches (no notifications endpoint).
- "Sign out of all other devices" (no operation; one by one).

## Sub-tasks

None beyond F7e (the figures, which need 012).

## Steps

1. Server, mappers and route handlers for `PATCH /v1/me` and the sessions (route and mapper tests).
2. Language and Offers on the account; login takes the account's language (AC-8).
3. The devices section (AC-9).
4. The reality check's clock and dialog; the read-only session-reminder card; the mock removed (AC-10).
5. Strings, translation notes, `pnpm ui` screens, design pages, contract request 012, the F7e task file.

## Changes during implementation

- **Files added to the list**: `src/components/ui/Switch.tsx` (a `pending` state: disabled and `aria-busy`
  while the API decides, decision 8); `src/features/profile/components/SaveProblem.tsx` (the failed-save
  notice shared by Offers and a device's Sign out); `tests/component/RegisterFlow.test.tsx` (registration
  keeps its language). The player-switch test for devices sits in `Profile.test.tsx` beside the others, not
  in `Session.test.tsx`. `docs/tasks/F7-account-rg-inbox.md` notes the F7e split at the end.
- **A sign-out settles only once the list has been read again** (the 404 too): `useRevokeDeviceSession`
  returns the re-read from `onSuccess`/`onError`, so a row never shows "signed out" or an error the list
  then contradicts. An explicit "gone already" guard turned out to be unreachable and was removed (see
  verification, Tests proven).
- **The language row's save state** is derived: "Saving to your account…" while any account save is in
  flight (`useIsMutating` on `accountKeys.update()`), "Not saved to your account" with Save whenever the
  account's language differs from the page's. So a failed save from the header shows on Profile too.
- **The reality check reports the time when it opened** (`shownAt`), not a time computed during render.
  A check more than about 24.8 days off (the longest a browser timer waits) is not scheduled at all.
- **`pnpm ui`**: `before` receives the screen's language. Prism's player is saved in Amharic, so the
  `profile` screens read the account in the screen's language (`profile-language-unsaved` shows the other
  one). `auth.spec.ts`'s session tests read an English account; one new test checks that login takes
  Prism's Amharic. `reality-check` is shot over My bets (a page one screen long) with Playwright's clock
  moved an hour on.
- **Prism's `PATCH /v1/me`** has no 200 example, so in development a saved preference brings back Prism's
  generated player (`excluded_until` in 2019) until `/api/me` is read again. This is in contract request 012,
  item 6.
