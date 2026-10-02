---
id: B3
title: C07 slip calculator passes all 366 golden rows
status: todo
depends_on: []
components: [C07]
contract_tags: []
touches_money: true
---

# B3 — Slip calculator (C07)

## Goal
A pure, strictly typed Python port of `contracts/golden/reference_slipcalc.py` in `modules/slipcalc`,
so betting, booking and settlement all use one calculator that matches the web and app to the santim.

## Read first
- `docs/engineering-decisions.md` D1 (all 12 rules) — the definition
- `contracts/golden/reference_slipcalc.py` and `contracts/golden/README.md`
- `docs/design/components/c07-slip-calculator.md` (context, worked example, combination table)

## Scope
In:
- `modules/slipcalc/domain/` — types and algorithm; `modules/slipcalc/__init__.py` exports `Leg, Slip, RuleSet (from_json), Quote, SlipError, quote` with the reference's semantics, plus `combos_for`.
- Error codes are `shared.error_codes.ErrorCode` values (that module is pure; `shared.errors` imports FastAPI and is off limits to slipcalc).
- Named systems helper (Trixie, Patent, Yankee, Lucky 15, Canadian, Heinz → system sizes).
- Remove nothing from the golden test; it starts running automatically once the exports exist.

Out: `POST /v1/slips/quote` endpoint (optional, add later with B6), Dart port (mobile repo).

## Acceptance criteria
- [ ] **AC-1** `uv run pytest tests/golden` runs 366 rows, 0 failures, 0 skips.
- [ ] **AC-2** No float anywhere in `modules/slipcalc` (grep + a test that passes huge odds/stakes without precision loss); mypy strict passes.
- [ ] **AC-3** Property tests: net payout ≤ max_payout; **gross** payout is monotonic non-decreasing in stake (net payout is deliberately not: D1.8 taxes the whole win once it passes the threshold — golden rows `WIN_TAX_GROSS_*`); an all-void slip returns the net stake (plus stake tax only with the refund flag).
- [ ] **AC-4** `modules/slipcalc` imports nothing with I/O (import-linter contract kept).
- [ ] **AC-5** `contracts/golden/` is unchanged (`git diff --stat main -- contracts/golden` is empty).

## Verification
- `make golden && make verify`
