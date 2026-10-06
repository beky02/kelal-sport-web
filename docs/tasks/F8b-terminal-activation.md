---
id: F8b
title: Split from F8 — terminal activation, the device key and signed requests
status: planned
depends_on: [F8a]
contract_tags: [Retail - terminal]
touches_money: false
touches_ui: true
---

# F8b — Terminal activation and signed requests

Split from [F8](F8-terminal.md) (2026-10-03, before planning), following C19 §16's order. F8a is the
host split, not part of the terminal.

## Goal

A shop terminal is activated once with its one-time code, keeps a non-extractable device key and signs
every request; a revoked or disabled terminal stops and says so.

## Read first

- `docs/decisions.md` **FD1** (the `(terminal)` group, the host split)
- `docs/backend/design/components/c19-retail-network.md` §4.1, §9.1, §12; `c18-client-apps.md` §5
- `docs/backend/engineering-decisions.md` D3 (device signatures)
- `contracts/openapi.yaml`: `POST /v1/retail/terminals/activate`, `GET /v1/retail/terminal`,
  `POST /v1/retail/terminal/token`, the `X-Device-*` parameters

## Scope

In: the terminal's shell — the `(terminal)` route group's layout on `terminal.{brand}` (FD1, F8a) — and its
route handlers under `/api/terminal/*`, which add the terminal token from their own httpOnly cookie (D3); activation (one-time code, 5 attempts); the device key
(WebCrypto P-256, non-extractable); `X-Device-Id`, `X-Device-Timestamp` and `X-Device-Signature` on every
call; status on boot and every 5 minutes; token rotation before expiry; revoked and disabled states.

Out: browsing and slips (F8c).

## Acceptance criteria

- [ ] **AC-2** Requests carry `X-Device-Id`, `X-Device-Timestamp` and `X-Device-Signature` from a
      non-extractable WebCrypto key.
- [ ] **AC-4** Activation takes the one-time code; a wrong code, too many attempts and a revoked terminal
      each say so, and a revoked terminal offers nothing else (route and component tests; `pnpm ui`).
- [ ] **AC-5** The terminal reads its status on boot and every 5 minutes and rotates its token before it
      expires without interrupting the screen (hook test with fake timers).
