/**
 * Products of every k-sized subset of `values`, in lexicographic order.
 *
 * A system bet is every k-fold combination of the selections placed as its own
 * multiple, so a 2/4 system is six separate bets. This returns one product per
 * bet, which is all the payout maths needs.
 */
export function combinationProducts(
  values: readonly number[],
  k: number,
): number[] {
  if (k <= 0 || k > values.length) return [];

  const out: number[] = [];
  const walk = (start: number, chosen: number[]): void => {
    if (chosen.length === k) {
      out.push(chosen.reduce((a, b) => a * b, 1));
      return;
    }
    for (let i = start; i < values.length; i++) {
      chosen.push(values[i]);
      walk(i + 1, chosen);
      chosen.pop();
    }
  };
  walk(0, []);
  return out;
}

/** n choose k. */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - i + 1)) / i;
  return Math.round(r);
}
