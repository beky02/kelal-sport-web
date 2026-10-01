"""Reference slip calculator (C07) — the executable definition of the slip rules.

The Python backend, the Dart app and the TypeScript web apps must produce exactly the
same numbers as this file for every row of slips.csv. All arithmetic is exact
(integers and fractions); nothing is rounded except where a rule says "floor".

Units: money in santim (int), odds as decimal strings with up to 3 decimals.
Rules are documented in the "Engineering Decisions" tab, section D1.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from itertools import combinations
from math import floor
from typing import Literal

Result = Literal["open", "win", "lose", "void", "half_win", "half_lose"]


class SlipError(Exception):
    """Validation failure; `code` is the API ErrorCode."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


# ----------------------------------------------------------------------------- parsing helpers
def money_to_santim(s: str) -> int:
    neg = s.startswith("-")
    whole, _, frac = s.lstrip("-").partition(".")
    frac = (frac + "00")[:2]
    v = int(whole) * 100 + int(frac)
    return -v if neg else v


def santim_to_money(v: int) -> str:
    sign = "-" if v < 0 else ""
    v = abs(v)
    return f"{sign}{v // 100}.{v % 100:02d}"


def dec(s: str) -> Fraction:
    """Exact decimal string -> Fraction (e.g. "1.85" -> 37/20)."""
    return Fraction(s)


# ----------------------------------------------------------------------------- rule set
@dataclass(frozen=True)
class TaxRule:
    code: str                     # STAKE_TAX, WIN_TAX, WITHHOLDING, LEVY
    base: str                     # stake | gross_win | net_win | profit
    rate: Fraction
    threshold: int                # santim; tax applies only when base > threshold
    deduct_from: str              # stake | payout | operator


@dataclass(frozen=True)
class RuleSet:
    min_stake: int
    max_stake: int
    max_payout: int
    max_legs: int
    max_lines: int
    acca_bonus_table: list[tuple[int, Fraction]]   # (min_legs, pct) ascending; pct in percent
    acca_bonus_min_leg_odds: Fraction
    acca_bonus_max: int
    taxes: list[TaxRule]
    refund_stake_tax_on_void: bool

    @staticmethod
    def from_json(d: dict) -> "RuleSet":
        """Accepts the contract's RuleSet shape (money and rates as decimal strings)."""
        return RuleSet(
            min_stake=money_to_santim(d["min_stake"]),
            max_stake=money_to_santim(d["max_stake"]),
            max_payout=money_to_santim(d["max_payout"]),
            max_legs=int(d["max_legs"]),
            max_lines=int(d["max_lines"]),
            acca_bonus_table=sorted((int(t["min_legs"]), dec(t["pct"])) for t in d["acca_bonus_table"]),
            acca_bonus_min_leg_odds=dec(d["acca_bonus_min_leg_odds"]),
            acca_bonus_max=money_to_santim(d["acca_bonus_max"]),
            taxes=[TaxRule(t["code"], t["base"], dec(t["rate"]), money_to_santim(t.get("threshold", "0.00")),
                           t["deduct_from"]) for t in d["taxes"]],
            refund_stake_tax_on_void=bool(d.get("refund_stake_tax_on_void", False)),
        )


# ----------------------------------------------------------------------------- slip and quote
@dataclass(frozen=True)
class Leg:
    odds: str
    result: Result = "open"


@dataclass(frozen=True)
class Slip:
    bet_type: Literal["single", "multiple", "system"]
    legs: list[Leg]
    stake: int                           # santim, total unless stake_is_per_line
    system_sizes: tuple[int, ...] = ()
    stake_is_per_line: bool = False


@dataclass
class Quote:
    lines: int
    stake_per_line: int
    total_stake: int
    stake_tax: int
    net_stake: int
    total_odds: str | None
    gross_payout: int
    acca_bonus: int
    taxes: dict[str, int]
    win_tax: int
    stake_tax_refund: int
    net_payout: int
    capped: bool
    warnings: list[str] = field(default_factory=list)


def combos_for(slip: Slip) -> list[tuple[int, ...]]:
    n = len(slip.legs)
    if slip.bet_type == "single":
        return [(i,) for i in range(n)]
    if slip.bet_type == "multiple":
        return [tuple(range(n))]
    out: list[tuple[int, ...]] = []
    for k in slip.system_sizes:
        out.extend(combinations(range(n), k))
    return out


def validate(slip: Slip, r: RuleSet, settled: bool) -> None:
    n = len(slip.legs)
    if n == 0:
        raise SlipError("VALIDATION_FAILED")
    if n > r.max_legs:
        raise SlipError("BET_TOO_MANY_LEGS")
    if slip.bet_type == "multiple" and n < 2:
        raise SlipError("VALIDATION_FAILED")
    if slip.bet_type == "system":
        sizes = list(slip.system_sizes)
        if not sizes or sizes != sorted(set(sizes)) or sizes[0] < 1 or sizes[-1] > n or (sizes == [n]):
            raise SlipError("VALIDATION_FAILED")
    elif slip.system_sizes:
        raise SlipError("VALIDATION_FAILED")
    for leg in slip.legs:
        o = dec(leg.odds)
        if o < Fraction(101, 100) or (o * 1000).denominator != 1:
            raise SlipError("VALIDATION_FAILED")
        if settled and leg.result == "open":
            raise SlipError("VALIDATION_FAILED")


def effective(leg: Leg) -> Fraction:
    o = dec(leg.odds)
    return {
        "open": o,              # preview: an open leg is treated as a win
        "win": o,
        "lose": Fraction(0),
        "void": Fraction(1),
        "half_win": (o + 1) / 2,
        "half_lose": Fraction(1, 2),
    }[leg.result]


def quote(slip: Slip, r: RuleSet, settled: bool = False) -> Quote:
    validate(slip, r, settled)
    combos = combos_for(slip)
    lines = len(combos)
    if lines > r.max_lines:
        raise SlipError("BET_TOO_MANY_LINES")
    warnings: list[str] = []

    # 1. stake per line; a remainder that does not divide is not charged
    stake_line = slip.stake if slip.stake_is_per_line else slip.stake // lines
    if stake_line < 1:
        raise SlipError("BET_STAKE_TOO_LOW")
    total_stake = stake_line * lines
    if not slip.stake_is_per_line and total_stake != slip.stake:
        warnings.append("STAKE_REMAINDER_NOT_CHARGED")
    if total_stake < r.min_stake:
        raise SlipError("BET_STAKE_TOO_LOW")
    if total_stake > r.max_stake:
        raise SlipError("BET_STAKE_TOO_HIGH")

    # 2. stake taxes per line, rounded down per line, so every charged santim is either tax or stake at risk
    taxes: dict[str, int] = {}
    tax_line = 0
    for t in r.taxes:
        if t.base == "stake" and t.deduct_from == "stake" and total_stake > t.threshold:
            amt = floor(stake_line * t.rate)
            taxes[t.code] = taxes.get(t.code, 0) + amt * lines
            tax_line += amt
    stake_tax = tax_line * lines
    net_stake_line = stake_line - tax_line
    net_stake = net_stake_line * lines

    # 3. gross: each line floored to the santim, exact product of effective odds
    gross = 0
    for c in combos:
        prod = Fraction(1)
        for i in c:
            prod *= effective(slip.legs[i])
        gross += floor(net_stake_line * prod)

    # 4. accumulator bonus
    bonus = 0
    if slip.bet_type == "multiple":
        non_void = [l for l in slip.legs if l.result != "void"]
        all_winning = all(l.result in ("open", "win") for l in non_void)
        qualifying = [l for l in non_void if dec(l.odds) >= r.acca_bonus_min_leg_odds]
        pct = Fraction(0)
        for min_legs, p in r.acca_bonus_table:
            if len(qualifying) >= min_legs:
                pct = p
        profit = gross - net_stake
        if all_winning and pct > 0 and profit > 0:
            bonus = floor(profit * pct / 100)
            if bonus > r.acca_bonus_max:
                bonus = r.acca_bonus_max
                warnings.append("ACCA_BONUS_CAPPED")

    # 5. payout cap on the pre-tax payout (gross + bonus): cut the bonus first, then gross
    capped = False
    if gross + bonus > r.max_payout:
        capped = True
        excess = gross + bonus - r.max_payout
        cut = min(bonus, excess)
        bonus -= cut
        gross -= excess - cut
        warnings.append("MAX_PAYOUT_REACHED")

    # 6. payout taxes on the whole base when base > threshold, rounded down, once per ticket
    bases = {
        "stake": total_stake,
        "gross_win": gross + bonus,
        "net_win": gross + bonus - net_stake,
        "profit": gross + bonus - total_stake,
    }
    deducted = 0
    win_tax = 0
    for t in r.taxes:
        if t.base == "stake":
            continue
        b = bases[t.base]
        if b > t.threshold and b > 0:
            amt = floor(b * t.rate)
            taxes[t.code] = taxes.get(t.code, 0) + amt
            if t.deduct_from == "payout":
                deducted += amt
                win_tax += amt
    net = gross + bonus - deducted

    # 7. all-void refund of stake tax (tenant option)
    stake_tax_refund = 0
    if settled and all(l.result == "void" for l in slip.legs) and r.refund_stake_tax_on_void:
        stake_tax_refund = stake_tax
        net += stake_tax_refund

    total_odds = None
    if lines == 1:
        prod = Fraction(1)
        for l in slip.legs:
            prod *= dec(l.odds)
        v = floor(prod * 100)                           # display only, floored to 2 decimals
        total_odds = f"{v // 100}.{v % 100:02d}"

    return Quote(lines, stake_line, total_stake, stake_tax, net_stake, total_odds, gross, bonus, taxes,
                 win_tax, stake_tax_refund, net, capped, warnings)
