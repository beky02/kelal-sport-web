---
id: F8
title: Shop terminal app
status: todo
depends_on: [F3]
contract_tags: [Retail - terminal, Catalogue, Config]
touches_money: true
touches_ui: true
---

# F8 — Shop terminal

## Goal

A self-service kiosk in a shop: activate the device, browse matches, build a slip, get a code to pay at
the counter, and reset when idle.

## Read first

- Open decision 1 in `README.md` (workspace layout) — **resolve before planning**.
- `../kelal backend/docs/design/components/c19-retail-network.md` §4.1, `c18-client-apps.md` §5
- `../kelal backend/docs/engineering-decisions.md` D3 (device signatures)
- `contracts/openapi.yaml`: `POST /v1/retail/terminals/activate`, `GET /v1/retail/terminal`,
  `POST /v1/retail/slip-codes`

## Acceptance criteria

- [ ] **AC-1** Code screen shows `4829 1735` with a QR code, then resets after the idle timeout.
- [ ] **AC-2** Requests carry `X-Device-Id`, `X-Device-Timestamp` and `X-Device-Signature` from a
      non-extractable WebCrypto key.
- [ ] **AC-3** The retail rule set is used for slip figures.
