/**
 * n choose k — how many lines a k/n system places. A count, not money: the
 * combinations themselves, and every figure from them, are slipcalc's (D1).
 */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  // Exact at every step: r × (n − i + 1) is always divisible by i.
  for (let i = 1; i <= k; i++) r = (r * (n - i + 1)) / i;
  return r;
}
