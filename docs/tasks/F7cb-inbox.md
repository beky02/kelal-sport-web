---
id: F7cb
title: Split from F7c — the inbox, its unread badge, marking read
status: todo
depends_on: [F7ca]
contract_tags: [Inbox]
touches_money: false
touches_ui: true
---

# F7cb — Inbox

Split from [F7c](F7c-promotions-inbox.md) (2026-10-09, while planning). Carries F7c's **AC-13**.
Depends on F7ca only because both add query roots, entries in the phone's Menu and in `forgetPlayer`.

## Goal

A signed-in player reads their messages in an inbox, sees how many are unread on a badge in the header,
and opening a message marks it read on the server, so every device agrees.

## Read first

- `docs/backend/design/components/c14-notifications.md` §5–§7
- `contracts/openapi.yaml`: `GET /v1/inbox` (cursor paging), `GET /v1/inbox/unread-count`,
  `POST /v1/inbox/read` (`{ids}` or `{all: true}`, 204)
- `docs/tasks/F7c/plan.md` (the parent's decisions on the inbox: where the badge sits, deep links)
- Existing: `src/features/bets/components/MyBetsView.tsx` (Show more by `next_cursor`),
  `src/components/layout/AppHeader.tsx`

## Scope

In: `/inbox` (behind login); the badge from `/v1/inbox/unread-count`; opening a message marks it read
(`{ids}`), Mark all read (`{all: true}`); a message's `deep_link` opened only when it names one of this
app's routes.

Out: push notifications and `POST /v1/devices`; notification preferences (no contract operation).

## Acceptance criteria

- [ ] **AC-13** The inbox lists messages; the badge comes from `/v1/inbox/unread-count`; opening messages
      marks them read through `POST /v1/inbox/read` (component test; `pnpm ui`).

## Verification

- `pnpm verify` passes
- `pnpm ui --grep inbox`

## Notes

- `deep_link`'s path set is not in the contract or D7 (the example is `/bets/{id}`; the app's ticket is
  `/my-bets/{id}`). Planned in F7c: a known path maps to its `routes.*` value, anything else shows no
  link. Worth a contract note when F7cb starts.
