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
