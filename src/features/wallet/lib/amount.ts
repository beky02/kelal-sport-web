import type { ApiError } from "@/lib/api/errors";
import { MONEY_PATTERN } from "@/lib/api/patterns";
import { compareMoney, normaliseMoney, toSantim } from "@/lib/money";
import type { AmountRange } from "../types";

/** A typed amount as the contract's `Money`, or null while it isn't one yet. */
export function typedAmount(amount: string): string | null {
  const value = amount.replace(/\.$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return toSantim(value) > 0n ? normaliseMoney(value) : null;
}

export type AmountProblem = "empty" | "below" | "above";

/**
 * What stops a typed amount going to the API: nothing typed yet, or outside
 * a method's limits — compared as strings (FD4), never as floats. The API
 * checks again; this only saves the player a round trip. Deposits and
 * withdrawals alike, each against its own range.
 */
export function amountProblem(
  amount: string,
  range: AmountRange,
): AmountProblem | null {
  const value = typedAmount(amount);
  if (value === null) return "empty";
  if (compareMoney(value, range.min) < 0) return "below";
  if (compareMoney(value, range.max) > 0) return "above";
  return null;
}

const distance = (a: string, b: string): bigint => {
  const d = toSantim(a) - toSantim(b);
  return d < 0n ? -d : d;
};

/**
 * The amount to offer when the API refuses one as out of range: of the
 * limits it gives for the amount, the one nearest the refused amount — the
 * side it fell on — and only one the method's `range` takes and, for a
 * withdrawal, the cash balance (`ceiling`) covers; else the method's own
 * limit on that side, on the same terms. Null when nothing qualifies: the
 * player changes the amount themselves.
 */
export function nearestAllowedAmount(
  error: ApiError,
  range: AmountRange,
  amount: string,
  ceiling?: string,
): string | null {
  const allowed = (value: string) =>
    amountProblem(value, range) === null &&
    (ceiling === undefined || compareMoney(value, ceiling) <= 0);
  const limits = error.errors
    .filter((e) => e.field === "amount")
    .map((e) => e.limit)
    .filter(
      (limit): limit is string =>
        limit !== undefined &&
        MONEY_PATTERN.test(limit) &&
        compareMoney(limit, amount) !== 0 &&
        allowed(limit),
    )
    .sort((a, b) => {
      const da = distance(a, amount);
      const db = distance(b, amount);
      return da < db ? -1 : da > db ? 1 : 0;
    });
  if (limits.length > 0) return limits[0];
  const side =
    compareMoney(amount, range.min) < 0
      ? range.min
      : compareMoney(amount, range.max) > 0
        ? range.max
        : null;
  return side !== null && allowed(side) ? side : null;
}
