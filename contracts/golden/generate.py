"""Generate slips.csv from reference_slipcalc.py.

Run: python3 generate.py            (rewrites slips.csv)
     python3 generate.py --check    (fails if slips.csv would change)

Hand-picked cases cover every rule in Engineering Decisions D1; seeded random cases add breadth.
Review any diff in slips.csv in code review: a changed row means a changed payout.
"""
from __future__ import annotations

import csv, io, json, random, sys
from pathlib import Path

from reference_slipcalc import Leg, RuleSet, Slip, SlipError, money_to_santim, quote, santim_to_money

HERE = Path(__file__).parent
RULES = {k: RuleSet.from_json(v) for k, v in json.loads((HERE / "rules.json").read_text()).items()}

COLUMNS = ["case_id", "rules", "bet_type", "system_sizes", "stake", "stake_is_per_line", "leg_odds",
           "leg_results", "settled", "expected_error", "lines", "stake_per_line", "total_stake", "stake_tax",
           "net_stake", "total_odds", "gross_payout", "acca_bonus", "win_tax", "stake_tax_refund",
           "net_payout", "capped", "warnings"]

NAMED_SYSTEMS = {  # name: (legs, sizes)
    "TRIXIE": (3, [2, 3]), "PATENT": (3, [1, 2, 3]), "YANKEE": (4, [2, 3, 4]), "LUCKY15": (4, [1, 2, 3, 4]),
    "CANADIAN": (5, [2, 3, 4, 5]), "HEINZ": (6, [2, 3, 4, 5, 6]), "SYS_2_3": (3, [2]), "SYS_3_5": (5, [3]),
}

def row(case_id, rules, bet_type, odds, results=None, stake="100.00", sizes=(), per_line=False, settled=False):
    results = results or ["open"] * len(odds)
    slip = Slip(bet_type, [Leg(o, r) for o, r in zip(odds, results)], money_to_santim(stake), tuple(sizes), per_line)
    base = {"case_id": case_id, "rules": rules, "bet_type": bet_type, "system_sizes": ";".join(map(str, sizes)),
            "stake": stake, "stake_is_per_line": str(per_line).lower(), "leg_odds": ";".join(odds),
            "leg_results": ";".join(results), "settled": str(settled).lower()}
    try:
        q = quote(slip, RULES[rules], settled)
    except SlipError as e:
        return {**base, "expected_error": e.code, **{c: "" for c in COLUMNS[10:]}}
    return {**base, "expected_error": "", "lines": q.lines, "stake_per_line": santim_to_money(q.stake_per_line),
            "total_stake": santim_to_money(q.total_stake), "stake_tax": santim_to_money(q.stake_tax),
            "net_stake": santim_to_money(q.net_stake), "total_odds": q.total_odds or "",
            "gross_payout": santim_to_money(q.gross_payout), "acca_bonus": santim_to_money(q.acca_bonus),
            "win_tax": santim_to_money(q.win_tax), "stake_tax_refund": santim_to_money(q.stake_tax_refund),
            "net_payout": santim_to_money(q.net_payout), "capped": str(q.capped).lower(),
            "warnings": ";".join(q.warnings)}

def hand_picked():
    D = "default_2026_10"
    r = []
    # The C07 worked example: must give 690.29
    r.append(row("WORKED_EXAMPLE_C07", D, "multiple", ["1.50"] * 5))
    # singles
    r.append(row("SINGLE_BASIC", D, "single", ["1.95"], stake="50.00"))
    r.append(row("SINGLE_THREE_LINES", D, "single", ["1.50", "2.00", "3.25"], stake="30.00"))
    r.append(row("SINGLE_REMAINDER", D, "single", ["1.50", "2.00", "3.25"], stake="100.00"))
    r.append(row("SINGLE_PER_LINE", D, "single", ["1.50", "2.00", "3.25"], stake="20.00", per_line=True))
    r.append(row("SINGLE_3DP_ODDS", D, "single", ["1.833"], stake="77.77"))
    # stake limits
    r.append(row("STAKE_BELOW_MIN", D, "single", ["2.00"], stake="4.99"))
    r.append(row("STAKE_AT_MIN", D, "single", ["2.00"], stake="5.00"))
    r.append(row("STAKE_AT_MAX", D, "single", ["2.00"], stake="50000.00"))
    r.append(row("STAKE_ABOVE_MAX", D, "single", ["2.00"], stake="50000.01"))
    r.append(row("PER_LINE_TOTAL_ABOVE_MAX", D, "single", ["2.00", "2.00"], stake="30000.00", per_line=True))
    # win-tax threshold edges (gross_win compared with 1,000.00; tax on the whole base when strictly greater)
    r.append(row("WIN_TAX_GROSS_EXACTLY_1000", D, "single", ["2.00"], stake="588.23"))
    r.append(row("WIN_TAX_GROSS_1000_02", D, "single", ["2.00"], stake="588.24"))
    r.append(row("WIN_TAX_GROSS_1000_04", D, "single", ["2.00"], stake="588.25"))
    r.append(row("WIN_TAX_BIG", D, "multiple", ["1.50"] * 5, stake="200.00"))
    # accumulator bonus
    r.append(row("ACCA_2_LEGS_NO_BONUS", D, "multiple", ["1.50", "1.50"]))
    r.append(row("ACCA_3_LEGS_3PCT", D, "multiple", ["1.50"] * 3))
    r.append(row("ACCA_LOW_ODDS_LEG_NOT_QUALIFYING", D, "multiple", ["1.50", "1.50", "1.29"]))
    r.append(row("ACCA_LEG_AT_MIN_ODDS_QUALIFIES", D, "multiple", ["1.50", "1.50", "1.30"]))
    r.append(row("ACCA_25_LEGS_TOP_TIER", D, "multiple", ["1.35"] * 25, stake="10.00"))
    r.append(row("ACCA_30_LEGS", D, "multiple", ["1.30"] * 30, stake="5.00"))
    r.append(row("ACCA_31_LEGS", D, "multiple", ["1.30"] * 31, stake="5.00"))
    r.append(row("ACCA_BONUS_CAPPED", "small_caps", "multiple", ["1.80"] * 4, stake="100.00"))
    # settlement: voids, losses, halves
    r.append(row("ACCA_ONE_VOID_SETTLED", D, "multiple", ["1.50", "2.00", "1.80"], ["win", "void", "win"], settled=True))
    r.append(row("ACCA_ONE_LOSS_SETTLED", D, "multiple", ["1.50", "2.00", "1.80"], ["win", "lose", "win"], settled=True))
    r.append(row("ACCA_HALF_WIN_NO_BONUS", D, "multiple", ["1.90", "1.90", "1.90"], ["win", "half_win", "win"], settled=True))
    r.append(row("ACCA_HALF_LOSE", D, "multiple", ["1.90", "1.90", "1.90"], ["win", "half_lose", "win"], settled=True))
    r.append(row("ACCA_ALL_VOID", D, "multiple", ["1.90", "1.90", "1.90"], ["void"] * 3, settled=True))
    r.append(row("ACCA_ALL_VOID_REFUND_TAX", "net_win_tax_refund_void", "multiple", ["1.90", "1.90", "1.90"], ["void"] * 3, settled=True))
    r.append(row("ACCA_VOID_DROPS_BONUS_TIER", D, "multiple", ["1.50"] * 5, ["win", "win", "win", "win", "void"], settled=True))
    r.append(row("ACCA_PREVIEW_WITH_SETTLED_LEG", D, "multiple", ["1.50", "1.50", "1.50"], ["win", "open", "open"]))
    r.append(row("SETTLED_WITH_OPEN_LEG_ERROR", D, "multiple", ["1.50", "1.50"], ["win", "open"], settled=True))
    r.append(row("SINGLE_HALF_WIN", D, "single", ["1.90"], ["half_win"], stake="100.00", settled=True))
    r.append(row("SINGLE_VOID", D, "single", ["1.90"], ["void"], stake="100.00", settled=True))
    # systems
    for name, (n, sizes) in NAMED_SYSTEMS.items():
        odds = ["1.50", "2.00", "2.50", "1.80", "3.00", "1.70"][:n]
        r.append(row(f"SYSTEM_{name}", D, "system", odds, sizes=sizes, stake="100.00"))
        results = ["win", "lose"] + ["win"] * (n - 2)
        r.append(row(f"SYSTEM_{name}_ONE_LOSS", D, "system", odds, results, sizes=sizes, stake="100.00", settled=True))
    r.append(row("SYSTEM_INVALID_SIZE", D, "system", ["1.50", "2.00", "2.50"], sizes=[4]))
    r.append(row("SYSTEM_ONLY_FULL_SIZE_INVALID", D, "system", ["1.50", "2.00", "2.50"], sizes=[3]))
    r.append(row("SYSTEM_UNSORTED_INVALID", D, "system", ["1.50", "2.00", "2.50"], sizes=[3, 2]))
    r.append(row("SYSTEM_TOO_MANY_LINES", "small_caps", "system", ["1.50"] * 10, sizes=[5], stake="500.00"))
    r.append(row("SYSTEM_STAKE_TOO_SMALL_PER_LINE", D, "system", ["1.50"] * 10, sizes=[5], stake="5.00"))
    # payout cap
    r.append(row("CAP_SINGLE", "small_caps", "single", ["50.00"], stake="100.00"))
    r.append(row("CAP_BONUS_THEN_GROSS", "small_caps", "multiple", ["1.60", "1.60", "1.60"], stake="700.00"))
    r.append(row("CAP_BONUS_ONLY_CUT", "small_caps", "multiple", ["1.60", "1.60", "1.60"], stake="569.00"))
    r.append(row("CAP_DEFAULT_HUGE_ODDS", D, "multiple", ["9.00"] * 8, stake="1000.00"))
    # net_win tax and operator levy
    r.append(row("NET_WIN_TAX_SINGLE", "net_win_tax_refund_void", "single", ["2.50"], stake="100.00"))
    r.append(row("NET_WIN_TAX_LOSS_NO_TAX", "net_win_tax_refund_void", "single", ["2.50"], ["lose"], stake="100.00", settled=True))
    # validation
    r.append(row("MULTIPLE_ONE_LEG_INVALID", D, "multiple", ["1.50"]))
    r.append(row("ODDS_BELOW_1_01_INVALID", D, "single", ["1.00"]))
    r.append(row("ODDS_4DP_INVALID", D, "single", ["1.8333"]))
    # no-tax sanity
    r.append(row("NO_TAX_SINGLE", "no_tax", "single", ["2.00"], stake="100.00"))
    r.append(row("NO_TAX_ACCA", "no_tax", "multiple", ["1.25", "1.40", "1.65", "2.05"], stake="37.50"))
    return r

def random_cases(n=300, seed=20261001):
    rnd = random.Random(seed)
    rows = []
    rule_names = ["default_2026_10", "default_2026_10", "default_2026_10", "no_tax", "net_win_tax_refund_void", "small_caps"]
    for i in range(n):
        rules = rnd.choice(rule_names)
        kind = rnd.choices(["single", "multiple", "system"], [3, 5, 2])[0]
        if kind == "single":
            legs = rnd.randint(1, 4)
        elif kind == "multiple":
            legs = rnd.randint(2, 12)
        else:
            legs = rnd.randint(3, 6)
        odds = [f"{rnd.uniform(1.05, 6.0):.{rnd.choice([2, 2, 2, 3])}f}" for _ in range(legs)]
        settled = rnd.random() < 0.5
        if settled:
            results = rnd.choices(["win", "lose", "void", "half_win", "half_lose"], [10, 4, 1, 1, 1], k=legs)
        else:
            results = ["open"] * legs
        sizes = ()
        if kind == "system":
            k = rnd.randint(1, legs - 1)
            sizes = sorted(set([k] + ([k + 1] if rnd.random() < 0.3 and k + 1 < legs else [])))
        stake = f"{rnd.choice([5, 10, 20, 37, 50, 100, 250, 999, 1500])}.{rnd.choice(['00', '00', '50', '33', '99'])}"
        per_line = kind != "multiple" and rnd.random() < 0.2
        rows.append(row(f"RND_{i:03d}", rules, kind, odds, results, stake, sizes, per_line, settled))
    return rows

def render(rows):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=COLUMNS, lineterminator="\n")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    return buf.getvalue()

if __name__ == "__main__":
    text = render(hand_picked() + random_cases())
    target = HERE / "slips.csv"
    if "--check" in sys.argv:
        if target.read_text() != text:
            sys.exit("slips.csv is out of date: run python3 generate.py and review the diff")
        print("slips.csv is up to date")
    else:
        target.write_text(text)
        print(f"wrote {text.count(chr(10)) - 1} rows")
