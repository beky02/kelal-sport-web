/**
 * TypeScript port of contracts/golden/reference_slipcalc.py (C07).
 * Drop into client/web/packages/slipcalc/src/. Exact arithmetic with BigInt rationals:
 * no floating point anywhere. Must pass every row of contracts/golden/slips.csv.
 */

export type LegResult = "open" | "win" | "lose" | "void" | "half_win" | "half_lose";
export type BetType = "single" | "multiple" | "system";

export interface TaxRuleJson { code: string; base: "stake" | "gross_win" | "net_win" | "profit"; rate: string; threshold?: string; deduct_from: "stake" | "payout" | "operator"; }
export interface RuleSetJson {
  min_stake: string; max_stake: string; max_payout: string; max_legs: number; max_lines: number;
  acca_bonus_table: { min_legs: number; pct: string }[]; acca_bonus_min_leg_odds: string; acca_bonus_max: string;
  taxes: TaxRuleJson[]; refund_stake_tax_on_void?: boolean;
}
export interface Leg { odds: string; result?: LegResult }
export interface Slip { betType: BetType; legs: Leg[]; stake: string; systemSizes?: number[]; stakeIsPerLine?: boolean }
export interface Quote {
  lines: number; stakePerLine: string; totalStake: string; stakeTax: string; netStake: string; totalOdds: string | null;
  grossPayout: string; accaBonus: string; taxes: Record<string, string>; winTax: string; stakeTaxRefund: string;
  netPayout: string; capped: boolean; warnings: string[];
}
export class SlipError extends Error { constructor(public code: string) { super(code); } }

// ---------------------------------------------------------------- exact rationals (n/d, d > 0)
type Q = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const q = (n: bigint, d = 1n): Q => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; };
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const cmp = (a: Q, b: Q) => { const l = a.n * b.d, r = b.n * a.d; return l < r ? -1 : l > r ? 1 : 0; };
const floorQ = (a: Q): bigint => { const f = a.n / a.d; return a.n % a.d !== 0n && a.n < 0n ? f - 1n : f; };
const dec = (s: string): Q => {
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new SlipError("VALIDATION_FAILED");
  const neg = s.startsWith("-"); const [w, f = ""] = s.replace("-", "").split(".");
  const v = q(BigInt(w + f), 10n ** BigInt(f.length)); return neg ? q(-v.n, v.d) : v;
};
const santim = (s: string): bigint => floorQ(mul(dec(s), q(100n)));
export const money = (v: bigint): string => { const neg = v < 0n; const a = neg ? -v : v; return `${neg ? "-" : ""}${a / 100n}.${(a % 100n).toString().padStart(2, "0")}`; };

function combos(n: number, k: number): number[][] {
  const out: number[][] = []; const cur: number[] = [];
  const rec = (start: number) => { if (cur.length === k) { out.push([...cur]); return; } for (let i = start; i < n; i++) { cur.push(i); rec(i + 1); cur.pop(); } };
  rec(0); return out;
}

function effective(leg: Leg): Q {
  const o = dec(leg.odds);
  switch (leg.result ?? "open") {
    case "open": case "win": return o;
    case "lose": return q(0n);
    case "void": return q(1n);
    case "half_win": return mul(add(o, q(1n)), q(1n, 2n));
    case "half_lose": return q(1n, 2n);
  }
}

export function quote(slip: Slip, rules: RuleSetJson, settled = false): Quote {
  const legs = slip.legs.map((l) => ({ ...l, result: l.result ?? "open" as LegResult }));
  const n = legs.length; const sizes = slip.systemSizes ?? [];
  // validation
  if (n === 0) throw new SlipError("VALIDATION_FAILED");
  if (n > rules.max_legs) throw new SlipError("BET_TOO_MANY_LEGS");
  if (slip.betType === "multiple" && n < 2) throw new SlipError("VALIDATION_FAILED");
  if (slip.betType === "system") {
    const sorted = [...new Set(sizes)].sort((a, b) => a - b);
    if (!sizes.length || sorted.join() !== sizes.join() || sizes[0] < 1 || sizes[sizes.length - 1] > n || (sizes.length === 1 && sizes[0] === n))
      throw new SlipError("VALIDATION_FAILED");
  } else if (sizes.length) throw new SlipError("VALIDATION_FAILED");
  for (const l of legs) {
    const o = dec(l.odds);
    if (cmp(o, q(101n, 100n)) < 0 || mul(o, q(1000n)).d !== 1n) throw new SlipError("VALIDATION_FAILED");
    if (settled && l.result === "open") throw new SlipError("VALIDATION_FAILED");
  }
  const lineSets = slip.betType === "single" ? legs.map((_, i) => [i]) : slip.betType === "multiple" ? [legs.map((_, i) => i)] : sizes.flatMap((k) => combos(n, k));
  const lines = BigInt(lineSets.length);
  if (lineSets.length > rules.max_lines) throw new SlipError("BET_TOO_MANY_LINES");
  const warnings: string[] = [];

  // 1. stake per line
  const stakeIn = santim(slip.stake);
  const stakeLine = slip.stakeIsPerLine ? stakeIn : stakeIn / lines;
  if (stakeLine < 1n) throw new SlipError("BET_STAKE_TOO_LOW");
  const totalStake = stakeLine * lines;
  if (!slip.stakeIsPerLine && totalStake !== stakeIn) warnings.push("STAKE_REMAINDER_NOT_CHARGED");
  if (totalStake < santim(rules.min_stake)) throw new SlipError("BET_STAKE_TOO_LOW");
  if (totalStake > santim(rules.max_stake)) throw new SlipError("BET_STAKE_TOO_HIGH");

  // 2. stake taxes per line
  const taxes: Record<string, bigint> = {};
  let taxLine = 0n;
  for (const t of rules.taxes) {
    if (t.base === "stake" && t.deduct_from === "stake" && totalStake > santim(t.threshold ?? "0.00")) {
      const amt = floorQ(mul(q(stakeLine), dec(t.rate)));
      taxes[t.code] = (taxes[t.code] ?? 0n) + amt * lines; taxLine += amt;
    }
  }
  const stakeTax = taxLine * lines; const netLine = stakeLine - taxLine; const netStake = netLine * lines;

  // 3. gross
  let gross = 0n;
  for (const set of lineSets) { let p = q(1n); for (const i of set) p = mul(p, effective(legs[i])); gross += floorQ(mul(q(netLine), p)); }

  // 4. accumulator bonus
  let bonus = 0n;
  if (slip.betType === "multiple") {
    const nonVoid = legs.filter((l) => l.result !== "void");
    const allWinning = nonVoid.every((l) => l.result === "open" || l.result === "win");
    const minOdds = dec(rules.acca_bonus_min_leg_odds);
    const qualifying = nonVoid.filter((l) => cmp(dec(l.odds), minOdds) >= 0).length;
    let pct = q(0n);
    for (const tier of [...rules.acca_bonus_table].sort((a, b) => a.min_legs - b.min_legs)) if (qualifying >= tier.min_legs) pct = dec(tier.pct);
    const profit = gross - netStake;
    if (allWinning && pct.n > 0n && profit > 0n) {
      bonus = floorQ(mul(q(profit), mul(pct, q(1n, 100n))));
      const max = santim(rules.acca_bonus_max);
      if (bonus > max) { bonus = max; warnings.push("ACCA_BONUS_CAPPED"); }
    }
  }

  // 5. payout cap on the pre-tax payout: bonus first, then gross
  let capped = false; const maxPayout = santim(rules.max_payout);
  if (gross + bonus > maxPayout) {
    capped = true; const excess = gross + bonus - maxPayout; const cut = bonus < excess ? bonus : excess;
    bonus -= cut; gross -= excess - cut; warnings.push("MAX_PAYOUT_REACHED");
  }

  // 6. payout taxes
  const bases: Record<string, bigint> = { stake: totalStake, gross_win: gross + bonus, net_win: gross + bonus - netStake, profit: gross + bonus - totalStake };
  let deducted = 0n, winTax = 0n;
  for (const t of rules.taxes) {
    if (t.base === "stake") continue;
    const b = bases[t.base];
    if (b > santim(t.threshold ?? "0.00") && b > 0n) {
      const amt = floorQ(mul(q(b), dec(t.rate)));
      taxes[t.code] = (taxes[t.code] ?? 0n) + amt;
      if (t.deduct_from === "payout") { deducted += amt; winTax += amt; }
    }
  }
  let net = gross + bonus - deducted;

  // 7. all-void stake-tax refund
  let refund = 0n;
  if (settled && legs.every((l) => l.result === "void") && rules.refund_stake_tax_on_void) { refund = stakeTax; net += refund; }

  let totalOdds: string | null = null;
  if (lineSets.length === 1) { let p = q(1n); for (const l of legs) p = mul(p, dec(l.odds)); totalOdds = money(floorQ(mul(p, q(100n)))); }

  return {
    lines: lineSets.length, stakePerLine: money(stakeLine), totalStake: money(totalStake), stakeTax: money(stakeTax), netStake: money(netStake),
    totalOdds, grossPayout: money(gross), accaBonus: money(bonus), taxes: Object.fromEntries(Object.entries(taxes).map(([k, v]) => [k, money(v)])),
    winTax: money(winTax), stakeTaxRefund: money(refund), netPayout: money(net), capped, warnings,
  };
}
