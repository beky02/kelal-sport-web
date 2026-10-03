import { money } from "@golden/slipcalc";

/**
 * Money outside the slip calculator (FD4).
 *
 * Amounts stay the contract's decimal strings (`"1250.00"`); anything that has
 * to compare or add them comes here and works in BigInt santim, with slipcalc's
 * rule: parse exactly, floor extra decimals to the santim. The slip's own
 * figures are slipcalc's (D1), never computed here.
 *
 * The parse mirrors slipcalc's private `santim()`; the format *is* its exported
 * `money()`. `tests/unit/money.test.ts` pins the two together over every amount
 * in `contracts/golden/slips.csv`.
 */

const DECIMAL = /^-?\d+(\.\d+)?$/;

/** `"12.345"` → `1234n`. Throws on anything but a plain decimal. */
export function toSantim(amount: string): bigint {
  if (!DECIMAL.test(amount)) throw new RangeError(`Not an amount: "${amount}"`);
  const negative = amount.startsWith("-");
  const [whole, fraction = ""] = amount.replace("-", "").split(".");
  const cents = BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
  if (!negative) return cents;
  // Floor, not truncate: -0.001 is -1 santim, as in slipcalc.
  return /[1-9]/.test(fraction.slice(2)) ? -cents - 1n : -cents;
}

/** `1234n` → `"12.34"` — slipcalc's own formatter. */
export const fromSantim = (santim: bigint): string => money(santim);

/**
 * An amount as a player types it: digits, one point, two decimals at most —
 * `"0012.345x"` → `"12.34"`. A stake on the slip, a deposit in the wallet.
 */
export function sanitiseAmount(raw: string): string {
  const [whole = "", ...rest] = raw.replace(/[^\d.]/g, "").split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  return rest.length
    ? `${integer || "0"}.${rest.join("").slice(0, 2)}`
    : integer;
}

/** `"100"` → `"100.00"`. */
export const normaliseMoney = (amount: string): string =>
  fromSantim(toSantim(amount));

const sign = (n: bigint): -1 | 0 | 1 => (n < 0n ? -1 : n > 0n ? 1 : 0);

export const compareMoney = (a: string, b: string): -1 | 0 | 1 =>
  sign(toSantim(a) - toSantim(b));

export const addMoney = (...amounts: string[]): string =>
  fromSantim(amounts.reduce((sum, a) => sum + toSantim(a), 0n));

/** An amount times a whole number, e.g. a minimum per line × lines. */
export const mulMoney = (amount: string, times: number): string =>
  fromSantim(toSantim(amount) * BigInt(times));

/** The smallest multiple of `n` santim at or above `amount`. */
export const roundUpToMultiple = (amount: string, n: number): string => {
  const santim = toSantim(amount);
  const step = BigInt(n);
  return fromSantim(((santim + step - 1n) / step) * step);
};

export const maxMoney = (a: string, b: string): string =>
  compareMoney(a, b) >= 0 ? a : b;

/**
 * `numerator / denominator` of an amount, floored to the santim. Display only —
 * a partial cash-out's real amount is the server's.
 */
export const share = (
  amount: string,
  numerator: number,
  denominator: number,
): string =>
  fromSantim((toSantim(amount) * BigInt(numerator)) / BigInt(denominator));

/** Odds have at most three decimals; compared in thousandths. */
function toThousandths(odds: string): bigint {
  if (!DECIMAL.test(odds)) throw new RangeError(`Not odds: "${odds}"`);
  const [whole, fraction = ""] = odds.split(".");
  return BigInt(whole) * 1000n + BigInt((fraction + "000").slice(0, 3));
}

/** `"2.1"` and `"2.10"` are the same price. */
export const compareOdds = (a: string, b: string): -1 | 0 | 1 =>
  sign(toThousandths(a) - toThousandths(b));

/**
 * Odds moved by a whole percentage, floored to two decimals and never below
 * 1.01. For the development odds simulator, not for pricing.
 */
export function scaleOdds(odds: string, percent: number): string {
  const hundredths = (toThousandths(odds) * BigInt(100 + percent)) / 1000n;
  const price = hundredths < 101n ? 101n : hundredths;
  return `${price / 100n}.${(price % 100n).toString().padStart(2, "0")}`;
}
