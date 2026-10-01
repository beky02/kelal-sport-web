# F0 — Verification

Done before the `/task` workflow existed, so there was no plan file or reviewer round. Evidence:

## Automated gate

| Check                                       | Result           | Command                      |
| ------------------------------------------- | ---------------- | ---------------------------- |
| Typecheck, lint, Prettier, unit + component | PASS (118 tests) | `pnpm check`                 |
| Generated types match the contract          | PASS             | `pnpm api:check`             |
| Contract copy matches the backend           | PASS             | `pnpm contract:sync --check` |
| UI screens, 375/1440 px × en/am             | PASS (44)        | `pnpm ui`                    |

## Acceptance criteria

| AC   | Status | Evidence                                                                                                                                                                                  |
| ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | MET    | Browser check against Prism on :4010: three sections (Ethiopian Premier League, Premier League, LaLiga) with the three matches; `toBoard` tests in `tests/unit/catalogue-mappers.test.ts` |
| AC-2 | MET    | Network log: only `/api/catalogue/{sports,board,competitions/top,competitions/countries}`                                                                                                 |
| AC-3 | MET    | 17 mapper tests reading examples from `contracts/openapi.yaml` via `tests/contract.ts`                                                                                                    |
| AC-4 | MET    | `locks every price on a suspended market`; screenshot `test-results/ui/home-en-desktop.png`                                                                                               |
| AC-5 | MET    | `fills specifiers into market and outcome names`, `offers the groups the fixture has`                                                                                                     |
| AC-6 | MET    | `/live` returns 404; desktop nav and phone tab bar have no Live entry                                                                                                                     |

## Found and fixed during verification

- The event page's market-group tabs overflowed a 375 px phone (found by `pnpm ui`); they now scroll.
- A grouped market card was titled after its first line ("Total 2.5"); it now uses the line-free title.

## Gaps

- Prism always answers in English, so Amharic catalogue names are untested against real data.
- Prism ignores query parameters: filter, date and sport switching return the same three matches.
