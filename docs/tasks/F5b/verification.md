# F5b — verification

Branch `task/F5b-my-bets-ticket-check`. Plan: `F5b/plan.md` (approved 2026-10-03, interactive).

## Automated gate

| Check                  | Result | Command / evidence                                                                    |
| ---------------------- | ------ | ------------------------------------------------------------------------------------- |
| Typecheck              | PASS   | `pnpm typecheck` (route types regenerated with `next typegen` for the new routes)     |
| Lint                   | PASS   | `pnpm lint`                                                                           |
| Format                 | PASS   | `pnpm format:check`                                                                   |
| Unit + component tests | PASS   | `pnpm test` — 44 files, 980 tests                                                     |
| Golden slip rows (D1)  | PASS   | `tests/unit/golden.test.ts` — all 366 rows; `contracts/golden/` untouched             |
| Generated types        | PASS   | `pnpm api:check`                                                                      |
| Contract drift         | PASS   | `contract-sync --check`: contracts/ and docs/backend/ match the backend               |
| Production build       | PASS   | `pnpm build` — `ƒ /api/bets`, `ƒ /api/bets/[id]`, `ƒ /t`, `ƒ /t/[ticket]` dynamic     |
| UI screens + e2e       | PASS   | `pnpm ui` — 216 passed (screens at 375 / 1440 px, en / am; booking, auth, ticket)     |
| No JavaScript (AC-4)   | PASS   | `tests/e2e/ticket.spec.ts` "without JavaScript" (3 tests), `javaScriptEnabled: false` |

Final `pnpm verify` at the head of implementation (after `bde73a4`):

```
 Test Files  44 passed (44)
      Tests  980 passed (980)
contracts/ matches the backend.
docs/backend/ matches the backend.
Route (app) … ƒ /api/bets · ƒ /api/bets/[id] · ƒ /t · ƒ /t/[ticket] …
  216 passed (1.9m)
exit 0
```

## Acceptance criteria

| AC   | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-3 | PASS   | `MyBets.test.tsx` "shows each ticket's potential payout, payout and taxes from the API, not a recomputation (AC-3)" — 84.00 / 250.00 / 12.34 / 14.00 on the cards, slipcalc's 82.87 / 289.17 / 15.00 absent; "opens with every leg's result and the API's stake, stake tax, bonus, winnings tax and payout (AC-3)" — each row equals the API's string; `bets-mappers.test.ts` `toBet (AC-3)` (3 tests); screens `my-bets`, `my-bets-settled`, `ticket` |
| AC-4 | PASS   | `ticket.spec.ts` "renders /t/R7K2-M9XP-K's status with JavaScript disabled (AC-4)" — heading, status "Won", legs and payout in the server's HTML; "checks a typed number from the plain form without JavaScript (AC-4)" — `/t` → `r7k2 m9xp k` → `/t/R7K2-M9XP-K` with its status                                                                                                                                                                      |
| AC-5 | PASS   | `MyBets.test.tsx` "pages with next_cursor: Show more asks for the next page and adds it, and goes on the last page (AC-5)" — requests `?status=open` then `?status=open&cursor=c2`; `bets-route.test.ts` "forwards status and cursor to /v1/bets with the player's token, in both languages, and answers nextCursor (AC-5)"; `toBetPage (AC-5)`; screen `my-bets-more`                                                                                 |
| AC-9 | PASS   | `ticket.spec.ts` "serves /t/K7Q2-M9XP-M with Open Graph tags in the head for Telegram's preview bot (AC-9)"; "answers 404 for an unknown number, in the ticket's words (AC-9)"; "redirects a typed number to its canonical path (AC-9)"; "answers 404 for a number whose check character is wrong…"; "never repeats text from the address…"; `ticket-page.test.ts` (metadata 6, lookup 6, mapper 2); `ticket-number.test.ts` (18)                      |

## Review findings

Round 1 (2026-10-03): spec-verifier, security-reviewer, quality-reviewer, money-reviewer, ui-checker.

| ID  | Reviewer | Severity | Summary | Decision |
| --- | -------- | -------- | ------- | -------- |

## Gaps

- **Prism ignores `status`**: both example bets come back under Open and Settled. The app shows what the
  API returns for each filter; `pnpm ui` shapes the route's own answer by status in the browser so the
  screens read as the real API would (decision 20). The real filter is the backend's (B6).
- **Prism's `next_cursor` is always null**: paging is proven in component and route tests and shown in
  `my-bets-more` with a cursor injected in the browser; no real second page has been read end to end.
- **Prism answers every ticket number with one example** (`K7Q2-M9XP-M`, won), so `/t/R7K2-M9XP-K`
  shows that record (decision 14), and only the `won` status is seen against Prism; the other seven
  statuses are covered by unit tests of their labels and tones, not on screen.
- **Names in both languages are English in Prism** (`Accept-Language` is not honoured by the mock): the
  merge by bet and outcome is unit-tested with marked Amharic names.
- **`payout` / `potential_payout` net or gross, and `TicketCheck.payout` per status** are not described
  by the contract (007 item 2): labels claim nothing more ("Payout", "Potential payout").
- **No tab counts, no `rules_version`** until contract request 007 (items 6 and 1).
- **Without JavaScript, the body is English** (the UI store's default) until F2a puts the language in the
  URL; the Open Graph tags are in the tenant's default language, as `/b` does.
- **Composed Amharic** for every new string (and void vs cancelled) needs a native speaker's review
  (`TRANSLATION-NOTES.md`).
- **Two upstream reads per view** (both languages) for My bets, the ticket and the public check, until
  FD2's one-language loaders; nothing polls.
