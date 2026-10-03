---
id: F8
title: Shop terminal app
status: todo
depends_on: [F8a]
contract_tags: [Retail - terminal, Catalogue, Config]
touches_money: true
touches_ui: true
---

# F8 — Shop terminal

Split (2026-10-03, before planning), following C19 §16's order, into
[F8b — terminal activation and signed requests](F8b-terminal-activation.md) (AC-2, AC-4, AC-5) and
[F8c — terminal slip to code](F8c-terminal-slip-code.md) (AC-1, AC-3, AC-6). F8a, the workspace, comes
first and is not part of the terminal. F8 is done when F8b and F8c are.

## Goal

A self-service kiosk in a shop: activate the device, browse matches, build a slip, get a code to pay at
the counter, and reset when idle.

## Read first

- `docs/decisions.md` **FD1** — this app is `apps/<name>` in the workspace F8a creates, built on its
  shared packages.
- `docs/backend/design/components/c19-retail-network.md` §4.1, `c18-client-apps.md` §5
- `docs/backend/engineering-decisions.md` D3 (device signatures)
- `contracts/openapi.yaml`: `POST /v1/retail/terminals/activate`, `GET /v1/retail/terminal`,
  `POST /v1/retail/slip-codes`

## Acceptance criteria

- [ ] **AC-1** Code screen shows `4829 1735` with a QR code, then resets after the idle timeout.
- [ ] **AC-2** Requests carry `X-Device-Id`, `X-Device-Timestamp` and `X-Device-Signature` from a
      non-extractable WebCrypto key.
- [ ] **AC-3** The retail rule set is used for slip figures.

Added at the split (2026-10-03):

- [ ] **AC-4** Activation takes the one-time code; a wrong code, too many attempts and a revoked terminal
      each say so.
- [ ] **AC-5** The terminal reads its status on boot and every 5 minutes and rotates its token before it
      expires.
- [ ] **AC-6** A 429 from `POST /v1/retail/slip-codes` says when the terminal can make the next code.
