<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# KelalSport web

Sportsbook frontend for Ethiopia. The backend is a **separate service** — nothing
server-side belongs in this repo beyond rendering.

## The rule that matters most

The frontend never decides money. It displays state and collects actions.

`features/bet-slip/lib/calculate.ts` computes a _display estimate_ so the user can
see what a stake would return. The betting engine recomputes stake tax, winnings
tax, the per-ticket cap and the final payout when the bet is placed, and its
answer is the one that counts. If you find yourself reconciling the two in the
browser, stop.

Optimistic updates are fine for selecting odds, opening panels and switching
filters. They are not fine for placing a bet, depositing, withdrawing or cashing
out: those wait for the server.

## Where state lives

| Kind     | Home                                      | Examples                              |
| -------- | ----------------------------------------- | ------------------------------------- |
| Server   | TanStack Query                            | events, markets, competitions, wallet |
| Realtime | `lib/websocket` → patches the Query cache | odds, scores, suspensions             |
| Client   | Zustand (`stores/ui.store.ts`)            | theme, language, clock, what is open  |
| Bet slip | Zustand (`features/bet-slip/stores`)      | selections, mode, stake               |
| Filters  | **The URL**                               | sport, date, filter                   |

Board filters go in the URL so refresh, back and sharing work. Don't move them
into a store. Don't copy query results into Zustand.

## Conventions

- **Tokens, not hex.** Colours, radii and fonts are CSS variables in
  `app/globals.css`, exposed as Tailwind utilities (`bg-surface`, `text-muted`,
  `rounded-lg`). A raw `#hex` in a component is a bug.
- **Both languages, always.** Add every string to `en.json` _and_ `am.json`;
  `tests/unit/i18n.test.ts` fails otherwise. Never concatenate translated
  fragments — add a key with a `{placeholder}`.
- **Amharic is not just longer.** It needs more line height and no uppercasing.
  That is handled by tokens keyed off `<html lang>`; don't hardcode `uppercase`
  or `tracking-*` on a label.
- **Validate at the boundary.** Every response goes through a Zod schema in
  `lib/api/schemas.ts`, mocks included. Schemas carry
  `satisfies z.ZodType<Domain>` so a schema and its interface cannot drift.
- **Preserve identity in realtime updates.** `applyToBoard` returns untouched
  objects by reference, and rows are `memo`ised, so one price moving re-renders
  one button. `tests/unit/realtime.test.ts` guards this — if it fails, the board
  has started re-rendering wholesale.
- **Compose, don't add props.** An `EventRow` is assembled from `TeamLine`,
  `EventMeta` and `OddsGroup`. Resist the 20-prop component.
- **Safety state is server state.** A responsible-gaming break lives behind
  `features/responsible-gaming` and is read with a query, never a Zustand store.
  A break a user could end by reloading would not be one. Same reasoning for
  balance, withdrawable and KYC status.
- **One definition of the money.** `settleBet` in
  `features/bet-slip/lib/calculate.ts` is the only place Ethiopian withholding is
  expressed for a single price; tickets and the slip both go through it, and a
  test pins them together. Don't write the formula a third time.
- **A custom breakpoint sorts before the built-ins.** Tailwind emits `wide:`
  ahead of `lg:`/`xl:`, so overlapping responsive rules are decided by source
  order, not width. `SportsbookShell` uses bounded ranges (`lg:max-xl:`,
  `xl:max-wide:`, `wide:`) for that reason — don't collapse it into a cascade.
- **Rejections carry their fix.** When the engine refuses something it returns a
  code and the limit in `details`; the UI offers the correction rather than
  reporting the problem and stopping.
