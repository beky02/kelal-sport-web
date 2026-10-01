// Deliberately wrong: money parsed into a float. `tests/unit/money-lint.test.ts`
// lints this file and expects the FD4 rule to refuse every line from 8 on.
declare const bet: { stake: string; odds: string } | undefined;
export const stake = "100.00";
export const odds = "2.10";
export const ok = Number("3"); // not money: allowed

export const parsed = parseFloat(stake);
export const numbered = Number(odds);
export const unary = +stake;
export const chained = Number(bet?.stake);
export const cast = Number(stake as string);
export const computed = Number(bet!["odds"]);
export const integer = parseInt(stake, 10);
export const templated = Number(`${stake}`);
