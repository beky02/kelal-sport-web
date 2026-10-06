---
id: F11
title: Platform console — platform staff create, run and suspend brands
status: todo
depends_on: [F12, F10b]
contract_tags: [Platform]
touches_money: false
touches_ui: true
---

# F11 — Platform console

Built in **`kelalsport-ops`**, not this repo (FD1, 2026-10-05); this file moves there when F12 creates it.

Added 2026-10-05 with **FD6**. No backend build step names it yet (the build plan has none for the
platform layer). **Waits for the backend:** proposal
[001](../backend-proposals/001-platform-and-retail-hierarchy.md) applied to the backend docs, and the
`Platform` operations of contract request [013](../contract-requests/013-platform-and-retail-chain.md) in
the contract and synced. Re-cut the criteria below against those before planning; split it if it outgrows
one PR.

## Goal

Platform staff, above every brand, sign in to their own console, create a brand (licence, domains, first
admin), see each brand's status and licence expiry, and suspend or reactivate one. They never sign in to
a brand's back office this way, and they see no brand's players, bets or money unless proposal 001 Q4
decides otherwise.

## Read first

- `docs/decisions.md` **FD1** (the console is built in `kelalsport-ops`, F12), **FD6**
- Backend proposal 001 §4–§5 and its open questions (Q1 how a brand pays the platform; Q4 access to brand
  data; Q5 how many brands at launch)
- `docs/backend/design/components/c16-config-tenancy.md` §3 (tenants, domains, config versions), §7
  (the real-money switch); `c15-back-office-trading.md` (sign-in with TOTP, audit), `c18-client-apps.md` §3
- `contracts/openapi.yaml`: the `Platform` operations, once they exist

## Scope

In: the console app in `kelalsport-ops` on the platform's own host;
platform staff sign-in (password and TOTP; the token in an httpOnly cookie, D3); the brands list; create a
brand; its domains; invite its first admin; suspend and reactivate; its config history (read only).

Out: anything inside a brand (its back office, F10b–F10g); the platform statement, until proposal 001 Q1
picks an option that needs one.

## Acceptance criteria

- [ ] **AC-1** Platform staff sign in with password and TOTP; a brand's back-office account can't sign in
      here, and a platform token reaches no brand operation (route tests).
- [ ] **AC-2** A brand is created with its code, legal name, licence number and expiry, and its hosts per
      app; it starts in `setup` and shows the API's status (component test; `pnpm ui`).
- [ ] **AC-3** The first brand admin is invited by email; the invitation shows only once it is sent.
- [ ] **AC-4** Suspending a brand asks once, in full sentences, and shows the API's new status; a licence
      within 30 days of expiry is flagged (component test).
