# C07 Slip Calculator & Rules Engine

## 1. Purpose & scope

C07 is a pure calculation library with no I/O. It takes a slip, a stake and a tenant rule set, and returns every number the player sees and the ledger posts: combinations, total odds, bonus, taxes and payout. It is used by C08 (placement), C10 (settlement), C09 (booking preview) and `POST /v1/slips/quote`. It is ported line-for-line to Dart (Flutter app) and TypeScript (Next.js apps) for previews. It implements BET-01, BET-04, BET-07, SET-02 and BR-02 to BR-07.

The rules below are finalised in Engineering Decisions D1; `contracts/golden/reference_slipcalc.py` is the executable definition.

## 2. Research notes

| Topic | Finding | Design |
| --- | --- | --- |
| Competitor slip rules | HuluSport and Shamo.bet send a `slip_computer_class` plus parameters: `MAX_WIN` 1,000,000; `SLIP_SIZE` 50; accumulator `BONUS_TABLE` 3 legs 5% → 20 legs 100%; `MIN_BONUS_ODD` 1.3; tax fields `WIN_TAX` 0.15, `VAT_TAX` 0.15, `WITHHOLDING_TAX` 0.14, `NATIONAL_LOTTERY` 0.15, `TAXABLE_WIN` 1,000 | Same concepts as data (rule set), not a hard-coded class name |
| Named system bets | Trixie = 4 bets on 3 selections, Patent 7, Yankee 11, Lucky 15, Canadian 26, Heinz 57 | Generated as combination sets |
| Void legs | Industry standard: void selection = odds 1.00 in multiples | SET-02 |
| Dead heat | Payout at odds × dead-heat factor on the stake portion | Supported via `dead_heat_factor` |
| Rounding | Round payouts down to the santim; never round odds up | Protects house and matches display |

## 3. Types

```python
@dataclass(frozen=True)
class Leg:
    outcome_id: str
    fixture_id: str
    odds: Decimal
    result: Literal["open", "win", "lose", "void", "half_win", "half_lose"] = "open"
    dead_heat_factor: Decimal = Decimal(1)


@dataclass(frozen=True)
class Slip:
    legs: list[Leg]
    bet_type: Literal["single", "multiple", "system"]
    system_sizes: tuple[int, ...] = ()  # e.g. (2,) for 2/3, (2,3) for Trixie
    stake_santim: int = 0  # TOTAL stake entered by player
    stake_is_per_line: bool = False


@dataclass(frozen=True)
class RuleSet:  # from tenant config (C16), versioned
    min_stake: int
    max_stake: int
    max_payout: int
    max_legs: int
    acca_bonus: list[tuple[int, Decimal]]  # (min_legs, pct) ascending
    acca_bonus_min_leg_odds: Decimal
    acca_bonus_max: int
    taxes: list[TaxRule]  # applied in order
    rounding: Literal["down"] = "down"


@dataclass(frozen=True)
class TaxRule:
    code: str  # STAKE_TAX, WIN_TAX, WITHHOLDING, LEVY
    base: Literal["stake", "gross_win", "net_win", "profit"]
    rate: Decimal
    threshold_santim: int = 0  # applies only above threshold
    deduct_from: Literal["stake", "payout", "operator"] = "payout"  # operator = house-borne levy


@dataclass(frozen=True)
class Quote:
    lines: int
    stake_per_line: int
    total_stake: int
    net_stake: int
    total_odds: Decimal | None  # for single-line bets
    gross_payout: int
    acca_bonus: int
    taxes: dict[str, int]
    net_payout: int
    capped: bool
    warnings: list[str]
```

## 4. Algorithm

```python
def quote(slip: Slip, r: RuleSet, settled: bool = False) -> Quote:
    validate_shape(slip, r)                          # legs ≤ max_legs, no duplicate fixtures, sizes valid
    combos = combinations_for(slip)                   # list[list[Leg]]
    lines = len(combos)
    stake_line = slip.stake_santim if slip.stake_is_per_line else slip.stake_santim // lines
    total_stake = stake_line * lines                  # remainder santim is not charged
    tax_line = sum_tax(r.taxes, base="stake", amount=stake_line, deduct_from="stake")   # per line, floored (D1.4)
    net_stake_line = stake_line - tax_line
    stake_tax = tax_line * lines
    net_stake = net_stake_line * lines

    gross = 0
    for combo in combos:
        odds = product(effective_odds(l, settled) for l in combo)    # void → 1, half_win → (o+1)/2, half_lose → 0.5, lose → 0
        gross += floor_santim(net_stake_line * odds)

    bonus = 0
    if slip.bet_type == "multiple":
        qualifying = [l for l in slip.legs if l.odds >= r.acca_bonus_min_leg_odds and l.result != "void"]
        pct = lookup(r.acca_bonus, len(qualifying))
        profit = gross - net_stake
        bonus = min(floor_santim(profit * pct), r.acca_bonus_max) if profit > 0 and all_non_void_legs_win(slip) else 0

    capped = gross + bonus > r.max_payout             # cap before tax (D1.7): cut the bonus first, then gross
    if capped:
        bonus = max(r.max_payout - gross, 0)
        gross = min(gross, r.max_payout)
    win_taxes = apply_payout_taxes(r.taxes, stake=total_stake, gross=gross + bonus)
    net = gross + bonus - sum(win_taxes.values())
    return Quote(lines, stake_line, total_stake, net_stake, …, net_payout=net, capped=capped)
```

Before settlement (`settled=False`), every leg is treated as a win, so the quote shows the potential payout. At settlement the same function runs with real results, so preview and payout never use different code.

## 5. Worked example (placeholder rates)

Two tax rules, both placeholders until the directive is published: a stake tax of 15% deducted from the stake, and a win tax of 15% on the payout, applied only when the win exceeds 1,000 ETB. The slip is a 5-leg accumulator, each leg at 1.50 (total odds 7.59), with a 100 ETB stake and an 8% bonus at 5 legs.

| Step | Value |
| --- | --- |
| Stake entered | 100.00 |
| Stake tax 15% | 15.00 → net stake 85.00 |
| Gross payout 85.00 × 7.59375 = 645.46875, rounded down | 645.46 |
| Accumulator bonus 8% of profit (645.46 − 85.00 = 560.46) | 44.83 |
| Win tax (payout 690.29 ≤ 1,000 threshold) | 0.00 |
| **Net payout** | **690.29** |

## 6. Combination generation

| Type | Selections n | Lines |
| --- | --- | --- |
| Single | 1 each | n |
| Multiple (accumulator) | 2–30 | 1 |
| System k/n | n | C(n,k) |
| Trixie | 3 | 4 (3 doubles + 1 treble) |
| Patent | 3 | 7 (3 singles + Trixie) |
| Yankee | 4 | 11 |
| Lucky 15 | 4 | 15 |
| Canadian | 5 | 26 |
| Heinz | 6 | 57 |

Maximum lines per slip: 1,024 (guards against huge system bets).

## 7. Interface and API

- Library: `slipcalc.quote(slip, rules, settled=False) -> Quote`; `slipcalc.combinations_for(slip)`; `slipcalc.rules_from_config(cfg)`.
- `POST /v1/slips/quote` (public, optional) wraps it for server-side checks and debugging; clients compute previews locally. Request `{bet_type, system_sizes, legs:[{outcome_id, odds}], stake}` → `Quote` with amounts as decimal strings.

## 8. Configuration (C16 keys)

`betting.min_stake`, `betting.max_stake`, `betting.max_payout`, `betting.max_legs`, `betting.acca_bonus_table`, `betting.acca_bonus_min_leg_odds`, `betting.acca_bonus_max`, `betting.taxes[]`. The **rule-set version** used is stored on every bet, so settlement uses the same rules as placement.

## 9. Edge cases

- **Stake not divisible by lines**: charge `stake_line × lines`; the app shows the per-line stake.
- **All legs void**: payout = net stake returned; stake tax is refunded if the tenant rule says so (config `refund_stake_tax_on_void`).
- **Half-win/half-lose** (Asian handicap quarter lines): half the line stake wins at odds and half is refunded, or half is refunded and half lost.
- **Payout cap** applies to the pre-tax payout (gross + bonus), cutting the bonus first; taxes are computed on the capped amount (Engineering Decisions D1.7). The app shows “max payout reached”.
- **Decimal precision**: use `Decimal` only from exact inputs, and do the arithmetic exactly (integer santim and fractions; Python fractions.Fraction, BigInt rationals in TypeScript). Floor only at the santim steps listed in D1; never use floats or a limited-precision context.

## 10. Tests

- `contracts/golden/slips.csv` (366 rows; format in contracts/golden/README.md): inputs → expected quote, run by the Python, Dart and TypeScript test suites. Any difference fails CI.
- Property tests: net payout ≤ max payout; payout is monotonic in stake; all-void refunds.
- Mutation testing on the tax module (e.g. mutmut), because tax bugs are costly.
