// Deliberately wrong: money parsed into a float. `tests/unit/money-lint.test.ts`
// lints this file and expects the FD4 rule to refuse each line.
export const stake = "100.00";
export const odds = "2.10";
export const parsed = parseFloat(stake);
export const numbered = Number(odds);
export const unary = +stake;
